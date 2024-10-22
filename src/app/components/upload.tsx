"use client"; // This makes the component a Client Component

import React, { useState } from 'react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { FiX, FiCheckCircle } from 'react-icons/fi'; 
import { uploadToS3 } from '@/app/lib/s3';
import { toast } from 'react-hot-toast'; // Import toast
import { getFileIcon } from '@/app/utils/getFileIcon'; // Adjust the path according to your project structure

const Upload: React.FC<{ refreshFiles: () => void }> = ({ refreshFiles }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<(number | 'complete')[]>([]); // Track upload progress or completion status for each file
  const [loading, setLoading] = useState<boolean>(false); // Track the upload state
  const [disableUpload, setDisableUpload] = useState<boolean>(false); // Disable upload button after upload

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]); // Append files
      setProgress((prevProgress) => [...prevProgress, ...Array(acceptedFiles.length).fill(0)]); // Add progress trackers for new files
      setDisableUpload(false); // Enable upload button if new files are added
    },
    multiple: true, // Allow multiple files
  });

  // Function to remove a file from the list before upload
  const removeFile = (fileToRemove: File) => {
    const indexToRemove = files.indexOf(fileToRemove);
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
    setProgress((prevProgress) => prevProgress.filter((_, index) => index !== indexToRemove)); // Remove progress tracker
  };

  // Handle file upload
  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('No files selected', { position: 'top-center', duration: 5000 });
      return;
    }

    setLoading(true); // Set loading to true

    try {
      const progressArr: (number | 'complete')[] = Array(files.length).fill(0);

      for (let i = 0; i < files.length; i++) {
        await uploadToS3(files[i], (percentCompleted) => {
          progressArr[i] = percentCompleted;
          setProgress([...progressArr]); // Update progress for each file
        });

        // Update progress to 'complete' when a file is uploaded
        progressArr[i] = 'complete';
        setProgress([...progressArr]);

        // Send email notification after each successful upload
        try {
          await fetch('/api/send-upload-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: files[i].name,
              recipientEmail: 'scottj@thegrovery.com', // Replace with actual recipient email
            }),
          });
        } catch (notificationError) {
          console.error('Error sending email notification:', notificationError);
        }
      }

      toast.success('Upload successful!', { position: 'top-center', duration: 8000 });
      refreshFiles(); // Refresh the download list after successful upload

      // Disable upload button since the files are already uploaded
      setDisableUpload(true);
    } catch (error) {
      console.error('Error during file upload:', error);
      setProgress(Array(files.length).fill(0));
      toast.error('Error uploading files', { position: 'top-center', duration: 5000 });
    } finally {
      setLoading(false); // Set loading to false
    }
  };

  return (
    <div className="relative">
      <div className="bg-white dark:bg-slate-700 p-6 rounded-lg shadow-lg text-center w-full">
        <div className='w-full justify-center flex items-center'>
          {/* Logo rendering based on theme */}
          <Image 
            src="imgs/grovery-logo-update-color.svg"
            alt="Grovery Logo Light" 
            width={200}  // Set appropriate width
            height={100}  // Set appropriate height
            className="mb-4 block dark:hidden" 
          />
          <Image 
            src="imgs/grovery-logo-update-white.svg"
            alt="Grovery Logo Dark" 
            width={200}  // Set appropriate width
            height={100}  // Set appropriate height
            className="mb-4 hidden dark:block" 
          />
        </div>

        <h1 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Upload Your Files</h1>
        <div
          {...getRootProps()}
          className="border-2 border-dashed transition hover:bg-slate-300 hover:bg-opacity-10 border-gray-400 dark:border-slate-500 p-5 rounded-lg cursor-pointer mb-5"
        >
          <input {...getInputProps()} />
          <p className="dark:text-slate-300 text-slate-800">Drag & drop your files here, or click to select files</p>
        </div>

        {/* Display selected files */}
        {files.length > 0 && (
          <div className="max-h-60 overflow-auto mt-4">
            <ul className="mb-5 space-y-2">
              {files.map((file, index) => (
                <li 
                  key={file.name} 
                  className={`flex flex-col w-full text-slate-500 dark:text-slate-300 leading-snug text-sm 
                  ${index % 2 === 0 ? 'bg-gray-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} p-3 rounded-sm`}
                >   
                  {/* File icon and name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="min-w-[24px]">
                        {getFileIcon(file.name)}
                      </div>
                      <span className="ml-2 text-left">{file.name}</span>
                    </div>

                    {/* Remove file before upload */}
                    <button onClick={() => removeFile(file)} className="ml-2">
                      <FiX className="text-red-500 w-4 h-4" />
                    </button>
                  </div>

                  {/* Show progress bar or complete message */}
                  {progress[index] !== 'complete' && progress[index] > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                      <div
                        className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${progress[index]}%` }}
                      ></div>
                    </div>
                  )}
                  {progress[index] === 'complete' && (
                    <div className="flex items-center justify-center text-green-600 mt-2">
                      <FiCheckCircle className="w-5 h-5 mr-2" />
                      <span>Upload complete</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleUpload}
          className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 dark:bg-blue-700 ${loading || disableUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={loading || disableUpload || files.length === 0}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

export default Upload;
