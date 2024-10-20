// src/components/Upload.tsx
"use client"; // This makes the component a Client Component

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiShare2, FiDownload, FiFileText, FiX } from 'react-icons/fi';
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
import { uploadToS3 } from '@/app/lib/s3';
import ThemeToggle from '@/app/components/ThemeToggler';
import toast, { Toaster } from 'react-hot-toast'; // Toast for notifications

// Function to get the file icon
const getFileIcon = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const iconSize = "w-5 h-5 mr-2"; // Icon size globally

  switch (extension) {
    case 'pdf':
      return <FaFilePdf className={`text-red-500 ml-[-0.15em] ${iconSize}`} />;
    case 'doc':
    case 'docx':
      return <FaFileWord className={`text-blue-500 ${iconSize}`} />;
    case 'ppt':
    case 'pptx':
      return <FaFilePowerpoint className={`text-orange-500 ${iconSize}`} />;
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
      return <FaFileArchive className={`text-yellow-500 ${iconSize}`} />;
    case 'mp4':
    case 'mov':
      return <FaFileVideo className={`text-purple-500 ml-[-0.15em]  ${iconSize}`} />;
    default:
      return <FaFile className={`text-gray-500 ml-[-0.15em]  ${iconSize}`} />;
  }
};

const Upload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [s3Urls, setS3Urls] = useState<string[]>([]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
      setIsSuccess(false);
      setStatusMessage('');
    },
    multiple: true,
  });

  // Remove a file from the list
  const handleRemoveFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }

    try {
      setStatusMessage('Uploading...');
      toast.loading('Uploading...');

      const uploadedUrls: string[] = [];
      const progressArr: number[] = Array(files.length).fill(0);

      for (let i = 0; i < files.length; i++) {
        const uploadedUrl = await uploadToS3(files[i]);
        uploadedUrls.push(uploadedUrl);
        progressArr[i] = 100;
        setProgress([...progressArr]);
      }

      setS3Urls(uploadedUrls);
      toast.dismiss();
      toast.success('Upload successful!');
      setIsSuccess(true);
    } catch (error) {
      toast.dismiss();
      toast.error('Error uploading files');
      setIsSuccess(false);
      setProgress(Array(files.length).fill(0));
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900">
      <Toaster /> {/* Toast notifications */}
      
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="bg-white dark:bg-slate-700 p-6 rounded-lg shadow-lg text-center w-96">
        <h1 className="text-xl font-bold mb-4 dark:text-slate-100">Upload Your Files</h1>
        <div
          {...getRootProps()}
          className="border-2 border-dashed border-gray-400 dark:border-slate-500 p-5 rounded-lg cursor-pointer mb-5"
        >
          <input {...getInputProps()} />
          <p className="dark:text-slate-300">Drag & drop your files here, or click to select files</p>
        </div>

        {files.length > 0 && (
          <ul className="mb-5 space-y-4">
            {files.map((file, index) => (
              <li key={file.name} className="flex justify-between items-center text-slate-500 dark:text-slate-300 text-left leading-snug text-sm"> 
                <div className="flex items-center">
                  {getFileIcon(file)}
                  {file.name}
                </div>
                <button onClick={() => handleRemoveFile(index)}>
                  <FiX className="text-red-500 w-5 h-5 hover:text-red-700" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 dark:bg-blue-700"
        >
          Upload
        </button>

        {isSuccess &&
          s3Urls.map((url, index) => (
            <div className="mt-4 text-left" key={index}>
              <div className="flex justify-between items-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 underline"
                >
                  {files[index].name}
                </a>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast.success('Link copied to clipboard');
                    }}
                    className="flex items-center space-x-1 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                  >
                    <FiShare2 className="w-5 h-5" />
                    <span>Copy Link</span>
                  </button>

                  <a
                    href={url}
                    download
                    className="flex items-center space-x-1 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                  >
                    <FiDownload className="w-5 h-5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Upload;
