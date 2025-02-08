import mongoose, { isValidObjectId } from 'mongoose';
import { Comment } from '../models/comment.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortType = 'desc',
  } = req.query;

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Video ID is required to get comments');
  }

  const allVideoComments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $sort: {
        [sortBy]: sortType === 'desc' ? -1 : 1,
      },
    },
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: parseInt(limit, 10),
    },
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
              avatar: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'likes',
        localField: '_id',
        foreignField: 'comment',
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
        content: 1,
        createdAt: 1,
        owner: 1,
        totalCommentLikes: {
          $size: '$likes',
        },
      },
    },
  ]);

  if (!allVideoComments) {
    throw new ApiError(404, 'No comments found for this video');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        allVideoComments,
        'All comments for this video are fetched successfully'
      )
    );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId) || !videoId) {
    throw new ApiError(400, 'Video ID is required to add a comment');
  }

  if (!content) {
    throw new ApiError(400, 'Content is required to add a comment');
  }

  // create a comment
  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw new ApiError(500, 'Comment not created');
  }

  return res
    .status(201)
    .json(new ApiResponse(201, comment, 'Comment created successfully'));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  if (!commentId) {
    throw new ApiError(400, 'Invalid comment id ');
  }
  if (!content) {
    throw new ApiError(400, 'content is required to update.');
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content: content.trim(),
      },
    },
    { new: true }
  );

  if (!updateComment) {
    throw new ApiError(500, 'Comment is not updated');
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedComment, 'Comment is updated successfully.')
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, 'Invalid comment id');
  }

  // finding and deleting perticular comment

  const delComment = await Comment.findByIdAndDelete(commentId);

  if (!delComment) {
    throw new ApiError(
      500,
      'Error while deleting the comment. Please try again.'
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Comment deleted successfully'));
});

export { getVideoComments, addComment, updateComment, deleteComment };
