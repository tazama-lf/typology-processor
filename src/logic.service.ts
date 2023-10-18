/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import apm from './apm';
import { databaseManager, server, loggerService } from '.';
import { type RuleResult, type NetworkMap, type Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { type TypologyResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/TypologyResult';
import { type CADPRequest } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/CADPRequest';
import { configuration } from './config';
import { type IExpression, type IRuleValue, type ITypologyExpression } from './interfaces/iTypologyExpression';
import { type MetaData } from './interfaces/metaData';

const calculateDuration = (startTime: bigint): number => {
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime);
};

const noDescription = 'No description provided in typology config.';

const evaluateTypologyExpression = (ruleValues: IRuleValue[], ruleResults: RuleResult[], typologyExpression: IExpression): number => {
  let toReturn = 0.0;
  // eslint-disable-next-line @typescript-eslint/no-for-in-array
  for (const rule in typologyExpression.terms) {
    const ruleResult = ruleResults.find((r) => r.id === typologyExpression.terms[rule].id && r.cfg === typologyExpression.terms[rule].cfg);
    let ruleVal = 0.0;
    if (!ruleResult) return ruleVal;
    if (ruleResult.result)
      ruleVal = Number(
        ruleValues.find(
          (rv) =>
            rv.id === typologyExpression.terms[rule].id &&
            rv.cfg === typologyExpression.terms[rule].cfg &&
            rv.ref === ruleResult.subRuleRef,
        )?.true ?? 0.0,
      );
    else
      ruleVal = Number(
        ruleValues.find(
          (rv) =>
            rv.id === typologyExpression.terms[rule].id &&
            rv.cfg === typologyExpression.terms[rule].cfg &&
            rv.ref === ruleResult.subRuleRef,
        )?.false ?? 0.0,
      );
    ruleResult.wght = ruleVal;
    switch (typologyExpression.operator) {
      case '+':
        toReturn += ruleVal;
        break;
      case '-':
        toReturn -= ruleVal;
        break;
      case '*':
        toReturn *= ruleVal;
        break;
      case '/':
        if (ruleVal === 0.0) break;
        toReturn /= ruleVal;
        break;
    }
  }
  if (typologyExpression.expression) {
    const evalRes = evaluateTypologyExpression(ruleValues, ruleResults, typologyExpression.expression);
    switch (typologyExpression.operator) {
      case '+':
        toReturn += evalRes;
        break;
      case '-':
        toReturn -= evalRes;
        break;
      case '*':
        toReturn *= evalRes;
        break;
      case '/':
        if (evalRes === 0.0) break;
        toReturn /= evalRes;
        break;
    }
  }
  return toReturn;
};

const executeRequest = async (
  transaction: any,
  typology: Typology,
  ruleResult: RuleResult,
  ruleId: string,
  networkMap: NetworkMap,
  channelHost: string,
  metaData: MetaData,
): Promise<void> => {
  const startTime = process.hrtime.bigint();

  const typologyResult: TypologyResult = {
    result: 0.0,
    id: typology.id,
    cfg: typology.cfg,
    threshold: 0.0,
    prcgTm: 0,
    ruleResults: [],
    workflow: {
      alertThreshold: '',
      interdictionThreshold: '',
    },
  };

  const cadpReqBody: CADPRequest = {
    typologyResult,
    transaction,
    networkMap,
  };
  const spanExecReq = apm.startSpan(`${typologyResult.id}.exec.Req`);

  try {
    const transactionType = 'FIToFIPmtSts';
    const transactionID = transaction[transactionType].GrpHdr.MsgId;
    const cacheKey = `TP_${transactionID}_${typology.id}_${typology.cfg}`;
    const jruleResultsCount = await databaseManager.addOneGetCount(`${cacheKey}`, { ruleResult: { ...ruleResult } });

    if (jruleResultsCount && jruleResultsCount < typology.rules.length) {
      typologyResult.prcgTm = calculateDuration(startTime);
      spanExecReq?.end();
      return;
    }

    const jruleResults = await databaseManager.getMemberValues(`${cacheKey}`);
    const ruleResults: RuleResult[] = jruleResults.map((res) => res.ruleResult as RuleResult);

    cadpReqBody.typologyResult.ruleResults = ruleResults;

    const expressionRes = (await databaseManager.getTypologyExpression(typology)) as unknown[][];
    if (!expressionRes?.[0]?.[0]) {
      loggerService.warn(`No Typology Expression found for Typology ${typology.id}@${typology.cfg}`);
      typologyResult.prcgTm = calculateDuration(startTime);
      spanExecReq?.end();
      return;
    }

    const expression = expressionRes[0][0] as ITypologyExpression;
    const span = apm.startSpan(`[${transactionID}] eval.typology.expr`);
    const typologyResultValue = evaluateTypologyExpression(expression.rules, ruleResults, expression.expression);
    span?.end();

    typologyResult.result = typologyResultValue;
    // typologyResult.desc = expression.desc?.length ? expression.desc : noDescription;
    typologyResult.prcgTm = calculateDuration(startTime);
    typologyResult.review = false;
    cadpReqBody.typologyResult = typologyResult;
    typologyResult.workflow.interdictionThreshold = expression.workflow.interdictionThreshold ?? '';

    // Interdiction
    // Send Result to CMS
    if (expression.workflow.interdictionThreshold && typologyResultValue >= Number(expression.workflow.interdictionThreshold)) {
      const spanCms = apm.startSpan(`[${transactionID}] Send Typology result to CMS`);
      typologyResult.review = true;
      server
        .handleResponse({ ...cadpReqBody, metaData }, [configuration.cmsProducer])
        .catch((error) => {
          loggerService.error(`Error while sending Typology result to CMS`, error as Error);
        })
        .finally(() => {
          spanCms?.end();
        });
    }

    if (!expression.workflow.alertThreshold && Number(expression.workflow.alertThreshold) !== 0) {
      loggerService.error(`Typology ${typology.cfg} config missing alert Threshold`);
    } else if (typologyResultValue >= Number(expression.workflow.alertThreshold)) {
      typologyResult.workflow.alertThreshold = expression.workflow.alertThreshold;
      loggerService.log(`Typology ${typology.cfg} alerting on transaction : ${transactionID} with a trigger of: ${typologyResultValue}`);
      typologyResult.review = true;
    }

    // Send TADP request with this Typology's result
    const spanTadpr = apm.startSpan(`[${transactionID}] Send Typology result to TADP`);
    server
      .handleResponse({ ...cadpReqBody, metaData })
      .catch((error) => {
        loggerService.error(`Error while sending Typology result to TADP`, error as Error);
      })
      .finally(() => {
        spanTadpr?.end();
      });

    const spanDelete = apm.startSpan(`cache.delete.[${transactionID}].Typology interim cache key`);
    await databaseManager.deleteKey(cacheKey);
    spanDelete?.end();
  } catch (error) {
    loggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
  } finally {
    loggerService.log(`Concluded processing of Rule ${ruleId}`);
    spanExecReq?.end();
  }
};

export const handleTransaction = async (transaction: any): Promise<void> => {
  let typologyCounter = 0;
  const metaData = transaction.metaData;
  loggerService.log(`traceParent in typroc: ${JSON.stringify(metaData?.traceParent)}`);
  const apmTransaction = apm.startTransaction('typroc.handleTransaction', {
    childOf: metaData?.traceParent,
  });
  const networkMap: NetworkMap = transaction.networkMap;
  const ruleResult: RuleResult = transaction.ruleResult;

  const parsedTrans = transaction.transaction;

  const requests = [];

  const spanCadpRes = apm.startSpan('cadproc.sendReq');
  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.id))) {
      // will loop through every Typology here
      typologyCounter++;
      const channelHost = channel.host;

      requests.push(
        executeRequest(parsedTrans, typology, ruleResult, ruleResult.id, networkMap, channelHost, {
          ...metaData,
          traceParent: apm.getCurrentTraceparent(),
        }),
      );
    }
  }

  await Promise.all(requests);
  spanCadpRes?.end();

  const transactionType = 'FIToFIPmtSts';
  const transactionID = parsedTrans[transactionType].GrpHdr.MsgId;
  const result = `${typologyCounter} typologies initiated for transaction ID: ${transactionID}`;
  loggerService.log(`${result} for Rule ${ruleResult.id}`);
  apmTransaction?.end();
};
