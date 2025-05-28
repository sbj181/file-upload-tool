import AWS from "aws-sdk";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4',
  s3DisableBodySigning: false,
  useAccelerateEndpoint: false,
  s3ForcePathStyle: false
});

const generatePresignedUrl = async (bucketName: string, fileName: string): Promise<string> => {
  try {
    const response = await fetch('/api/generate-short-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate short URL');
    }

    const data = await response.json();
    return data.shortUrl;
  } catch (error) {
    console.error('Error generating short URL:', error);
    // Fallback to direct presigned URL if short URL generation fails
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Expires: 60 * 60 * 24 * 7, // 7 days
    };
    return s3.getSignedUrl("getObject", params);
  }
};

export default generatePresignedUrl;
