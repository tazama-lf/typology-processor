import { Database } from 'arangojs';
import { configuration } from '../config';
import { LoggerService } from '../logger.service';
import { cache } from '..';
import { ITypologyExpression } from '../interfaces/iTypologyExpression';
import apm from 'elastic-apm-node';
import { Typology } from '../classes/network-map';
import * as fs from 'fs';

export class ArangoDBService {
  client: Database;

  constructor() {
    const caOption = fs.existsSync(configuration.db.dbCertPath)
      ? [fs.readFileSync(configuration.db.dbCertPath)]
      : [];
    this.client = new Database({
      url: 'https://frmarango-sandbox.sybrin.com/',
      databaseName: 'Configuration',
      auth: {
        username: 'root',
        password: '8eaAfEZWNJWI',
      },
      agentOptions: {
        ca: caOption,
      },
    });

    if (this.client.isArangoDatabase) {
      LoggerService.log('✅ ArangoDB connection is ready');
    } else {
      LoggerService.error('❌ ArangoDB connection is not ready');
      throw new Error('ArangoDB connection is not ready');
    }
  }

  async query(query: string): Promise<unknown> {
    try {
      const cycles = await this.client.query(query);

      const results = await cycles.batches.all();

      LoggerService.log(`Query result: ${JSON.stringify(results)}`);

      return results;
    } catch (error) {
      LoggerService.error('Error while executing query from arango with message:', error as Error, 'ArangoDBService');
    }
  }

  async getTypologyExpression(typology: Typology): Promise<ITypologyExpression | undefined> {
    const cacheVal = cache.get(`${typology.id}_${typology.cfg}`);
    if (cacheVal) return cacheVal as ITypologyExpression;
    const span = apm.startSpan('Fetch Typology Expression from Database');
    const typologyExpressionQuery = `
        FOR doc IN ${configuration.db.collectionName}
        FILTER doc.id == "${typology.id}" AND doc.cfg == "${typology.cfg}"
        RETURN doc
        `;

    try {
      const cycles = await this.client.query(typologyExpressionQuery);
      const results = await cycles.batches.all();
      if (results.length === 0) return;
      const typologyExpression: ITypologyExpression = results[0][0];
      cache.set(`${typology.id}_${typology.cfg}`, results[0][0], configuration.cacheTTL);
      return typologyExpression;
    } catch (error) {
      LoggerService.error('Error while executing ArangoDB query with message:', error as Error, 'ArangoDBService');
    } finally {
      if (span) span.end();
    }
  }
}
