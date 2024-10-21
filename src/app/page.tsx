// src/app/page.tsx

"use client"; // This ensures it's a Client Component

import RandomBackground from '@/app/components/RandomBackground';
import Upload from '@/app/components/upload';
import Footer from './components/Footer';
import FileDownload from './components/DownloadFiles'; // Assume this is the file download component
import ThemeToggle from './components/ThemeToggler';

export default function Home() {
  return (
    <RandomBackground>
      <div className="flex flex-col lg:flex-row items-center justify-center space-y-6 lg:space-y-0 lg:space-x-6 w-full h-full p-4">
        {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

        
        <div className="flex flex-col items-center w-full max-w-md">
           {/* Upload Box */}
        <Upload />
        {/* Download Box */}
          <FileDownload />
        </div>
      </div>

      <Footer />
    </RandomBackground>
  );
}
