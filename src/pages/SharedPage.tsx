import { useState, useEffect } from 'react';
import { getSharedByUser, revokeShare, type SharedFile } from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatDateFull, isExpired, getFileIcon } from '@/lib/utils';
import { Paper, Typography, Chip, Button, CircularProgress, Box } from '@mui/material';
import { Share2, ExternalLink, Clock, Trash2 } from 'lucide-react';

export default function SharedPage() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
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

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      await revokeShare(token);
      setFiles((prev) => prev.filter((f) => f.sharing_token !== token));
      toast('success', 'Share revoked');
    } catch {
      toast('error', 'Failed to revoke share');
    } finally {
      setRevoking(null);
    }
  };

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
            const isRevoking = revoking === file.sharing_token;
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
                <div className="flex items-center gap-2 mt-2">
                  {!expired && (
                    <Button
                      size="small"
                      variant="outlined"
                      href={`${window.location.origin}/share/${file.sharing_token}`}
                      target="_blank"
                      startIcon={<ExternalLink size={14} />}
                    >
                      Open Link
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={isRevoking}
                    startIcon={isRevoking ? <CircularProgress size={12} color="inherit" /> : <Trash2 size={14} />}
                    onClick={() => handleRevoke(file.sharing_token)}
                  >
                    Revoke
                  </Button>
                </div>
              </Paper>
            );
          })}
        </div>
      )}
    </div>
  );
}
