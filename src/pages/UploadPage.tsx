import { useState, useCallback, useRef } from 'react';
import { uploadFile } from '@/api';
import { useToast } from '@/hooks/useToast';
import { Button, Paper, Typography, IconButton, LinearProgress } from '@mui/material';
import { Upload, FileUp, CheckCircle, XCircle, X } from 'lucide-react';

interface QueuedFile {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

let fileId = 0;

export default function UploadPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map((file) => ({
      id: ++fileId,
      file,
      status: 'pending' as const,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const removeFromQueue = useCallback((id: number) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = queue.filter((f) => f.status === 'pending' || f.status === 'error');
    if (pending.length === 0) return;

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading' as const } : f)),
      );
      try {
        await uploadFile(item.file);
        setQueue((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'success' as const } : f)),
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error' as const, error: err instanceof Error ? err.message : 'Upload failed' }
              : f,
          ),
        );
      }
    }

    const successCount = pending.length;
    toast('success', `Uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`);
  }, [queue, toast]);

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
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <Typography variant="body2" color="text.secondary">
              {successCount > 0 && `${successCount} uploaded`}
              {successCount > 0 && pendingCount > 0 && ' · '}
              {pendingCount > 0 && `${pendingCount} pending`}
            </Typography>
            <div className="flex gap-2">
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

          <Paper variant="outlined">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-200 last:border-b-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {item.status === 'success' && <CheckCircle size={16} className="text-green-500 shrink-0" />}
                  {item.status === 'error' && <XCircle size={16} className="text-red-500 shrink-0" />}
                  {item.status === 'uploading' && <LinearProgress sx={{ width: 16, height: 16, borderRadius: '50%' }} />}
                  {item.status === 'pending' && <FileUp size={16} className="text-slate-400 shrink-0" />}
                  <div className="min-w-0 flex flex-col">
                    <span className="text-sm font-medium truncate">{item.file.name}</span>
                    <span className="text-xs text-slate-400">
                      {(item.file.size / 1024).toFixed(1)} KB
                      {item.error && <span className="text-red-500"> · {item.error}</span>}
                    </span>
                  </div>
                </div>
                {item.status !== 'uploading' && (
                  <IconButton size="small" onClick={() => removeFromQueue(item.id)}>
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
