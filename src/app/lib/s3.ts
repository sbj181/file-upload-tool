import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const ALLOWED_FILE_TYPES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'video/',
  'application/x-photoshop',
  'image/vnd.adobe.photoshop',
  'application/illustrator',
  'application/octet-stream',
  'application/figma',
  'application/x-figma',
  '.psd',
  '.ai',
  '.fig',
  '.sketch'
];

// Function to upload a file to S3
export const uploadToS3 = async (file: File, onProgress: (percent: number) => void): Promise<string> => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.some(type => 
    file.type.startsWith(type) || file.name.toLowerCase().endsWith(type)
  )) {
    throw new Error('File type not allowed');
  }

  const params = {
    Bucket: 'groveryuploads',
    Key: file.name,
    Body: file,
    ContentType: file.type,
    ServerSideEncryption: 'AES256',
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
