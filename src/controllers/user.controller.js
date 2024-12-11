import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';

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
  const existedUser = User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(
      409,
      'User with this email and username is already exists!'
    );
  }

  // check for images , check for avatar
  const avatarLocalPath = req.file?.avatar[0]?.path;
  const coverImageLocalPath = req.file?.coverImage[0]?.path;

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

export { registerUser };
