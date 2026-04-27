import { useMemo, useState, useEffect } from 'react';
import { getSharedDownloadUrl, resolvePublicShare, type SharedFile } from '@/api';
import { ApiError } from '@/api';
import { formatBytes, formatDateFull, isExpired } from '@/lib/utils';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Paper,
  Chip,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import { X, Eye, Image as ImageIcon, Music2, Video, FileText, ExternalLink, Download, Lock, EyeOff } from 'lucide-react';

interface Props {
  open: boolean;
  file: SharedFile | null;
  onClose: () => void;
}

type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'unsupported';

function getMediaKind(fileType: string, fileName: string): MediaKind {
  const mime = (fileType || '').toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';

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

export default function ReceivedFilePreviewDrawer({ open, file, onClose }: Props) {
  const kind = useMemo(
    () => (file ? getMediaKind(file.file_type, file.file_name) : 'unsupported'),
    [file],
  );

  // Unlock state (for password-protected shares)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [resolvedInlineUrl, setResolvedInlineUrl] = useState<string | null>(null);
  const [resolvedDownloadUrl, setResolvedDownloadUrl] = useState<string | null>(null);

  // Reset unlock state whenever a different file is opened
  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setUnlocking(false);
    setUnlockError(null);
    setResolvedInlineUrl(null);
    setResolvedDownloadUrl(null);
  }, [file?.sharing_token]);

  const fileName = file?.file_name.split('/').pop() || file?.file_name || '';
  const expired = file ? isExpired(file.expires_at) : false;
  const isPasswordProtected = Boolean(file?.password_protected);
  const isUnlocked = Boolean(resolvedInlineUrl || resolvedDownloadUrl);

  // For non-protected files, use direct download URLs; for unlocked files, use resolved URLs
  const previewUrl = isPasswordProtected ? resolvedInlineUrl : (file ? getSharedDownloadUrl(file.sharing_token, 'inline') : null);
  const downloadUrl = isPasswordProtected ? resolvedDownloadUrl : (file ? getSharedDownloadUrl(file.sharing_token, 'download') : null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !password.trim()) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const [inlineRes, downloadRes] = await Promise.all([
        resolvePublicShare(file.sharing_token, 'inline', password),
        resolvePublicShare(file.sharing_token, 'download', password),
      ]);
      setResolvedInlineUrl(inlineRes.url);
      setResolvedDownloadUrl(downloadRes.url);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setUnlockError('Wrong password. Please try again.');
        } else if (err.status === 429 || err.body?.includes('share_blocked')) {
          setUnlockError('Too many failed attempts — this share has been blocked.');
        } else {
          setUnlockError('Failed to unlock. Please try again.');
        }
      } else {
        setUnlockError('Failed to unlock. Please try again.');
      }
    } finally {
      setUnlocking(false);
    }
  };

  const renderPreview = () => {
    if (!file) {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 260 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (expired) {
      return (
        <Box className="flex flex-col items-center justify-center text-center" sx={{ minHeight: 220, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">This share has expired.</Typography>
        </Box>
      );
    }

    if (!previewUrl) {
      return (
        <Box className="flex flex-col items-center justify-center text-center" sx={{ minHeight: 220, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Preview is not available.</Typography>
        </Box>
      );
    }

    if (kind === 'image') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 220 }}>
          <img
            src={previewUrl}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, objectFit: 'contain' }}
          />
        </Box>
      );
    }

    if (kind === 'audio') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 160 }}>
          <audio controls src={previewUrl} style={{ width: '100%' }} />
        </Box>
      );
    }

    if (kind === 'video') {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 240 }}>
          <video controls src={previewUrl} style={{ width: '100%', maxHeight: 520, borderRadius: 12 }} />
        </Box>
      );
    }

    if (kind === 'pdf') {
      return (
        <iframe
          title={`Preview ${fileName}`}
          src={previewUrl}
          style={{ width: '100%', minHeight: 520, border: 'none', borderRadius: 12, background: '#fff' }}
        />
      );
    }

    return (
      <Box className="flex flex-col items-center justify-center text-center" sx={{ minHeight: 220, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          This file type cannot be embedded as a preview.
        </Typography>
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
        <Box sx={{ px: 2.5, py: 1.8 }} className="flex items-start justify-between gap-3">
          <Box className="min-w-0">
            <Typography variant="h6" fontWeight={700} className="truncate">
              {fileName || 'File Preview'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} className="truncate">
              {file?.file_name || ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ p: 2.5, display: 'grid', gap: 2, overflow: 'auto' }}>
          {isPasswordProtected && !isUnlocked && !expired && (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box className="flex items-center gap-2" sx={{ mb: 1.5 }}>
                <Lock size={18} />
                <Typography variant="subtitle2" fontWeight={700}>Password Required</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This file is password-protected. Enter the password to view or download it.
              </Typography>
              <form onSubmit={handleUnlock}>
                <Box className="flex flex-col gap-2">
                  {unlockError && (
                    <Alert severity="error" sx={{ mb: 0.5 }}>{unlockError}</Alert>
                  )}
                  <TextField
                    label="Password"
                    size="small"
                    fullWidth
                    autoFocus
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={unlocking}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={unlocking || !password.trim()}
                    startIcon={unlocking ? <CircularProgress size={14} color="inherit" /> : <Lock size={14} />}
                  >
                    {unlocking ? 'Unlocking…' : 'Unlock'}
                  </Button>
                </Box>
              </form>
            </Paper>
          )}

          {(!isPasswordProtected || isUnlocked) && (
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
                  {!expired && previewUrl && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<ExternalLink size={14} />}
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open
                    </Button>
                  )}
                </Box>
              </Box>
              {renderPreview()}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.25 }}>
              File Metadata
            </Typography>
            <Box className="grid gap-2" sx={{ gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Name</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{fileName || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">MIME Type</Typography>
                <Typography variant="body2">{file?.file_type || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Size</Typography>
                <Typography variant="body2">{typeof file?.size === 'number' ? formatBytes(file.size) : '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Shared By</Typography>
                <Typography variant="body2">{file?.shared_by || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Expires</Typography>
                <Typography variant="body2">{file?.expires_at ? formatDateFull(file.expires_at) : '-'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Chip
                  label={expired ? 'Expired' : 'Active'}
                  size="small"
                  color={expired ? 'error' : 'success'}
                  sx={{ mt: 0.25 }}
                />
              </Box>
            </Box>
          </Paper>

          {!expired && downloadUrl && (
            <Button
              variant="contained"
              href={downloadUrl}
              target="_blank"
              startIcon={<Download size={16} />}
              fullWidth
            >
              Download File
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
