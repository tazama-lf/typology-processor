// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import apm from './apm';
import { databaseManager, server, loggerService } from '.';
import { type RuleResult, type NetworkMap, type Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { type TypologyResult } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/TypologyResult';
import { type CADPRequest } from '@frmscoe/frms-coe-lib/lib/interfaces/processor-files/CADPRequest';
import { configuration } from './config';
import { type IExpression, type IRuleValue, type ITypologyExpression } from './interfaces/iTypologyExpression';
// import { type MetaData } from './interfaces/metaData';
import fs from 'fs';

// const calculateDuration = (startTime: bigint): number => {
//   const endTime = process.hrtime.bigint();
//   return Number(endTime - startTime);
// };

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

// const executeRequest = async (
//   transaction: any,
//   typology: Typology,
//   ruleResult: RuleResult,
//   ruleId: string,
//   networkMap: NetworkMap,
//   channelHost: string,
//   metaData: MetaData,
// ): Promise<void> => {
//   const startTime = process.hrtime.bigint();

//   const typologyResult: TypologyResult = {
//     result: 0.0,
//     id: typology.id,
//     cfg: typology.cfg,
//     prcgTm: 0,
//     ruleResults: [],
//     workflow: {
//       alertThreshold: 0,
//     },
//   };

//   const cadpReqBody: CADPRequest = {
//     typologyResult,
//     transaction,
//     networkMap,
//   };
//   const spanExecReq = apm.startSpan(`${typologyResult.id}.exec.Req`);

//   try {
//     const transactionType = 'FIToFIPmtSts';
//     const transactionID = transaction[transactionType].GrpHdr.MsgId;
//     const cacheKey = `TP_${transactionID}_${typology.id}_${typology.cfg}`;
//     const jruleResultsCount = await databaseManager.addOneGetCount(`${cacheKey}`, { ruleResult: { ...ruleResult } });

//     if (jruleResultsCount && jruleResultsCount < typology.rules.length) {
//       typologyResult.prcgTm = calculateDuration(startTime);
//       spanExecReq?.end();
//       return;
//     }

//     const jruleResults = await databaseManager.getMemberValues(`${cacheKey}`);
//     const ruleResults: RuleResult[] = jruleResults.map((res) => res.ruleResult as RuleResult);

//     cadpReqBody.typologyResult.ruleResults = ruleResults;

//     const expressionRes = (await databaseManager.getTypologyExpression(typology)) as unknown[][];
//     if (!expressionRes?.[0]?.[0]) {
//       loggerService.warn(`No Typology Expression found for Typology ${typology.id}@${typology.cfg}`);
//       typologyResult.prcgTm = calculateDuration(startTime);
//       spanExecReq?.end();
//       return;
//     }

//     const expression = expressionRes[0][0] as ITypologyExpression;
//     const span = apm.startSpan(`[${transactionID}] eval.typology.expr`);
//     const typologyResultValue = evaluateTypologyExpression(expression.rules, ruleResults, expression.expression);
//     span?.end();

//     typologyResult.result = typologyResultValue;
//     typologyResult.prcgTm = calculateDuration(startTime);
//     typologyResult.review = false;
//     if (expression.workflow.interdictionThreshold)
//       typologyResult.workflow.interdictionThreshold = expression.workflow.interdictionThreshold;
//     if (expression.workflow.alertThreshold) typologyResult.workflow.alertThreshold = expression.workflow.alertThreshold;

//     // Interdiction
//     // Send Result to CMS
//     if (expression.workflow.interdictionThreshold && typologyResultValue >= expression.workflow.interdictionThreshold) {
//       const spanCms = apm.startSpan(`[${transactionID}] Send Typology result to CMS`);
//       typologyResult.review = true;
//       server
//         .handleResponse({ ...cadpReqBody, metaData }, [configuration.cmsProducer])
//         .catch((error) => {
//           loggerService.error(`Error while sending Typology result to CMS`, error as Error);
//         })
//         .finally(() => {
//           spanCms?.end();
//         });
//     }

//     if (!expression.workflow.alertThreshold) {
//       loggerService.error(`Typology ${typology.cfg} config missing alert Threshold`);
//     } else if (typologyResultValue >= expression.workflow.alertThreshold) {
//       loggerService.log(`Typology ${typology.cfg} alerting on transaction : ${transactionID} with a trigger of: ${typologyResultValue}`);
//       typologyResult.review = true;
//     }
//     cadpReqBody.typologyResult = typologyResult;

//     // Send TADP request with this Typology's result
//     const spanTadpr = apm.startSpan(`[${transactionID}] Send Typology result to TADP`);
//     server
//       .handleResponse({ ...cadpReqBody, metaData })
//       .catch((error) => {
//         loggerService.error(`Error while sending Typology result to TADP`, error as Error);
//       })
//       .finally(() => {
//         spanTadpr?.end();
//       });

//     const spanDelete = apm.startSpan(`cache.delete.[${transactionID}].Typology interim cache key`);
//     await databaseManager.deleteKey(cacheKey);
//     spanDelete?.end();
//   } catch (error) {
//     loggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
//   } finally {
//     loggerService.log(`Concluded processing of Rule ${ruleId}`);
//     spanExecReq?.end();
//   }
// };

interface UniqueIdentifiers {
  rules: { ids: string[]; total: number };
  typologies: { ids: string[]; total: number };
}

const getUniqueRulesCount = (networkMap: NetworkMap): UniqueIdentifiers => {
  const uniqueIdsRules: string[] = [];
  const uniqueIdsTypologies: string[] = [];

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies) {
      if (!uniqueIdsTypologies.includes(typology.id)) {
        uniqueIdsTypologies.push(typology.id);
      }
      for (const rule of typology.rules) {
        if (!uniqueIdsRules.includes(rule.id)) {
          uniqueIdsRules.push(rule.id);
        }
      }
    }
  }
  return {
    rules: { ids: uniqueIdsRules, total: uniqueIdsRules.length },
    typologies: { ids: uniqueIdsTypologies, total: uniqueIdsTypologies.length },
  };
};

const saveToRedisGetAll = async (transaction: any, ruleResult: RuleResult): Promise<RuleResult[] | undefined> => {
  const transactionType = 'FIToFIPmtSts';
  const transactionID = transaction[transactionType].GrpHdr.MsgId;
  const cacheKey = `TP_${transactionID}`;

  const currentlyStoredRuleResult = await databaseManager.addOneGetAll(cacheKey, { ruleResult: { ...ruleResult } });
  const ruleResults: RuleResult[] | undefined = currentlyStoredRuleResult.map((res) => res.ruleResult as RuleResult);
  loggerService.log(JSON.stringify(currentlyStoredRuleResult));

  return ruleResults;
};

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

const evaluateTypologySendRequest = async (
  typologyResults: TypologyResult[],
  networkMap: NetworkMap,
  transaction: any,
): Promise<CADPRequest | undefined> => {
  let cadpReqBody: CADPRequest = { networkMap, transaction, typologyResult: typologyResults[0] };
  for (let index = 0; index < typologyResults.length; index++) {
    if (typologyResults[index].result === -1) {
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

      if (networkMap.messages[0].channels[0].typologies[index].rules.length <= typologyResults[index].ruleResults.length) {
        if (expression.workflow.interdictionThreshold && typologyResultValue >= expression.workflow.interdictionThreshold) {
          typologyResults[index].review = true;
          server
            .handleResponse({ ...cadpReqBody }, [configuration.cmsProducer])
            .catch((error) => {
              loggerService.error(`Error while sending Typology result to CMS`, error as Error);
            })
            .finally(() => {
              /* Empty Final */
            });
        }

        if (!expression.workflow.alertThreshold) {
          loggerService.error(`Typology ${typologyResults[index].cfg} config missing alert Threshold`);
        } else if (typologyResultValue >= expression.workflow.alertThreshold) {
          loggerService.log(`Typology ${typologyResults[index].cfg} alerting on transaction :  with a trigger of: ${typologyResultValue}`);
          typologyResults[index].review = true;
        }
        cadpReqBody.typologyResult = typologyResults[index];
        loggerService.log(`Last rule on the transaction sending to TADP`);
        fs.writeFileSync('./result.json', JSON.stringify({ ...cadpReqBody }));
        server
          .handleResponse({ ...cadpReqBody })
          .catch((error) => {
            loggerService.error(`Error while sending Typology result to TADP`, error as Error);
          })
          .finally(() => {
            /* Empty Final */
          });
      }
    }
  }
  return cadpReqBody;
};

export const handleTransaction = async (transaction: any): Promise<void> => {
  loggerService.log(`Started Handing Typology work`);
  const metaData = transaction.metaData;
  loggerService.log(`traceParent in typroc: ${JSON.stringify(metaData?.traceParent)}`);
  const apmTransaction = apm.startTransaction('typroc.handleTransaction', {
    childOf: metaData?.traceParent,
  });
  const networkMap: NetworkMap = transaction.networkMap;
  const ruleResult: RuleResult = transaction.ruleResult;
  const parsedTrans = transaction.transaction;

  // const requests = [];

  // const spanCadpRes = apm.startSpan('cadproc.sendReq');

  // Rules list creation and saving to Redis #Step 1
  loggerService.log(`Got ${ruleResult.id} rule result`);

  // Save the rules Result to Redis and continue with the available #Step 1
  const rulesList: RuleResult[] | undefined = await saveToRedisGetAll(parsedTrans, ruleResult);

  if (!rulesList) {
    loggerService.log('Redis records should never be undefined');
    return;
  }

  // Aggregations typology config merge with rule result #Step 2
  const jtypologyResults: TypologyResult[] = ruleResultAggregation(networkMap, rulesList);

  // Typology evaluation and Send to TADP Step 3
  const typologyResults = await evaluateTypologySendRequest(jtypologyResults, networkMap, parsedTrans);

  // ---------------------------------------------------------------------------------------
  // for (const channel of networkMap.messages[0].channels) {
  //   for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.id))) {
  //     // will loop through every Typology here

  //     const channelHost = channel.host;

  //     requests.push(
  //       executeRequest(parsedTrans, typology, ruleResult, ruleResult.id, networkMap, channelHost, {
  //         ...metaData,
  //         traceParent: apm.getCurrentTraceparent(),
  //       }),
  //     );
  //   }
  // }

  // await Promise.all(requests);
  // spanCadpRes?.end();

  // const transactionType = 'FIToFIPmtSts';
  // const transactionID = parsedTrans[transactionType].GrpHdr.MsgId;
  // const result = `${typologyCounter} typologies initiated for transaction ID: ${transactionID}`;
  // loggerService.log(`${result} for Rule ${ruleResult.id}`);
  const uniqueCountNetworkMap = getUniqueRulesCount(networkMap);
  if (rulesList.length >= uniqueCountNetworkMap.rules.total) {
    apmTransaction?.end();
    fs.writeFileSync('./test.json', JSON.stringify(typologyResults));
  }

  //
};
