import { useState, useCallback, useRef } from 'react';
import { uploadFile, type MultipartUploadProgress } from '@/api';
import { useToast } from '@/hooks/useToast';
import { Box, Button, Paper, Typography, IconButton, LinearProgress, TextField } from '@mui/material';
import { Upload, FileUp, CheckCircle, XCircle, X } from 'lucide-react';
import { runWithConcurrency } from '@/lib/utils';

const FILE_UPLOAD_CONCURRENCY = 3;

interface QueuedFile {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

let fileId = 0;

export default function UploadPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [folder, setFolder] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map((file) => ({
      id: ++fileId,
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const removeFromQueue = useCallback((id: number) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const applyProgress = useCallback((id: number, progress: MultipartUploadProgress) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, progress: Math.round(progress.fraction * 100) }
          : item,
      ),
    );
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = queue.filter((f) => f.status === 'pending' || f.status === 'error');
    if (pending.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    await runWithConcurrency(pending, FILE_UPLOAD_CONCURRENCY, async (item) => {
      setQueue((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading' as const, progress: 0, error: undefined } : f)),
      );

      try {
        await uploadFile(item.file, folder.trim() || undefined, {
          onProgress: (progress) => applyProgress(item.id, progress),
        });
        successCount++;
        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'success' as const, progress: 100 } : f)),
        );
      } catch (err) {
        errorCount++;
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error' as const, error: errorMsg }
              : f,
          ),
        );
      }
    });

    // Show appropriate toast based on actual results
    if (successCount > 0) {
      toast('success', `Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast('error', `Failed to upload ${errorCount} file${errorCount !== 1 ? 's' : ''}`);
    }
  }, [applyProgress, queue, folder, toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const successCount = queue.filter((f) => f.status === 'success').length;
  const pendingCount = queue.filter((f) => f.status === 'pending' || f.status === 'error').length;
  const isUploading = queue.some((f) => f.status === 'uploading');

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Upload Files</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Drag and drop or browse to upload
        </Typography>
      </div>

      {/* Optional folder */}
      <TextField
        size="small"
        label="Destination folder (optional)"
        placeholder="e.g. work/docs"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        sx={{ maxWidth: 360, mb: 3 }}
        fullWidth
        helperText="Leave empty to upload to Root. Use / to nest folders (max 3 levels)."
      />

      {/* Drop zone */}
      <Paper
        variant="outlined"
        className={`flex flex-col items-center py-16 px-6 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-dashed hover:border-indigo-500 hover:bg-indigo-50/50'}`}
        sx={{ borderStyle: 'dashed', borderWidth: 2 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center mb-4">
          <Upload size={32} />
        </div>
        <Typography variant="body1">
          <strong>Click to upload</strong> or drag and drop
        </Typography>
        <Typography variant="caption" color="text.secondary">Any file type supported</Typography>
      </Paper>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="mt-7 min-w-0">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <Typography variant="body2" color="text.secondary">
              {successCount > 0 && `${successCount} uploaded`}
              {successCount > 0 && pendingCount > 0 && ' · '}
              {pendingCount > 0 && `${pendingCount} pending`}
            </Typography>
            <div className="flex flex-wrap gap-2">
              <Button size="small" variant="outlined" onClick={() => setQueue([])} disabled={isUploading}>
                Clear all
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={uploadAll}
                disabled={isUploading || pendingCount === 0}
                startIcon={isUploading ? undefined : <FileUp size={14} />}
              >
                {isUploading ? 'Uploading...' : `Upload ${pendingCount > 0 ? `(${pendingCount})` : 'all'}`}
              </Button>
            </div>
          </div>

          <Paper variant="outlined" className="w-full max-w-full overflow-x-hidden">
            {queue.map((item) => (
              <div key={item.id} className="flex w-full min-w-0 items-start gap-1.5 border-b border-slate-200 px-2 py-2.5 last:border-b-0 sm:items-center sm:gap-2 sm:px-4 sm:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  {item.status === 'success' && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                  {item.status === 'error' && <XCircle size={16} className="text-red-500 shrink-0" />}
                  {item.status === 'uploading' && <Upload size={16} className="text-indigo-500 shrink-0" />}
                  {item.status === 'pending' && <FileUp size={16} className="text-slate-400 shrink-0" />}
                  <div className="min-w-0 flex flex-col">
                    <span className="block max-w-full break-all text-sm font-medium sm:truncate sm:break-normal">{item.file.name}</span>
                    <span className="block break-all pr-1 text-xs text-slate-400">
                      {(item.file.size / 1024).toFixed(1)} KB · {item.progress}%
                      {item.error && <span className="break-all text-red-500"> · {item.error}</span>}
                    </span>
                    <Box sx={{ mt: 0.75 }}>
                      <LinearProgress
                        variant="determinate"
                        value={item.progress}
                        color={item.status === 'error' ? 'error' : item.status === 'success' ? 'success' : 'primary'}
                      />
                    </Box>
                  </div>
                </div>
                {item.status !== 'uploading' && (
                  <IconButton size="small" onClick={() => removeFromQueue(item.id)} className="shrink-0">
                    <X size={14} />
                  </IconButton>
                )}
              </div>
            ))}
          </Paper>
        </div>
      )}
    </div>
  );
}
