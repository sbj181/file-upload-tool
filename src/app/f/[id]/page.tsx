'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image'; 
import ThemeToggle from '@/app/components/ThemeToggler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ShortUrlRedirect(props: any) {
  // Unwrap params Promise using React.use()
  const params = typeof props.params?.then === 'function'
    ? React.use(props.params)
    : props.params;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params) return;
    const fetchPresignedUrl = async () => {
      try {
        const response = await fetch(`/api/get-presigned-url?id=${params.id}`);
        if (!response.ok) {
          throw new Error('Invalid or expired link');
        }
        const data = await response.json();
        window.location.href = data.presignedUrl;
      } catch {
        setError('This link is invalid or has expired');
      }
    };

    fetchPresignedUrl();
  }, [params?.id]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2 text-red-600">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen dark:bg-gray-900">
      <div className="absolute top-4 right-4">
  <ThemeToggle />
</div>  
      <div className="text-center">
      <div className='w-full justify-center flex items-center mb-4'>
        {/* Logo rendering based on theme */}
        <Image 
          src="/imgs/grovery-glyph-color.svg"
          alt="Grovery Logo Light" 
          width={200}
          height={100}
          className="mb-4 block" 
        />
        
      </div>
        <h1 className="text-xl font-semibold mb-2 dark:text-white">Download Started...</h1>
        <p className="text-gray-600 dark:text-white/80">You may close this tab after your download begins.</p>
        
        <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
            Close Tab
        </button>
        <div>
            <a
            href={`/api/redirect-to-file?id=${params?.id}`}
            target="_self"
            rel="noopener noreferrer"
            className="mt-4 ml-4 inline-block px-4 py-2 text-teal-500 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 transition"
            >
            Click here if your download does not start automatically
            </a>
        </div> 
      </div>
    </div>
  );
} 