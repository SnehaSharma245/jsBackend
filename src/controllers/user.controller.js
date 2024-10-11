import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

//access token aur refresh token generate karne ke liye function
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

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
    [fullName, email, password, username].some((field) => field?.trim === "")
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
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

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
  await User.findByIdAndUpdate(
    req._id,
    {
      $set: {
        refreshToken: undefined,
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
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});
export { registerUser, loginUser, logoutUser };
