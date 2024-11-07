import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
//access token aur refresh token generate karne ke liye function
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    // console.log(user);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    // console.log(accessToken, refreshToken);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

//Registration of user logic
const registerUser = asyncHandler(async (req, res) => {
  //get userDetails from frontend
  //validation - not empty
  //check if user already exists via username , email
  //check for images , check for avatar
  //upload them to cloudinary
  //create user object - create entry in db
  //remove password and refresh token field from response
  //check for user creation
  //return response

  const { fullName, email, username, password } = req.body;
  console.log("email: ", email);

  if (
    [fullName, email, password, username].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // console.log("Req.files: ", req.files);
  // console.log("avatarLocalPath", avatarLocalPath);
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }
  // let coverImageLocalPath ;
  // if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
  //   coverImageLocalPath = req.files.coverImage[0].path;
  // }
  let coverImageLocalPath = req?.files?.coverImage?.[0]?.path || null;

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  let coverImage = null;
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  // console.log("res: ", res);
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

//Login of user logic

const loginUser = asyncHandler(async (req, res) => {
  //req body se data lena hai
  //user details enter karvani hai jaise username ya email
  //check karna hai ki user exist karta hai ya nhi
  //agar nhi exist karta toh error throw karna hai
  //exist karta hai toh password check karna hai
  //password correct na ho toh error dena hai
  //password correct hone pe access token aur refresh token generate karna hai
  //send cookie
  const { email, username, password } = req.body;
  //agar username aur email dono hi enter nhi karte toh ek error throw karenge ki kuch to do
  if (!username && !email) {
    throw new ApiError(401, "Either username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  const isPasswordValid = user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "User credentials are invalid");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("Access Token", accessToken)
    .cookie("Refresh Token", refreshToken)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

//logout of user logic

const logoutUser = asyncHandler(async (req, res) => {
  //logged in user db mein locate kiya through id
  //uske refresh token ko delete kiya taki voh aage se login na kar pae
  //cookies clear kiye
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1,
      },
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
    .clearCookie("Access Token", options)
    .clearCookie("Refresh Token", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccesToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies["Refresh Token"] || req.body["Refresh Token"];

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    console.log(decodedToken);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }
    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh Token is either expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { newAccessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    return res
      .status(200)
      .cookie("Access Token", newAccessToken, options)
      .cookie("Refresh Token", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { newAccessToken, refreshToken: newRefreshToken },
          "Access Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "Either field is required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email },
    },
    { new: true, select: "-password" } // Select only required fields
  );

  // Prepare a sanitized response

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  // Find the user
  const user = await User.findById(req.user?._id).select("-password");
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  const oldAvatarUrl = user.avatar;

  // Upload new avatar to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  // Update user with new avatar URL
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // Delete the old avatar from Cloudinary if it exists
  if (oldAvatarUrl) {
    await deleteFromCloudinary(oldAvatarUrl);
  }

  // Prepare response object
  const userResponse = {
    _id: updatedUser._id,
    avatar: updatedUser.avatar,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, userResponse, "Avatar image uploaded successfully")
    );
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  // Find the user
  const user = await User.findById(req.user?._id).select("-password");
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  const oldCoverImageUrl = user.coverImage; // Assuming you have this field in your User model

  // Upload new cover image to Cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  // Update user with new cover image URL
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  // Delete the old cover image from Cloudinary if it exists
  if (oldCoverImageUrl) {
    await deleteFromCloudinary(oldCoverImageUrl);
  }

  // Prepare response object
  const userResponse = {
    _id: updatedUser._id,
    coverImage: updatedUser.coverImage,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, userResponse, "Cover image uploaded successfully")
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  // User.find({username})

  const channel = await User.aggregate([
    //username ka use karke database mein match kiya ja raha hai ki koi user hai jiska username yeh ho, aur username ko lowercase mein convert kar diya gaya hai
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    //Yeh subscriptions collection se users ko dhoondhne ka kaam karta hai jo iss channel ko subscribe kar chuke hain.
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    //Yeh dhoondh raha hai ki yeh user kin channels ko subscribe karta hai.
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "Channel is not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel fetched succesfully"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      // req.user._id ye hume sirf string return karta hai ye mongodb ki id nhi hoti
      // mongodb ki id ka format : - ObjectId('string')
      //ab mongoose ise directly mongodb ki objectID mein
      //aggregation pipeline mein mongoose ye work nhi karta hai isliye hume use manually convert karna padta hai
      $match: {
        _id: new mongoose.Types.ObjectID(req.user._id),
      },
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
            },
            pipeline: [
              {
                $project: {
                  fullName: 1,
                  username: 1,
                  avatar: 1,
                },
              },
            ],
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccesToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
