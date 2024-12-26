import Router from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  getLikedVideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
} from '../controllers/like.controller.js';

const router = Router();
router.use(verifyJWT);

router.route('/like-video/:videoId').patch(toggleVideoLike);
router.route('/like-comment/:commentId').patch(toggleCommentLike);
router.route('/like-tweet/:tweetId').patch(toggleTweetLike);
router.route('/all-videos').get(getLikedVideos);

export default router;
