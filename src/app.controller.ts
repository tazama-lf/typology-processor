import { CustomerCreditTransferInitiation } from './classes/iPain001Transaction';
import { NetworkMap } from './classes/network-map';
import { RuleResult } from './classes/rule-result';
import { LoggerService } from './logger.service';
import { handleTransaction } from './app.service';
import { Context, Next } from 'koa';
import apm from 'elastic-apm-node';
import { configuration } from './config';

export const handleExecute = async (ctx: Context, next: Next): Promise<Context | undefined> => {
  LoggerService.log('Start - Handle execute request');
  apm.startTransaction(configuration.functionName, 'handleExecute');
  const span = apm.startSpan('Handle execute request');

  const request = ctx.request.body;

  let networkMap: NetworkMap = new NetworkMap();
  let ruleResult: RuleResult = new RuleResult();
  let transaction: CustomerCreditTransferInitiation = new CustomerCreditTransferInitiation({});

  try {
    networkMap = request.networkMap;
    ruleResult = request.ruleResult;
    transaction = request.transaction;
  } catch (parseError) {
    const failMessage = 'Failed to parse execution request';

    LoggerService.error(failMessage, parseError as Error, 'typology.server.ts');
    LoggerService.log('End - Handle execute request');
  }

  try {
    const result = await handleTransaction(transaction, networkMap, ruleResult);

    // The request has been received but not yet acted upon.
    ctx.status = 200;
    ctx.body = {
      message: result,
    };

    await next();
    span?.end();
    return ctx;
  } catch (err) {
    const failMessage = 'Failed to process execution request.';
    LoggerService.error(failMessage, err as Error, 'ApplicationService');
  } finally {
    LoggerService.log('End - Handle execute request');
  }
};
