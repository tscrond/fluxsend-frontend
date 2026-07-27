import { useCallback, useRef, useState } from 'react';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { Upload } from 'lucide-react';
import UploadsPanel from '@/components/UploadsPanel';
import { useUploadManager } from '@/hooks/useUploadManager';

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [folder, setFolder] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { enqueueUploads, activeCount, failedCount, completedCount } = useUploadManager();

  const addFiles = useCallback((files: FileList | File[]) => {
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;

    enqueueUploads({
      files: nextFiles,
      source: 'upload-page',
      target: { kind: 'personal', folder: folder.trim() || undefined },
    });

    if (inputRef.current) inputRef.current.value = '';
  }, [enqueueUploads, folder]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Uploads</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Queue personal uploads here and keep tracking every upload while you navigate the app.
        </Typography>
      </div>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Active</Typography>
          <Typography variant="h6" fontWeight={800}>{activeCount}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Need attention</Typography>
          <Typography variant="h6" fontWeight={800}>{failedCount}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary">Completed this session</Typography>
          <Typography variant="h6" fontWeight={800}>{completedCount}</Typography>
        </Paper>
      </Box>

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

      <Paper
        variant="outlined"
        className={`flex flex-col items-center py-16 px-6 text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-dashed hover:border-indigo-500 hover:bg-indigo-50/50'}`}
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
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
          <Upload size={32} />
        </div>
        <Typography variant="h6" fontWeight={700}>Select or Drop Files</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 520 }}>
          Files start uploading immediately in the background. You can keep browsing the app and manage progress from here or the global uploads drawer.
        </Typography>
        <Button variant="contained" startIcon={<Upload size={16} />}>
          Add files
        </Button>
      </Paper>

      <Box sx={{ mt: 4 }}>
        <UploadsPanel />
      </Box>
    </div>
  );
}
