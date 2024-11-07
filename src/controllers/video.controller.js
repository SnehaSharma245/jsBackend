import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(
      400,
      "Either page number or limit number is negative or zero , make it positive"
    );
  }

  const pipeline = [
    {
      $match: {
        ...(query && {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
        }),
        ...(userId && { user: userId }),
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    },
  ];
  const options = {
    page: pageNumber,
    limit: limitNumber,
  };
  const videos = await Video.aggregatePaginate(pipeline, options);
  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Video details fetched succesfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Title and description are required");
  }

  // if(!req.files || !req.files.videoFile || !req.files.thumbnail){
  //   throw new ApiError(400 , "Video file and thumbnail are required")
  // }
  const existingTitle = await Video.findOne({
    title: new RegExp(`^${title}$`, "i"), // Case-insensitive search
  });
  if (existingTitle) {
    throw new ApiError(400, "Video with this title already exists");
  }

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailFileLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath || !thumbnailFileLocalPath) {
    throw new ApiError(400, "Both video file and thumbnail file is required");
  }
  console.log("Uploading video:", videoFileLocalPath);
  const video = await uploadOnCloudinary(videoFileLocalPath);
  console.log("Uploading thumbnail:", thumbnailFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailFileLocalPath);

  if (!video) {
    throw new ApiError(500, "Error uploading video file on cloudinary");
  }
  if (!thumbnail) {
    throw new ApiError(500, "Error uploading thumbnail file on cloudinary");
  }
  if (!video.url || !thumbnail.url) {
    throw new ApiError(500, "Uploaded files did not return valid URLs");
  }
  const duration = video.duration;
  if (!duration) {
    throw new ApiError(500, "Unable to retrieve duration");
  }
  console.log("Video File Path:", videoFileLocalPath);
  console.log("Thumbnail File Path:", thumbnailFileLocalPath);
  console.log("Duration:", duration);
  const newVideo = await Video.create({
    title,
    description,
    videoFile: video.url,
    thumbnail: thumbnail.url,
    duration,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, newVideo, "Video published succesfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Video with this video id not found");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Video fetched successfully from video id")
    );
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  const { newTitle, newDescription } = req.body;
  if (!newTitle && !newDescription) {
    throw new ApiError(400, "Both title and description are needed");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError("Video by this videoid not found");
  }
  let thumbnailOldUrl = video.thumbnail;
  if (!thumbnailOldUrl) {
    throw new ApiError(400, "Old thumbail is not found");
  }
  const deleteThumbnailFromCloudinary =
    await deleteFromCloudinary(thumbnailOldUrl);
  console.log(deleteThumbnailFromCloudinary);
  const newThumbnail = req.files?.thumbnail[0]?.path;
  if (!newThumbnail) {
    throw new ApiError(404, "New thumbnail not found");
  }
  const ThumbnailOnCloudinary = await uploadOnCloudinary(newThumbnail);
  if (!ThumbnailOnCloudinary.url) {
    throw new ApiError(400, "Uploaded thumbnail doesn't return a valid url");
  }
  video.title = newTitle;
  video.description = newDescription;
  video.thumbnail = ThumbnailOnCloudinary.url;

  const updatedVideo = await video.save();
  if (!updatedVideo) {
    throw new ApiError(500, "Video updation failed");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, updateVideo, "Video details updated successfully")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  console.log("Video: ", video);
  const videoFileUrl = video.videoFile;
  const thumbnailUrl = video.thumbnail;
  console.log("videoFileUrl", videoFileUrl);
  console.log("thumbnailUrl", thumbnailUrl);
  const deleteVideoFileFromCloudinary =
    await deleteFromCloudinary(videoFileUrl);
  console.log(deleteVideoFileFromCloudinary);
  const deleteEntireVideoFromDB = await Video.findByIdAndDelete(videoId);
  console.log(deleteEntireVideoFromDB);
  const deleteThumbnailFromCloudinary =
    await deleteFromCloudinary(thumbnailUrl);
  console.log(deleteThumbnailFromCloudinary);

  return res
    .status(200)
    .json(new ApiResponse(200, { message: "Video File deleted successfully" }));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Video id is invalid");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Video with this id not found");
  }
  video.isPublished = !video.isPublished;
  await video.save();
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Toggled publish status"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
