import Router from 'express';
const router = Router();
import { healthcheck } from '../controllers/healthCheck.controller.js';

router.route('/health-check').get(healthcheck);
export default router;
