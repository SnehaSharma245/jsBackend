import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();
//Ye line /register endpoint ke liye route define kar rahi hai.
//.post(...): Ye method HTTP POST request handle karne ke liye use hota hai. Iska matlab hai ki jab koi client is route par data bhejta hai, toh is route ke andar jo function diya gaya hai, wo execute hoga.

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  //Yahan registerUser function ko call kiya ja raha hai, jo user registration ka logic handle karega, jab files upload ho jayengi.
  registerUser
);
router.route("/login").post(loginUser);

//secured routes
router.route("/logout").post(verifyJWT, logoutUser);
export default router;
