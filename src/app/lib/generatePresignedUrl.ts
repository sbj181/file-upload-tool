import AWS from "aws-sdk";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, // replace with your region
});

const generatePresignedUrl = (bucketName: string, fileName: string): string => {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 60 * 5, // The URL is valid for 5 minutes
  };
  return s3.getSignedUrl("getObject", params);
};

export default generatePresignedUrl;
