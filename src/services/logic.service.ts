import http from 'http';
import { forkJoin } from 'rxjs';
import { config } from '../config';
import { LoggerService } from './logger.service';
import { CustomerCreditTransferInitiation } from '../classes/iPain001Transaction';
import { NetworkMap, Rule, Typology } from '../classes/network-map';
import { FlowFileReply, FlowFileRequest } from '../models/nifi_pb';
import { sendUnaryData } from '@grpc/grpc-js';
import { redisSetJson, redisGetJson, redisDeleteKey } from '../clients/redis-client';
import { RuleResult } from '../classes/rule-result';
import { IExpression, IRuleValue, ITypologyExpression } from '../interfaces/iTypologyExpression';
import axios from 'axios';
import { cadpService } from '../clients/cadp.client';
import { TypologyResult } from '../classes/typology-result';

const getTypologyExpression = async (): Promise<ITypologyExpression> => {
  // Fetch typology expression from config store
  const typologyExpressionRes = await axios.post(`${config.druidEndpoint}/druid/v2/sql`, {
    query: 'select * from TypologyExpression WHERE typology_name = \'Typology_29\'',
  });
  const jTypoloty = typologyExpressionRes.data[0];

  const toReturn = {} as ITypologyExpression;
  toReturn.rules_values = JSON.parse(jTypoloty.rules_values);
  toReturn.typology_expression = JSON.parse(jTypoloty.typology_expression);
  toReturn.typology_name = jTypoloty.typology_name;
  toReturn.typology_version = jTypoloty.sum_typology_version;
  return toReturn;
};

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
  try {
    const score = '';

    const transactionID = request.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification;
    const cacheKey = `${transactionID}_${typology.typology_id}`;
    const jruleResults = await redisGetJson(cacheKey);
    const ruleResults: RuleResult[] = [];

    if (jruleResults && jruleResults.length > 0) Object.assign(ruleResults, jruleResults);

    ruleResults.push({ rule: ruleResult.rule, result: ruleResult.result });

    // check if all results for this typology are found
    if (ruleResults.length < typology.rules.length) {
      await redisSetJson(cacheKey, ruleResults);
      return 0.0;
    }
    // else means we have all results for Typology, so lets evaluate result
    const expression: ITypologyExpression = await getTypologyExpression();

    const typologyResultValue = evaluateTypologyExpression(expression.rules_values, ruleResults, expression.typology_expression);
    const typologyResult: TypologyResult = { result: typologyResultValue, typology: typology.typology_id };
    // Send CADP request with this Typology's result
    try {
      const cadpReq = new FlowFileRequest();
      const cadpReqBody = `{"typologyResult": ${JSON.stringify(typologyResult)}, "transaction":${JSON.stringify(
        request,
      )}, "networkMap":${JSON.stringify(networkMap)}, "ruleResults":${JSON.stringify(ruleResults)}}`;
      const toSend = Buffer.from(JSON.stringify(cadpReqBody)).toString('base64');
      cadpReq.setContent(toSend);
      await cadpService.send(cadpReq);
    } catch (error) {
      LoggerService.error('Error while sending Typology result to CADP', error);
    }
    await redisDeleteKey(cacheKey);
    return typologyResultValue;
  } catch (error) {
    const processError = new Error(`Failed to process Typology ${typology.typology_id} request`);
    processError.message += `\n${error.message}`;

    LoggerService.error(`${processError.message}`);
    return 0.0;
  }
};

export const handleTransaction = async (
  req: CustomerCreditTransferInitiation,
  networkMap: NetworkMap,
  ruleResult: RuleResult,
  callback: sendUnaryData<FlowFileReply>,
) => {
  let typologyCounter = 0;
  const toReturn = [];
  for (const channel of networkMap.transactions[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.rule_name === ruleResult.rule))) {
      // will loop through every Typology here
      typologyCounter++;
      // for (const rule of typology.rules) {
      //   // determine rule completion
      // }
      const typoRes = await executeRequest(req, typology, ruleResult, networkMap);
      toReturn.push(`{"Typology": ${typology.typology_id}}, "Result":${typoRes}}`);
    }
  }

  const result = `${typologyCounter} typologies initiated for transaction ID: ${req.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:\r\n${toReturn}`;
  LoggerService.log(result);
  const res: FlowFileReply = new FlowFileReply();
  res.setBody(result);
  res.setResponsecode(1);

  callback(null, res);
};

const sendRule = async (rule: Rule, req: CustomerCreditTransferInitiation) => {
  const ruleEndpoint = `${config.cadpEndpoint}/${rule.rule_name}/${rule.rule_version}`; // rule.ruleEndpoint;
  // const ruleRequest: RuleRequest = new RuleRequest(req, rule.typologies);
  const toSend = `{"transaction":${JSON.stringify(req)}, "typologies":${JSON.stringify(rule.typologies)}}`;

  // Uncomment this to send gRPC request to Rule Engines
  // let ruleRequest = new FlowFileRequest();
  const objJsonB64 = Buffer.from(JSON.stringify(toSend)).toString('base64');
  // ruleRequest.setContent(objJsonB64);
  // ruleEngineService.send(ruleRequest);

  await executePost(ruleEndpoint, toSend);
};

// Submit the score to the Rule Engine
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
      LoggerService.log(`Rule response statusCode: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        LoggerService.trace(`StatusCode != 200, request:\r\n${request}`);
      }

      res.on('data', (d) => {
        LoggerService.log(`Rule response data: ${d.toString()}`);
        resolve();
      });
    });

    req.on('error', (error) => {
      LoggerService.error(`Rule response Error data: ${error}`);
      LoggerService.trace(`Request:\r\n${request}`);
      resolve(error);
    });

    req.write(request);
    req.end();
  });
};
