import Router from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  getUserChannelSubscribers,
  toggleSubscription,
  getSubscribedChannels,
  getChannelIsSubscribed,
} from '../controllers/subscription.controller.js';

const router = Router();
router.use(verifyJWT);

router.route('/t-subscribe/:channelId').post(toggleSubscription);
router.route('/subscribers/:channelId').get(getUserChannelSubscribers);
router.route('/subscribed-channels/:subscriberId').get(getSubscribedChannels);
router.route('/channel-is-subscribed/:channelId').get(getChannelIsSubscribed);

export default router;
