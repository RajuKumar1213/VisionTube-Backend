import mongoose, { isValidObjectId } from 'mongoose';
import { User } from '../models/user.model.js';
import { Subscription } from '../models/subscription.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, 'Invalid channel id');
  }
  const subscriberId = req.user?._id;

  const existedSubscriber = await Subscription.findOne({
    subscriber: subscriberId,
    channel: channelId,
  });

  if (existedSubscriber) {
    await existedSubscriber.deleteOne({
      subscriber: subscriberId,
      channel: channelId,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, {}, 'Unsubscribed successfully'));
  }

  const createdSubscription = await Subscription.create({
    subscriber: subscriberId,
    channel: channelId,
  });
  if (!createdSubscription) {
    throw new ApiError(400, 'Something went wrong while subscribing');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Subscribed successfully'));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, 'Invalid channel id');
  }

  const subscribersList = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'subscriber',
        foreignField: '_id',
        as: 'subscriber',
      },
    },
    {
      $unwind: '$subscriber',
    },
    {
      $project: {
        _id: 1,
        subscriber: {
          _id: 1,
          username: 1,
          fullName: 1,
          avatar: 1,
        },
      },
    },
  ]);

  if (!subscribersList) {
    throw new ApiError(400, 'Something went wrong while fetching subscribers');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, subscribersList, 'Subscribers fetched successfully')
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, 'Invalid subscriber id');
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'channel',
        foreignField: '_id',
        as: 'channel',
      },
    },
    {
      $unwind: '$channel',
    },
    {
      $project: {
        // _id: 1,
        channel: {
          _id: 1,
          username: 1,
          fullName: 1,
          avatar: 1,
        },
      },
    },
  ]);

  if (!subscribedChannels) {
    throw new ApiError(
      400,
      'Something went wrong while fetching subscribed channels'
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        'Subscribed channels fetched successfully'
      )
    );
});

const getChannelIsSubscribed = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, 'Invalid channel id');
  }

  const isSubscribed = await Subscription.findOne({
    subscriber: req.user?._id,
    channel: channelId,
  });

  if (!isSubscribed) {
    return res.status(200).json(new ApiResponse(200, false, 'Not subscribed'));
  }

  return res.status(200).json(new ApiResponse(200, true, 'Subscribed'));
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
  getChannelIsSubscribed,
};
