// src/pages/api/send-upload-notification.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { fileName, recipientEmail } = req.body;

    const msg = {
      to: recipientEmail,
      from: 'webdev@thegrovery.com', // Replace with your verified sender
      subject: 'New File Uploaded',
      text: `A new file named ${fileName} has been uploaded.`,
      html: `<p>A new file named <strong>${fileName}</strong> has been uploaded.</p>`,
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
