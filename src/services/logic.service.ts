import http from 'http';
import { forkJoin } from 'rxjs';
import { config } from '../config';
import { LoggerService } from './logger.service';
import { CustomerCreditTransferInitiation } from '../classes/iPain001Transaction';
import { NetworkMap, Rule, Typology } from '../classes/network-map';
import { FlowFileReply, FlowFileRequest } from '../models/nifi_pb';
import { sendUnaryData } from '@grpc/grpc-js';
import { redisAppendJson, redisGetJson } from '../clients/redis-client';
import { RuleResult } from '../classes/rule-result';
import { IExpression, IRuleValue, ITypologyExpression, Operators } from '../interfaces/iTypologyExpression';
import axios from 'axios';

export const handleTransaction = async (req: CustomerCreditTransferInitiation, networkMap: NetworkMap, ruleResult: RuleResult, callback: sendUnaryData<FlowFileReply>) => {
  let typologyCounter = 0;
  let toReturn = [];
  for (const channel of networkMap.transactions[0].channels) {
    for (const typology of channel.typologies.filter(typo => typo.rules.some(r => r.rule_name === ruleResult.rule))) {
      // will loop through every Typology here
      typologyCounter++;
      for (const rule of typology.rules) {
        // determine rule completion
      }
      var typoRes = await executeRequest(req, typology, ruleResult);
      toReturn.push(`{"Typology": ${typology.typology_name}}, "Result":${typoRes}}`);
    }
  }

  const result = `${typologyCounter} typologies initiated for transaction ID: ${req.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification}, with the following results:\r\n${toReturn}`;
  LoggerService.log(result);
  const res: FlowFileReply = new FlowFileReply();
  res.setBody(result);
  res.setResponsecode(1);
  callback(null, res);
};

const getTypologyExpression = async (): Promise<ITypologyExpression> => {
  // Fetch typology expression from config store
  const typologyExpressionRes = await axios.post('http://20.90.202.27:8888/druid/v2/sql', { query: "select * from TypologyExpression WHERE typology_name = 'Typology_29'" });
  const jTypoloty = typologyExpressionRes.data[0];

  var toReturn = {} as ITypologyExpression;
  toReturn.rules_values = JSON.parse(jTypoloty.rules_values);
  toReturn.typology_expression = JSON.parse(jTypoloty.typology_expression);
  toReturn.typology_name = jTypoloty.typology_name;
  toReturn.typology_version = jTypoloty.sum_typology_version;
  return toReturn;
}

const evaluateTypologyExpression = (ruleValues: IRuleValue[], ruleResults: RuleResult[], typologyExpression: IExpression): number => {
  let toReturn = 0.0;
  for (const rule in typologyExpression.values) {
    const ruleResult = ruleResults.find(r => r.rule === typologyExpression.values[rule])?.result ?? false;
    let ruleVal = 0.0;
    if (ruleResult)
      ruleVal = Number.parseFloat(ruleValues.find(rv => rv.rule_id === typologyExpression.values[rule])?.rule_true_value ?? "0.0");
    else
      ruleVal = Number.parseFloat(ruleValues.find(rv => rv.rule_id === typologyExpression.values[rule])?.rule_false_value ?? "0.0");

    switch (typologyExpression.operation) {
      case Operators['+']:
        toReturn += ruleVal;
        break;
      case Operators['-']:
        toReturn -= ruleVal;
        break;
      case Operators['*']:
        toReturn *= ruleVal;
        break;
      case Operators['/']:
        if (ruleVal === 0.0)
          break;
        toReturn /= ruleVal;
        break;
    }
  }
  if (typologyExpression.nestedExpression) {
    const evalRes = evaluateTypologyExpression(ruleValues, ruleResults, typologyExpression.nestedExpression);
    switch (typologyExpression.operation) {
      case Operators['+']:
        toReturn += evalRes;
        break;
      case Operators['-']:
        toReturn -= evalRes;
        break;
      case Operators['*']:
        toReturn *= evalRes;
        break;
      case Operators['/']:
        if (evalRes === 0.0)
          break;
        toReturn /= evalRes;
        break;
    }
  }
  return toReturn;
}

const executeRequest = async (
  request: CustomerCreditTransferInitiation,
  typology: Typology,
  ruleResult: RuleResult
): Promise<number> => {

  try {
    let score: string = '';
    try {
      const transactionID = request.PaymentInformation.CreditTransferTransactionInformation.PaymentIdentification.EndToEndIdentification;
      const cacheKey = `${transactionID}_${typology.typology_id}`
      var jruleResults = await redisGetJson(cacheKey);
      const ruleResults: RuleResult[] = [];

      if (jruleResults && jruleResults.length > 0)
        Object.assign(ruleResults, jruleResults);

      ruleResults.push({ rule: ruleResult.rule, result: ruleResult.result });

      // check if all results for this typology are found 
      if (ruleResults.length < typology.rules.length) {
        var saveResult = await redisAppendJson(cacheKey, ruleResults);
        //response.status(200).send('All rules not yet processed for Typology 28');
        return 0.0;
      }
      // else means we have all results for Typology, so lets evaluate result
      const expression: ITypologyExpression = await getTypologyExpression();

      const typologyResult = evaluateTypologyExpression(expression.rules_values, ruleResults, expression.typology_expression);
      return typologyResult;
      // Convert rule results to Score object
      // const scores: Typology28Type = {};
      // ruleResults.forEach((rule) => {
      //   scores[rule.name] = rule.result;
      // });

      // // Calculate score for Typology-28
      // // See https://lextego.atlassian.net/browse/ACTIO-197
      // score = handleScores(scores, transfer.transaction.TransactionID, transfer.transaction.HTTPTransactionDate);
    } catch (e) {
      console.error(e);
      return 0.0;
    }

    // var res = await sendScore(score);

    // response.status(200).send(`${score}\r\nChannel Score Response:\r\n${res}`);
  } catch (error) {
    const processError = new Error(
      'Failed to process Typology-28 request',
    );
    processError.message += `\n${error.message}`;

    LoggerService.error(`[ERROR] ${processError.message}`);
    // response.status(500).send(processError.message);
    return 0.0;
  }
}

const sendRule = async (rule: Rule, req: CustomerCreditTransferInitiation) => {
  const ruleEndpoint = `${config.ruleEndpoint}/${rule.rule_name}/${rule.rule_version}`; // rule.ruleEndpoint;
  // const ruleRequest: RuleRequest = new RuleRequest(req, rule.typologies);
  const toSend = `{"transaction":${JSON.stringify(req)}, "typologies":${JSON.stringify(rule.typologies)}}`;

  // Uncomment this to send gRPC request to Rule Engines
  // let ruleRequest = new FlowFileRequest();
  let objJsonB64 = Buffer.from(JSON.stringify(toSend)).toString("base64");
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

function getRuleMap(networkMap: NetworkMap, transactionType: string): Rule[] {
  const rules: Rule[] = new Array<Rule>();
  const painChannel = networkMap.transactions.find((tran) => tran.transaction_type === transactionType);
  if (painChannel && painChannel.channels && painChannel.channels.length > 0)
    for (const channel of painChannel.channels) {
      if (channel.typologies && channel.typologies.length > 0)
        for (const typology of channel.typologies) {
          if (typology.rules && typology.rules.length > 0)
            for (const rule of typology.rules) {
              const ruleIndex = rules.findIndex(
                (r: Rule) => `${r.rule_id}${r.rule_name}${r.rule_version}` === `${rule.rule_id}${rule.rule_name}${rule.rule_version}`,
              );
              if (ruleIndex > -1) {
                rules[ruleIndex].typologies.push(new Typology(typology.typology_id, typology.typology_name, typology.typology_version));
              } else {
                const tempTypologies = Array<Typology>();
                tempTypologies.push(new Typology(typology.typology_id, typology.typology_name, typology.typology_version));
                rule.typologies = tempTypologies;
                rules.push(rule);
              }
            }
        }
    }

  return rules;
}

