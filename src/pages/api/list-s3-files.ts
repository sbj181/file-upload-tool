import type { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION, // replace with your AWS region
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const params = {
      Bucket: 'thegroveryfiles', // Replace with your bucket name
    };
    const data = await s3.listObjectsV2(params).promise();

    if (!data.Contents) {
      return res.status(404).json({ message: 'No files found' });
    }

    const filesList = data.Contents.map((item) => item.Key);
    res.status(200).json({ files: filesList });
  } catch (error) {
    console.error('Error listing files from S3:', error);
    res.status(500).json({ error: 'Error listing files from S3' });
  }
}
