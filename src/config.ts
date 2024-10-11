// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import {
  validateDatabaseConfig,
  validateEnvVar,
  validateLocalCacheConfig,
  validateProcessorConfig,
  validateRedisConfig,
} from '@tazama-lf/frms-coe-lib/lib/helpers/env';
import { Database } from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';
import { type ManagerConfig } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface IConfig {
  maxCPU: number;
  env: string;
  functionName: string;
  db: ManagerConfig;
  interdictionProducer: string;
  logstashLevel: string;
  sidecarHost?: string;
  suppressAlerts: boolean;
}

const generalConfig = validateProcessorConfig();
const suppressAlerts = validateEnvVar<boolean>('SUPPRESS_ALERTS', 'boolean');
const interdictionProducer = validateEnvVar<string>('INTERDICTION_PRODUCER', 'string');
const authEnabled = generalConfig.nodeEnv === 'production';
const redisConfig = validateRedisConfig(authEnabled);
const configurationResult = validateDatabaseConfig(authEnabled, Database.CONFIGURATION);
const localCacheConfig = validateLocalCacheConfig();

export const configuration: IConfig = {
  maxCPU: generalConfig.maxCPU,
  env: generalConfig.nodeEnv,
  functionName: generalConfig.functionName,
  suppressAlerts,
  interdictionProducer,
  db: {
    localCacheConfig,
    configuration: configurationResult,
    redisConfig,
  },
  sidecarHost: process.env.SIDECAR_HOST,
  logstashLevel: validateEnvVar('LOGSTASH_LEVEL', 'string'),
};
