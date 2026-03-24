import { useState, useEffect } from 'react';
import { getNote, saveNote, type ObjectMetadata } from '@/api';
import { useToast } from '@/hooks/useToast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  IconButton, Typography, CircularProgress, Box,
} from '@mui/material';
import { X, Save } from 'lucide-react';

interface Props {
  file: ObjectMetadata;
  onClose: () => void;
}

export default function NoteModal({ file, onClose }: Props) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await getNote(file.md5);
        setContent(res.content ?? '');
      } catch {
        setContent('');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [file.md5]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNote(file.md5, content);
      toast('success', 'Note saved');
      onClose();
    } catch {
      toast('error', 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="flex items-center justify-between">
        <span className="truncate pr-4">Note for &ldquo;{file.name}&rdquo;</span>
        <IconButton size="small" onClick={onClose} edge="end"><X size={18} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box className="flex justify-center py-8">
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TextField
              multiline
              minRows={4}
              maxRows={8}
              fullWidth
              placeholder="Add a note about this file (max 500 characters)..."
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              autoFocus
            />
            <Typography variant="caption" color="text.secondary" className="text-right block mt-1">
              {content.length}/500
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} />}
        >
          {saving ? 'Saving...' : 'Save Note'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
