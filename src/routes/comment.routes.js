import Router from 'express';
const router = Router();
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from '../controllers/comment.controller.js';

router.use(verifyJWT);

router.route('/add-comment/:videoId').post(addComment);
router.route('/all-comments/:videoId').get(getVideoComments);
router.route('/update-comment/:commentId').put(updateComment);
router.route('/delete-comment/:commentId').delete(deleteComment);

export default router;
