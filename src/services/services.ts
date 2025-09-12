// SPDX-License-Identifier: Apache-2.0
import type { DatabaseManagerInstance, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import { Database } from '@tazama-lf/frms-coe-lib/lib/config/database.config';
import { Cache } from '@tazama-lf/frms-coe-lib/lib/config/redis.config';
import { CreateStorageManager } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import NodeCache from 'node-cache';
import type { Configuration } from '../config';
import type { ITypologyExpression } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/TypologyConfig';

// single instance of typology configuration cache
const typologyConfigCache = new NodeCache({ stdTTL: 86400 });

/* eslint-disable @typescript-eslint/no-extraneous-class -- singleton */
export class Singleton {
  private static dbManager: DatabaseManagerInstance<Configuration> | undefined;

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

export function getTypologyConfigCache(): NodeCache {
  return typologyConfigCache;
}

export function getTypologyConfigFromCache(tenantId: string, id: string, cfg: string): ITypologyExpression | undefined {
  const cacheKey = `${tenantId}:${id}:${cfg}`;
  return typologyConfigCache.get<ITypologyExpression>(cacheKey);
}

export function setTypologyConfigInCache(tenantId: string, id: string, cfg: string, expression: ITypologyExpression): void {
  const cacheKey = `${tenantId}:${id}:${cfg}`;
  typologyConfigCache.set(cacheKey, expression);
}

/* eslint-enable @typescript-eslint/no-extraneous-class */
