// src/components/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
  return (
    <div className="fixed bottom-4 left-4 flex bg-slate-50 dark:bg-slate-700 py-2 px-4 rounded-full items-center shadow-lg">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-300">
        Need a custom app? 
        <a href="https://SBJGraphics.com" target='_blank' className="text-blue-500 ml-2 hover:underline">
          Visit SBJGraphics.com
        </a> 
        🚀
      </span>
    </div>
  );
};

export default Footer;
