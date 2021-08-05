import { Database } from 'arangojs';
import NodeCache from 'node-cache';
import { cache } from '..';
import { config } from '../config';
import { ITypologyExpression } from '../interfaces/iTypologyExpression';
import { LoggerService } from '../services/logger.service';
import apm from 'elastic-apm-node';

class ArangoDBService {
    client: Database;

    constructor() {
        this.client = new Database({
            url: config.dbURL,
            databaseName: config.dbName,
            auth: {
                username: config.dbUser,
                password: config.dbPassword,
            },
        });

        LoggerService.log('✅ ArangoDB connection is ready');
    }

    async getTypologyExpression(typologyId: string): Promise<ITypologyExpression | undefined> {
        const cacheVal = cache.get(typologyId);
        if (cacheVal)
            return cacheVal as ITypologyExpression;
        let span = apm.startSpan('Fetch Typology Expression from Database');
        const typologyExpressionQuery = `
        FOR doc IN typologyExpression
        FILTER doc._key == "${typologyId}"
        RETURN doc
        `;

        try {
            const cycles = await this.client.query(typologyExpressionQuery);
            const results = await cycles.batches.all();
            const typologyExpression: ITypologyExpression = results[0][0];
            span?.end();
            cache.set(typologyId, results[0][0]);
            return typologyExpression;
        } catch (error) {
            span?.end();
            LoggerService.error(
                'Error while executing ArangoDB query with message:',
                error,
                'ArangoDBService',
            );
            return;
        }
    }
}

export const arangoDBService: ArangoDBService = new ArangoDBService();
