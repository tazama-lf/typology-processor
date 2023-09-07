/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import apm from './apm';
import axios from 'axios';
import { databaseManager, server, loggerService } from '.';
import { RuleResult, type NetworkMap, type Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';
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
  transaction: any, // eslint-disable-line
  typology: Typology,
  ruleResult: RuleResult,
  networkMap: NetworkMap,
  channelHost: string,
  metaData: MetaData,
): Promise<void> => {
  const startTime = process.hrtime.bigint();

  const typologyResult: TypologyResult = {
    result: 0.0,
    id: typology.id,
    cfg: typology.cfg,
    desc: '',
    threshold: 0.0,
    prcgTm: 0,
    ruleResults: [],
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
    const jruleResultsCount = await databaseManager.addOneGetCount(`${cacheKey}`, JSON.stringify(ruleResult));

    if (jruleResultsCount && jruleResultsCount < typology.rules.length) {
      typologyResult.desc = typology.desc ? typology.desc : noDescription;
      typologyResult.prcgTm = calculateDuration(startTime);
      spanExecReq?.end();
      return;
    }

    const jruleResults = await databaseManager.getMembers(`${cacheKey}`);
    const ruleResults: RuleResult[] = [];
    // Get cache from Redis if we have
    if (jruleResults && jruleResults.length > 0) {
      for (const jruleResult of jruleResults) {
        const ruleRes: RuleResult = new RuleResult();
        Object.assign(ruleRes, JSON.parse(jruleResult));
        ruleResults.push(ruleRes);
      }
    }
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
    typologyResult.threshold = expression?.threshold ?? 0.0;
    typologyResult.desc = expression.desc?.length ? expression.desc : noDescription;
    typologyResult.prcgTm = calculateDuration(startTime);
    cadpReqBody.typologyResult = typologyResult;

    // Interdiction
    // Send Result to CMS
    if (expression.threshold && typologyResultValue > expression.threshold) {
      const spanSendToTms = apm.startSpan(`[${transactionID}] Interdiction - Send Typology result to CMS`);
      executePost(configuration.cmsEndpoint, cadpReqBody)
        .then(() => {
          spanSendToTms?.end();
        })
        .catch((error) => {
          spanSendToTms?.end();
          loggerService.error('Error while sending Typology result to CMS', error as Error);
        });
    }

    // Send CADP request with this Typology's result
    const spanCadpr = apm.startSpan(`[${transactionID}] Send Typology result to CADP`);
    server
      .handleResponse({ ...cadpReqBody, metaData })
      .then(() => {
        spanCadpr?.end();
      })
      .catch((error) => {
        spanCadpr?.end();
        loggerService.error('Error while sending Typology result to CADP', error as Error);
      });

    const spanDelete = apm.startSpan(`cache.delete.[${transactionID}].Typology interim cache key`);
    await databaseManager.deleteKey(cacheKey);
    spanDelete?.end();
  } catch (error) {
    loggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
  } finally {
    loggerService.log(`Concluded processing of Rule ${ruleResult.id}`);
    spanExecReq?.end();
  }
  return; // eslint-disable-line
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const handleTransaction = async (transaction: any): Promise<void> => {
  // eslint-disable-line
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
        executeRequest(parsedTrans, typology, ruleResult, networkMap, channelHost, {
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

// Submit the score to the CADP/CMS
const executePost = async (endpoint: string, request: CADPRequest): Promise<void> => {
  const span = apm.startSpan('send.cadp/cms');
  try {
    const cadpRes = await axios.post(endpoint, request);
    if (cadpRes.status !== 200) {
      loggerService.error(`Response StatusCode != 200, request:\r\n${JSON.stringify(request)}`);
    }
  } catch (error) {
    loggerService.error(`Error while sending request to ${endpoint ?? ''} with message: ${error}`);
    loggerService.trace(`Axios Post Error Request:\r\n${JSON.stringify(request)}`);
    span?.end();
    throw error;
  } finally {
    span?.end();
  }
};
