import mongoose, { isValidObjectId, mongo } from 'mongoose';
import { Tweet } from '../models/tweet.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const createTweet = asyncHandler(async (req, res) => {
  // checking if content is provided
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, 'Some content is required to create tweet');
  }

  // creating tweet
  const tweet = await Tweet.create({ content, owner: req.user?._id });
  if (!tweet) {
    throw new ApiError(500, 'Tweet not created');
  }

  // returning the res.
  return res
    .status(201)
    .json(new ApiResponse(201, tweet, 'Tweet created successfully'));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const userTweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    // lookup for get the user details
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'owner',

        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: '$owner',
        },
      },
    },
  ]);

  if (!userTweets) {
    throw new ApiError(404, 'No tweets found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, userTweets, 'User tweets fetched successfully'));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, 'Invalid tweet id');
  }
  if (!content) {
    throw new ApiError(400, 'content is required to update tweet');
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: content.trim(),
      },
    },
    { new: true }
  );

  if (!updatedTweet) {
    throw new ApiError(500, 'Tweet not updated');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, 'Tweet updated successfully'));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, 'Invalid tweet id');
  }

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deletedTweet) {
    throw new ApiError(500, 'Tweet not deleted');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Tweet deleted successfully'));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
