import { useState, useEffect, useCallback } from 'react';
import { getUserBucket, deleteFile, getPrivateDownloadToken, getPrivateDownloadUrl, type ObjectMetadata } from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, formatDate, getFileIcon } from '@/lib/utils';
import ShareModal from '@/components/ShareModal';
import NoteModal from '@/components/NoteModal';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, TextField, InputAdornment, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Chip, CircularProgress, Box,
} from '@mui/material';
import {
  Download, Trash2, Share2, StickyNote, Search, FileQuestion, MoreVertical,
} from 'lucide-react';

export default function FilesPage() {
  const [files, setFiles] = useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuFile, setMenuFile] = useState<ObjectMetadata | null>(null);
  const [shareFile, setShareFile] = useState<ObjectMetadata | null>(null);
  const [noteFile, setNoteFile] = useState<ObjectMetadata | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    try {
      const data = await getUserBucket();
      setFiles((data.bucket_data.objects ?? []).filter((o) => o.name));
    } catch {
      toast('error', 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (file: ObjectMetadata) => {
    try {
      const { private_download_token } = await getPrivateDownloadToken(file.name);
      window.open(getPrivateDownloadUrl(private_download_token, 'download'), '_blank');
    } catch {
      toast('error', 'Failed to get download link');
    }
  };

  const handleDelete = async (file: ObjectMetadata) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting(file.name);
    try {
      await deleteFile(file.name);
      toast('success', `"${file.name}" deleted`);
      setFiles((prev) => prev.filter((f) => f.name !== file.name));
    } catch {
      toast('error', 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = files.filter((f) =>
    f.name?.toLowerCase().includes(search.toLowerCase()),
  );

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
        <Typography variant="h5" fontWeight={700}>My Files</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {files.length} file{files.length !== 1 ? 's' : ''} in your storage
        </Typography>
      </div>

      {files.length > 0 && (
        <TextField
          size="small"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
          sx={{ maxWidth: 360 }}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}

      {filtered.length === 0 && files.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <FileQuestion size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No files yet</Typography>
          <Typography variant="body2" color="text.secondary">Upload your first file to get started</Typography>
        </Paper>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <Search size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No matches</Typography>
          <Typography variant="body2" color="text.secondary">No files match "{search}"</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Size</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Modified</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((file) => (
                <TableRow key={file.name} hover>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{getFileIcon(file.content_type)}</span>
                      <span className="truncate font-medium text-sm">{file.name}</span>
                      <Chip
                        label={file.content_type?.split('/')[1]?.toUpperCase() ?? file.content_type ?? 'FILE'}
                        size="small"
                        color="primary"
                        variant="outlined"
                        className="shrink-0"
                      />
                    </div>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>
                    {formatDate(file.date_updated || file.date_created)}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton size="small" onClick={() => handleDownload(file)} title="Download">
                        <Download size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setShareFile(file)} title="Share">
                        <Share2 size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuFile(file); }}
                      >
                        <MoreVertical size={16} />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuFile(null); }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) setNoteFile(menuFile); setMenuFile(null); }}>
          <ListItemIcon><StickyNote size={16} /></ListItemIcon>
          <ListItemText>Add Note</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAnchor(null); if (menuFile) handleDelete(menuFile); setMenuFile(null); }}
          disabled={menuFile ? deleting === menuFile.name : false}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}><Trash2 size={16} /></ListItemIcon>
          <ListItemText>{menuFile && deleting === menuFile.name ? 'Deleting...' : 'Delete'}</ListItemText>
        </MenuItem>
      </Menu>

      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
      {noteFile && <NoteModal file={noteFile} onClose={() => setNoteFile(null)} />}
    </div>
  );
}
