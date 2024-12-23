import Router from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createTweet,
  deleteTweet,
  getUserTweets,
  updateTweet,
} from '../controllers/tweet.controller.js';

const router = Router();
router.use(verifyJWT);

router.route('/create-tweet').post(createTweet);
router.route('/user-tweets').get(verifyJWT, getUserTweets);
router.route('/update-tweet/:tweetId').patch(verifyJWT, updateTweet);
router.route('/delete-tweet/:tweetId').delete(verifyJWT, deleteTweet);

export default router;
