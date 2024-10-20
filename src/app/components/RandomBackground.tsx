"use client"; // Ensure it's a client-side component

import React, { useEffect, useState } from 'react';

const RandomBackground: React.FC = ({ children }) => {
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');

  useEffect(() => {
    // Fetch a random Picsum photo
    const randomImageUrl = 'https://picsum.photos/1920/1080';
    setBackgroundUrl(randomImageUrl);
  }, []);

  return (
    <>
    <div className='absolute w-full h-full opacity-50 bg-slate-300 dark:bg-slate-900'></div>
    <div
      className="flex items-center justify-center w-full h-screen"
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        
      }}
    >
      {children}
    </div>
   
    </>
  );
};

export default RandomBackground;
