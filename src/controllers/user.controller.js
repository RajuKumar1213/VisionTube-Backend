import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// writing function for generating referesh and acces tokens
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // updating user with  referesh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and referesh token.'
    );
  }
};

//  REGISTER USER **
const registerUser = asyncHandler(async (req, res) => {
  // take user data from the frontend
  // validate the data
  // check if user already exists : email, username
  // check for images , check for avatar
  // upload them to cloudinary, get the url , specially for avatar
  // create a user object - create entry in the database
  // remove password and refreshToken field from the response
  // check for user creation
  // send back the response to the frontend

  const { fullName, email, username, password } = req.body;

  // validating
  if (
    [fullName, email, username, password].some((field) => field?.trim() === '')
  ) {
    throw new ApiError(400, 'All fields are required');
  }

  // check if user already exists
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(
      409,
      'User with this email and username is already exists!'
    );
  }

  // check for images , check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path || '';

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length >= 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar is required!');
  }

  //uploading on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(
      400,
      'Avatar is not uploaded successfylly, please try again!'
    );
  }

  //create a user object - create entry in the database
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || '',
    email,
    password,
    username: username.toLowerCase(),
  });

  // checking if user created or not ,and deselecting password and refreshToken field

  const createdUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong while registering the user!');
  }

  // finally sending response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, 'User is created Successfully!'));
});

// LOGIN  USER **
const loginUser = asyncHandler(async (req, res) => {
  // extract data from req.body
  // check for empty : username or email
  // find the user
  // match password
  // refresh and access tokens
  // send cokies

  const { username, email, password } = req.body;

  if (!(username || email)) {
    const missingFields = [];
    if (!username) missingFields.push('username');
    if (!email) missingFields.push('email');
    throw new ApiError(400, `${missingFields.join(' and ')} is required`);
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, 'User does not exist!');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid user Credentials.');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  //
  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged In successfully.'
      )
    );
});

// LOGOUT USER **
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    // {
    //   $set: { refreshToken: undefined },
    // },
    {
      $unset: { refreshToken: 1 },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User Logged out Successfully.'));
});

//  REFRESH ACCESS TOKEN**
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingAccessToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingAccessToken) {
    throw new ApiError(401, 'unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(
      incomingAccessToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'Invalid refresh token.');
    }

    if (incomingAccessToken !== user?.refreshToken) {
      throw new ApiError(401, 'Refresh token in expired or used.');
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          'Access token refreshed successfully'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid access token');
  }
});

// UPDATE PASSWORD**
const updatePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (oldPassword == newPassword) {
    throw new ApiError(400, 'Old and new password must be different.');
  }

  const user = await User.findById(req.user?._id);
  // comparing password is correct or not
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, 'Invalid old password.');
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password updated successfully.'));
});

// FORGET PASSWORD**
const forgetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required.');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'Invalid Email. Please enter correct email.');
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password forgot successfully.'));
});

/// GET CURRENT USER**
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, 'current user fetched successfully'));
});

// UPDATE USER**
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!(email || fullName)) {
    throw new ApiError(400, 'All fields are required.');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email,
        fullName,
      },
    },
    { new: true }
  ).select('-password');

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, 'User accout details updated successfully.')
    );
});

// UPDATE PROFILE PICTURE**
const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, 'Avatar is required.');
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(500, 'Error while uploading avatar.');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Avatar updated successfully.'));
});

// UPDATE COVER IMAGE**
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, 'Cover image file is required.');
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage?.url) {
    throw new ApiError(500, 'Error while uploading cover image.');
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select('-password');

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Cover Image updated successfully.'));
});

// GET CHANNEL PROFILE DETAILS**
const getChannelProfileDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, 'Username missing in params.');
  }

  // writing aggrigation pipelines for joining the Subscription model. to get the total subscribers count and subscribed count.

  const channel = await User.aggregate([
    // stage 1 : for filtering according to username
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    // stage 2 : for joining the subscription model to User model "or" finding subscriber
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'channel',
        as: 'subscriber',
      },
    },
    // state 3 : for getting the user subscribedTo details
    {
      $lookup: {
        from: 'subscriptions',
        localField: '_id',
        foreignField: 'subscriber',
        as: 'subscribedTo',
      },
    },

    // state 4 : calculating the count of the subscriber and subscribedTo
    {
      $addFields: {
        subscribersCount: { $size: '$subscriber' },
        subscribedToCount: { $size: '$subscribedTo' },
        // checking weather user is subscribed by currently logged in user or not
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, ['$subscribers.subscriber']] },
            then: true,
            else: false,
          },
        },
      },
    },

    // state 5 : projecting the essential fields
    {
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel doesn't exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], 'channel details fetched successfully!')
    );
});

// GET WATCH HISTORY**
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    // state 1: selecting the user
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id), // TODO: if this will not work then use another alternative
      },
    },
    // state 2: joining the watchHistory model
    {
      $lookup: {
        from: 'videos',
        localField: 'watchHistory',
        foreignField: '_id',
        as: 'watchHistory',
        // now looking up for use / owner so the user id can join with the owner field of the video model
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'owner',
              foreignField: '_id',
              as: 'owner',
              // using anothor sub pipeline to project required details
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    avatar: 1,
                    username: 1,
                  },
                },
              ],
            },
          },
          // adding anothor state in to pull out the first value of the owner array
          {
            $addFields: {
              owner: {
                $first: '$owner',
              },
            },
          },
        ],
      },
    },
  ]);

  // sending back the res
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        'Watch history fetched successfully.'
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updatePassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getChannelProfileDetails,
  getWatchHistory,
  forgetPassword,
};
