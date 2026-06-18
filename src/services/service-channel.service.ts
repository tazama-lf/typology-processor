// SPDX-License-Identifier: Apache-2.0

import {
  construct,
  deserialize,
  validateEnvelope,
  inAudience,
  ServiceChannelType,
  type NetworkMapActivatedData,
} from '@tazama-lf/frms-coe-lib';
import { getRoutesFromNetworkMap } from '@tazama-lf/frms-coe-lib/lib/helpers/networkMapIdentifiers';
import type { CloudEvent } from 'cloudevents';
import { configuration, databaseManager, loggerService, server } from '..';
import { handleTransaction } from '../logic.service';
import * as util from 'node:util';

type ServiceChannelAckOutcome = 'success' | 'error';

/** The reply payload echoed back on the producer subject: which trigger this acks and how it went. */
interface ServiceChannelAckData {
  correlationId: string;
  outcome: ServiceChannelAckOutcome;
  error?: string;
}

/**
 * Make-before-break re-subscribe for a freshly-activated network map. The full per-processor subject
 * set is re-derived from the reloaded map (keyed on FUNCTION_NAME, spanning every tenant) and handed
 * to the additive seam, which subscribes only the new subjects and leaves existing subscriptions in
 * place. The tenantId on the trigger is irrelevant here - derivation is by processor, never by tenant.
 */
const handleNetworkMapActivated = async (): Promise<void> => {
  const { consumers } = await getRoutesFromNetworkMap(databaseManager, configuration.functionName);
  await server.addConsumers!(consumers, handleTransaction);
  loggerService.log(`Additively subscribed ${consumers.length} data-plane consumer(s) after network-map reload`);
};

const dispatchTable: Record<string, (event: CloudEvent<NetworkMapActivatedData>) => void | Promise<void>> = {
  [ServiceChannelType.NETWORK_MAP_ACTIVATED]: handleNetworkMapActivated,
};

/**
 * Publish exactly one ack on the reply subject (`SERVICE_CHANNEL_PRODUCER`) after a handler runs. The
 * ack is a service-channel CloudEvent reusing the trigger's `type` verb with this instance as `source`
 * and `data` carrying the trigger's `id` as `correlationId`, the outcome, and (on failure) the error.
 * Generic by design (the same on every consumer); it never inspects handler-internal semantics and
 * never throws - a failed publish is logged so it cannot tear down the subscription.
 */
const emitAck = async (trigger: CloudEvent<NetworkMapActivatedData>, outcome: ServiceChannelAckOutcome, error?: string): Promise<void> => {
  try {
    const ack = construct<ServiceChannelAckData>({
      type: trigger.type as ServiceChannelType,
      source: `${configuration.SERVICE_CHANNEL_SOURCE_URI_PREFIX ?? ''}${configuration.functionName}`,
      data: { correlationId: trigger.id, outcome, ...(error !== undefined ? { error } : {}) },
    });
    const bytes = new TextEncoder().encode(JSON.stringify(ack));
    await server.publishServiceChannel!(bytes, configuration.SERVICE_CHANNEL_PRODUCER);
    if (outcome === 'success') {
      loggerService.log(`Acked ${trigger.type} on service channel (correlationId: ${trigger.id}, outcome: success)`);
    } else {
      loggerService.error(`Acked ${trigger.type} on service channel (correlationId: ${trigger.id}, outcome: error)`);
    }
  } catch (err) {
    loggerService.error(`Failed to publish service-channel ack for ${trigger.type} (correlationId: ${trigger.id}): ${util.inspect(err)}`);
  }
};

/**
 * The service-channel receive seam: validate, dispatch, re-subscribe, then ack. Decodes the
 * structured-mode CloudEvent bytes, re-checks the envelope, gates on audience, then dispatches on the
 * `type` verb. Every pre-dispatch rejection drops the message without throwing (and without acking) so
 * a single bad message can never tear down the subscription. Once a handler is matched, exactly one
 * ack is published on the reply subject - `success` when the handler returns, `error` when it throws.
 */
export const handleServiceChannelMessage = async (data: Uint8Array): Promise<void> => {
  let event: CloudEvent<NetworkMapActivatedData>;
  try {
    event = deserialize<NetworkMapActivatedData>(data);
    validateEnvelope(event);
  } catch (err) {
    loggerService.warn(`Discarding malformed service-channel message: ${util.inspect(err)}`);
    return;
  }

  const handler = dispatchTable[event.type];
  if (!handler) {
    loggerService.warn(`Discarding service-channel message of unknown type: ${event.type}`);
    return;
  }

  const { audience } = event as unknown as { audience?: unknown };
  if (
    !inAudience(typeof audience === 'string' ? audience : undefined, {
      class: configuration.SERVICE_CHANNEL_CLASS,
      functionName: configuration.functionName,
    })
  ) {
    loggerService.debug(
      `Ignoring service-channel message not addressed to ${configuration.SERVICE_CHANNEL_CLASS} (audience: ${String(audience)})`,
    );
    return;
  }

  let outcome: ServiceChannelAckOutcome = 'success';
  let ackError: string | undefined;
  try {
    await handler(event);
  } catch (err) {
    outcome = 'error';
    ackError = err instanceof Error ? err.message : util.inspect(err);
    loggerService.error(`Service-channel handler for ${event.type} failed: ${ackError}`);
  }

  await emitAck(event, outcome, ackError);
};
