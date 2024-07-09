// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-non-null-assertion */
// config settings, env variables
import * as dotenv from 'dotenv';
import * as path from 'path';

import { type RedisConfig } from '@frmscoe/frms-coe-lib/lib/interfaces';

// Load .env file into process.env if it exists. This is convenient for running locally.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

export interface IConfig {
  maxCPU: number;
  env: string;
  functionName: string;
  apm: {
    secretToken: string;
    serviceName: string;
    url: string;
    active: string;
  };
  db: {
    name: string;
    password: string;
    url: string;
    user: string;
    dbCertPath: string;
    cacheEnabled?: boolean;
    cacheTTL?: number;
  };
  cmsProducer: string;
  logger: {
    logstashHost: string;
    logstashPort: number;
    logstashLevel: string;
  };
  redis: RedisConfig;
  sidecarHost: string;
}

export const configuration: IConfig = {
  maxCPU: parseInt(process.env.MAX_CPU!, 10) || 1,
  apm: {
    serviceName: process.env.APM_SERVICE_NAME!,
    url: process.env.APM_URL!,
    secretToken: process.env.APM_SECRET_TOKEN!,
    active: process.env.APM_ACTIVE!,
  },
  cmsProducer: process.env.CMS_PRODUCER!,
  db: {
    name: process.env.DATABASE_NAME!,
    password: process.env.DATABASE_PASSWORD!,
    url: process.env.DATABASE_URL!,
    user: process.env.DATABASE_USER!,
    dbCertPath: process.env.DATABASE_CERT_PATH!,
    cacheEnabled: process.env.CACHE_ENABLED === 'true',
    cacheTTL: parseInt(process.env.CACHE_TTL!, 10),
  },
  env: process.env.NODE_ENV!,
  functionName: process.env.FUNCTION_NAME!,
  logger: {
    logstashHost: process.env.LOGSTASH_HOST!,
    logstashPort: parseInt(process.env.LOGSTASH_PORT ?? '0', 10),
    logstashLevel: process.env.LOGSTASH_LEVEL! || 'info',
  },
  redis: {
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
    servers: JSON.parse(process.env.REDIS_SERVERS! || '[{"hostname": "127.0.0.1", "port":6379}]'),
    password: process.env.REDIS_AUTH!,
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  },
  sidecarHost: process.env.SIDECAR_HOST!,
};
