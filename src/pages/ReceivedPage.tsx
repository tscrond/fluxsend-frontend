import { useState, useEffect, useCallback } from 'react';
import { getReceivedFiles, getSharedDownloadUrl, markReceivedSeen, type SharedFile } from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatDateFull, isExpired, getFileIcon } from '@/lib/utils';
import ReceivedFilePreviewDrawer from '@/components/ReceivedFilePreviewDrawer';
import { Paper, Typography, Chip, Button, CircularProgress, Box } from '@mui/material';
import { Inbox, Download, Clock, Eye } from 'lucide-react';

export default function ReceivedPage() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  const { toast } = useToast();

  const markSeen = useCallback((token: string) => {
    setFiles(prev =>
      prev.map(f => f.sharing_token === token ? { ...f, seen: true } : f)
    );
    markReceivedSeen(token).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await getReceivedFiles();
        setFiles(data.files ?? []);
      } catch {
        toast('error', 'Failed to load received files');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  if (loading) {
    return (
      <Box className="flex items-center justify-center py-20">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Received Files</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Files others have shared with you
        </Typography>
      </div>

      {files.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <Inbox size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No files received</Typography>
          <Typography variant="body2" color="text.secondary">Files shared with you will appear here</Typography>
        </Paper>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file, idx) => {
            const expired = isExpired(file.expires_at);
            const unseen = !file.seen && !expired;
            return (
              <Paper
                key={`${file.sharing_token}-${idx}`}
                variant="outlined"
                className="p-5 hover:shadow-md transition-shadow"
                sx={unseen ? { borderColor: 'primary.main', borderWidth: 2 } : undefined}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{getFileIcon(file.file_type)}</span>
                  <div className="flex items-center gap-1.5">
                    {unseen && (
                      <Chip label="New" size="small" color="primary" />
                    )}
                    <Chip
                      label={expired ? 'Expired' : 'Active'}
                      size="small"
                      color={expired ? 'error' : 'success'}
                    />
                  </div>
                </div>
                <Typography variant="subtitle2" className="truncate" sx={{ mb: 1 }}>
                  {file.file_name}
                </Typography>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <span>{formatBytes(file.size)}</span>
                  <span>·</span>
                  <span>From: {file.shared_by}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expires: {formatDateFull(file.expires_at)}</span>
                </div>
                {!expired && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setPreviewFile(file);
                        markSeen(file.sharing_token);
                      }}
                      startIcon={<Eye size={14} />}
                    >
                      Preview
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      href={getSharedDownloadUrl(file.sharing_token)}
                      target="_blank"
                      onClick={() => markSeen(file.sharing_token)}
                      startIcon={<Download size={14} />}
                    >
                      Download
                    </Button>
                  </div>
                )}
              </Paper>
            );
          })}
        </div>
      )}

      <ReceivedFilePreviewDrawer
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
