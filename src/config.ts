// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { ProcessorConfig, AdditionalConfig } from '@tazama-lf/frms-coe-lib/lib/config/processor.config';
import type { Databases } from './services/services';

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
];

export interface ExtendedConfig {
  INTERDICTION_PRODUCER: string;
  SUPPRESS_ALERTS: boolean;
}

export type Configuration = ProcessorConfig & Databases & ExtendedConfig;
