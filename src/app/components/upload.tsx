"use client"; // This makes the component a Client Component

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiShare2, FiDownload, FiX } from 'react-icons/fi'; 
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
import { toast } from 'react-hot-toast'; // Import toast

// Function to determine the icon based on file type
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

const Upload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [s3Urls] = useState<string[]>([]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]); // Append files
      setIsSuccess(false);
    },
    multiple: true, // Allow multiple files
  });

  // Function to remove a file from the list before upload
  const removeFile = (fileToRemove: File) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
  };

  // Handle file upload
  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }
  
    try {
      const progressArr: number[] = Array(files.length).fill(0);
      
      for (let i = 0; i < files.length; i++) {
        await uploadToS3(files[i], (percentCompleted) => {
          progressArr[i] = percentCompleted;
          setProgress([...progressArr]); // Update progress for each file
        });
      }
      
      setIsSuccess(true);
      toast.success('Upload successful!');
    } catch (error) {
      console.error(error);
      setIsSuccess(false);
      setProgress(Array(files.length).fill(0));
      toast.error('Error uploading files');
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center justify-center min-h-screen ">
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

        {/* Display selected files */}
        
        {files.length > 0 && (
        <div className='max-h-60 overflow-auto mt-4'>
            <ul className="mb-5 space-y-2">
            {files.map((file, index) => (
                <li 
                  key={file.name} 
                  className={`flex flex-col text-slate-500 dark:text-slate-300 text-left leading-snug items-start text-sm 
                  ${index % 2 === 0 ? 'bg-gray-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} p-3 rounded-sm`}
                >                <div className="flex items-center">
                    {getFileIcon(file)}
                    <span className="flex-1">{file.name}</span>

                    {/* Remove file before upload */}
                    <button onClick={() => removeFile(file)} className="ml-2">
                    <FiX className="text-red-500 w-4 h-4" />
                    </button>
                </div>
            
                {/* Show progress bar */}
                {progress[index] > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-4 mt-2"> {/* Add margin to separate it */}
                    <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{ width: `${progress[index]}%` }}
                    ></div>
                    </div>
                )}
                </li>
            ))}
            </ul>
        </div>
        )}
       
        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 dark:bg-blue-700"
        >
          Upload
        </button>

        {/* Display S3 links with Copy, Download, and Delete actions */}
        {isSuccess &&
          s3Urls.map((url, index) => (
            <div className="mt-4 text-left" key={index}>
                <div className='mb-2'>
                    <h2 className='font-bold text-xl'>Uploaded Files</h2>
                </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 dark:text-blue-400 underline"
              >
                {files[index]?.name} {/* Display filename */}
              </a>
              <div className="flex mt-2 space-x-2">
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
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

                {/* Delete option after file upload */}
                <button
                  onClick={() => console.log('Deleting file from S3', url)}
                  className="flex items-center space-x-1 text-red-500 hover:text-red-600"
                >
                  <FiX className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Upload;
