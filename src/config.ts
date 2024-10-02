// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import * as dotenv from 'dotenv';
import * as path from 'path';

import { type RedisConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import { validateEnvVar } from '@tazama-lf/frms-coe-lib/lib/helpers/env';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/processor.config';
import { validateRedisConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/redis.config';
import { Database, validateDatabaseConfig } from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface IConfig {
  maxCPU: number;
  env: string;
  functionName: string;
  db: {
    name: string;
    password: string;
    url: string;
    user: string;
    dbCertPath: string;
    cacheEnabled?: boolean;
    cacheTTL?: number;
  };
  interdictionProducer: string;
  logstashLevel: string;
  redis: RedisConfig;
  sidecarHost?: string;
  suppressAlerts: boolean;
}

const generalConfig = validateProcessorConfig();
const suppressAlerts = validateEnvVar<boolean>('SUPPRESS_ALERTS', 'boolean');
const interdictionProducer = validateEnvVar<string>('INTERDICTION_PRODUCER', 'string');

const authEnabled = generalConfig.nodeEnv === 'production';
const redisConfig = validateRedisConfig(authEnabled);
const configDBConfig = validateDatabaseConfig(authEnabled, Database.CONFIGURATION);

export const configuration: IConfig = {
  maxCPU: generalConfig.maxCPU,
  interdictionProducer,
  db: {
    name: configDBConfig.name,
    password: configDBConfig.password ?? '',
    url: configDBConfig.url,
    user: configDBConfig.user,
    dbCertPath: configDBConfig.certPath,
    cacheEnabled: validateEnvVar<boolean>('CACHE_ENABLED', 'boolean'),
    cacheTTL: validateEnvVar<number>('CACHETTL', 'number'),
  },
  env: generalConfig.nodeEnv,
  functionName: generalConfig.functionName,
  logstashLevel: validateEnvVar('LOGSTASH_LEVEL', 'string'),
  redis: redisConfig,
  sidecarHost: process.env.SIDECAR_HOST,
  suppressAlerts,
};
