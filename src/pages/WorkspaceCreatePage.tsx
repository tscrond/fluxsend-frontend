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
    .slice(0, 48);
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
    if (name.length > 64 || slug.length > 48) return;
    setSubmitting(true);
    try {
      await createWorkspace(name.trim(), slug.trim());
      toast('success', `Workspace "${name}" created`);
      navigate('/workspaces');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('name_too_long')) {
        toast('error', 'Name must be 64 characters or fewer');
      } else if (msg.includes('slug_too_long')) {
        toast('error', 'Slug must be 48 characters or fewer');
      } else {
        toast('error', 'Failed to create workspace');
      }
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
            inputProps={{ maxLength: 64 }}
            error={name.length > 64}
            helperText={
              name.length > 64
                ? `Name too long (${name.length}/64)`
                : `${name.length}/64`
            }
          />
          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
            fullWidth
            placeholder="my-team"
            error={slug.length > 48}
            helperText={
              slug.length > 48
                ? `Slug too long (${slug.length}/48)`
                : `Lowercase letters, numbers, and hyphens only. ${slug.length}/48`
            }
            inputProps={{ maxLength: 48, pattern: '[a-z0-9-]+' }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !name.trim() || !slug.trim() || name.length > 64 || slug.length > 48}
            sx={{ alignSelf: 'flex-start', mt: 1 }}
          >
            {submitting ? 'Creating…' : 'Create Workspace'}
          </Button>
        </Box>
      </Paper>
    </div>
  );
}
