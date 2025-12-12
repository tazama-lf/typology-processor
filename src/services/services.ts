// SPDX-License-Identifier: Apache-2.0
import type { DatabaseManagerInstance, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import { Database } from '@tazama-lf/frms-coe-lib/lib/config/database.config';
import { Cache } from '@tazama-lf/frms-coe-lib/lib/config/redis.config';
import { CreateStorageManager } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import { loggerService, databaseManager, configuration, server } from '..';
import type { Configuration, Databases } from '../config';
import { handleTransaction } from '../logic.service';
import { getRoutesFromNetworkMap } from '@tazama-lf/frms-coe-lib/lib/helpers/networkMapIdentifiers';
import type { MsgHdrs } from 'nats';

/* eslint-disable @typescript-eslint/no-extraneous-class -- singleton */
export class Singleton {
  private static dbManager: DatabaseManagerInstance<Configuration>;

  public static async getDatabaseManager(
    configuration: Configuration,
  ): Promise<{ db: DatabaseManagerInstance<Configuration>; config: ManagerConfig }> {
    if (!Singleton.dbManager) {
      const requireAuth = configuration.nodeEnv === 'production';

      const { db } = await CreateStorageManager<typeof configuration>(
        [Database.CONFIGURATION, Cache.LOCAL, Cache.DISTRIBUTED],
        requireAuth,
      );

      Singleton.dbManager = db;
    }
    return { db: Singleton.dbManager, config: configuration };
  }
}
/* eslint-enable @typescript-eslint/no-extraneous-class */

export async function loadAllTypologyConfigs(databaseManager: DatabaseManagerInstance<Databases>): Promise<void> {
  const networkMaps = await databaseManager.getNetworkMap();
  for (const networkMap of networkMaps) {
    for (const message of networkMap.messages) {
      for (const typology of message.typologies) {
        await databaseManager.getTypologyConfig(typology.id, typology.cfg, networkMap.tenantId);
      }
    }
  }
}

export async function handleReload(object: unknown): Promise<void> {
  loggerService.log('Hot-Reloading...');
  loggerService.log('Getting new Network Map for Subscription subjects', 'updateConfig');

  const { consumers } = await getRoutesFromNetworkMap(databaseManager, configuration.functionName);

  const { headers } = object as { message: unknown; headers: MsgHdrs | null };
  if (headers?.get('config-type') === 'network-map' || headers?.get('config-type') === 'typology-config') {
    loggerService.log('Clearing node cache');
    databaseManager.nodeCache?.flushAll();

    loggerService.log('Loading all typology configurations into cache...', 'handleReload');
    await loadAllTypologyConfigs(databaseManager); // Reload all typology configs into cache

    loggerService.log('Re-subscribing', 'updateConfig');
    if (!(await server.init(handleTransaction, loggerService, consumers, configuration.INTERDICTION_PRODUCER))) {
      loggerService.log('Failed to re-subscript to nats', 'updateConfig');
    } else {
      loggerService.log('Completed re-subscription after config update', 'updateConfig');
    }
  }
}
