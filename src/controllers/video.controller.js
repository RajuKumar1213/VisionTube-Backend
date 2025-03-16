import mongoose, { isValidObjectId } from 'mongoose';
import { Video } from '../models/video.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from '../utils/cloudinary.js';

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    limit = 10,
    query,
    sortBy = 'views',
    sortType = 'desc',
    userId,
    lastVideoId,
  } = req.query;

  const limitNumber = parseInt(limit, 10);
  const sortOrder = sortType === 'asc' ? 1 : -1;

  // MongoDB aggregation pipeline
  const pipeline = [];

  // Match Stage (Filter by query or user ID)
  const matchStage = {};
  if (query) matchStage.title = { $regex: query, $options: 'i' };
  if (userId) matchStage.owner = new mongoose.Types.ObjectId(userId);

  // Cursor-based pagination (Fix for duplicate issue)
  if (lastVideoId) {
    matchStage._id =
      sortOrder === -1
        ? { $lt: new mongoose.Types.ObjectId(lastVideoId) } // Fetch older videos
        : { $gt: new mongoose.Types.ObjectId(lastVideoId) }; // Fetch newer videos
  }

  pipeline.push({ $match: matchStage });

  // Sort Stage (Fix duplicate issues)
  pipeline.push({
    $sort: { [sortBy]: sortOrder, _id: sortOrder }, // Sort by `views` and `_id`
  });

  // Lookup Owner Details (User Info)
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'owner',
      foreignField: '_id',
      as: 'owner',
      pipeline: [{ $project: { username: 1, avatar: 1, fullName: 1 } }],
    },
  });

  // Flatten Owner Array
  pipeline.push({
    $addFields: {
      owner: { $arrayElemAt: ['$owner', 0] },
    },
  });

  // Pagination Limit (🔥 No `$skip` to prevent duplicate data)
  pipeline.push({ $limit: limitNumber });

  // Execute aggregation
  const videos = await Video.aggregate(pipeline);

  // Handle case when no videos are found
  if (!videos.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          data: [],
          currentPage: null,
          nextPage: null,
          hasMore: false,
          totalVideos: 0,
          lastVideoId: null,
        },
        'No videos found'
      )
    );
  }

  // Fetch total video count for pagination info
  const totalVideos = await Video.countDocuments(matchStage);
  const hasMore = videos.length === limitNumber; // If full limit fetched, assume more exists

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        data: videos,
        currentPage: lastVideoId ? null : 1, // Only relevant for first page
        nextPage: hasMore ? (lastVideoId ? null : 2) : null, // Only relevant for first page
        hasMore,
        totalVideos,
        lastVideoId: videos[videos.length - 1]._id, // Send last ID for cursor-based pagination
      },
      'Videos fetched successfully'
    )
  );
});

// publish a video.

const publishAVideo = asyncHandler(async (req, res) => {
  // TODO: get video, upload to cloudinary, create video

  // steps
  // 1. take the video file , title and description
  // 2. upload the video file to cloudinary
  // 3. upload the thumbnail to cloudinary
  //    delete the video file from the local storage
  // 4. create a new video document in the database
  // 5. return the video document
  // 6. check if video is created successfully or not
  //    finaly return the video document in res.

  try {
    if (!req.user._id) {
      throw new ApiError(401, 'Unauthorized access');
    }

    const { title, description } = req.body;
    if (!(title && description)) {
      throw new ApiError(400, 'Title and description are required');
    }

    // checking for video file and thumbnail
    if (!req?.files?.videoFile) {
      throw new ApiError(400, 'Video file is required');
    }
    if (!req?.files?.thumbnail) {
      throw new ApiError(400, 'Thumbnail is required');
    }

    const videoFileLocalPath = req?.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req?.files?.thumbnail[0]?.path;
    if (!(videoFileLocalPath && thumbnailLocalPath)) {
      throw new ApiError(400, 'Video file and thumbnail are required');
    }

    // uploading on cloudinary
    const video = await uploadOnCloudinary(videoFileLocalPath);

    if (!video) {
      throw new ApiError(
        500,
        'Failed to upload video on cloudinary. Please try again'
      );
    }
    // uploading thumbnail on cloudinary
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) {
      throw new ApiError(
        500,
        'Failed to upload thumbnail on cloudinary. Please try again'
      );
    }

    // create a new video document
    const newVideo = await Video.create({
      videoFile: video.secure_url,
      thumbnail: thumbnail.secure_url,
      videoPublicId: video.public_id,
      thumbnailPublicId: thumbnail.public_id,
      title: title.trim(),
      description: description.trim(),
      duration: video.duration,
      owner: req.user._id,
    });

    if (!newVideo) {
      throw new ApiError(500, 'Failed to create video. Please try again');
    }

    // return the video document
    return res
      .status(201)
      .json(new ApiResponse(201, 'Video uploaded successfully', newVideo));
  } catch (error) {
    await deleteFromCloudinary(video?.public_id);
    await deleteFromCloudinary(thumbnail?.public_id);
    throw new ApiError(
      500,
      'Something went wrong while uploading the video! and images are deleted from cloudinary'
    );
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id

  if (!(isValidObjectId(videoId) || videoId)) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  // using aggregation pipeline for fetching video by id
  const videoById = await Video.aggregate([
    // match with Id
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'owner',

        pipeline: [
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
          // adding user subscriber count
          {
            $lookup: {
              from: 'subscriptions',
              localField: '_id',
              foreignField: 'channel',
              as: 'subscribers',
            },
          },
          {
            $addFields: {
              subscriberCount: { $size: '$subscribers' },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'likes',
        localField: '_id',
        foreignField: 'video',
        as: 'likes',
      },
    },
    {
      $addFields: {
        owner: {
          $first: '$owner',
        },
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        duration: 1,
        thumbnail: 1,
        videoFile: 1,
        views: 1,
        createdAt: 1,
        isPublished: 1,
        owner: {
          username: 1,
          avatar: 1,
          fullName: 1,
          subscriberCount: 1,
          _id: 1,
        },
        totalLikes: { $size: '$likes' },
      },
    },
  ]);

  if (!videoById) {
    throw new ApiError(404, 'No video found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoById[0], 'Video fetched successfully'));
});

const updateVideoTitleAndDesc = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  const { title, description } = req.body;
  if (!(title || description)) {
    throw new ApiError(400, 'Title or description are required');
  }

  // updating video details
  const updatedVideoDetails = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideoDetails, 'Video updated successfully')
    );
});

const updateThumbnail = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  const thumbnailLocalPath = req?.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, 'Thumbnail is required');
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!thumbnail) {
    throw new ApiError(
      500,
      'Failed to upload thumbnail on cloudinary. Please try again'
    );
  }

  const updatedVideoWithThumbnail = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        thumbnail: thumbnail.url,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideoWithThumbnail,
        'Thumbnail updated successfully'
      )
    );
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  const { videoPublicId, thumbnailPublicId } = video;
  await deleteFromCloudinary(videoPublicId);
  await deleteFromCloudinary(thumbnailPublicId);

  // deleting from database
  const deletedVideo = await Video.findByIdAndDelete(videoId);

  if (!deletedVideo) {
    throw new ApiError('video not deleted successfully');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Video deleted successfully'));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  // find the video
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(500, 'Video not found');
  }

  video.isPublished = !video.isPublished;

  const updatedVideo = await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideo.isPublished,
        'Video publish status updated successfully'
      )
    );
});

const increatementViewCount = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

  // find the video

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(500, 'Video not found');
  }

  if (video.viewedBy.includes(req.user._id)) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'You have already viewed this video'));
  }

  video.viewedBy.push(req.user._id);
  video.views += 1;
  const updatedVideo = await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideo.views,
        'Video view count updated successfully'
      )
    );
});

// get all videos of a channel

const getAllVideosOfChannel = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType } = req.query;
  const { channelId } = req.params;

  const pipeline = [];

  //stage -1 : match state
  if (query || channelId) {
    const matchState = {};
    if (query) {
      matchState.title = { $regex: query, $options: 'i' }; // case-insensitive search in title
    }
    if (channelId) {
      matchState.owner = new mongoose.Types.ObjectId(channelId);
    }
    pipeline.push({ $match: matchState });
  }

  // stage - 2 - sort stage
  if (sortBy) {
    const sortState = {
      $sort: {
        [sortBy]: sortType === 'desc' ? -1 : 1,
      },
    };
    pipeline.push(sortState);
  }

  // stage -3 : pagination stage
  const skipStage = {
    $skip: (page - 1) * limit, // calculate the number of documents to skip
  };

  const limitStage = {
    $limit: parseInt(limit, 20), // limit the number of documents to display
  };

  // add lookup stage to get owner details
  // const lookupStage = {
  //   $lookup: {
  //     from: 'users',
  //     localField: 'owner',
  //     foreignField: '_id',
  //     as: 'owner',

  //     pipeline: [
  //       {
  //         $project: {
  //           username: 1,
  //           avatar: 1,
  //           fullName: 1,
  //         },
  //       },
  //     ],
  //   },
  // };

  // adding another stage for get the first element of owner array
  // pipeline.push({
  //   $addFields: {
  //     owner: {
  //       $first: '$owner',
  //     },
  //   },
  // });

  // pipeline.push(lookupStage);

  pipeline.push(skipStage, limitStage);

  const allVidoes = await Video.aggregate(pipeline);

  if (!allVidoes) {
    throw new ApiError(404, 'No videos found');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        allVidoes,
        'All videos fetched successfully according to the query'
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideoTitleAndDesc,
  deleteVideo,
  togglePublishStatus,
  updateThumbnail,
  increatementViewCount,
  getAllVideosOfChannel,
};
