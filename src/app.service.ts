import http from 'http';

import { LoggerService } from './logger.service';
import { CustomerCreditTransferInitiation } from './classes/iPain001Transaction';
import { NetworkMap, Typology } from './classes/network-map';

import { RuleResult } from './classes/rule-result';
import { IExpression, IRuleValue, ITypologyExpression } from './interfaces/iTypologyExpression';
import { TypologyResult } from './classes/typology-result';
import apm from 'elastic-apm-node';
import { configuration } from './config';
import { cacheClient, databaseClient } from '.';

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
  request: CustomerCreditTransferInitiation,
  typology: Typology,
  ruleResult: RuleResult,
  networkMap: NetworkMap,
): Promise<number> => {
  // Have to manually start transaction because we are not making use of one of the out-of-the-box solutions (eg, express / koa server)
  const apmTran = apm.startTransaction(`${typology.typology_id}`);
  try {
    const transactionID = request.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification;
    const cacheKey = `${transactionID}_${typology.typology_id}`;
    const jruleResults = await cacheClient.getJson(cacheKey);
    const ruleResults: RuleResult[] = [];

    // Get cache from Redis if we have
    if (jruleResults && jruleResults.length > 0) Object.assign(ruleResults, JSON.parse(jruleResults));

    if (ruleResults.some((r) => r.rule === typologyResult.typology)) return 0.0;

    ruleResults.push({ rule: ruleResult.rule, result: ruleResult.result });

    // check if all results for this typology are found
    if (ruleResults.length < typology.rules.length) {
      const span = apm.startSpan(`[${transactionID}] Save Typology interim rule results to Cache`, {
        childOf: apmTran == null ? undefined : apmTran,
      });
      // Save Typology interim rule results to Cache
      await cacheClient.setJson(cacheKey, JSON.stringify(ruleResults));
      span?.end();
      return 0.0;
    }
    // else means we have all results for Typology, so lets evaluate result

    const expressionRes = await databaseClient.getTypologyExpression(typology.typology_id);
    if (!expressionRes) return 0.0;

    const expression: ITypologyExpression = expressionRes!;
    let span = apm.startSpan(`[${transactionID}] Evaluate Typology Expression`, { childOf: apmTran == null ? undefined : apmTran });
    const typologyResultValue = evaluateTypologyExpression(expression.rules_values, ruleResults, expression.typology_expression);
    span?.end();
    const typologyResult: TypologyResult = { result: typologyResultValue, typology: typology.typology_id };
    // Send CADP request with this Typology's result
    try {
      const cadpReqBody = {
        typologyResult: typologyResult,
        transaction: request,
        networkMap: networkMap,
        ruleResults: ruleResults,
      };
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
    return typologyResultValue;
  } catch (error) {
    LoggerService.error(`Failed to process Typology ${typology.typology_id} request`, error as Error, 'executeRequest');
    return 0.0;
  } finally {
    apmTran?.end();
  }
};

export const handleTransaction = async (
  transaction: CustomerCreditTransferInitiation,
  networkMap: NetworkMap,
  ruleResult: RuleResult,
): Promise<string> => {
  let typologyCounter = 0;
  const toReturn = [];
  for (const channel of networkMap.transactions[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.rule_name === ruleResult.rule))) {
      // will loop through every Typology here
      typologyCounter++;
      // for (const rule of typology.rules) {
      // determine rule completion
      // }
      const typoRes = await executeRequest(transaction, typology, ruleResult, networkMap);
      toReturn.push(`{"Typology": ${typology.typology_id}}, "Result":${typoRes}}`);
    }
  }

  // Response for CRSP - How many typologies have kicked off?

  // Let CRSP know that we have finished processing this transaction
  const result = `${typologyCounter} typologies initiated for transaction ID: ${transaction.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:\r\n${toReturn}`;
  LoggerService.log(result);

  return result;
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
