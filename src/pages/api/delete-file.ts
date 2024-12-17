// src/pages/api/delete-file.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4',
  s3DisableBodySigning: false,
  useAccelerateEndpoint: false,
  s3ForcePathStyle: false
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { fileName } = req.query;

  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const params = {
    Bucket: 'groveryuploads', // Your S3 bucket name
    Key: decodeURIComponent(fileName), // Decode the file name before using it
  };

  try {
    await s3.deleteObject(params).promise();
    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
}
