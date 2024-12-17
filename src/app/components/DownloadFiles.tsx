// src/app/components/DownloadFiles.tsx

import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { FiDownload, FiCopy, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import generatePresignedUrl from '../lib/generatePresignedUrl';
import GoogleSignIn from './GoogleSignIn';
import { getFileIcon } from '@/app/utils/getFileIcon'; // Adjust the path according to your project structure
import { toast } from 'react-hot-toast';

const bucketName = 'groveryuploads'; // Your S3 bucket name

interface FileInfo {
  name: string;
  lastModified: Date;
}

type SortField = 'name' | 'date';
type SortDirection = 'asc' | 'desc';

interface S3FileObject {
  Key: string;
  LastModified: Date;
}

const DownloadFiles = forwardRef((props, ref) => {
  const [userSignedIn, setUserSignedIn] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // Using useImperativeHandle to expose `fetchFiles` to parent
  useImperativeHandle(ref, () => ({
    fetchFiles,
  }));

  const handleSignIn = (token: string) => {
    console.log('Google ID Token:', token);
    setUserSignedIn(true);
  };

  const listFilesInS3 = async (): Promise<FileInfo[]> => {
    try {
      const response = await fetch('/api/list-s3-files');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      return data.files.map((file: S3FileObject) => ({
        name: file.Key,
        lastModified: new Date(file.LastModified)
      }));
    } catch (error) {
      console.error('Error fetching files from API:', error);
      return [];
    }
  };

  const handleCopyLink = async (fileName: string) => {
    const link = generatePresignedUrl(bucketName, fileName);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Failed to copy link.');
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      toast((t) => (
        <span>
          Are you sure you want to delete <b>{fileName}</b>?
          <div className="mt-2">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                resolve(true);
              }}
              className="bg-red-500 text-white px-2 py-1 rounded mr-2"
            >
              Delete
            </button>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                resolve(false);
              }}
              className="bg-gray-500 text-white px-2 py-1 rounded"
            >
              Cancel
            </button>
          </div>
        </span>
      ));
    });

    if (confirmed) {
      try {
        const response = await fetch(`/api/delete-file?fileName=${encodeURIComponent(fileName)}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete file');
        }

        setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
        toast.success('File deleted successfully!');
      } catch (error) {
        console.error('Error deleting file:', error);
        toast.error('Error deleting file.');
      }
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortFiles = (filesToSort: FileInfo[]) => {
    return [...filesToSort].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (sortField === 'name') {
        return multiplier * a.name.localeCompare(b.name);
      } else {
        return multiplier * (a.lastModified.getTime() - b.lastModified.getTime());
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-700 p-6 rounded-lg shadow-lg text-center w-full mt-4">
      <h1 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Download Available Files</h1>
      {userSignedIn ? (
        <div className="max-h-60 overflow-auto mt-4">
          {loading ? (
            <p className="text-slate-800 dark:text-slate-300">Loading files...</p>
          ) : files.length > 0 ? (
            <>
              <div className="flex px-1 w-full justify-between mb-2 space-x-4">
                <button
                  onClick={() => toggleSort('name')}
                  className="flex items-center space-x-1 text-sm text-slate-600 dark:text-slate-300"
                >
                  <span>Name</span>
                  {sortField === 'name' && (
                    sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />
                  )}
                </button>
                <button
                  onClick={() => toggleSort('date')}
                  className="flex items-center space-x-1 text-sm text-slate-600 dark:text-slate-300"
                >
                  <span>Date</span>
                  {sortField === 'date' && (
                    sortDirection === 'asc' ? <FiArrowUp /> : <FiArrowDown />
                  )}
                </button>
              </div>
              <ul className="space-y-2">
                {sortFiles(files).map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between p-2 rounded-md bg-gray-100 dark:bg-slate-800 relative group"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="min-w-[24px]">
                        {getFileIcon(file.name)}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-sm text-slate-800 dark:text-slate-300">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {file.lastModified.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <a
                        href={generatePresignedUrl(bucketName, file.name)} // Use generatePresignedUrl to get the download link
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                      >
                        <FiDownload className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleCopyLink(file.name)}
                        className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                      >
                        <FiCopy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.name)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
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
});

DownloadFiles.displayName = 'DownloadFiles';

export default DownloadFiles;
