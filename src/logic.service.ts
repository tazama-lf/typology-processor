// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-explicit-any */
import apm from './apm';
import { databaseManager, server, loggerService } from '.';
import { type RuleResult, type NetworkMap } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { type TypologyResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/TypologyResult';
import { type CADPRequest } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/CADPRequest';
import { configuration } from './config';
import { type IExpression, type IRuleValue, type ITypologyExpression } from './interfaces/iTypologyExpression';
import { CalculateDuration } from '@frmscoe/frms-coe-lib/lib/helpers/calculatePrcg';
import { type MetaData } from './interfaces/metaData';

// Util #1
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

// Util #2
const getUniqueRulesCount = (networkMap: NetworkMap): number => {
  const uniqueIdsRules: string[] = [];

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies) {
      for (const rule of typology.rules) {
        if (!uniqueIdsRules.includes(rule.id)) {
          uniqueIdsRules.push(rule.id);
        }
      }
    }
  }
  return uniqueIdsRules.length;
};

// Step 1
const saveToRedisGetAll = async (transactionId: any, ruleResult: RuleResult): Promise<RuleResult[] | undefined> => {
  const currentlyStoredRuleResult = await databaseManager.addOneGetAll(transactionId, { ruleResult: { ...ruleResult } });
  const ruleResults: RuleResult[] | undefined = currentlyStoredRuleResult.map((res) => res.ruleResult as RuleResult);
  return ruleResults;
};

// Step 2
const ruleResultAggregation = (networkMap: NetworkMap, ruleList: RuleResult[]): TypologyResult[] => {
  const typologyResult: TypologyResult[] = [];

  networkMap.messages.forEach((message) => {
    message.channels.forEach((channel) => {
      channel.typologies.forEach((typology) => {
        typologyResult.push({
          id: typology.id,
          cfg: typology.cfg,
          result: -1,
          ruleResults: ruleList.filter((rRule) => typology.rules.some((tRule) => rRule.id === tRule.id)),
          workflow: { alertThreshold: -1 },
        });
      });
    });
  });

  return typologyResult;
};

// Step 3
const evaluateTypologySendRequest = async (
  typologyResults: TypologyResult[],
  networkMap: NetworkMap,
  transaction: any,
  metaData: MetaData,
  transactionId: string,
): Promise<CADPRequest | undefined> => {
  let cadpReqBody: CADPRequest = { networkMap, transaction, typologyResult: typologyResults[0] };
  for (let index = 0; index < typologyResults.length; index++) {
    const jsentAlready = (await databaseManager.getMemberValues(`alreadySent_${transactionId}`)).map((res) => res.alreadySent as string);

    // Already has been sent to TADProc continue with the next typology
    if (jsentAlready.some((idOfSent) => idOfSent === typologyResults[index].cfg)) continue;

    // Typology Wait for enough rules if they are not matching the number configured
    const networkMapRules = networkMap.messages[0].channels[0].typologies[index].rules;
    const typologyResultRules = typologyResults[index].ruleResults;
    if (typologyResultRules.length < networkMapRules.length) continue;

    const startTime = process.hrtime.bigint();
    const spanExecReq = apm.startSpan(`${typologyResults[index].cfg}.exec.Req`);

    const expressionRes = (await databaseManager.getTypologyExpression({
      id: typologyResults[index].id,
      cfg: typologyResults[index].cfg,
      host: '',
      desc: '',
      rules: [],
    })) as unknown[][];

    if (!expressionRes?.[0]?.[0]) {
      loggerService.warn(`No Typology Expression found for Typology ${typologyResults[index].id}@${typologyResults[index].cfg}`);
      return {
        typologyResult: typologyResults[index],
        transaction,
        networkMap,
      };
    }

    const expression = expressionRes[0][0] as ITypologyExpression;
    const typologyResultValue = evaluateTypologyExpression(expression.rules, typologyResults[index].ruleResults, expression.expression);

    typologyResults[index].result = typologyResultValue;

    if (expression.workflow.interdictionThreshold)
      typologyResults[index].workflow.interdictionThreshold = expression.workflow.interdictionThreshold;

    if (expression.workflow.alertThreshold) typologyResults[index].workflow.alertThreshold = expression.workflow.alertThreshold;

    typologyResults[index].review = false;

    if (!expression.workflow.alertThreshold) {
      loggerService.error(`Typology ${typologyResults[index].cfg} config missing alert Threshold`);
    } else if (typologyResultValue >= expression.workflow.alertThreshold) {
      loggerService.log(`Typology ${typologyResults[index].cfg} alerting on transaction : with a trigger of: ${typologyResultValue}`);
      typologyResults[index].review = true;
    }

    cadpReqBody = {
      typologyResult: typologyResults[index],
      transaction,
      networkMap,
    };

    if (expression.workflow.interdictionThreshold && typologyResultValue >= expression.workflow.interdictionThreshold) {
      typologyResults[index].review = true;
      typologyResults[index].prcgTm = CalculateDuration(startTime);

      // Send Typology to CMS
      const spanCms = apm.startSpan(`[${transactionId}] Send Typology result to CMS`);
      server
        .handleResponse({ ...cadpReqBody, metaData }, [configuration.cmsProducer])
        .catch((error) => {
          loggerService.error(`Error while sending Typology result to CMS`, error as Error);
        })
        .finally(() => {
          spanExecReq?.end();
          spanCms?.end();
        });
    }

    if (!expression.workflow.alertThreshold) {
      loggerService.error(`Typology ${typologyResults[index].cfg} config missing alert Threshold`);
    } else if (typologyResultValue >= expression.workflow.alertThreshold) {
      loggerService.log(`Typology ${typologyResults[index].cfg} alerting on transaction :  with a trigger of: ${typologyResultValue}`);
      typologyResults[index].review = true;
    }
    typologyResults[index].prcgTm = CalculateDuration(startTime);
    cadpReqBody.typologyResult = typologyResults[index];

    // Send Typology to TADProc
    const spanTadpr = apm.startSpan(`[${transactionId}] Send Typology result to TADP`);
    server
      .handleResponse({ ...cadpReqBody, metaData })
      .then(async () => {
        await databaseManager.setAdd(`alreadySent_${transactionId}`, { alreadySent: typologyResults[index].cfg });
      })
      .catch((error) => {
        loggerService.error(`Error while sending Typology result to TADP`, error as Error);
      })
      .finally(() => {
        spanExecReq?.end();
        spanTadpr?.end();
      });
  }
  return cadpReqBody;
};

export const handleTransaction = async (transaction: any): Promise<void> => {
  const metaData = transaction.metaData;
  loggerService.log(`traceParent in typroc: ${JSON.stringify(metaData?.traceParent)}`);
  const apmTransaction = apm.startTransaction('typroc.handleTransaction', {
    childOf: metaData?.traceParent,
  });

  const networkMap: NetworkMap = transaction.networkMap;
  const ruleResult: RuleResult = transaction.ruleResult;
  const parsedTrans = transaction.transaction;

  const transactionType = 'FIToFIPmtSts';
  const transactionId = parsedTrans[transactionType].GrpHdr.MsgId;
  const cacheKey = `TP_${String(transactionId)}`;

  // Save the rules Result to Redis and continue with the available #Step 1
  const rulesList: RuleResult[] | undefined = await saveToRedisGetAll(cacheKey, ruleResult);

  if (!rulesList) {
    loggerService.log('Redis records should never be undefined');
    return;
  }

  // Aggregations of typology config merge with rule result #Step 2
  const typologyResults: TypologyResult[] = ruleResultAggregation(networkMap, rulesList);

  // Typology evaluation and Send to TADP interdiction determining #Step 3
  await evaluateTypologySendRequest(typologyResults, networkMap, parsedTrans, metaData, cacheKey);

  // Garbage collection
  if (rulesList.length >= getUniqueRulesCount(networkMap)) {
    const spanDelete = apm.startSpan(`cache.delete.[${String(transactionId)}].Typology interim cache key`);
    databaseManager.deleteKey(cacheKey);
    databaseManager.deleteKey(`alreadySent_${cacheKey}`);
    apmTransaction?.end();
    spanDelete?.end();
  }
};
