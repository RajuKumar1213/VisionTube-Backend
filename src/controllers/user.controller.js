import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

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
    {
      $set: { refreshToken: undefined },
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

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie('accessToken', accessToken, options)
      .cookie('refreshToken', newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, accessToken: newRefreshToken },
          'Access token refreshed successfully'
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid access token');
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
