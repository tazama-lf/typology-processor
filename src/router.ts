import Router from 'koa-router';
import { handleExecute } from './app.controller';
import { handleHealthCheck } from './health.controller';

const router = new Router();

router.get('/', handleHealthCheck);
router.get('/health', handleHealthCheck);
router.get('/execute', handleExecute);

export default router;
