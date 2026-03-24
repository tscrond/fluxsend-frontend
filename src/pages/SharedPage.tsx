import { useState, useEffect } from 'react';
import { getSharedByUser, getSharedDownloadUrl, type SharedFile } from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatDateFull, isExpired, getFileIcon } from '@/lib/utils';
import { Paper, Typography, Chip, Button, CircularProgress, Box } from '@mui/material';
import { Share2, ExternalLink, Clock } from 'lucide-react';

export default function SharedPage() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await getSharedByUser();
        setFiles(data.files ?? []);
      } catch {
        toast('error', 'Failed to load shared files');
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
        <Typography variant="h5" fontWeight={700}>Shared by Me</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Files you've shared with others
        </Typography>
      </div>

      {files.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <Share2 size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>Nothing shared yet</Typography>
          <Typography variant="body2" color="text.secondary">Files you share will appear here</Typography>
        </Paper>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file, idx) => {
            const expired = isExpired(file.expires_at);
            return (
              <Paper key={`${file.sharing_token}-${idx}`} variant="outlined" className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{getFileIcon(file.file_type)}</span>
                  <Chip
                    label={expired ? 'Expired' : 'Active'}
                    size="small"
                    color={expired ? 'error' : 'success'}
                  />
                </div>
                <Typography variant="subtitle2" className="truncate" sx={{ mb: 1 }}>
                  {file.file_name}
                </Typography>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <span>{formatBytes(file.size)}</span>
                  <span>·</span>
                  <span>To: {file.shared_for}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expires: {formatDateFull(file.expires_at)}</span>
                </div>
                {!expired && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={getSharedDownloadUrl(file.sharing_token)}
                    target="_blank"
                    startIcon={<ExternalLink size={14} />}
                    sx={{ mt: 2 }}
                  >
                    Open Link
                  </Button>
                )}
              </Paper>
            );
          })}
        </div>
      )}
    </div>
  );
}
