import React, { useState } from 'react';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  onFileSelect: (file: File) => void;
  label?: string;
}

export function FileUpload({
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  onFileSelect,
  label = 'Upload File',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.length) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    setError(null);

    if (file.size > maxSize) {
      setError(`File too large. Max size: ${(maxSize / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300 mb-3">
        {label}
      </label>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />

        <label htmlFor="file-upload" className="cursor-pointer block">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <p className="text-slate-300 font-medium">
            Drag and drop your file here, or click to select
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Max size: {(maxSize / 1024 / 1024).toFixed(0)}MB
          </p>
        </label>
      </div>

      {selectedFile && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-green-400 text-sm">
            ✓ Selected: {selectedFile.name}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">✗ {error}</p>
        </div>
      )}
    </div>
  );
}
