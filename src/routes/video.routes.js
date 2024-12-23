import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/multer.middleware.js';
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateThumbnail,
  updateVideoTitleAndDesc,
} from '../controllers/video.controller.js';

const router = Router();

router.route('/upload-video').post(
  verifyJWT,
  upload.fields([
    {
      name: 'videoFile',
      maxCount: 1,
    },
    {
      name: 'thumbnail',
      maxCount: 1,
    },
  ]),
  publishAVideo
);

router.route('/:?').get(getAllVideos);
router.route('/:videoId').get(getVideoById);
router.route('/update/:videoId').patch(verifyJWT, updateVideoTitleAndDesc);
router
  .route('/update-thumbnail/:videoId')
  .patch(verifyJWT, upload.single('thumbnail'), updateThumbnail);

router.route('/delete/:videoId').delete(verifyJWT, deleteVideo);
router.route('/toggle-publish/:videoId').patch(verifyJWT, togglePublishStatus);
export default router;
