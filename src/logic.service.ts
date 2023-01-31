import axios from 'axios';
import apm from 'elastic-apm-node';
import { cacheClient, databaseClient } from '.';
import { CADPRequest, CombinedResult, TypologyResult } from './classes/cadp-request';
import { NetworkMap, Typology } from './classes/network-map';
import { RuleResult } from './classes/rule-result';
import { configuration } from './config';
import { IExpression, IRuleValue, ITypologyExpression } from './interfaces/iTypologyExpression';
import { LoggerService } from './logger.service';

const evaluateTypologyExpression = (ruleValues: IRuleValue[], ruleResults: RuleResult[], typologyExpression: IExpression): number => {
  let toReturn = 0.0;
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
  let typologyResult: TypologyResult = { result: 0.0, id: typology.id, cfg: typology.cfg, theshold: 0.0, ruleResults: [] };
  const cadpReqBody: CADPRequest = {
    typologyResult: typologyResult,
    transaction: transaction,
    networkMap: networkMap,
  };
  try {
    let transactionType = Object.keys(transaction).find((k) => k !== 'TxTp') ?? '';
    const transactionID = transaction[transactionType].GrpHdr.MsgId;
    const cacheKey = `TP_${transactionID}_${typology.id}_${typology.cfg}`;
    let jruleResults = await cacheClient.addOneGetAll(`${cacheKey}`, JSON.stringify(ruleResult))
    let ruleResults: RuleResult[] = [];

    // Get cache from Redis if we have
    if (jruleResults && jruleResults.length > 0) {
      for (const jruleResult of jruleResults) {
        let ruleRes: RuleResult = new RuleResult();
        Object.assign(ruleRes, JSON.parse(jruleResult));
        ruleResults.push(ruleRes);
      }
    }

    cadpReqBody.typologyResult.ruleResults = ruleResults;

    if (ruleResults && ruleResults.length < typology.rules.length) {
      return cadpReqBody;
    }

    const expressionRes = await databaseClient.getTypologyExpression(typology);
    if (!expressionRes) {
      LoggerService.warn(`No Typology Expression found for Typology ${typology.id}@${typology.cfg}`);
      return cadpReqBody;
    }

    const expression: ITypologyExpression = expressionRes!;
    let span = apm.startSpan(`[${transactionID}] Evaluate Typology Expression`);
    const typologyResultValue = evaluateTypologyExpression(expression.rules, ruleResults, expression.expression);
    span?.end();
    typologyResult.result = typologyResultValue;
    typologyResult.theshold = expression?.threshold ?? 0.0;
    cadpReqBody.typologyResult = typologyResult;

    //Interdiction
    //Send Result to CMS
    if (expression?.threshold && typologyResultValue > expression.threshold) {
      try {
        span = apm.startSpan(`[${transactionID}] Interdiction - Send Typology result to CMS`);
        // LoggerService.log(`Sending to CADP ${config.cadpEndpoint} data: ${toSend}`);
        await executePost(configuration.cmsEndpoint, cadpReqBody);
        span?.end();
      } catch (error) {
        span?.end();
        LoggerService.error('Error while sending Typology result to CMS', error as Error);
      }
    }

    // Send CADP request with this Typology's result
    try {
      span = apm.startSpan(`[${transactionID}] Send Typology result to CADP`);
      //LoggerService.log(`Sending to CADP ${configuration.cadpEndpoint} data: \n${JSON.stringify(cadpReqBody)}`);
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
  } finally {
    LoggerService.log(`Concluded processing of Rule ${ruleResult.id}`);
    return cadpReqBody;
  }
};

export const handleTransaction = async (transaction: any, networkMap: NetworkMap, ruleResult: RuleResult): Promise<CombinedResult> => {
  let typologyCounter = 0;
  const toReturn: CombinedResult = new CombinedResult();

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.id))) {
      // will loop through every Typology here
      typologyCounter++;

      const cadpRes = await executeRequest(transaction, typology, ruleResult, networkMap);
      toReturn.cadpRequests.push(cadpRes);
    }
  }

  // Response for CRSP - How many typologies have kicked off?
  // Let CRSP know that we have finished processing this transaction
  let transactionType = Object.keys(transaction).find((k) => k !== 'TxTp') ?? '';
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
    LoggerService.error(`Error while sending request to CADP at ${endpoint ?? ''} with message: ${error}`);
    LoggerService.trace(`CADP Error Request:\r\n${request}`);
  }
};
