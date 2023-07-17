import cluster from 'cluster';
import apm from 'elastic-apm-node';
import os from 'os';
import { configuration } from './config';
import { LoggerService } from './logger.service';
import { Services } from './services';
import { StartupFactory, IStartupService } from '@frmscoe/frms-coe-startup-lib';
import { handleTransaction } from './logic.service';

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

export const cache = Services.getCacheInstance();
export const databaseClient = Services.getDatabaseInstance();
export const cacheClient = Services.getCacheClientInstance();
export let server: IStartupService;

export const runServer = async () => {
  // await dbinit();
  server = new StartupFactory();
  if (configuration.env !== 'test')
    for (let retryCount = 0; retryCount < 10; retryCount++) {
      LoggerService.log('Connecting to nats server...');
      if (!(await server.init(handleTransaction))) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        LoggerService.log('Connected to nats');
        break;
      }
    }
};

const numCPUs = os.cpus().length > configuration.maxCPU ? configuration.maxCPU + 1 : os.cpus().length + 1;

if (cluster.isPrimary && configuration.maxCPU !== 1) {
  LoggerService.log(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i < 2; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    LoggerService.log(`worker ${worker.process.pid} died, starting another worker`);
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
