import { v2 as cloudinary } from "cloudinary";

import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file has been uploaded successfully
    // console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlink(localFilePath); //remove locally saved temp file as upload operation got failed
    return null;
  }
};
const deleteFromCloudinary = async (avatarUrl) => {
  try {
    if (!avatarUrl) return null;

    // Extract public_id from the Cloudinary URL
    const publicId = getPublicIdFromUrl(avatarUrl);
    console.log("PublicId: ", publicId);
    // Delete file from Cloudinary using public_id
    const response = await cloudinary.uploader.destroy(publicId);
    console.log("Response: ", response);
    // Check if deletion was successful
    if (response.result === "ok") {
      // File deleted successfully
      console.log("File deleted successfully from Cloudinary");
      return response;
    } else {
      console.log("Failed to delete file from Cloudinary");
      return null;
    }
  } catch (error) {
    console.error("Error deleting file from Cloudinary", error);
    return null;
  }
};

// Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  // Assuming URL is like: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<public_id>.<file_extension>
  const parts = url.split("/");
  const fileName = parts[parts.length - 1]; // Get the last part, which is public_id with extension
  const publicId = fileName.split(".")[0]; // Remove the extension from file name
  return publicId;
};

export { uploadOnCloudinary, deleteFromCloudinary };
