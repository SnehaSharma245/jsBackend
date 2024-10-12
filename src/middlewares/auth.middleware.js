//Is code ka main kaam hai ki yeh user ka access token verify kare aur ensure kare ki valid token hai ya nahi. Agar token valid hota hai toh user ko request ke sath attach karke aage bhejta hai. Agar token invalid ya missing hota hai, toh error throw karta hai. kyuki logout karte wakt hum jo function banayenge use user lagega voh hum is middleware ke through denge

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
//verifyJWT: Yeh function JWT (JSON Web Token) ko verify karega. Yeh middleware hai, jo request aane ke baad aur response bhejne se pehle check karta hai ki user ka token valid hai ya nahi.
export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // console.log(req.headers);
    // console.log(req.cookies);

    const token =
      req.cookies?.["Access Token"] ||
      req.header("Authorization")?.replace("Bearer ", ""); //Header mein token "Bearer <token>" ke format mein hota hai, toh replace("Bearer ", "") isse clean kar deta hai, taaki sirf token bache.
    // console.log(token);
    if (!token) {
      throw new ApiError(401, "Unauthorized Request");
    }
    //token aur process.env.ACCESS_TOKEN_SECRET (jo secret key hai) ke through token decode kiya jata hai. Agar token valid hai, toh yeh decodedToken return karega, jisme user ki details hoti hain, jaise userId ya _id.
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }
    //Agar user valid hai, toh code user ki details ko req.user mein attach kar deta hai. Isse baad ke request handlers (jo is route ke baad aayenge) user ki details ko access kar sakte hain.
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
