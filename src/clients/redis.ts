import redis from 'redis';
import { configuration } from '../config';
import { LoggerService } from '../logger.service';

export class RedisService {
  client: redis.RedisClient;

  constructor() {
    this.client = redis.createClient({
      db: configuration.redis?.db,
      host: configuration.redis?.host,
      port: configuration.redis?.port,
      auth_pass: configuration.redis?.auth,
    });
    this.client.on('connect', () => {
      LoggerService.log('✅ Redis connection is ready');
    });
    this.client.on('error', (error) => {
      LoggerService.error('❌ Redis connection is not ready', error);
    });
  }

  getJson = (key: string): Promise<string> =>
    new Promise((resolve) => {
      this.client.get(key, (err, res) => {
        if (err) {
          LoggerService.error('Error while getting key from redis with message:', err, 'RedisService');

          resolve('');
        }
        resolve(res ?? '');
      });
    });

  setJson = (key: string, value: string): Promise<string> =>
    new Promise((resolve) => {
      this.client.SET(key, value, (err, res) => {
        if (err) {
          LoggerService.error('Error while setting key to redis with message:', err, 'RedisService');

          resolve('');
        }
        resolve(res);
      });
    });

  deleteKey = (key: string): Promise<number> =>
    new Promise((resolve) => {
      this.client.DEL(key, (err, res) => {
        if (err) {
          LoggerService.error('Error while deleting key from redis with message:', err, 'RedisService');

          resolve(0);
        }
        resolve(res);
      });
    });
}
