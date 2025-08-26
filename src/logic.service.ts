// SPDX-License-Identifier: Apache-2.0
import apm from './apm';
import { CalculateDuration } from '@tazama-lf/frms-coe-lib/lib/helpers/calculatePrcg';
import type { DataCache, NetworkMap, Pacs002, RuleResult } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import type { MetaData } from '@tazama-lf/frms-coe-lib/lib/interfaces/metaData';
import type { ITypologyExpression } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/TypologyConfig';
import type { TypologyResult } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/TypologyResult';
import * as util from 'node:util';
import { configuration, databaseManager, loggerService, server } from '.';
import { evaluateTypologyExpression } from './utils/evaluateTExpression';
import { Singleton } from './services/services';

const saveToRedisGetAll = async (cacheKey: string, ruleResult: RuleResult, tenantId: string): Promise<RuleResult[] | undefined> => {
  // The cacheKey already includes tenant separation from the caller
  // Store the tenantId separately, not as part of the rule result to avoid breaking tests
  const currentlyStoredRuleResult = await databaseManager.addOneGetAll(cacheKey, {
    ruleResult,
    tenantId,
  });
  const ruleResults: RuleResult[] | undefined = currentlyStoredRuleResult.map((res) => {
    const result = res as { ruleResult: RuleResult; tenantId: string };
    return result.ruleResult;
  });
  return ruleResults;
};

const ruleResultAggregation = (
  networkMap: NetworkMap,
  ruleList: RuleResult[],
  ruleResult: RuleResult,
): { typologyResult: TypologyResult[]; ruleCount: number } => {
  const typologyResult: TypologyResult[] = [];
  const allRuleSet = new Set();
  networkMap.messages.forEach((message) => {
    message.typologies.forEach((typology) => {
      const set = new Set();
      for (const rule of typology.rules) {
        set.add(`${rule.id}@${rule.cfg}`);
        allRuleSet.add(`${rule.id}@${rule.cfg}`);
      }
      if (!set.has(`${ruleResult.id}@${ruleResult.cfg}`)) return;
      const ruleResults = ruleList.filter((rule) => set.has(`${rule.id}@${rule.cfg}`)).map((r) => ({ ...r }));
      if (ruleResults.length) {
        typologyResult.push({
          id: typology.id,
          cfg: typology.cfg,
          result: -1,
          ruleResults,
          workflow: { alertThreshold: -1 },
        });
      }
    });
  });

  return { typologyResult, ruleCount: allRuleSet.size };
};

const evaluateTypologySendRequest = async (
  typologyResults: TypologyResult[],
  networkMap: NetworkMap,
  transaction: unknown,
  metaData: MetaData,
  transactionId: string,
  msgId: string,
  dataCache: DataCache,
  tenantId: string,
): Promise<void> => {
  const logContext = 'evaluateTypologySendRequest()';
  for (const currTypologyResult of typologyResults) {
    // Typology Wait for enough rules if they are not matching the number configured
    const networkMapRules = networkMap.messages[0].typologies.find(
      (typology) => typology.cfg === currTypologyResult.cfg && typology.id === currTypologyResult.id,
    );
    const typologyResultRules = currTypologyResult.ruleResults;
    if (networkMapRules && typologyResultRules.length < networkMapRules.rules.length) continue;

    const startTime = process.hrtime.bigint();
    const spanExecReq = apm.startSpan(`${currTypologyResult.cfg}.exec.Req`);

    // Try to get typology configuration from cache first
    let expression = Singleton.getTypologyConfigFromCache(tenantId, currTypologyResult.id, currTypologyResult.cfg);

    if (!expression) {
      // If not in cache, fetch from database with tenant filter
      const expressionRes = (await databaseManager.getTypologyConfig({
        id: currTypologyResult.id,
        cfg: currTypologyResult.cfg,
        host: '',
        desc: '',
        rules: [],
      })) as unknown[][];

      if (!expressionRes?.[0]?.[0]) {
        loggerService.warn(`No Typology Expression found for Typology ${currTypologyResult.cfg} and tenant ${tenantId}`, logContext, msgId);
        continue;
      }

      // Filter results by tenantId - expressions should include tenantId field
      const expressions = expressionRes[0] as ITypologyExpression[];
      const tenantExpression = expressions.find(
        (expr: ITypologyExpression & { tenantId?: string }) => expr.tenantId === tenantId || (!expr.tenantId && tenantId === 'default'),
      );

      if (!tenantExpression) {
        loggerService.warn(`No Typology Expression found for Typology ${currTypologyResult.cfg} and tenant ${tenantId}`, logContext, msgId);
        continue;
      }

      expression = tenantExpression;

      // Cache the expression for future use
      const cache = Singleton.getTypologyConfigCache();
      const cacheKey = `${tenantId}:${currTypologyResult.id}:${currTypologyResult.cfg}`;
      cache.set(cacheKey, expression);
    }

    const typologyResultValue = evaluateTypologyExpression(expression.rules, currTypologyResult.ruleResults, expression.expression);

    currTypologyResult.result = typologyResultValue;
    currTypologyResult.workflow.interdictionThreshold = expression.workflow.interdictionThreshold;
    currTypologyResult.workflow.alertThreshold = expression.workflow.alertThreshold;
    currTypologyResult.workflow.flowProcessor = expression.workflow.flowProcessor;

    currTypologyResult.review = false;

    if (!currTypologyResult.workflow.alertThreshold) {
      loggerService.error(`Typology ${currTypologyResult.cfg} config missing alert Threshold`, logContext, msgId);
    } else if (typologyResultValue >= currTypologyResult.workflow.alertThreshold) {
      loggerService.log(
        `Typology ${currTypologyResult.cfg} alerting on transaction : with a trigger of: ${typologyResultValue}`,
        logContext,
        msgId,
      );
      currTypologyResult.review = true;
    }

    const tadpReqBody = {
      typologyResult: currTypologyResult,
      transaction: transaction as Pacs002,
      networkMap,
      DataCache: dataCache,
    };

    let efrupStatus: string | undefined;
    let efrupBlockAlert = false;

    if (currTypologyResult.workflow.flowProcessor) {
      // if flowProcessor is defined -> get it's status
      const { flowProcessor } = currTypologyResult.workflow;
      efrupStatus = currTypologyResult.ruleResults.find((r) => r.id === flowProcessor)?.subRuleRef;
      if (efrupStatus === 'block') {
        efrupBlockAlert = true;
        currTypologyResult.review = true; // review even if we don't interdict
      } else if (efrupStatus === 'override') {
        efrupBlockAlert = true;
      }
    }

    const isInterdicting =
      currTypologyResult.workflow.interdictionThreshold !== undefined &&
      typologyResultValue >= currTypologyResult.workflow.interdictionThreshold;

    if (!configuration.SUPPRESS_ALERTS && !efrupBlockAlert && isInterdicting) {
      currTypologyResult.review = true;
      currTypologyResult.prcgTm = CalculateDuration(startTime);

      // Determine interdiction destination based on configuration
      let interdictionDestination: string[];
      if (configuration.INTERDICTION_DESTINATION === 'tenant') {
        interdictionDestination = [`${configuration.INTERDICTION_PRODUCER}-${tenantId}`];
      } else {
        interdictionDestination = [configuration.INTERDICTION_PRODUCER];
      }

      // Send Typology to interdiction service
      const spanInterdiction = apm.startSpan(`[${transactionId}] Send Typology result to interdiction service`);
      server
        .handleResponse({ ...tadpReqBody, metaData }, interdictionDestination)
        .catch((error: unknown) => {
          loggerService.error('Error while sending Typology result to interdiction service', util.inspect(error), logContext, msgId);
        })
        .finally(() => {
          spanExecReq?.end();
          spanInterdiction?.end();
        });
    }

    currTypologyResult.prcgTm = CalculateDuration(startTime);
    tadpReqBody.typologyResult = currTypologyResult;

    // Send Typology to TADProc
    const spanTadpr = apm.startSpan(`[${transactionId}] Send Typology result to TADP`);
    server
      .handleResponse({ ...tadpReqBody, metaData }, [`typology-${networkMapRules ? networkMapRules.cfg : '000@0.0.0'}`])
      .catch((error: unknown) => {
        loggerService.error('Error while sending Typology result to TADP', util.inspect(error), logContext, msgId);
      })
      .finally(() => {
        spanExecReq?.end();
        spanTadpr?.end();
      });
  }
};

export const handleTransaction = async (req: unknown): Promise<void> => {
  const context = 'handleTransaction()';

  const parsedReq = req as {
    transaction: unknown;
    networkMap: NetworkMap;
    DataCache: DataCache;
    metaData?: MetaData;
    ruleResult: RuleResult;
  };

  const { metaData, networkMap, ruleResult, transaction, DataCache: dataCache } = parsedReq;
  const parsedTrans = transaction as Pacs002;
  const apmTransaction = apm.startTransaction('typroc.handleTransaction', {
    childOf: typeof metaData?.traceParent === 'string' ? metaData.traceParent : undefined,
  });

  const transactionType = 'FIToFIPmtSts';

  const id = parsedTrans[transactionType].GrpHdr.MsgId;
  loggerService.log('tx received', context, id);

  const transactionId = parsedTrans[transactionType].GrpHdr.MsgId;

  // Extract tenantId from transaction payload or default to 'default'
  // Support both legacy TenantId and new standardized tenantId properties
  type TenantAwareTransaction = Pacs002 & { tenantId?: string };
  const tenantAwareTransaction = parsedTrans as TenantAwareTransaction;
  const tenantId = tenantAwareTransaction.tenantId ?? parsedTrans.TenantId ?? 'default';

  const cacheKey = `${tenantId}:${transactionId}`;
  // Save the rules Result to Redis and continue with the available
  const rulesList: RuleResult[] | undefined = await saveToRedisGetAll(cacheKey, ruleResult, tenantId);

  if (!rulesList) {
    loggerService.error('Redis records should never be undefined', undefined, context, id);
    return;
  }

  // Aggregations of typology config merge with rule result
  const { typologyResult, ruleCount } = ruleResultAggregation(networkMap, rulesList, ruleResult);

  // Typology evaluation and Send to TADP interdiction determining

  await evaluateTypologySendRequest(typologyResult, networkMap, parsedTrans, metaData!, cacheKey, id, dataCache, tenantId);

  // Garbage collection
  if (rulesList.length >= ruleCount) {
    const spanDelete = apm.startSpan(`cache.delete.[${transactionId}].Typology interim cache key`);
    databaseManager.deleteKey(cacheKey);
    apmTransaction?.end();
    spanDelete?.end();
  }
};
