import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

// Function to upload a file to S3
export const uploadToS3 = async (file: File, onProgress: (percent: number) => void): Promise<string> => {
  const params = {
    Bucket: 'thegroveryfiles', // Replace with your bucket name
    Key: `${Date.now()}-${file.name}`, // Generate a unique name for the file
    Body: file,
    ContentType: file.type,
  };

  const upload = s3.upload(params);

  // Track upload progress
  upload.on('httpUploadProgress', (event) => {
    const percentCompleted = Math.round((event.loaded / event.total) * 100);
    onProgress(percentCompleted);
  });

  const { Location } = await upload.promise();
  return Location; // Return the URL of the uploaded file
};

// Function to list files from S3
export const listFilesInS3 = async (): Promise<string[]> => {
  const params = {
    Bucket: 'thegroveryfiles', // Replace with your bucket name
  };

  const data = await s3.listObjectsV2(params).promise();

  // Return an array of URLs to the uploaded files
  return data.Contents?.map(item => `https://thegroveryfiles.s3.amazonaws.com/${item.Key}`) || [];
};
