// SPDX-License-Identifier: Apache-2.0

// Service-channel env (subscribe on CONSUMER, ack on PRODUCER) must be in place before src/index is imported.
process.env.SERVICE_CHANNEL_CONSUMER = 'service-channel';
process.env.SERVICE_CHANNEL_PRODUCER = 'service-channel-ack';
process.env.SERVICE_CHANNEL_SOURCE_URI_PREFIX = '';
process.env.SERVICE_CHANNEL_CLASS = 'typology-processor';

// Transport is mocked: the StartupFactory instance exposes the additive-subscribe seam (addConsumers)
// and the ack publisher (publishServiceChannel) as jest mocks we can assert against.
jest.mock('@tazama-lf/frms-coe-startup-lib', () => ({
  StartupFactory: jest.fn(() => ({
    init: jest.fn().mockResolvedValue(true),
    initServiceChannel: jest.fn().mockResolvedValue(true),
    publishServiceChannel: jest.fn().mockResolvedValue(undefined),
    addConsumers: jest.fn().mockResolvedValue(true),
  })),
}));

// The handler re-derives the full subject set from the freshly-loaded network map.
const DEFAULT_CONSUMERS = ['pub-typology-901', 'pub-typology-902'];
jest.mock('@tazama-lf/frms-coe-lib/lib/helpers/networkMapIdentifiers', () => ({
  getRoutesFromNetworkMap: jest.fn().mockResolvedValue({ consumers: ['pub-typology-901', 'pub-typology-902'] }),
}));

jest.mock('@tazama-lf/frms-coe-lib/lib/services/dbManager', () => ({
  CreateStorageManager: jest.fn().mockReturnValue({
    db: {
      getNetworkMap: jest.fn(),
      addOneGetAll: jest.fn(),
      getTypologyConfig: jest.fn(),
      deleteKey: jest.fn(),
      isReadyCheck: jest.fn().mockReturnValue({ nodeEnv: 'test' }),
    },
  }),
}));

jest.mock('@tazama-lf/frms-coe-startup-lib/lib/interfaces/iStartupConfig', () => ({
  startupConfig: {
    startupType: 'nats',
    consumerStreamName: 'consumer',
    serverUrl: 'server',
    producerStreamName: 'producer',
    functionName: 'producer',
  },
}));

import { ServiceChannelType, SERVICE_CHANNEL_AUDIENCE } from '@tazama-lf/frms-coe-lib';
import { getRoutesFromNetworkMap } from '@tazama-lf/frms-coe-lib/lib/helpers/networkMapIdentifiers';
import { configuration, databaseManager, loggerService, runServer, server } from '../../src';
import { handleTransaction } from '../../src/logic.service';
import { handleServiceChannelMessage } from '../../src/services/service-channel.service';

const encode = (event: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(event));

const buildEvent = (overrides: Record<string, unknown> = {}): Uint8Array =>
  encode({
    specversion: '1.0',
    id: 'evt-1',
    source: 'test://producer',
    type: ServiceChannelType.NETWORK_MAP_ACTIVATED,
    datacontenttype: 'application/json',
    data: { cfg: '1.0.0', tenantId: 'tenant-A' },
    ...overrides,
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DecodedAck = { event: Record<string, any>; subject: string };

const decodeAck = (call: unknown[]): DecodedAck => {
  const [bytes, subject] = call as [Uint8Array, string];
  return { event: JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>, subject } as DecodedAck;
};

const getRoutesMock = getRoutesFromNetworkMap as jest.Mock;
let addConsumersMock: jest.Mock;
let publishMock: jest.Mock;

beforeAll(async () => {
  // Populate the exported `server` live-binding (nodeEnv === 'test' short-circuits the connect/retry
  // inside runServer) so the mocked transport seams are available for every awaited handler call.
  await runServer();
  addConsumersMock = server.addConsumers as unknown as jest.Mock;
  publishMock = server.publishServiceChannel as unknown as jest.Mock;
});

describe('service-channel dispatch + additive re-subscribe (#436)', () => {
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    configuration.functionName = 'typology-processor';
    configuration.SERVICE_CHANNEL_CLASS = SERVICE_CHANNEL_AUDIENCE.TYPOLOGY_PROCESSOR;
    configuration.SERVICE_CHANNEL_PRODUCER = 'service-channel-ack';
    configuration.SERVICE_CHANNEL_SOURCE_URI_PREFIX = '';
    getRoutesMock.mockReset();
    getRoutesMock.mockResolvedValue({ consumers: [...DEFAULT_CONSUMERS] });
    addConsumersMock.mockReset();
    addConsumersMock.mockResolvedValue(true);
    publishMock.mockReset();
    publishMock.mockResolvedValue(undefined);
    jest.spyOn(loggerService, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(loggerService, 'warn').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(loggerService, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('valid network-map.activated', () => {
    it('re-derives the network-map subjects for this function and additively subscribes them', async () => {
      await handleServiceChannelMessage(buildEvent());

      expect(getRoutesMock).toHaveBeenCalledTimes(1);
      expect(getRoutesMock).toHaveBeenCalledWith(databaseManager, configuration.functionName);
      expect(addConsumersMock).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).toHaveBeenCalledWith(DEFAULT_CONSUMERS, handleTransaction);
    });

    it('passes the data-plane transaction handler as the onMessage for the new subjects', async () => {
      await handleServiceChannelMessage(buildEvent());

      const [, onMessage] = addConsumersMock.mock.calls[0] as [string[], unknown];
      expect(onMessage).toBe(handleTransaction);
    });

    it('is a safe no-op on re-delivery, delegating idempotency to addConsumers', async () => {
      getRoutesMock.mockResolvedValue({ consumers: [...DEFAULT_CONSUMERS] });

      await handleServiceChannelMessage(buildEvent());
      await expect(handleServiceChannelMessage(buildEvent())).resolves.toBeUndefined();

      expect(addConsumersMock).toHaveBeenCalledTimes(2);
      expect(addConsumersMock).toHaveBeenNthCalledWith(2, DEFAULT_CONSUMERS, handleTransaction);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('re-subscribes the newly-added subjects when the reloaded map has grown', async () => {
      getRoutesMock.mockResolvedValueOnce({ consumers: [...DEFAULT_CONSUMERS, 'pub-typology-903'] });

      await handleServiceChannelMessage(buildEvent());

      expect(addConsumersMock).toHaveBeenCalledWith(['pub-typology-901', 'pub-typology-902', 'pub-typology-903'], handleTransaction);
    });

    it('derives by functionName for every event regardless of the tenantId, never keyed on tenant (no tenant gate)', async () => {
      // TP re-derives the full per-processor subject set; a different tenantId, or none at all, must
      // yield the identical derivation and never drop. The event tenantId must not reach the helper.
      await handleServiceChannelMessage(buildEvent({ data: { cfg: '1.0.0', tenantId: 'tenant-A' } }));
      await handleServiceChannelMessage(buildEvent({ data: { cfg: '1.0.0' } }));

      expect(getRoutesMock).toHaveBeenCalledTimes(2);
      // Both deliveries derive on (databaseManager, functionName) only - no tenant arg is ever passed.
      for (const call of getRoutesMock.mock.calls) {
        expect(call).toEqual([databaseManager, configuration.functionName]);
      }
      expect(addConsumersMock).toHaveBeenCalledTimes(2);
      expect(addConsumersMock).toHaveBeenNthCalledWith(1, DEFAULT_CONSUMERS, handleTransaction);
      expect(addConsumersMock).toHaveBeenNthCalledWith(2, DEFAULT_CONSUMERS, handleTransaction);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('completes as a no-op (subscribes nothing) when the reloaded map has no routes', async () => {
      getRoutesMock.mockResolvedValueOnce({ consumers: [] });

      await expect(handleServiceChannelMessage(buildEvent())).resolves.toBeUndefined();

      expect(addConsumersMock).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).toHaveBeenCalledWith([], handleTransaction);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('malformed input is dropped at warn without subscribing', () => {
    it('drops non-JSON bytes', async () => {
      await expect(handleServiceChannelMessage(new TextEncoder().encode('not-json'))).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).not.toHaveBeenCalled();
    });

    it('drops an envelope missing the required type attribute', async () => {
      await expect(handleServiceChannelMessage(buildEvent({ type: undefined }))).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).not.toHaveBeenCalled();
    });
  });

  describe('unknown type is dropped at warn without subscribing', () => {
    it('does not re-subscribe and does not throw', async () => {
      await expect(handleServiceChannelMessage(buildEvent({ type: 'org.tazama.network-map.deactivated' }))).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).not.toHaveBeenCalled();
    });
  });

  describe('audience gate', () => {
    it('acts when audience is absent (broadcast default)', async () => {
      await handleServiceChannelMessage(buildEvent());
      expect(addConsumersMock).toHaveBeenCalledTimes(1);
    });

    it('acts when audience is the broadcast token', async () => {
      await handleServiceChannelMessage(buildEvent({ audience: SERVICE_CHANNEL_AUDIENCE.ALL }));
      expect(addConsumersMock).toHaveBeenCalledTimes(1);
    });

    it('acts when audience is its own class token', async () => {
      await handleServiceChannelMessage(buildEvent({ audience: SERVICE_CHANNEL_AUDIENCE.TYPOLOGY_PROCESSOR }));
      expect(addConsumersMock).toHaveBeenCalledTimes(1);
    });

    it('acts when audience is its own function name (distinct from the class token)', async () => {
      configuration.functionName = 'typology-processor-worker-1';

      await handleServiceChannelMessage(buildEvent({ audience: 'typology-processor-worker-1' }));

      expect(addConsumersMock).toHaveBeenCalledTimes(1);
    });

    it('ignores a message addressed to another tier at debug, without subscribing', async () => {
      await handleServiceChannelMessage(buildEvent({ audience: SERVICE_CHANNEL_AUDIENCE.RULE_PROCESSOR }));

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).not.toHaveBeenCalled();
    });

    it('ignores an empty-string audience at debug (not broadcast), without subscribing', async () => {
      await handleServiceChannelMessage(buildEvent({ audience: '' }));

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(addConsumersMock).not.toHaveBeenCalled();
    });
  });
});

describe('service-channel ack emission (#436)', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    configuration.functionName = 'typology-processor';
    configuration.SERVICE_CHANNEL_CLASS = SERVICE_CHANNEL_AUDIENCE.TYPOLOGY_PROCESSOR;
    configuration.SERVICE_CHANNEL_PRODUCER = 'service-channel-ack';
    configuration.SERVICE_CHANNEL_SOURCE_URI_PREFIX = '';
    getRoutesMock.mockReset();
    getRoutesMock.mockResolvedValue({ consumers: [...DEFAULT_CONSUMERS] });
    addConsumersMock.mockReset();
    addConsumersMock.mockResolvedValue(true);
    publishMock.mockReset();
    publishMock.mockResolvedValue(undefined);
    jest.spyOn(loggerService, 'log').mockImplementation(() => undefined);
    jest.spyOn(loggerService, 'debug').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(loggerService, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(loggerService, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publishes exactly one ack on the reply subject (SERVICE_CHANNEL_PRODUCER) after a successful handler', async () => {
    await handleServiceChannelMessage(buildEvent({ id: 'evt-success' }));

    expect(publishMock).toHaveBeenCalledTimes(1);
    const { event, subject } = decodeAck(publishMock.mock.calls[0]);
    expect(subject).toBe('service-channel-ack');
    expect(event.type).toBe(ServiceChannelType.NETWORK_MAP_ACTIVATED);
    expect(event.data.correlationId).toBe('evt-success');
    expect(event.data.outcome).toBe('success');
    expect(event.data.error).toBeUndefined();
  });

  it('mints a fresh ack id distinct from the triggering event id', async () => {
    await handleServiceChannelMessage(buildEvent({ id: 'evt-fresh-id' }));

    expect(publishMock).toHaveBeenCalledTimes(1);
    const { event } = decodeAck(publishMock.mock.calls[0]);
    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.id).not.toBe('evt-fresh-id');
  });

  it('composes the ack source as `${SERVICE_CHANNEL_SOURCE_URI_PREFIX}${FUNCTION_NAME}`', async () => {
    configuration.SERVICE_CHANNEL_SOURCE_URI_PREFIX = 'tazama://acme/';
    configuration.functionName = 'typology-processor-worker-7';

    await handleServiceChannelMessage(buildEvent({ id: 'evt-src' }));

    expect(publishMock).toHaveBeenCalledTimes(1);
    const { event } = decodeAck(publishMock.mock.calls[0]);
    expect(event.source).toBe('tazama://acme/typology-processor-worker-7');
  });

  it('publishes an outcome:error ack with data.error when the re-subscribe throws', async () => {
    addConsumersMock.mockRejectedValueOnce(new Error('subscribe boom'));

    await handleServiceChannelMessage(buildEvent({ id: 'evt-error' }));

    expect(publishMock).toHaveBeenCalledTimes(1);
    const { event } = decodeAck(publishMock.mock.calls[0]);
    expect(event.type).toBe(ServiceChannelType.NETWORK_MAP_ACTIVATED);
    expect(event.data.correlationId).toBe('evt-error');
    expect(event.data.outcome).toBe('error');
    expect(typeof event.data.error).toBe('string');
    expect(event.data.error.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('publishes an outcome:error ack with data.error when re-deriving the network map fails', async () => {
    getRoutesMock.mockRejectedValueOnce(new Error('network-map read boom'));

    await handleServiceChannelMessage(buildEvent({ id: 'evt-route-fail' }));

    expect(addConsumersMock).not.toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledTimes(1);
    const { event } = decodeAck(publishMock.mock.calls[0]);
    expect(event.type).toBe(ServiceChannelType.NETWORK_MAP_ACTIVATED);
    expect(event.data.correlationId).toBe('evt-route-fail');
    expect(event.data.outcome).toBe('error');
    expect(typeof event.data.error).toBe('string');
    expect(event.data.error.length).toBeGreaterThan(0);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('sends exactly one ack on each of the success and error paths', async () => {
    await handleServiceChannelMessage(buildEvent({ id: 'ok' }));
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(decodeAck(publishMock.mock.calls[0]).event.data.outcome).toBe('success');

    addConsumersMock.mockRejectedValueOnce(new Error('boom'));
    await handleServiceChannelMessage(buildEvent({ id: 'bad' }));
    expect(publishMock).toHaveBeenCalledTimes(2);
    expect(decodeAck(publishMock.mock.calls[1]).event.data.outcome).toBe('error');
  });

  describe('no ack on a pre-dispatch drop', () => {
    it('does not ack malformed (non-JSON) bytes', async () => {
      await handleServiceChannelMessage(new TextEncoder().encode('not-json'));
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('does not ack an unknown type', async () => {
      await handleServiceChannelMessage(buildEvent({ id: 'u', type: 'org.tazama.network-map.deactivated' }));
      expect(publishMock).not.toHaveBeenCalled();
    });

    it('does not ack a message addressed to another tier', async () => {
      await handleServiceChannelMessage(buildEvent({ id: 'a', audience: SERVICE_CHANNEL_AUDIENCE.RULE_PROCESSOR }));
      expect(publishMock).not.toHaveBeenCalled();
    });
  });

  it('swallows a publish failure without throwing and logs at error', async () => {
    publishMock.mockRejectedValueOnce(new Error('nats down'));

    await expect(handleServiceChannelMessage(buildEvent({ id: 'evt-pubfail' }))).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not log the successful ack at warn or error', async () => {
    await handleServiceChannelMessage(buildEvent({ id: 'evt-log' }));

    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
