import './apm';
import { CreateDatabaseManager, LoggerService, type DatabaseManagerInstance } from '@frmscoe/frms-coe-lib';
import { StartupFactory, type IStartupService } from '@frmscoe/frms-coe-startup-lib';
import cluster from 'cluster';
import os from 'os';
import { configuration } from './config';
import { handleTransaction } from './logic.service';
import fastJson from 'fast-json-stringify';
import { messageSchema } from '@frmscoe/frms-coe-lib/lib/helpers/schemas/message';

const databaseManagerConfig = {
  redisConfig: {
    db: configuration.redis.db,
    servers: configuration.redis.servers,
    password: configuration.redis.password,
    isCluster: configuration.redis.isCluster,
  },
  configuration: {
    databaseName: configuration.db.name,
    certPath: configuration.db.dbCertPath,
    password: configuration.db.password,
    url: configuration.db.url,
    user: configuration.db.user,
    localCacheEnabled: configuration.db.cacheEnabled,
    localCacheTTL: configuration.db.cacheTTL,
  },
};

export const loggerService = new LoggerService();
let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;

export const dbinit = async (): Promise<void> => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
};

const serialiseMessage = fastJson({
  title: 'Message Schema',
  ...messageSchema.definitions,
});

export let server: IStartupService;

export const runServer = async (): Promise<void> => {
  await dbinit();
  server = new StartupFactory();
  if (configuration.env !== 'test') {
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      loggerService.log('Connecting to nats server...');
      if (!(await server.init(handleTransaction))) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        loggerService.log('Connected to nats');
        break;
      }
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
  // In this case it is an HTTP server
  (async () => {
    try {
      if (configuration.env !== 'test') {
        await runServer();
        loggerService.log(`Worker ${process.pid} started`);
      }
    } catch (err) {
      loggerService.error(`Error while starting HTTP server on Worker ${process.pid}`, err);
    }
  })();
  //loggerService.log(`Worker ${process.pid} started`);
}

export { databaseManager, serialiseMessage };
