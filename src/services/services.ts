// SPDX-License-Identifier: Apache-2.0
import type { DatabaseManagerInstance, ManagerConfig } from '@tazama-lf/frms-coe-lib';
import { Database } from '@tazama-lf/frms-coe-lib/lib/config/database.config';
import { Cache } from '@tazama-lf/frms-coe-lib/lib/config/redis.config';
import { CreateStorageManager } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import NodeCache from 'node-cache';
import type { Configuration } from '../config';
import type { ITypologyExpression } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/TypologyConfig';
import { loggerService } from '../index';

/* eslint-disable @typescript-eslint/no-extraneous-class -- singleton */
export class Singleton {
  private static dbManager: DatabaseManagerInstance<Configuration> | undefined;
  private static typologyConfigCache: NodeCache | undefined;

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

  public static getTypologyConfigCache(): NodeCache {
    Singleton.typologyConfigCache ??= new NodeCache({ stdTTL: 86400 });
    return Singleton.typologyConfigCache;
  }
  public static loadAllTypologyConfigs(): void {
    if (!Singleton.dbManager) {
      // Database manager not initialized yet - this is expected during startup
      // Configurations will be loaded lazily when needed
      return;
    }

    const cache = Singleton.getTypologyConfigCache();

    try {
      // Get all typology configurations from the database
      // This assumes the database manager has a method to get all typology configurations
      // Since the exact method signature may vary, we'll implement lazy loading for now
      // and load configurations as they are requested
      cache.flushAll(); // Clear existing cache to prepare for new configs

      // Note: In a full implementation, you would query the database here
      // to load all typology configurations and cache them by tenant
      // For example:
      // const allConfigs = await Singleton.dbManager.getAllTypologyConfigs();
      // allConfigs.forEach(config => {
      //   const cacheKey = `${config.tenantId || 'default'}:${config.id}:${config.cfg}`;
      //   cache.set(cacheKey, config);
      // });
    } catch (error) {
      loggerService.error('Error loading typology configurations:', error);
      // Don't throw here - allow lazy loading to work as fallback
    }
  }

  public static getTypologyConfigFromCache(tenantId: string, id: string, cfg: string): ITypologyExpression | undefined {
    const cache = Singleton.getTypologyConfigCache();
    const cacheKey = `${tenantId}:${id}:${cfg}`;
    return cache.get<ITypologyExpression>(cacheKey);
  }
}
/* eslint-enable @typescript-eslint/no-extraneous-class */