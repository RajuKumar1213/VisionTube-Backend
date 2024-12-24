import Router from 'express';
const router = Router();
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  getChannelStats,
  getChannelVideos,
} from '../controllers/dashboard.controller.js';

router.use(verifyJWT);

router.route('/my-dashboard').get(getChannelStats);
router.route('/my-videos/?').get(getChannelVideos);

export default router;
