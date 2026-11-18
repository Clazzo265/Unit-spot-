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
  Pause,
  Play,
  X,
  WifiOff,
} from 'lucide-react';
import {
  formatFileSize,
  uploadFileToCloudStorage,
  UploadedFileMetadata,
  UploadTaskController,
} from '../../firebase/config';
import {
  UploadStatus,
  MAX_UPLOAD_SIZE_BYTES,
  validateUploadFile,
  isUploadInProgress,
  getUploadStatusLabel,
} from '../../utils/uploadUtils';

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
  onStatusChange?: (status: UploadStatus) => void;
}

/**
 * Compress large mobile camera photos cleanly while keeping receipt numbers & names readable.
 * Leaves PDFs and normal-sized images (< 850 KB) untouched.
 */
async function prepareFileForUpload(
  file: File,
  normalizedType: 'application/pdf' | 'image/jpeg' | 'image/png'
): Promise<{ blob: Blob; contentType: string; fileName: string }> {
  if (normalizedType === 'application/pdf' || file.size <= 850 * 1024) {
    return {
      blob: file,
      contentType: normalizedType,
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
          resolve({ blob: file, contentType: normalizedType, fileName: file.name });
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
              resolve({ blob: file, contentType: normalizedType, fileName: file.name });
            }
          },
          'image/jpeg',
          0.84
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, contentType: normalizedType, fileName: file.name });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, contentType: normalizedType, fileName: file.name });
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
  const taskControllerRef = useRef<UploadTaskController | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const uploadRunIdRef = useRef<number>(0);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(
    value ? 'completed' : 'idle'
  );
  const [progressPct, setProgressPct] = useState<number>(value ? 100 : 0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  const updateStatus = (next: UploadStatus) => {
    setUploadStatus(next);
    onStatusChange?.(next);
  };

  useEffect(() => {
    if (value && uploadStatus === 'idle') {
      setUploadStatus('completed');
      setProgressPct(100);
    }
    if (!value && uploadStatus === 'completed') {
      setUploadStatus('idle');
      setProgressPct(0);
    }
  }, [value, uploadStatus]);

  // Network awareness during uploads
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup active Storage upload & preview URL ONLY on true component unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      taskControllerRef.current?.cancel();
      taskControllerRef.current = null;
      if (localPreviewRef.current && localPreviewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  const acceptTypes = allowPdf
    ? 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png'
    : 'image/jpeg,image/png,.jpg,.jpeg,.png';

  const startUpload = async (file: File, isRetry = false) => {
    const runId = ++uploadRunIdRef.current;

    // Cancel any previous task before starting the next
    taskControllerRef.current?.cancel();
    taskControllerRef.current = null;

    setPendingFile(file);
    setErrorMsg('');
    setProgressPct(0);

    // Pre-preparation validation (checks PDF/JPG/JPEG/PNG format & size before preparation)
    const preCheck = validateUploadFile({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      allowPdf,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      prePreparation: true,
    });

    if (!preCheck.valid || !preCheck.normalizedType) {
      updateStatus('failed');
      setErrorMsg(preCheck.error || 'Unsupported file.');
      onChange(null);
      return;
    }

    updateStatus(isRetry ? 'retrying' : 'preparing');

    let previewUrl: string | undefined;
    if (preCheck.isImage) {
      previewUrl = URL.createObjectURL(file);
      if (localPreviewRef.current && localPreviewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
      localPreviewRef.current = previewUrl;
      setLocalPreview(previewUrl);
    } else {
      if (localPreviewRef.current && localPreviewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
      localPreviewRef.current = null;
      setLocalPreview(null);
    }

    try {
      const prepared = await prepareFileForUpload(file, preCheck.normalizedType);

      if (!isMountedRef.current || uploadRunIdRef.current !== runId) return;

      const postCheck = validateUploadFile({
        fileName: prepared.fileName,
        fileType: prepared.contentType,
        fileSize: prepared.blob.size,
        allowPdf,
        maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        prePreparation: false,
      });

      if (!postCheck.valid) {
        updateStatus('failed');
        setErrorMsg(postCheck.error || 'File exceeds 5 MB maximum upload size.');
        onChange(null);
        return;
      }

      updateStatus('uploading');
      const recordId = `${recordIdPrefix}_${Date.now()}`;

      const result: UploadedFileMetadata = await uploadFileToCloudStorage({
        folder,
        groupId,
        recordId,
        file: prepared.blob,
        fileName: prepared.fileName,
        contentType: prepared.contentType,
        maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        scopeMeta,
        onProgress: (pct) => {
          if (isMountedRef.current && uploadRunIdRef.current === runId) {
            setProgressPct(pct);
          }
        },
        onStateChange: (nextStatus, pct) => {
          if (!isMountedRef.current || uploadRunIdRef.current !== runId) return;
          setProgressPct(pct);
          if (nextStatus === 'paused' || nextStatus === 'uploading') {
            updateStatus(nextStatus);
          }
        },
        onTaskCreated: (controller) => {
          if (uploadRunIdRef.current === runId) {
            taskControllerRef.current = controller;
          } else {
            controller.cancel();
          }
        },
      });

      if (!isMountedRef.current || uploadRunIdRef.current !== runId) return;

      taskControllerRef.current = null;
      setProgressPct(100);
      updateStatus('completed');
      onChange({
        url: result.url,
        storagePath: result.storagePath,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        previewUrl: previewUrl || (result.fileType.startsWith('image/') ? result.url : undefined),
      });
    } catch (err) {
      if (!isMountedRef.current || uploadRunIdRef.current !== runId) return;
      taskControllerRef.current = null;
      const msg = err instanceof Error ? err.message : 'File upload failed.';
      const wasCancelled = msg.toLowerCase().includes('cancelled');
      updateStatus(wasCancelled ? 'cancelled' : 'failed');
      setErrorMsg(wasCancelled ? 'Upload cancelled. Tap Retry or choose another file.' : msg);
      onChange(null);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void startUpload(file, false);
  };

  const handlePauseToggle = () => {
    if (!taskControllerRef.current) return;
    if (uploadStatus === 'paused') {
      taskControllerRef.current.resume();
      updateStatus('uploading');
    } else if (uploadStatus === 'uploading') {
      taskControllerRef.current.pause();
      updateStatus('paused');
    }
  };

  const handleCancelUpload = () => {
    uploadRunIdRef.current += 1;
    taskControllerRef.current?.cancel();
    taskControllerRef.current = null;
    setProgressPct(0);
    updateStatus('cancelled');
    setErrorMsg('Upload cancelled. Tap Retry to upload again or choose another file.');
    onChange(null);
  };

  const handleRemove = () => {
    uploadRunIdRef.current += 1;
    taskControllerRef.current?.cancel();
    taskControllerRef.current = null;
    setPendingFile(null);
    if (localPreviewRef.current && localPreviewRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(localPreviewRef.current);
    }
    localPreviewRef.current = null;
    setLocalPreview(null);
    setProgressPct(0);
    setErrorMsg('');
    updateStatus('idle');
    onChange(null);
  };

  const inProgress = isUploadInProgress(uploadStatus);
  const displayName = value?.fileName || pendingFile?.name || 'Attached file';
  const displaySize = value?.fileSize ?? pendingFile?.size ?? 0;
  const displayType = value?.fileType || pendingFile?.type || '';
  const isPdf = displayType === 'application/pdf' || displayName.toLowerCase().endsWith('.pdf');
  const displayPreview = value?.previewUrl || localPreview || (value?.url && !isPdf ? value.url : null);
  const showCard = uploadStatus !== 'idle' || Boolean(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {label}
        </label>
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          {allowPdf ? 'PDF, JPG, JPEG, PNG · Max 5 MB' : 'JPG, JPEG, PNG · Max 5 MB'}
        </span>
      </div>

      {!isOnline && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You appear offline. Reconnect before uploading or tap Retry when internet returns.</span>
        </div>
      )}

      {!showCard && (
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
            <span>{allowPdf ? 'Choose Photo / PDF' : 'Choose Image'}</span>
          </button>
        </div>
      )}

      {showCard && (
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
                {inProgress ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {(uploadStatus === 'uploading' || uploadStatus === 'paused') && (
                      <button
                        type="button"
                        onClick={handlePauseToggle}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        {uploadStatus === 'paused' ? (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
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

              {inProgress && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                    <span className="inline-flex items-center gap-1.5">
                      {uploadStatus !== 'paused' && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>{getUploadStatusLabel(uploadStatus, progressPct)}</span>
                    </span>
                    <span className="font-mono tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        uploadStatus === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-blue-600 dark:bg-cyan-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === 'completed' && value && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Upload completed</span>
                </div>
              )}
            </div>
          </div>

          {(uploadStatus === 'failed' || uploadStatus === 'cancelled') && errorMsg && (
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
                  onClick={() => void startUpload(pendingFile, true)}
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
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
      )}
    </div>
  );
};
