import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const healthcheck = asyncHandler(async (req, res) => {
  // if not healthy then throw error
  // if (process.env.NODE_ENV !== 'production') {
  //   throw new ApiError(500, 'Server is not healthy');

  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(500, 'Server is not healthy');
  }

  const response = {
    uptime: process.uptime(),
    message: 'healthy',
    timestamp: Date.now(),
  };

  return res.status(200).json(new ApiResponse(200, response, 'OK'));
});

export { healthcheck };
