import NodeCache from 'node-cache';
import { ArangoDBService } from './clients';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Services {
  private static cache: NodeCache;
  private static databaseClient: ArangoDBService;

  public static getCacheInstance(): NodeCache {
    if (!Services.cache) Services.cache = new NodeCache();

    return Services.cache;
  }

  public static getDatabaseInstance(): ArangoDBService {
    if (!Services.databaseClient) Services.databaseClient = new ArangoDBService();

    return Services.databaseClient;
  }
}
