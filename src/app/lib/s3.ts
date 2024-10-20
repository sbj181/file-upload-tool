import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

export const uploadToS3 = async (file: File, onProgress: (percent: number) => void): Promise<string> => {
  const params = {
    Bucket: 'thegroveryfiles', // replace with your bucket name
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
