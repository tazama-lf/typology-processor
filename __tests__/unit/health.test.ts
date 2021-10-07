import { Context } from 'koa';
import { handleHealthCheck, handleMonitorTransaction } from '../../src/health.controller';

describe('HealthCheck', () => {
  test('should healtcheck returns UP', () => {
    const ctx = {
      body: {
        status: 'DOWN',
      },
    };

    const ctxTest = handleHealthCheck(ctx as Context);

    expect(ctxTest.body).toMatchObject({
      status: 'UP',
    });
  });

  test('should monitorTransaction result is VALID', () => {
    const ctx = {
      body: {
        result: 'Transaction is not valid',
      },
    };

    const ctxTest = handleMonitorTransaction(ctx as Context);

    expect(ctxTest.body).toMatchObject({
      result: 'Transaction is valid',
    });
  });
});
