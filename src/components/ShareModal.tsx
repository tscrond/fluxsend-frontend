import { useState } from 'react';
import { shareFiles, type ObjectMetadata } from '@/api';
import { useToast } from '@/hooks/useToast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, IconButton,
  MenuItem, FormControlLabel, Checkbox, Typography, CircularProgress, InputAdornment,
} from '@mui/material';
import { X, Send, Copy, Check } from 'lucide-react';

interface Props {
  file: ObjectMetadata;
  onClose: () => void;
}

export default function ShareModal({ file, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState('24h');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await shareFiles({
        email: email.trim(),
        objects: [file.name],
        duration,
        send_email: sendEmail,
      });
      if (res.sharing_info?.length > 0) {
        const token = res.sharing_info[0].sharing_token;
        const link = `${window.location.origin}/d/${token}`;
        setShareLink(link);
        toast('success', 'File shared successfully');
      }
    } catch {
      toast('error', 'Failed to share file');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center justify-between">
        <span className="truncate pr-4">Share &ldquo;{file.name}&rdquo;</span>
        <IconButton size="small" onClick={onClose} edge="end"><X size={18} /></IconButton>
      </DialogTitle>

      {shareLink ? (
        <>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Share link created! Copy it below:
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={shareLink}
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={copyLink} startIcon={copied ? <Check size={14} /> : <Copy size={14} />}>
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
              onClick={(e) => (e.target as HTMLInputElement).select?.()}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={handleShare}>
          <DialogContent className="flex flex-col gap-4">
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
