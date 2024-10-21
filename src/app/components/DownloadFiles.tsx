import React, { useEffect, useState, useCallback } from 'react';
import { FiDownload } from 'react-icons/fi';
import generatePresignedUrl from '../lib/generatePresignedUrl';
import GoogleSignIn from './GoogleSignIn';
import { getFileIcon } from '@/app/utils/getFileIcon'; // Adjust the path according to your project structure

const bucketName = 'thegroveryfiles'; // Your S3 bucket name

const DownloadFiles: React.FC = () => {
  const [userSignedIn, setUserSignedIn] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Wrap fetchFiles in useCallback to prevent unnecessary re-creations
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const filesList = await listFilesInS3();
      setFiles(filesList);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userSignedIn) {
      fetchFiles();
    }
  }, [userSignedIn, fetchFiles]);

  const handleSignIn = (token: string) => {
    console.log('Google ID Token:', token);
    // Set the user as signed in
    setUserSignedIn(true);
  };

  const listFilesInS3 = async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/list-s3-files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      return data.files; // Assuming the API returns { files: string[] }
    } catch (error) {
      console.error('Error fetching files from API:', error);
      return [];
    }
  };

  return (
    <div className="bg-white dark:bg-slate-700 p-6 rounded-lg shadow-lg text-center w-full mt-4">
      <h1 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Download Available Files</h1>
      {userSignedIn ? (
        <div className="max-h-60 overflow-auto mt-4">
          {loading ? (
            <p className="text-slate-800 dark:text-slate-300">Loading files...</p>
          ) : files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((fileName) => (
                <li
                  key={fileName}
                  className="flex items-center justify-between p-2 rounded-md bg-gray-100 dark:bg-slate-800 relative group"
                >
                  {/* Left-aligned file icon and name */}
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="min-w-[24px]"> {/* Set a minimum width for the icon */}
                      {getFileIcon(fileName)}
                    </div>
                    <span
                      className="text-sm text-left text-slate-800 dark:text-slate-300 truncate max-w-full overflow-ellipsis"
                    >
                      {fileName}
                    </span>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute left-0 z-10 top-full mt-2 hidden group-hover:block w-max bg-gray-800 text-white text-xs rounded-md px-2 py-1">
                    {fileName}
                  </div>

                  {/* Right-aligned download icon */}
                  <a
                    href={generatePresignedUrl(bucketName, fileName)} // Use generatePresignedUrl to get the download link
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                  >
                    <FiDownload className="w-5 h-5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dark:text-slate-300 text-slate-800">No files found.</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-slate-800 dark:text-slate-300 mb-4">Sign in to view and download files.</p>
          <GoogleSignIn onSignIn={handleSignIn} />
        </div>
      )}
    </div>
  );
};

export default DownloadFiles;
