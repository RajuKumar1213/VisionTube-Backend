import mongoose, { isValidObjectId } from 'mongoose';
import { Like } from '../models/like.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user?._id;

  const like = await Like.findOne({ likedBy: userId });
  if (!like) {
    const liked = await Like.create({
      likedBy: userId,
      video: [videoId],
    });
    return res.status(201).json(new ApiResponse(201, liked, 'video liked'));
  }

  if (like.video?.includes(videoId)) {
    const unlikeVideo = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $pull: { video: videoId },
      },
      { new: true }
    );
    if (!unlikeVideo) {
      throw new ApiError(500, 'Error while disliking the video');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, unlikeVideo, 'video is disliked'));
  } else {
    const likedVideo = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $push: { video: videoId },
      },
      { new: true }
    );
    if (!likedVideo) {
      throw new ApiError(500, 'Error while liking the video');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, likedVideo, 'video is liked'));
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;
  const like = await Like.findOne({ likedBy: userId });
  if (!like) {
    const liked = await Like.create({
      likedBy: userId,
      comment: [commentId],
    });
    return res.status(201).json(new ApiResponse(201, liked, 'comment liked'));
  }

  if (like.comment?.includes(commentId)) {
    const unlikeComment = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $pull: { comment: commentId },
      },
      { new: true }
    );
    if (!unlikeComment) {
      throw new ApiError(500, 'Error while disliking the comment');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, unlikeComment, 'comment is disliked'));
  } else {
    const likedComment = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $push: { comment: commentId },
      },
      { new: true }
    );
    if (!likedComment) {
      throw new ApiError(500, 'Error while liking the comment');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, likedComment, 'comment is liked'));
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const userId = req.user?._id;
  const like = await Like.findOne({ likedBy: userId });
  if (!like) {
    const liked = await Like.create({
      likedBy: userId,
      tweet: [tweetId],
    });
    return res.status(201).json(new ApiResponse(201, liked, 'tweet liked'));
  }

  if (like.tweet?.includes(tweetId)) {
    const unlikeTweet = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $pull: { tweet: tweetId },
      },
      { new: true }
    );
    if (!unlikeTweet) {
      throw new ApiError(500, 'Error while disliking the tweet');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, unlikeTweet, 'tweet is disliked'));
  } else {
    const likedTweet = await Like.findOneAndUpdate(
      { likedBy: userId },
      {
        $push: { tweet: tweetId },
      },
      { new: true }
    );
    if (!likedTweet) {
      throw new ApiError(500, 'Error while liking the tweet');
    }
    return res
      .status(200)
      .json(new ApiResponse(200, likedTweet, 'tweet is liked'));
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const likedVideo = await Like.aggregate([
    {
      $match: {
        likedBy: req.user?._id,
      },
    },
    {
      $lookup: {
        from: 'videos',
        localField: 'video',
        foreignField: '_id',
        as: 'videos',

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
        videos: 1,
        videos: {
          views: 1,
          videoFile: 1,
          thumbnail: 1,
          title: 1,
          owner: {
            fullName: 1,
            username: 1,
            avatar: 1,
          },
        },
      },
    },
  ]);

  if (!likedVideo) {
    throw new ApiError(500, 'Error while fetching all liked video.');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideo[0], 'Liked videos fetched successfully.')
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
