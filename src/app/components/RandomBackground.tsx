"use client"; // Ensure it's a client-side component

import React, { useEffect, useState } from 'react';

const RandomBackground: React.FC<React.PropsWithChildren<object>> = ({ children }) => {
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');

  useEffect(() => {
    // Fetch a random Picsum photo
    const randomImageUrl = 'https://picsum.photos/1920/1080';
    setBackgroundUrl(randomImageUrl);
  }, []);

  return (
    <div
      className="relative flex items-center justify-center w-full h-screen"
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Apply an overlay effect without using absolute positioning */}
      <div className='absolute top-0 left-0 w-full h-full bg-slate-300 opacity-50 dark:bg-slate-900'></div>
      <div className='relative z-10 w-full h-full flex items-center justify-center'>
        {children}
      </div>
    </div>
  );
};

export default RandomBackground;
