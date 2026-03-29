import { useState } from 'react';
import { shareFiles } from '@/api';
import { useToast } from '@/hooks/useToast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, IconButton,
  MenuItem, FormControlLabel, Checkbox, Typography, CircularProgress, InputAdornment, Stack,
} from '@mui/material';
import { X, Send, Copy, Check } from 'lucide-react';

interface ShareFile {
  name: string;
}

interface ShareLink {
  fileName: string;
  url: string;
  copied: boolean;
}

interface Props {
  files: ShareFile[];
  onClose: () => void;
}

export default function ShareModal({ files, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState('24h');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[] | null>(null);
  const { toast } = useToast();

  const isSingle = files.length === 1;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await shareFiles({
        email: email.trim(),
        objects: files.map((f) => f.name),
        duration,
        send_email: sendEmail,
      });
      if (res.sharing_info?.length > 0) {
        setShareLinks(
          res.sharing_info.map((info, i) => ({
            fileName: info.file_name ?? files[i]?.name ?? '',
            url: `${window.location.origin}/d/${info.sharing_token}`,
            copied: false,
          })),
        );
        toast('success', isSingle ? 'File shared successfully' : `${res.sharing_info.length} files shared successfully`);
      }
    } catch {
      toast('error', 'Failed to share file(s)');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async (index: number) => {
    if (!shareLinks) return;
    await navigator.clipboard.writeText(shareLinks[index].url);
    setShareLinks((prev) =>
      prev
        ? prev.map((l, i) => (i === index ? { ...l, copied: true } : l))
        : prev,
    );
    setTimeout(
      () =>
        setShareLinks((prev) =>
          prev
            ? prev.map((l, i) => (i === index ? { ...l, copied: false } : l))
            : prev,
        ),
      2000,
    );
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

  const title = isSingle
    ? `Share "${files[0].name.split('/').pop()}"`
    : `Share ${files.length} files`;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center justify-between">
        <span className="truncate pr-4">{title}</span>
        <IconButton size="small" onClick={onClose} edge="end"><X size={18} /></IconButton>
      </DialogTitle>

      {shareLinks ? (
        <>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {isSingle ? 'Share link created! Copy it below:' : 'Share links created! Copy them below:'}
            </Typography>
            <Stack spacing={1.5}>
              {shareLinks.map((link, i) => (
                <div key={link.fileName}>
                  {!isSingle && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {(link.fileName || '').split('/').pop() || link.fileName}
                    </Typography>
                  )}
                  <TextField
                    fullWidth
                    size="small"
                    value={link.url}
                    slotProps={{
                      input: {
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              size="small"
                              onClick={() => copyLink(i)}
                              startIcon={link.copied ? <Check size={14} /> : <Copy size={14} />}
                            >
                              {link.copied ? 'Copied' : 'Copy'}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                    onClick={(e) => (e.target as HTMLInputElement).select?.()}
                  />
                </div>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={handleShare}>
          <DialogContent className="flex flex-col gap-4">
            {!isSingle && (
              <Typography variant="body2" color="text.secondary">
                {files.length} files selected
              </Typography>
            )}
            <TextField
              type="email"
              label="Recipient email"
              placeholder="colleague@example.com"
              size="small"
              fullWidth
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              select
              label="Link expires in"
              size="small"
              fullWidth
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {durationOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
              label="Send email notification"
              slotProps={{ typography: { variant: 'body2' } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !email.trim()}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Send size={14} />}
            >
              {loading ? 'Sharing...' : 'Share'}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
