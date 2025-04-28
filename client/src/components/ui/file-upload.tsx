import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Upload, Check, AlertCircle } from 'lucide-react';

type FileUploadProps = {
  onFileChange: (file: File | null) => void;
  maxSize?: number; // in MB
  accept?: string[];
  className?: string;
  label?: string;
  currentFileName?: string;
};

export function FileUpload({
  onFileChange,
  maxSize = 10, // 10MB default
  accept = ["image/png", "image/jpeg", "image/jpg", "application/pdf"],
  className,
  label = "Anexar Comprovante",
  currentFileName,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(currentFileName);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      
      // Check file size
      if (selectedFile.size > maxSize * 1024 * 1024) {
        setError(`O arquivo excede o tamanho máximo de ${maxSize}MB`);
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      onFileChange(selectedFile);
    }
  }, [maxSize, onFileChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((obj, curr) => ({...obj, [curr]: []}), {}),
    maxFiles: 1,
  });

  const removeFile = () => {
    setFile(null);
    setFileName(undefined);
    onFileChange(null);
  };

  const acceptedExtensions = accept.map(type => {
    return type.split('/')[1].toUpperCase();
  }).join(', ');

  return (
    <div className={className}>
      {label && (
        <Label className="block text-sm font-medium mb-1">
          {label}
        </Label>
      )}
      
      {!file && !fileName ? (
        <div
          {...getRootProps()}
          className={cn(
            "mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors",
            isDragActive 
              ? "border-primary/70 bg-primary/5" 
              : "border-slate-300 hover:border-primary/50",
          )}
        >
          <input {...getInputProps()} />
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-10 w-10 text-slate-400" />
            <div className="flex text-sm text-slate-600">
              <p className="relative font-medium text-primary hover:text-secondary focus-within:outline-none">
                Faça upload de um arquivo
              </p>
              <p className="pl-1">ou arraste e solte</p>
            </div>
            <p className="text-xs text-slate-500">
              {acceptedExtensions} até {maxSize}MB
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between p-4 border border-slate-300 rounded-md">
          <div className="flex items-center">
            {fileName && fileName.endsWith('.pdf') ? (
              <div className="h-10 w-10 flex items-center justify-center rounded-md bg-red-50 text-red-500">
                PDF
              </div>
            ) : (
              <div className="h-10 w-10 flex items-center justify-center rounded-md bg-blue-50 text-blue-500">
                IMG
              </div>
            )}
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
              <p className="text-xs text-slate-500">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={removeFile}
            type="button"
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {error && (
        <div className="mt-1 flex items-center text-sm text-destructive">
          <AlertCircle className="mr-1 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
