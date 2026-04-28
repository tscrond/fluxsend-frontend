import { useState } from 'react';
import { useNavigate } from 'react-router';
import { createWorkspace } from '@/api';
import { useToast } from '@/hooks/useToast';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

export default function WorkspaceCreatePage() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      await createWorkspace(name.trim(), slug.trim());
      toast('success', `Workspace "${name}" created`);
      navigate('/workspaces');
    } catch {
      toast('error', 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Button
          startIcon={<ArrowLeft size={16} />}
          variant="text"
          onClick={() => navigate('/workspaces')}
          sx={{ mb: 2, pl: 0 }}
        >
          Back to Workspaces
        </Button>
        <Typography variant="h5" fontWeight={700}>Create Workspace</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Set up a new workspace to collaborate with others
        </Typography>
      </div>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Workspace name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            fullWidth
            autoFocus
            placeholder="My Team"
            inputProps={{ maxLength: 128 }}
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
            fullWidth
            placeholder="my-team"
            helperText="Used in URLs. Lowercase letters, numbers, and hyphens only."
            inputProps={{ maxLength: 64, pattern: '[a-z0-9-]+' }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !name.trim() || !slug.trim()}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
          >
            {submitting ? 'Creating…' : 'Create Workspace'}
          </Button>
        </Box>
      </Paper>
    </div>
  );
}
