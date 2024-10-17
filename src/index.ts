// SPDX-License-Identifier: Apache-2.0
import './apm';
import { ComputeEngine } from '@cortex-js/compute-engine';
import { LoggerService, type DatabaseManagerInstance } from '@tazama-lf/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@tazama-lf/frms-coe-startup-lib';
import { getRoutesFromNetworkMap } from '@tazama-lf/frms-coe-lib/lib/helpers/networkMapIdentifiers';
import cluster from 'cluster';
import os from 'os';
import { additionalEnvironmentVariables, type Configuration } from './config';
import { handleTransaction } from './logic.service';
import { type Databases, Singleton } from './services/services';
import { validateProcessorConfig } from '@tazama-lf/frms-coe-lib/lib/config/processor.config';

let configuration = validateProcessorConfig(additionalEnvironmentVariables) as Configuration;
export const loggerService: LoggerService = new LoggerService(configuration);
let databaseManager: DatabaseManagerInstance<Databases>;

export const computeEngine = new ComputeEngine();

export const dbInit = async (): Promise<void> => {
  const { db, config } = await Singleton.getDatabaseManager(configuration);
  databaseManager = db;
  configuration = { ...configuration, ...config };
};

export let server: IStartupService;

export const runServer = async (): Promise<void> => {
  server = new StartupFactory();
  if (configuration.nodeEnv !== 'test') {
    let isConnected = false;
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      loggerService.log('Connecting to nats server...');
      const { consumers } = await getRoutesFromNetworkMap(databaseManager, configuration.functionName);
      if (!(await server.init(handleTransaction, undefined, consumers, configuration.INTERDICTION_PRODUCER))) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        loggerService.log('Connected to nats');
        isConnected = true;
        break;
      }
    }

    if (!isConnected) {
      throw new Error('Unable to connect to nats after 10 retries');
    }
  }
};

process.on('uncaughtException', (err) => {
  loggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  loggerService.error(`process on unhandledRejection error: ${JSON.stringify(err) ?? '[NoMetaData]'}`);
});

const numCPUs = os.cpus().length > configuration.maxCPU ? configuration.maxCPU + 1 : os.cpus().length + 1;

if (cluster.isPrimary && configuration.maxCPU !== 1) {
  loggerService.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    loggerService.log(`worker ${Number(worker.process.pid)} died, starting another worker`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an NATS server
  (async () => {
    try {
      if (configuration.nodeEnv !== 'test') {
        await dbInit();
        await runServer();
      }
    } catch (err) {
      loggerService.error(`Error while starting services on Worker ${process.pid}`, err);
      process.exit(1);
    }
  })();
  loggerService.log(`Worker ${process.pid} started`);
}

export { databaseManager, configuration };
