import Router from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updatePassword,
  getCurrentUser,
  updateCoverImage,
  getChannelProfileDetails,
  getWatchHistory,
  updateAccountDetails,
  updateAvatar,
  forgetPassword,
  makeWatchHistory,
} from '../controllers/user.controller.js';
import { upload } from '../middleware/multer.middleware.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.route('/register').post(
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1,
    },
    {
      name: 'coverImage',
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route('/login').post(loginUser);

// secured routes
router.route('/logout').post(verifyJWT, logoutUser);
router.route('/refresh-token').post(refreshAccessToken);
router.route('/change-password').post(verifyJWT, updatePassword);
router.route('/forgot-password').patch(forgetPassword);
router.route('/current-user').get(verifyJWT, getCurrentUser);
router.route('/update-account-details').patch(verifyJWT, updateAccountDetails);
router
  .route('/update-avatar')
  .patch(verifyJWT, upload.single('avatar'), updateAvatar);

router
  .route('/update-coverimage')
  .patch(verifyJWT, upload.single('coverImage'), updateCoverImage);

router.route('/channel/:username').get(verifyJWT, getChannelProfileDetails);

router.route('/watch-history').get(verifyJWT, getWatchHistory);
router.route('/make-watch-history').patch(verifyJWT, makeWatchHistory);

// router.route('/update-username').patch(updateAllusername);
export default router;
