// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import type { ManagerConfig } from '@tazama-lf/frms-coe-lib';
import type { AdditionalConfig, ProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config/processor.config';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export const additionalEnvironmentVariables: AdditionalConfig[] = [
  {
    name: 'SUPPRESS_ALERTS',
    type: 'boolean',
    optional: false,
  },
  {
    name: 'INTERDICTION_PRODUCER',
    type: 'string',
    optional: false,
  },
  {
    name: 'INTERDICTION_DESTINATION',
    type: 'string',
    optional: false,
  },
];

export interface ExtendedConfig {
  INTERDICTION_PRODUCER: string;
  SUPPRESS_ALERTS: boolean;
  INTERDICTION_DESTINATION: string;
}

export type Databases = Required<Pick<ManagerConfig, 'configuration' | 'localCacheConfig' | 'redisConfig'>>;
export type Configuration = ProcessorConfig & Databases & ExtendedConfig;
