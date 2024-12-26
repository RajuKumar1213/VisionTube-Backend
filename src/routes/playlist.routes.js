import Router from 'express';
const router = Router();
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  addVideoToPlaylist,
  createPlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
} from '../controllers/playlist.controller.js';

router.use(verifyJWT);

router.route('/create-playlist').post(createPlaylist);
router.route('/:userId').get(getUserPlaylists);
router.route('/playlist/:playlistId').get(getPlaylistById);
router.route('/:playlistId/add-video/:videoId').post(addVideoToPlaylist);
router
  .route('/:playlistId/remove-video/:videoId')
  .post(removeVideoFromPlaylist);

router.route('/delete/:playlistId').delete(deletePlaylist);
router.route('/update/:playlistId').patch(updatePlaylist);

export default router;
