// SPDX-License-Identifier: Apache-2.0
import type { DatabaseManagerInstance, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import { Database } from '@tazama-lf/frms-coe-lib/lib/config/database.config';
import { Cache } from '@tazama-lf/frms-coe-lib/lib/config/redis.config';
import { CreateStorageManager } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import type { Configuration, Databases } from '../config';

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
