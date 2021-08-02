import { RedisClient } from 'redis';
import { LoggerService } from '../services/logger.service';

let redisClient: RedisClient;

const initializeRedis = (redisDB: string, redisHost: string, redisPort: number, redisAuth: string): void => {
  redisClient = new RedisClient({
    db: redisDB,
    host: redisHost,
    port: redisPort,
    auth_pass: redisAuth,
  });
};

const redisGetJson = (key: string): Promise<string> =>
  new Promise((resolve) => {
    redisClient.get(key, (err, res) => {
      if (err) {
        LoggerService.error('Error while getting Redis key', err);
        resolve('');
      }
      resolve(res ?? '');
    });
  });

const redisSetJson = (key: string, value: string): Promise<string> =>
  new Promise((resolve) => {
    redisClient.SET(key, value, (err, res) => {
      if (err) {
        LoggerService.error(`Error while saving to Redis key: ${key}`, err);
        resolve('');
      }
      resolve(res);
    });
  });

const redisDeleteKey = (key: string): Promise<number> =>
  new Promise((resolve) => {
    redisClient.DEL(key, (err, res) => {
      if (err) {
        LoggerService.error(`Error while Deleting key in Redis: ${key}`, err);
        resolve(0);
      }
      resolve(res);
    });
  });

export { redisGetJson, redisSetJson, initializeRedis, redisDeleteKey };
