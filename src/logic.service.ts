import http from 'http';

import { LoggerService } from './logger.service';
import { Pain001V11Transaction } from './classes/Pain.001.001.11/iPain001Transaction';
import { NetworkMap, Typology } from './classes/network-map';

import { RuleResult } from './classes/rule-result';
import { IExpression, IRuleValue, ITypologyExpression } from './interfaces/iTypologyExpression';
import apm from 'elastic-apm-node';
import { configuration } from './config';
import { cacheClient, databaseClient } from '.';
import { CADPRequest, CombinedResult, TypologyResult } from './classes/cadp-request';
import axios from 'axios';

const evaluateTypologyExpression = (ruleValues: IRuleValue[], ruleResults: RuleResult[], typologyExpression: IExpression): number => {
  let toReturn = 0.0;
  for (const rule in typologyExpression.terms) {
    const ruleResult = ruleResults.find((r) => r.id === typologyExpression.terms[rule].id && r.cfg === typologyExpression.terms[rule].cfg);
    let ruleVal = 0.0;
    if (!ruleResult) return ruleVal;
    if (ruleResult.result)
      ruleVal = ruleValues.find((rv) => rv.id === typologyExpression.terms[rule].id && rv.cfg === typologyExpression.terms[rule].cfg && rv.ref === ruleResult.subRuleRef)?.true ?? 0.0;
    else
      ruleVal = ruleValues.find((rv) => rv.id === typologyExpression.terms[rule].id && rv.cfg === typologyExpression.terms[rule].cfg && rv.ref === ruleResult.subRuleRef)?.false ?? 0.0;

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
  networkMap: NetworkMap,
): Promise<CADPRequest> => {

  let typologyResult: TypologyResult = { result: 0.0, id: typology.id, cfg: typology.cfg, ruleResults: [] };
  const cadpReqBody: CADPRequest = {
    typologyResult: typologyResult,
    transaction: transaction,
    networkMap: networkMap
  };
  try {
    let transactionType = Object.keys(transaction).find(k => k !== "TxTp") ?? "";
    const transactionID = transaction[transactionType].GrpHdr.MsgId;
    const cacheKey = `${transactionID}_${typology.id}_${typology.cfg}`;
    const jruleResults = await cacheClient.getJson(cacheKey);
    const ruleResults: RuleResult[] = [];

    // Get cache from Redis if we have
    if (jruleResults && jruleResults.length > 0) {
      Object.assign(ruleResults, JSON.parse(jruleResults));
    }
    cadpReqBody.typologyResult = typologyResult;
    cadpReqBody.typologyResult.ruleResults = ruleResults;
    if (ruleResults.some((r) => r.id === ruleResult.id && r.cfg === ruleResult.cfg)) return cadpReqBody;

    ruleResults.push({ id: ruleResult.id, result: ruleResult.result, cfg: ruleResult.cfg, reason: ruleResult.reason, subRuleRef: ruleResult.subRuleRef });
    cadpReqBody.typologyResult.ruleResults = ruleResults;

    // check if all results for this typology are found
    if (ruleResults.length < typology.rules.length) {
      const span = apm.startSpan(`[${transactionID}] Save Typology interim rule results to Cache`);
      // Save Typology interim rule results to Cache
      await cacheClient.setJson(cacheKey, JSON.stringify(ruleResults));
      span?.end();
      return cadpReqBody;
    }
    // else means we have all results for Typology, so lets evaluate result

    const expressionRes = await databaseClient.getTypologyExpression(typology);
    if (!expressionRes) return cadpReqBody;

    const expression: ITypologyExpression = expressionRes!;
    let span = apm.startSpan(`[${transactionID}] Evaluate Typology Expression`);
    const typologyResultValue = evaluateTypologyExpression(expression.rules, ruleResults, expression.expression);
    span?.end();
    typologyResult.result = typologyResultValue;
    // Send CADP request with this Typology's result
    try {
      cadpReqBody.typologyResult = typologyResult;
      span = apm.startSpan(`[${transactionID}] Send Typology result to CADP`);
      // LoggerService.log(`Sending to CADP ${config.cadpEndpoint} data: ${toSend}`);
      await executePost(configuration.cadpEndpoint, cadpReqBody);
      span?.end();
    } catch (error) {
      span?.end();
      LoggerService.error('Error while sending Typology result to CADP', error as Error);
    }
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await cacheClient.deleteKey(cacheKey);
    span?.end();
    return cadpReqBody;
  } catch (error) {
    LoggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
    return cadpReqBody;
  } finally {
    LoggerService.log(`Concluded processing of Rule ${ruleResult.id}`);
  }
};

export const handleTransaction = async (
  transaction: any,
  networkMap: NetworkMap,
  ruleResult: RuleResult,
): Promise<CombinedResult> => {
  let typologyCounter = 0;
  const toReturn: CombinedResult = new CombinedResult();

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.id))) {
      // will loop through every Typology here
      typologyCounter++;
      // for (const rule of typology.rules) {
      // determine rule completion
      // }
      const cadpRes = await executeRequest(transaction, typology, ruleResult, networkMap);
      //typoRes.transaction = new Pain001V11Transaction({});
      toReturn.cadpRequests.push(cadpRes);
      // toReturn.push(`{"Typology": "${typology.id}", "cfg": "${typology.cfg}"}, "Result":${typoRes.typologyResult.result}}`);
    }
  }

  // Response for CRSP - How many typologies have kicked off?
  // Let CRSP know that we have finished processing this transaction
  let transactionType = Object.keys(transaction).find(k => k !== "TxTp") ?? "";
  const transactionID = transaction[transactionType].GrpHdr.MsgId;
  const result = `${typologyCounter} typologies initiated for transaction ID: ${transactionID}`;
  LoggerService.log(`${result} for Rule ${ruleResult.id}`);
  toReturn.typologyResult = result;
  return toReturn;
};

// Submit the score to the CADP
const executePost = async (endpoint: string, request: CADPRequest) => {
  try {
    const cadpRes = await axios.post(endpoint, request);
    if (cadpRes.status !== 200) {
      LoggerService.error(`CADP Response StatusCode != 200, request:\r\n${request}`);
    }
  } catch (error) {
    LoggerService.error(`Error while sending request to CADP at ${endpoint ?? ""} with message: ${error}`);
    LoggerService.trace(`CADP Error Request:\r\n${request}`);
  }
};
