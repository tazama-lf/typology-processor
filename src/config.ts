// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import * as dotenv from 'dotenv';
import * as path from 'path';

import { type RedisConfig } from '@tazama-lf/frms-coe-lib/lib/interfaces';
import {
  validateEnvVar,
  validateProcessorConfig,
  validateRedisConfig,
  validateDatabaseConfig,
} from '@tazama-lf/frms-coe-lib/lib/helpers/env';
import { Database } from '@tazama-lf/frms-coe-lib/lib/helpers/env/database.config';
import { type DBConfig } from '@tazama-lf/frms-coe-lib/lib/services/dbManager';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface IConfig {
  maxCPU: number;
  env: string;
  functionName: string;
  db: DBConfig;
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
const db = validateDatabaseConfig(authEnabled, Database.CONFIGURATION);

export const configuration: IConfig = {
  maxCPU: generalConfig.maxCPU,
  interdictionProducer,
  db,
  env: generalConfig.nodeEnv,
  functionName: generalConfig.functionName,
  logstashLevel: validateEnvVar('LOGSTASH_LEVEL', 'string'),
  redis: redisConfig,
  sidecarHost: process.env.SIDECAR_HOST,
  suppressAlerts,
};
