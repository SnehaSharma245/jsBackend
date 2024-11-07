import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Requested video does not exist");
  }
  const { page = 1, limit = 10 } = req.query;
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const comments = await Comment.aggregate([
    {
      $match: {
        video: videoId,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);
  const options = {
    page: parsedPage,
    limit: parsedLimit,
  };
  const result = await Comment.aggregatePaginate(aggregate, options);
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
});

export { getVideoComments, addComment, updateComment, deleteComment };
