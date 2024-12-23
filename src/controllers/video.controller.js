import mongoose, { isValidObjectId } from 'mongoose';
import { Video } from '../models/video.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  // writing mongodb aggregation pipeline

  const pipeline = [];

  //stage -1 : match state
  if (userId || query) {
    const matchState = {};
    if (query) {
      matchState.title = { $regex: query, $options: 'i' }; // case-insensitive search in title
    }
    if (userId) {
      matchState.owner = new mongoose.Types.ObjectId(userId);
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
    $limit: parseInt(limit, 10), // limit the number of documents to display
  };

  // add lookup stage to get owner details
  const lookupStage = {
    $lookup: {
      from: 'users',
      localField: 'owner',
      foreignField: '_id',
      as: 'owner',

      pipeline: [
        {
          $project: {
            username: 1,
            avatar: 1,
            fullName: 1,
          },
        },
      ],
    },
  };

  // adding another stage for get the first element of owner array
  // pipeline.push({
  //   $addFields: {
  //     owner: {
  //       $first: '$owner',
  //     },
  //   },
  // });

  pipeline.push(lookupStage);

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

const publishAVideo = asyncHandler(async (req, res) => {
  // TODO: get video, upload to cloudinary, create video

  // steps
  // 1. take the video file , title and description
  // 2. upload the video file to cloudinary
  // 3. upload the thumbnail to cloudinary
  // delete the video file from the local storage
  // 4. create a new video document in the database
  // 5. return the video document
  // 6. check if video is created successfully or not
  // finaly return the video document in res.

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
    videoFile: video.url,
    thumbnail: thumbnail.url,
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
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, ['$subscribers.subscriber']] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              avatar: 1,
              fullName: 1,
              subscriber: 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
  ]);

  if (!videoById) {
    throw new ApiError(404, 'No video found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoById, 'Video fetched successfully'));
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

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Invalid video id or missing video id');
  }

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

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideoTitleAndDesc,
  deleteVideo,
  togglePublishStatus,
  updateThumbnail,
};
