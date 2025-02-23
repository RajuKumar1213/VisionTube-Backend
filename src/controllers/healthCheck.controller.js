import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const healthcheck = asyncHandler(async (req, res) => {
  // Check if critical services are running (e.g., DB, Cache, etc.)
  const isDBConnected = true; // Replace with actual DB check if needed

  if (!isDBConnected) {
    throw new ApiError(500, 'Database is down');
  }

  const response = {
    uptime: process.uptime(),
    message: 'healthy',
    timestamp: Date.now(),
  };

  return res.status(200).json(new ApiResponse(200, response, 'OK'));
});

export { healthcheck };
