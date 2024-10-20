# S3 File Upload Tool

This is a file upload tool built using Next.js and Tailwind CSS. It allows users to drag and drop files for upload, and supports sharing and downloading of files through a generated S3 link.

## Features

- **Drag and Drop File Upload**: Users can drag and drop files or select files manually for upload.
- **AWS S3 Integration**: Uploaded files are stored in an AWS S3 bucket.
- **Progress Indicator**: The upload progress is shown with a visual progress bar.
- **Download and Share**: Uploaded files can be downloaded or shared via a generated link.
- **Styled with Tailwind CSS**: Tailwind CSS is used for responsive and modern styling.

## Setup and Installation

### Prerequisites

- Node.js
- pnpm (preferred) or npm
- AWS account with an S3 bucket and appropriate credentials

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:your-username/s3fileuploadtool.git
   ```

2. Navigate to the project directory:

   ```bash
   cd s3fileuploadtool
   ```

3. Install dependencies using pnpm:

   ```bash
   pnpm install
   ```

4. Set up your AWS credentials in a `.env.local` file in the root directory:

   ```bash
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   ```

5. Start the development server:

   ```bash
   pnpm dev
   ```

## Deployment

This project is ready to be deployed on Vercel. Simply link your GitHub repository, and Vercel will handle the build and deployment.

## Build for Production

To create a production build, run:

```bash
pnpm build
```

## Project Structure

```
├── src
│   ├── app
│   │   ├── components
│   │   │   └── upload.tsx
│   │   ├── fonts
│   │   ├── lib
│   │   │   └── s3.ts
│   │   └── layout.tsx
│   │   └── page.tsx
│   └── styles
│       └── globals.css
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── .env.local
└── README.md
```

## License

This project is licensed under the MIT License.

👨🏼‍💻 Developed by Scott Johnson.  
Check out my other projects at [sbjgraphics.com](http://sbjgraphics.com).

