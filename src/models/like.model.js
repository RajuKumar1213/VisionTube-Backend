import mongoose, { Schema } from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    video: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Video',
      },
    ],
    tweet: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tweet',
      },
    ],
    comment: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Like = mongoose.model('Like', likeSchema);
