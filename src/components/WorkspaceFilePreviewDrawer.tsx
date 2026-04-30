import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import { X, Eye, Image as ImageIcon, Music2, Video, FileText, Download, ExternalLink } from 'lucide-react';
import { getWorkspaceFileDownloadUrl, type WorkspaceFileEntry } from '@/api';
import { formatBytes } from '@/lib/utils';

interface Props {
  open: boolean;
  file: WorkspaceFileEntry | null;
  workspaceId: string;
  onClose: () => void;
}

type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'unsupported';

function getMediaKind(file: WorkspaceFileEntry): MediaKind {
  const mime = (file.file_type || '').toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'unsupported';
}

function mediaKindLabel(kind: MediaKind): string {
  switch (kind) {
    case 'image': return 'Image';
    case 'audio': return 'Audio';
    case 'video': return 'Video';
    case 'pdf': return 'PDF';
    default: return 'Unsupported';
  }
}

function mediaKindIcon(kind: MediaKind) {
  switch (kind) {
    case 'image': return <ImageIcon size={16} />;
    case 'audio': return <Music2 size={16} />;
    case 'video': return <Video size={16} />;
    case 'pdf': return <FileText size={16} />;
    default: return <Eye size={16} />;
  }
}

export default function WorkspaceFilePreviewDrawer({ open, file, workspaceId, onClose }: Props) {
  if (!file) return null;

  const kind = getMediaKind(file);
  const fileName = file.name.split('/').pop() || file.name;
  const inlineUrl = getWorkspaceFileDownloadUrl(workspaceId, file.id, 'inline');
  const downloadUrl = getWorkspaceFileDownloadUrl(workspaceId, file.id, 'download');

  const renderPreview = () => {
    if (kind === 'image') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 220 }}>
          <img
            src={inlineUrl}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }}
          />
        </Box>
      );
    }

    if (kind === 'audio') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 160 }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={inlineUrl} style={{ width: '100%' }} />
        </Box>
      );
    }

    if (kind === 'video') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 240 }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls src={inlineUrl} style={{ width: '100%', maxHeight: 520, borderRadius: 12 }} />
        </Box>
      );
    }

    if (kind === 'pdf') {
      return (
        <iframe
          title={`Preview ${fileName}`}
          src={inlineUrl}
          style={{ width: '100%', minHeight: 520, border: 'none', borderRadius: 12, background: '#fff' }}
        />
      );
    }

    return (
      <Box className="flex flex-col items-center justify-center text-center" sx={{ minHeight: 220, gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          This file type cannot be embedded as a preview.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Download size={15} />}
          onClick={() => { window.location.href = downloadUrl; }}
        >
          Download Instead
        </Button>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 820 },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ px: 2.5, py: 1.8 }} className="flex items-start justify-between gap-3">
          <Box className="min-w-0">
            <Typography variant="h6" fontWeight={700} className="truncate">
              {fileName || 'File Preview'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} className="truncate">
              {file.name}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ p: 2.5, display: 'grid', gap: 2, overflow: 'auto' }}>
          {/* Preview */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box className="flex items-center justify-between" sx={{ mb: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>Preview</Typography>
              <Box className="flex items-center gap-1">
                <Chip
                  size="small"
                  icon={mediaKindIcon(kind)}
                  label={mediaKindLabel(kind)}
                  variant="outlined"
                />
                {kind !== 'unsupported' && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ExternalLink size={14} />}
                    onClick={() => window.open(inlineUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open
                  </Button>
                )}
              </Box>
            </Box>
            {renderPreview()}
          </Paper>

          {/* Metadata */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.25 }}>
              File Metadata
            </Typography>
            <Box className="grid gap-2" sx={{ gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Name</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{fileName || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Full Path</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{file.name || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">MIME Type</Typography>
                <Typography variant="body2">{file.file_type || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Size</Typography>
                <Typography variant="body2">
                  {typeof file.size === 'number' ? `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)` : '—'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Uploaded By</Typography>
                <Typography variant="body2">{file.uploaded_by || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Uploaded At</Typography>
                <Typography variant="body2">
                  {file.created_at ? new Date(file.created_at).toLocaleString() : '—'}
                </Typography>
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / span 2' } }}>
                <Typography variant="caption" color="text.secondary">Checksum (MD5)</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {file.md5_checksum || '—'}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Download */}
          <Button
            variant="contained"
            startIcon={<Download size={16} />}
            fullWidth
            onClick={() => { window.location.href = downloadUrl; }}
          >
            Download File
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
