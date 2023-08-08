/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import axios from 'axios';
import apm from 'elastic-apm-node';
import { databaseClient, databaseManager, server } from '.';
import { type CADPRequest, type TypologyResult } from './classes/cadp-request';
import { type NetworkMap, type Typology } from './classes/network-map';
import { RuleResult } from './classes/rule-result';
import { configuration } from './config';
import { type IExpression, type IRuleValue, type ITypologyExpression } from './interfaces/iTypologyExpression';
import { type MetaData } from './interfaces/metaData';
import { LoggerService } from './logger.service';

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
): Promise<CADPRequest> => {
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

  try {
    const transactionType = 'FIToFIPmtSts';
    const transactionID = transaction[transactionType].GrpHdr.MsgId;
    const cacheKey = `TP_${transactionID}_${typology.id}_${typology.cfg}`;
    const jruleResults = await databaseManager.addOneGetAll(`${cacheKey}`, JSON.stringify(ruleResult));
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

    if (ruleResults && ruleResults.length < typology.rules.length) {
      typologyResult.desc = typology.desc ? typology.desc : noDescription;
      typologyResult.prcgTm = calculateDuration(startTime);
      return cadpReqBody;
    }

    const expressionRes = await databaseClient.getTypologyExpression(typology);
    if (!expressionRes) {
      LoggerService.warn(`No Typology Expression found for Typology ${typology.id}@${typology.cfg}`);
      typologyResult.prcgTm = calculateDuration(startTime);
      return cadpReqBody;
    }

    const expression: ITypologyExpression = expressionRes;
    let span = apm.startSpan(`[${transactionID}] eval.typology.expr`);
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
      span = apm.startSpan(`[${transactionID}] Interdiction - Send Typology result to CMS`);
      executePost(configuration.cmsEndpoint, cadpReqBody)
        .then(() => {
          span?.end();
        })
        .catch((error) => {
          span?.end();
          LoggerService.error('Error while sending Typology result to CMS', error as Error);
        });
    }

    // Send CADP request with this Typology's result
    span = apm.startSpan(`[${transactionID}] Send Typology result to CADP`);
    server
      .handleResponse({ ...cadpReqBody, metaData })
      .then(() => {
        span?.end();
      })
      .catch((error) => {
        span?.end();
        LoggerService.error('Error while sending Typology result to CADP', error as Error);
      });

    span = apm.startSpan(`[${transactionID}] Delete Typology interim cache key`);
    await databaseManager.deleteKey(cacheKey);
    span?.end();
    return cadpReqBody;
  } catch (error) {
    LoggerService.error(`Failed to process Typology ${typology.id} request`, error as Error, 'executeRequest');
  } finally {
    LoggerService.log(`Concluded processing of Rule ${ruleResult.id}`);
    return cadpReqBody; // eslint-disable-line
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const handleTransaction = async (transaction: any): Promise<void> => {
  // eslint-disable-line
  let typologyCounter = 0;
  const metaData = transaction.metaData;
  LoggerService.log(`traceParent in typroc: ${JSON.stringify(metaData?.traceParent)}`);
  const apmTransaction = apm.startTransaction('typroc.handleTransaction', {
    childOf: metaData?.traceParent,
  });
  const networkMap: NetworkMap = transaction.networkMap;
  const ruleResult: RuleResult = transaction.ruleResult;

  const parsedTrans = transaction.transaction;

  const requests = [];

  for (const channel of networkMap.messages[0].channels) {
    for (const typology of channel.typologies.filter((typo) => typo.rules.some((r) => r.id === ruleResult.id))) {
      // will loop through every Typology here
      typologyCounter++;
      const channelHost = channel.host;

      requests.push(
        executeRequest(parsedTrans, typology, ruleResult, networkMap, channelHost, {
          ...metaData,
          traceParent: apm.currentTraceparent,
        }),
      );
    }
  }

  const spanCadpRes = apm.startSpan('cadproc.sendReq');
  await Promise.all(requests);
  spanCadpRes?.end();

  const transactionType = 'FIToFIPmtSts';
  const transactionID = parsedTrans[transactionType].GrpHdr.MsgId;
  const result = `${typologyCounter} typologies initiated for transaction ID: ${transactionID}`;
  LoggerService.log(`${result} for Rule ${ruleResult.id}`);
  apmTransaction?.end();
};

// Submit the score to the CADP/CMS
const executePost = async (endpoint: string, request: CADPRequest): Promise<void> => {
  const span = apm.startSpan('send.cadp/cms');
  try {
    const cadpRes = await axios.post(endpoint, request);
    if (cadpRes.status !== 200) {
      LoggerService.error(`Response StatusCode != 200, request:\r\n${JSON.stringify(request)}`);
    }
  } catch (error) {
    LoggerService.error(`Error while sending request to ${endpoint ?? ''} with message: ${error}`);
    LoggerService.trace(`Axios Post Error Request:\r\n${JSON.stringify(request)}`);
    throw error;
  } finally {
    span?.end();
  }
};
