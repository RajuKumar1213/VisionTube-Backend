import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// upload file on cloudinary
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'auto',
    });

    // file has been uploaded successfully
    // console.log('File is uploaded on Cloudinary', response);

    // after uploading on cloudinary delete/unlink the file
    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the file upload operation on cloudinary got failed.
    return null;
  }
};

// delete file on cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log('Error while deleting file from cloudinary', error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
