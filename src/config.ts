// SPDX-License-Identifier: Apache-2.0
// config settings, env variables
import { SERVICE_CHANNEL_AUDIENCE, type ManagerConfig, type ServiceChannelAudienceClass } from '@tazama-lf/frms-coe-lib';
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
  {
    name: 'SERVICE_CHANNEL_PRODUCER',
    type: 'string',
    optional: true,
  },
  {
    name: 'SERVICE_CHANNEL_CONSUMER',
    type: 'string',
    optional: true,
  },
  {
    name: 'SERVICE_CHANNEL_SOURCE_URI_PREFIX',
    type: 'string',
    optional: true,
  },
  {
    name: 'SERVICE_CHANNEL_CLASS',
    type: 'string',
    optional: false,
  },
];

export interface ExtendedConfig {
  INTERDICTION_PRODUCER: string;
  SUPPRESS_ALERTS: boolean;
  INTERDICTION_DESTINATION: string;
  SERVICE_CHANNEL_PRODUCER?: string;
  SERVICE_CHANNEL_CONSUMER?: string;
  SERVICE_CHANNEL_SOURCE_URI_PREFIX?: string;
  SERVICE_CHANNEL_CLASS: ServiceChannelAudienceClass;
}

export type Databases = Required<Pick<ManagerConfig, 'configuration' | 'localCacheConfig' | 'redisConfig'>>;
export type Configuration = ProcessorConfig & Databases & ExtendedConfig;

export const validateServiceChannelConfiguration = (configuration: Configuration): void => {
  if (configuration.SERVICE_CHANNEL_CLASS !== SERVICE_CHANNEL_AUDIENCE.TYPOLOGY_PROCESSOR) {
    throw new Error(`Environment variable SERVICE_CHANNEL_CLASS must be '${SERVICE_CHANNEL_AUDIENCE.TYPOLOGY_PROCESSOR}'.`);
  }
};
