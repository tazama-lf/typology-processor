import http from 'http';

import { LoggerService } from './logger.service';
import { Pain001V11Transaction } from './classes/Pain.001.001.11/iPain001Transaction';
import { NetworkMap, Typology } from './classes/network-map';

import { RuleResult } from './classes/rule-result';
import { IExpression, IRuleValue, ITypologyExpression } from './interfaces/iTypologyExpression';
import { TypologyResult } from './classes/typology-result';
import apm from 'elastic-apm-node';
import { configuration } from './config';
import { cacheClient, databaseClient } from '.';
import { CADPRequest, CombinedResult } from './classes/cadp-request';

const evaluateTypologyExpression = (ruleValues: IRuleValue[], ruleResults: RuleResult[], typologyExpression: IExpression): number => {
  let toReturn = 0.0;
  for (const rule in typologyExpression.values) {
    const ruleResult = ruleResults.find((r) => r.rule === typologyExpression.values[rule])?.result ?? false;
    let ruleVal = 0.0;
    if (ruleResult)
      ruleVal = Number.parseFloat(ruleValues.find((rv) => rv.rule_id === typologyExpression.values[rule])?.rule_true_value ?? '0.0');
    else ruleVal = Number.parseFloat(ruleValues.find((rv) => rv.rule_id === typologyExpression.values[rule])?.rule_false_value ?? '0.0');

    switch (typologyExpression.operation) {
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
  if (typologyExpression.nested_expression) {
    const evalRes = evaluateTypologyExpression(ruleValues, ruleResults, typologyExpression.nested_expression);
    switch (typologyExpression.operation) {
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
  request: Pain001V11Transaction,
  typology: Typology,
  ruleResult: RuleResult,
  networkMap: NetworkMap,
): Promise<CADPRequest> => {
  // Have to manually start transaction because we are not making use of one of the out-of-the-box solutions (eg, express / koa server)
  const apmTran = apm.startTransaction(`${typology.id}`);
  let typologyResult: TypologyResult = { result: 0.0, typology: typology.id, cfg: typology.cfg };
  const cadpReqBody: CADPRequest = {
    typologyResult: typologyResult,
    transaction: request,
    networkMap: networkMap,
    ruleResults: [],
  };
  try {
    const transactionID = request.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId;
    const cacheKey = `${transactionID}_${typology.id}`;
    const jruleResults = await cacheClient.getJson(cacheKey);
    const ruleResults: RuleResult[] = [];

    // Get cache from Redis if we have
    if (jruleResults && jruleResults.length > 0) {
      Object.assign(ruleResults, JSON.parse(jruleResults));
    }
    cadpReqBody.typologyResult = typologyResult;
    cadpReqBody.ruleResults = ruleResults;
    if (ruleResults.some((r) => r.rule === ruleResult.rule)) return cadpReqBody;

    ruleResults.push({ rule: ruleResult.rule, result: ruleResult.result, reason: ruleResult.reason, subRuleRef: ruleResult.subRuleRef });
    cadpReqBody.ruleResults = ruleResults;

    // check if all results for this typology are found
    if (ruleResults.length < typology.rules.length) {
      const span = apm.startSpan(`[${transactionID}] Save Typology interim rule results to Cache`, {
        childOf: apmTran == null ? undefined : apmTran,
      });
      // Save Typology interim rule results to Cache
      await cacheClient.setJson(cacheKey, JSON.stringify(ruleResults));
      span?.end();
      return cadpReqBody;
    }
    // else means we have all results for Typology, so lets evaluate result

    const expressionRes = await databaseClient.getTypologyExpression(typology);
    if (!expressionRes) return cadpReqBody;

    const expression: ITypologyExpression = expressionRes!;
    let span = apm.startSpan(`[${transactionID}] Evaluate Typology Expression`, { childOf: apmTran == null ? undefined : apmTran });
    const typologyResultValue = evaluateTypologyExpression(expression.rules_values, ruleResults, expression.typology_expression);
    span?.end();
    typologyResult.result = typologyResultValue;
    // Send CADP request with this Typology's result
    try {
      cadpReqBody.typologyResult = typologyResult;
      const toSend = JSON.stringify(cadpReqBody);
      span = apm.startSpan(`[${transactionID}] Send Typology result to CADP`, { childOf: apmTran == null ? undefined : apmTran });
      // LoggerService.log(`Sending to CADP ${config.cadpEndpoint} data: ${toSend}`);
      await executePost(configuration.cadpEndpoint, toSend);
      span?.end();
    } catch (error) {
      span?.end();
      LoggerService.error('Error while sending Typology result to CADP', error as Error);
    }
    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`, { childOf: apmTran == null ? undefined : apmTran });
    await cacheClient.deleteKey(cacheKey);
    span?.end();
    return cadpReqBody;
  } catch (error) {
    LoggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
    return cadpReqBody;
  } finally {
    apmTran?.end();
  }
};

export const handleTransaction = async (
  transaction: Pain001V11Transaction,
  networkMap: NetworkMap,
  ruleResult: RuleResult,
): Promise<CombinedResult> => {
  let typologyCounter = 0;
  const toReturn: CombinedResult = new CombinedResult();

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.rule))) {
      // will loop through every Typology here
      typologyCounter++;
      // for (const rule of typology.rules) {
      // determine rule completion
      // }
      const typoRes = await executeRequest(transaction, typology, ruleResult, networkMap);
      //typoRes.transaction = new Pain001V11Transaction({});
      toReturn.cadpRequests.push(typoRes);
      // toReturn.push(`{"Typology": "${typology.id}", "cfg": "${typology.cfg}"}, "Result":${typoRes.typologyResult.result}}`);
    }
  }

  // Response for CRSP - How many typologies have kicked off?

  // Let CRSP know that we have finished processing this transaction
  const result = `${typologyCounter} typologies initiated for transaction ID: ${transaction.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf.PmtId.EndToEndId}`;
  LoggerService.log(result);
  toReturn.typologyResult = result;
  return toReturn;
};

// Submit the score to the CADP
// TODO: It needs to be rewritten with Axios library instead of 'http'
const executePost = (endpoint: string, request: string): Promise<void | Error> => {
  return new Promise((resolve) => {
    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': request.length,
      },
    };

    const req = http.request(endpoint, options, (res) => {
      LoggerService.log(`CADP statusCode: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        LoggerService.trace(`StatusCode != 200, request:\r\n${request}`);
      }

      res.on('data', (d) => {
        LoggerService.log(`CADP data: ${d.toString()}`);
        resolve();
      });
    });

    req.on('error', (error) => {
      LoggerService.error(`CADP Error data: ${error}`);
      LoggerService.trace(`Request:\r\n${request}`);
      resolve(error);
    });

    req.write(request);
    req.end();
  });
};
