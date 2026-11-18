import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Upload,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { formatFileSize, uploadFileToCloudStorage, UploadedFileMetadata } from '../../firebase/config';

export interface UploadedFileState {
  url: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
}

interface FileUploadFieldProps {
  label: string;
  helperText?: string;
  folder: 'receipts' | 'supportingDocs' | 'avatars';
  groupId?: string;
  recordIdPrefix?: string;
  scopeMeta?: { uploaderUid?: string; adminId?: string; treasurerId?: string };
  allowPdf?: boolean;
  allowCamera?: boolean;
  value: UploadedFileState | null;
  onChange: (next: UploadedFileState | null) => void;
  onStatusChange?: (status: 'idle' | 'uploading' | 'uploaded' | 'error') => void;
}

/**
 * Resize large camera photos cleanly before upload when over ~1.2MB while preserving PDFs untouched.
 */
async function prepareFileForUpload(file: File): Promise<{ blob: Blob; contentType: string; fileName: string }> {
  if (!file.type.startsWith('image/') || file.size <= 900 * 1024) {
    return {
      blob: file,
      contentType: file.type || 'application/octet-stream',
      fileName: file.name,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxDim = 1440;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ blob: file, contentType: file.type || 'image/jpeg', fileName: file.name });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (compressedBlob) => {
            URL.revokeObjectURL(objectUrl);
            if (compressedBlob && compressedBlob.size > 0 && compressedBlob.size < file.size) {
              const renamed = file.name.replace(/\.[^.]+$/, '') + '.jpg';
              resolve({ blob: compressedBlob, contentType: 'image/jpeg', fileName: renamed });
            } else {
              resolve({ blob: file, contentType: file.type || 'image/jpeg', fileName: file.name });
            }
          },
          'image/jpeg',
          0.84
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, contentType: file.type || 'image/jpeg', fileName: file.name });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, contentType: file.type || 'image/jpeg', fileName: file.name });
    };
    img.src = objectUrl;
  });
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  label,
  helperText,
  folder,
  groupId,
  recordIdPrefix = 'doc',
  scopeMeta,
  allowPdf = true,
  allowCamera = true,
  value,
  onChange,
  onStatusChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>(
    value ? 'uploaded' : 'idle'
  );
  const [progressPct, setProgressPct] = useState<number>(value ? 100 : 0);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (value && uploadStatus === 'idle') {
      setUploadStatus('uploaded');
      setProgressPct(100);
    }
    if (!value && uploadStatus === 'uploaded') {
      setUploadStatus('idle');
      setProgressPct(0);
    }
  }, [value, uploadStatus]);

  useEffect(() => {
    return () => {
      if (localPreview && localPreview.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview);
      }
      cancelRef.current?.();
    };
  }, [localPreview]);

  const acceptTypes = allowPdf ? 'image/*,application/pdf' : 'image/*';

  const startUpload = async (file: File) => {
    setPendingFile(file);
    setErrorMsg('');
    setProgressPct(0);
    setUploadStatus('uploading');
    onStatusChange?.('uploading');

    let previewUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
      setLocalPreview((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return previewUrl!;
      });
    } else {
      setLocalPreview(null);
    }

    try {
      const prepared = await prepareFileForUpload(file);
      const recordId = `${recordIdPrefix}_${Date.now()}`;
      const result: UploadedFileMetadata = await uploadFileToCloudStorage({
        folder,
        groupId,
        recordId,
        file: prepared.blob,
        fileName: prepared.fileName,
        contentType: prepared.contentType,
        scopeMeta,
        onProgress: (pct) => setProgressPct(pct),
        onTaskCreated: (cancel) => {
          cancelRef.current = cancel;
        },
      });

      cancelRef.current = null;
      setUploadStatus('uploaded');
      setProgressPct(100);
      onStatusChange?.('uploaded');
      onChange({
        url: result.url,
        storagePath: result.storagePath,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        previewUrl: previewUrl || (result.fileType.startsWith('image/') ? result.url : undefined),
      });
    } catch (err) {
      cancelRef.current = null;
      const msg = err instanceof Error ? err.message : 'File upload failed.';
      setUploadStatus('error');
      setErrorMsg(msg);
      onStatusChange?.('error');
      onChange(null);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void startUpload(file);
  };

  const handleCancelUpload = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setUploadStatus('idle');
    setProgressPct(0);
    setPendingFile(null);
    setErrorMsg('');
    onStatusChange?.('idle');
    onChange(null);
  };

  const handleRemove = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setPendingFile(null);
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview(null);
    setUploadStatus('idle');
    setProgressPct(0);
    setErrorMsg('');
    onStatusChange?.('idle');
    onChange(null);
  };

  const displayName = value?.fileName || pendingFile?.name || 'Attached file';
  const displaySize = value?.fileSize ?? pendingFile?.size ?? 0;
  const displayType = value?.fileType || pendingFile?.type || '';
  const isPdf = displayType === 'application/pdf' || displayName.toLowerCase().endsWith('.pdf');
  const displayPreview = value?.previewUrl || localPreview || (value?.url && !isPdf ? value.url : null);

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {label}
      </label>

      {uploadStatus === 'idle' && !value && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {allowCamera && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 min-h-[46px] px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] hover:border-slate-500 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
              <span>Take Photo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 min-h-[46px] px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] hover:border-slate-500 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer ${
              !allowCamera ? 'sm:col-span-2' : ''
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{allowPdf ? 'Choose File / PDF' : 'Choose Image'}</span>
          </button>
        </div>
      )}

      {(uploadStatus === 'uploading' || uploadStatus === 'uploaded' || uploadStatus === 'error' || value) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] p-3 space-y-2.5">
          <div className="flex items-start gap-3">
            {displayPreview ? (
              <img
                src={displayPreview}
                alt={displayName}
                className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-200/80 dark:bg-[#18233D] flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                {uploadStatus === 'uploading' ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      aria-label={`Remove ${displayName}`}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {isPdf ? 'PDF Document' : displayType ? displayType.replace('image/', '').toUpperCase() : 'File'}
                {displaySize > 0 ? ` · ${formatFileSize(displaySize)}` : ''}
              </p>

              {uploadStatus === 'uploading' && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading to cloud storage...
                    </span>
                    <span className="font-mono tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-cyan-500 transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === 'uploaded' && value && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Uploaded cleanly to cloud storage</span>
                </div>
              )}
            </div>
          </div>

          {uploadStatus === 'error' && errorMsg && (
            <div
              role="alert"
              className="rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {pendingFile && (
                <button
                  type="button"
                  onClick={() => void startUpload(pendingFile)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{helperText}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={handleFileSelected}
        className="hidden"
      />
      {allowCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
      )}
    </div>
  );
};
