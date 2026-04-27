import { useEffect, useMemo, useState } from 'react';
import { getNote, getPrivateDownloadToken, getPrivateDownloadUrl, quickShare, saveNote, type TreeEntry } from '@/api';
import { useToast } from '@/hooks/useToast';
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
  MenuItem,
  InputAdornment,
} from '@mui/material';
import { X, Eye, Image as ImageIcon, Music2, Video, FileText, ExternalLink, Save, Link2, Copy, Check } from 'lucide-react';

interface Props {
  open: boolean;
  file: TreeEntry | null;
  onClose: () => void;
}

type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'unsupported';

const MAX_NOTE_LENGTH = 500;

function getMediaKind(file: TreeEntry | null): MediaKind {
  if (!file) return 'unsupported';

  const mime = (file.file_type || '').toLowerCase();
  const lowerName = file.name.toLowerCase();

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';

  return 'unsupported';
}

function mediaKindLabel(kind: MediaKind): string {
  switch (kind) {
    case 'image':
      return 'Image';
    case 'audio':
      return 'Audio';
    case 'video':
      return 'Video';
    case 'pdf':
      return 'PDF';
    default:
      return 'Unsupported';
  }
}

function mediaKindIcon(kind: MediaKind) {
  switch (kind) {
    case 'image':
      return <ImageIcon size={16} />;
    case 'audio':
      return <Music2 size={16} />;
    case 'video':
      return <Video size={16} />;
    case 'pdf':
      return <FileText size={16} />;
    default:
      return <Eye size={16} />;
  }
}

export default function FilePreviewDrawer({ open, file, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const [quickShareDuration, setQuickShareDuration] = useState('24h');
  const [quickShareLoading, setQuickShareLoading] = useState(false);
  const [quickShareUrl, setQuickShareUrl] = useState<string | null>(null);
  const [quickShareCopied, setQuickShareCopied] = useState(false);

  const { toast } = useToast();

  const kind = useMemo(() => getMediaKind(file), [file]);
  const fileName = file?.name.split('/').pop() || file?.name || '';

  useEffect(() => {
    let active = true;

    if (!open || !file) {
      setPreviewUrl(null);
      setPreviewError(null);
      setPreviewLoading(false);
      setNote('');
      setNoteLoading(false);
      setNoteSaving(false);
      setQuickShareUrl(null);
      setQuickShareCopied(false);
      setQuickShareLoading(false);
      return;
    }

    const currentFile = file;

    async function loadData() {
      setPreviewLoading(true);
      setPreviewError(null);
      setNoteLoading(true);

      const [previewResult, noteResult] = await Promise.allSettled([
        getPrivateDownloadToken(currentFile.name),
        getNote(currentFile.md5_checksum),
      ]);

      if (!active) return;

      if (previewResult.status === 'fulfilled') {
        setPreviewUrl(getPrivateDownloadUrl(previewResult.value.private_download_token, 'inline'));
      } else {
        setPreviewUrl(null);
        setPreviewError('Unable to load preview URL for this file.');
      }

      if (noteResult.status === 'fulfilled') {
        setNote(noteResult.value.content ?? '');
      } else {
        setNote('');
      }

      setPreviewLoading(false);
      setNoteLoading(false);
    }

    loadData();

    return () => {
      active = false;
    };
  }, [open, file]);

  const handleSaveNote = async () => {
    if (!file) return;

    setNoteSaving(true);
    try {
      await saveNote(file.md5_checksum, note.slice(0, MAX_NOTE_LENGTH));
      toast('success', 'Note saved');
    } catch {
      toast('error', 'Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  const durationOptions = [
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 hour' },
    { value: '6h', label: '6 hours' },
    { value: '24h', label: '24 hours' },
    { value: '72h', label: '3 days' },
    { value: '168h', label: '7 days' },
    { value: '720h', label: '30 days' },
  ];

  const handleQuickShare = async () => {
    if (!file) return;

    setQuickShareLoading(true);
    try {
      const res = await quickShare(file.name, quickShareDuration);
      const url = `${window.location.origin}/d/${res.sharing_token}`;
      setQuickShareUrl(url);
      toast('success', 'Public link created');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to create quick share link');
    } finally {
      setQuickShareLoading(false);
    }
  };

  const handleCopyQuickShare = async () => {
    if (!quickShareUrl) return;
    await navigator.clipboard.writeText(quickShareUrl);
    setQuickShareCopied(true);
    setTimeout(() => setQuickShareCopied(false), 2000);
  };

  const renderPreview = () => {
    if (previewLoading) {
      return (
        <Box className="flex items-center justify-center" sx={{ minHeight: 260 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (previewError) {
      return (
        <Box className="flex flex-col items-center justify-center text-center" sx={{ minHeight: 220, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">{previewError}</Typography>
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
              {file?.name || ''}
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close preview">
            <X size={18} />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ p: 2.5, display: 'grid', gap: 2, overflow: 'auto' }}>
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
                <Button
                  size="small"
                  variant="text"
                  startIcon={<ExternalLink size={14} />}
                  disabled={!previewUrl}
                  onClick={() => previewUrl && window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open
                </Button>
              </Box>
            </Box>
            {renderPreview()}
          </Paper>

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
                <Typography variant="caption" color="text.secondary">Full Path</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{file?.name || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">MIME Type</Typography>
                <Typography variant="body2">{file?.file_type || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Size (bytes)</Typography>
                <Typography variant="body2">{typeof file?.size === 'number' ? file.size.toLocaleString() : '-'}</Typography>
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / span 2' } }}>
                <Typography variant="caption" color="text.secondary">Checksum (MD5)</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{file?.md5_checksum || '-'}</Typography>
              </Box>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box className="flex items-center justify-between" sx={{ mb: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>Quick Share Link</Typography>
            </Box>
            {quickShareUrl ? (
              <TextField
                fullWidth
                size="small"
                value={quickShareUrl}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          size="small"
                          onClick={handleCopyQuickShare}
                          startIcon={quickShareCopied ? <Check size={14} /> : <Copy size={14} />}
                        >
                          {quickShareCopied ? 'Copied' : 'Copy'}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
                onClick={(e) => (e.target as HTMLInputElement).select?.()}
              />
            ) : (
              <Box className="flex items-center gap-2">
                <TextField
                  select
                  size="small"
                  label="Expires in"
                  value={quickShareDuration}
                  onChange={(e) => setQuickShareDuration(e.target.value)}
                  sx={{ minWidth: 150 }}
                >
                  {durationOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={quickShareLoading ? <CircularProgress size={14} color="inherit" /> : <Link2 size={14} />}
                  onClick={handleQuickShare}
                  disabled={quickShareLoading || !file}
                >
                  {quickShareLoading ? 'Creating...' : 'Generate Link'}
                </Button>
              </Box>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box className="flex items-center justify-between" sx={{ mb: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>Note</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={noteSaving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
                onClick={handleSaveNote}
                disabled={noteLoading || noteSaving || !file}
              >
                {noteSaving ? 'Saving...' : 'Save Note'}
              </Button>
            </Box>

            {noteLoading ? (
              <Box className="flex items-center justify-center" sx={{ minHeight: 120 }}>
                <CircularProgress size={22} />
              </Box>
            ) : (
              <>
                <TextField
                  multiline
                  minRows={4}
                  maxRows={10}
                  fullWidth
                  placeholder="Add a note about this file (max 500 characters)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                />
                <Typography variant="caption" color="text.secondary" className="text-right block mt-1">
                  {note.length}/{MAX_NOTE_LENGTH}
                </Typography>
              </>
            )}
          </Paper>
        </Box>
      </Box>
    </Drawer>
  );
}
