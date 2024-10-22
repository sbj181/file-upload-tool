// src/pages/api/send-upload-notification.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import sgMail from '@sendgrid/mail';
import generatePresignedUrl from '@/app/lib/generatePresignedUrl'; // Adjust the path to your generatePresignedUrl function

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

const bucketName = 'thegroveryfiles'; // Your S3 bucket name

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { fileName, recipientEmail } = req.body;

    // Generate the presigned URL
    const downloadLink = generatePresignedUrl(bucketName, fileName);

    const msg = {
      to: recipientEmail,
      from: 'webdev@thegrovery.com', // Replace with your verified sender
      subject: 'New File Uploaded',
      text: `A new file named ${fileName} has been uploaded. You can download it here: ${downloadLink}`,
      html: `
        <p>A new file named <strong>${fileName}</strong> has been uploaded.</p>
        <p>Click <a href="${downloadLink}" target="_blank">here</a> to download the file.</p>
      `,
    };

    try {
      await sgMail.send(msg);
      res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Error sending email' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
