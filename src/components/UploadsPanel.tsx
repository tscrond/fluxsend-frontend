import { Box, Button, Chip, IconButton, LinearProgress, Paper, Typography } from '@mui/material';
import { CheckCircle, Clock3, LoaderCircle, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { useUploadManager, type UploadItem, type UploadStatus, type UploadTarget } from '@/hooks/useUploadManager';
import { formatBytes } from '@/lib/utils';

function formatUploadTarget(target: UploadTarget): string {
  if (target.kind === 'personal') {
    return target.folder ? `Personal · ${target.folder}` : 'Personal · Root';
  }
  return target.folder
    ? `Workspace · ${target.workspaceName} · ${target.folder}`
    : `Workspace · ${target.workspaceName} · Root`;
}

function statusLabel(status: UploadStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'uploading':
      return 'Uploading';
    case 'success':
      return 'Completed';
    case 'error':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function statusColor(status: UploadStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'queued':
      return 'warning';
    case 'uploading':
      return 'primary';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'cancelled':
      return 'default';
    default:
      return 'default';
  }
}

function StatusIcon({ item }: { item: UploadItem }) {
  switch (item.status) {
    case 'queued':
      return <Clock3 size={18} className="text-amber-500" />;
    case 'uploading':
      return <LoaderCircle size={18} className="text-indigo-500 animate-spin" />;
    case 'success':
      return <CheckCircle size={18} className="text-green-500" />;
    case 'error':
      return <XCircle size={18} className="text-red-500" />;
    case 'cancelled':
      return <X size={18} className="text-slate-400" />;
    default:
      return null;
  }
}

export default function UploadsPanel({ compact = false }: { compact?: boolean }) {
  const {
    uploads,
    activeCount,
    pendingCount,
    failedCount,
    completedCount,
    cancelUpload,
    cancelAllUploads,
    retryUpload,
    retryFailedUploads,
    removeUpload,
    clearCompleted,
  } = useUploadManager();

  if (uploads.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: compact ? 2 : 3 }}>
        <Typography variant="subtitle1" fontWeight={700}>No uploads yet</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Add files from the Uploads page, workspace browser, or global drag and drop. They will stay alive while you move around the app.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: compact ? 2 : 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" color={activeCount > 0 ? 'primary' : 'default'} label={`${activeCount} active`} />
          <Chip size="small" color={pendingCount > activeCount ? 'warning' : 'default'} label={`${pendingCount} pending`} />
          <Chip size="small" color={failedCount > 0 ? 'error' : 'default'} label={`${failedCount} need attention`} />
          <Chip size="small" color={completedCount > 0 ? 'success' : 'default'} label={`${completedCount} completed`} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" onClick={cancelAllUploads} disabled={activeCount === 0}>
            Cancel all
          </Button>
          <Button size="small" variant="outlined" onClick={retryFailedUploads} disabled={failedCount === 0}>
            Retry failed
          </Button>
          <Button size="small" variant="outlined" onClick={clearCompleted} disabled={completedCount === 0}>
            Clear completed
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {uploads.map((item) => {
          const canCancel = item.status === 'queued' || item.status === 'uploading';
          const canRetry = item.status === 'error' || item.status === 'cancelled';
          const canRemove = item.status !== 'uploading';

          return (
            <Box
              key={item.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: compact ? 1.5 : 2,
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                  <StatusIcon item={item} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                      {item.fileName}
                    </Typography>
                    <Chip size="small" color={statusColor(item.status)} label={statusLabel(item.status)} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {formatUploadTarget(item.target)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {item.progress}% · {formatBytes(item.size)}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={item.progress}
                      color={item.status === 'error' ? 'error' : item.status === 'success' ? 'success' : 'primary'}
                    />
                  </Box>
                  {item.error && (
                    <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
                      {item.error}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  {canRetry && (
                    <IconButton size="small" onClick={() => retryUpload(item.id)}>
                      <RotateCcw size={16} />
                    </IconButton>
                  )}
                  {canCancel && (
                    <IconButton size="small" onClick={() => cancelUpload(item.id)}>
                      <X size={16} />
                    </IconButton>
                  )}
                  {canRemove && (
                    <IconButton size="small" onClick={() => removeUpload(item.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}