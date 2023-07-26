import { CreateDatabaseManager, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { type IStartupService, StartupFactory } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import apm from 'elastic-apm-node';
import os from 'os';
import { configuration } from './config';
import { LoggerService } from './logger.service';
import { handleTransaction } from './logic.service';
import { Services } from './services';

const databaseManagerConfig = {
  redisConfig: {
    db: configuration.redis.db,
    servers: configuration.redis.servers,
    password: configuration.redis.password,
    isCluster: configuration.redis.isCluster,
  },
};

/*
 * Initialize the APM Logging
 **/
if (configuration.apm.active === 'true') {
  apm.start({
    serviceName: configuration.apm?.serviceName,
    secretToken: configuration.apm?.secretToken,
    serverUrl: configuration.apm?.url,
    usePathAsTransactionName: true,
    active: Boolean(configuration.apm?.active),
  });
}

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;

export const dbinit = async (): Promise<void> => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
  console.log(databaseManager.isReadyCheck());
};

export const cache = Services.getCacheInstance();
export const databaseClient = Services.getDatabaseInstance();
export let server: IStartupService;

export const runServer = async (): Promise<void> => {
  await dbinit();
  server = new StartupFactory();
  if (configuration.env !== 'test') {
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      LoggerService.log('Connecting to nats server...');
      if (!(await server.init(handleTransaction))) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        LoggerService.log('Connected to nats');
        break;
      }
    }
  }
};

process.on('uncaughtException', (err) => {
  LoggerService.error('process on uncaughtException error', err, 'index.ts');
});

process.on('unhandledRejection', (err) => {
  LoggerService.error(`process on unhandledRejection error: ${JSON.stringify(err) ?? '[NoMetaData]'}`);
});

const numCPUs = os.cpus().length > configuration.maxCPU ? configuration.maxCPU + 1 : os.cpus().length + 1;

if (cluster.isPrimary && configuration.maxCPU !== 1) {
  LoggerService.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < 2; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    LoggerService.log(`worker ${Number(worker.process.pid)} died, starting another worker`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  (async () => {
    try {
      if (configuration.env !== 'test') {
        await runServer();
      }
    } catch (err) {
      LoggerService.error(`Error while starting HTTP server on Worker ${process.pid}`, err);
    }
  })();
  LoggerService.log(`Worker ${process.pid} started`);
}

export { databaseManager };
