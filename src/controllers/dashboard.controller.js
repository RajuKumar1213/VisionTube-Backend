import mongoose from 'mongoose';
import { Video } from '../models/video.model.js';
import { User } from '../models/user.model.js';
import { Subscription } from '../models/subscription.model.js';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getChannelStats = asyncHandler(async (req, res) => {
  const dashBoardDetails = await User.aggregate([
    {
      $match: {
        _id: req.user?._id,
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscriber',
      },
    },
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscriberTo',
      },
    },
    // fetching total video count
    {
      $lookup: {
        from: 'videos',
        localField: '_id',
        foreignField: 'owner',
        as: 'videos',
      },
    },
    {
      $lookup: {
        from: 'likes',
        let: { videoIds: '$videos._id' },
        pipeline: [
          {
            $unwind: '$video', // Unwind the video array to check individual IDs,
          },
          {
            $match: {
              $expr: {
                $in: ['$video', '$$videoIds'],
              },
            },
          },
        ],
        as: 'likes',
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: { $ifNull: ['$subscriber', []] } },
        subscribedToCount: { $size: { $ifNull: ['$subscriberTo', []] } },
        totalVideos: { $size: { $ifNull: ['$videos', []] } },
        totalLikes: { $size: '$likes' },
        totalViews: {
          $sum: {
            $map: {
              input: { $ifNull: ['$vidoes', []] },
              as: 'video',
              in: '$$video.views',
            },
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        totalVideos: 1,
        totalViews: 1,
        totalLikes: 1,
      },
    },
  ]);

  if (!dashBoardDetails) {
    throw new ApiError(500, "Error while fetching user's dashboard details.");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        dashBoardDetails[0],
        'Dashboard details fetched successfully.'
      )
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel
  const { page = 1, limit = 20 } = req.query;
  const currentPage = parseInt(page, 10);
  const pageSize = parseInt(limit, 10);

  const allVideos = await Video.aggregate([
    {
      $match: {
        owner: req.user?._id,
      },
    },
    {
      $project: {
        title: 1,
        thumbnail: 1,
        videoFile: 1,
        views: 1,
        createdAt: 1,
      },
    },
    {
      $facet: {
        metadata: [
          {
            $count: 'total',
          },
        ],
        data: [
          {
            $skip: (currentPage - 1) * pageSize,
          },
          {
            $limit: pageSize,
          },
        ],
      },
    },
  ]);

  if (!allVideos || !allVideos[0].metadata.length) {
    throw new ApiError(404, 'No videos found for this channel.');
  }

  // Extract metadata and video data
  const totalVideos = allVideos[0].metadata[0]?.total || 0;
  const videos = allVideos[0].data;

  // Calculate pagination details
  const totalPages = Math.ceil(totalVideos / pageSize);

  // Build the response object
  const response = {
    videos,
    metadata: {
      totalCount: totalVideos,
      currentPage,
      pageSize,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        response,
        'Channel videos fetched successfully.'
      )
    );
});

export { getChannelStats, getChannelVideos };
