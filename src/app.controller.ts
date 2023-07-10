import { NetworkMap } from './classes/network-map';
import { RuleResult } from './classes/rule-result';
import { LoggerService } from './logger.service';
import { handleTransaction } from './logic.service';
import { Context, Next } from 'koa';
import apm from 'elastic-apm-node';

export const handleExecute = async (ctx: Context, next: Next): Promise<Context | undefined> => {
  LoggerService.log('Start - Handle execute request');
  const span = apm.startSpan('Handle execute request');

  const request: unknown | any = ctx.request.body; // eslint-disable-line

  let networkMap: NetworkMap = new NetworkMap();
  let ruleResult: RuleResult = new RuleResult();

  try {
    networkMap = request.networkMap as NetworkMap;
    ruleResult = request.ruleResult as RuleResult;
  } catch (parseError) {
    const failMessage = 'Failed to parse execution request';

    LoggerService.error(failMessage, parseError as Error, 'typology.server.ts');
    LoggerService.log('End - Handle execute request');
  }

  try {
    const result = await handleTransaction(request.transaction);

    // The request has been received but not yet acted upon.
    ctx.status = 200;
    ctx.body = result;

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
