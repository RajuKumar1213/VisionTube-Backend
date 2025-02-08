import mongoose, { isValidObjectId } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { Playlist } from '../models/playlist.model.js';

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!(name && description)) {
    throw new ApiError(400, 'Name and description are required');
  }

  const createdPlaylist = await Playlist.create({
    name,
    description,
    owner: req.user._id,
  });

  if (!createdPlaylist) {
    throw new ApiError(500, 'Failed to create playlist');
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdPlaylist, 'Playlist created'));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid user id');
  }

  const userPlaylists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId), // Match playlists by the user ID
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'videos',
        foreignField: '_id',
        as: 'videoDetails',
      },
    },

    {
      $addFields: {
        totalVideos: {
          $size: '$videos',
        },
        videoDetails: {
          $first: '$videoDetails',
        },
      },
    },

    {
      $project: {
        name: 1,
        description: 1,
        videoDetails: {
          thumbnail: 1,
        },
        totalVideos: 1,
      },
    },
  ]);

  if (!userPlaylists) {
    throw new ApiError(404, 'No playlists found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, userPlaylists, 'Playlists fetched'));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, 'Invalid playlist id');
  }

  const playList = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'videos',
        foreignField: '_id',
        as: 'videoDetails',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'owner',
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: '$videos',
        },
        videoDetails: {
          $first: '$videoDetails',
        },
        owner: {
          $first: '$owner',
        },
      },
    },

    {
      $project: {
        name: 1,
        description: 1,
        videoDetails: {
          thumbnail: 1,
        },
        totalVideos: 1,
        owner: {
          fullName: 1,
          avatar: 1,
          _id: 1,
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, playList[0], 'Playlist fetched'));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, 'Playlist not found');
  }

  if (!playlist.videos.includes(videoId)) {
    playlist.videos.push(videoId);
    const playlistWithVideo = await playlist.save();
    return res
      .status(200)
      .json(new ApiResponse(200, playlistWithVideo, 'Video added to playlist'));
  }
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const newPlaylist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      videos: { $in: [videoId] },
    },
    {
      $pull: { videos: videoId },
    },
    { new: true }
  );

  if (!newPlaylist) {
    throw new ApiError(404, 'Video not found in playlist');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, newPlaylist, 'Video removed from playlist'));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);
  if (!deletedPlaylist) {
    throw new ApiError(500, 'Failed to delete playlist');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedPlaylist, 'Playlist deleted sucessfully')
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!name || !description) {
    throw new ApiError(400, 'Name and description are required');
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { name, description },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError(500, 'Failed to update playlist');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, 'Playlist updated successfully')
    );
});

const getAllVideosOfPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, 'Invalid playlist id');
  }

  const playList = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'videos',
        foreignField: '_id',
        as: 'videoDetails',

        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
            },
          },
        ],
      },
    },

    {
      $project: {
        videoDetails: {
          _id: 1,
          title: 1,
          description: 1,
          thumbnail: 1,
          duration: 1,
          owner: {
            fullName: 1,
            username: 1,
          },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, playList[0], 'Playlist fetched'));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
  getAllVideosOfPlaylist,
};
