// src/utils/getFileIcon.tsx

import React from 'react';
import {
  FaFilePdf,
  FaFileWord,
  FaFilePowerpoint,
  FaFileExcel,
  FaFileArchive,
  FaFileVideo,
  FaFileImage,
  FaFile,
} from 'react-icons/fa';

export const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const iconSize = "w-5 h-5 mr-2"; // Icon size globally

  switch (extension) {
    case 'pdf':
      return <FaFilePdf className={`text-red-500 ml-[-0.15em] ${iconSize}`} />;
    case 'doc':
    case 'docx':
      return <FaFileWord className={`text-blue-500 ${iconSize}`} />;
    case 'ppt':
    case 'pptx':
      return <FaFilePowerpoint className={`text-orange-500  ml-[-0.15em] ${iconSize}`} />;
    case 'xls':
    case 'xlsx':
      return <FaFileExcel className={`text-green-500 ${iconSize}`} />;
    case 'psd':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'ai':
    case 'gif':
      return <FaFileImage className={`text-orange-500 ml-[-0.15em]  ${iconSize}`} />;
    case 'zip':
    case 'rar':
      return <FaFileArchive className={`text-yellow-500  ml-[-0.15em] ${iconSize}`} />;
    case 'mp4':
    case 'mov':
      return <FaFileVideo className={`text-purple-500 ml-[-0.15em]  ${iconSize}`} />;
    default:
      return <FaFile className={`text-gray-500 ml-[-0.15em]  ${iconSize}`} />; // Default icon
  }
};
