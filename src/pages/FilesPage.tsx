import { useState, useEffect, useCallback } from 'react';
import {
  getFilesTree, deleteFile, deleteFolder, moveFile, moveFolder,
  getPrivateDownloadToken, getPrivateDownloadUrl,
  getUserBucket,
  type TreeEntry, type TreeResponse, type ObjectMetadata,
} from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, getFileIcon } from '@/lib/utils';
import ShareModal from '@/components/ShareModal';
import NoteModal from '@/components/NoteModal';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, TextField, InputAdornment, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Chip, CircularProgress, Box,
  Breadcrumbs, Link, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import {
  Download, Trash2, Share2, StickyNote, Search, FileQuestion, MoreVertical,
  Folder, FolderOpen, MoveRight,
} from 'lucide-react';

// ObjectMetadata-compatible shim so ShareModal / NoteModal still work
interface FileLike {
  name: string;
  content_type: string;
  size: number;
  date_created: string;
  date_updated: string;
  date_deleted: string;
  md5: string;
  media_link: string;
  bucket: string;
}

function treeEntryToFileLike(e: TreeEntry): FileLike {
  return { name: e.name, content_type: e.file_type, size: e.size, date_created: '', date_updated: '', date_deleted: '', md5: e.md5_checksum, media_link: '', bucket: '' };
}

function buildTreeFromObjects(path: string, objects: ObjectMetadata[]): TreeResponse {
  const prefix = path ? `${path}/` : '';
  const folders = new Set<string>();
  const files: TreeEntry[] = [];

  for (const obj of objects) {
    const objectPath = obj.name;
    if (!objectPath || !objectPath.startsWith(prefix)) continue;

    const rest = objectPath.slice(prefix.length);
    if (!rest) continue;

    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      files.push({
        name: objectPath,
        file_type: obj.content_type,
        size: obj.size,
        md5_checksum: obj.md5,
      });
      continue;
    }

    folders.add(rest.slice(0, slashIdx));
  }

  return {
    path,
    folders: Array.from(folders),
    files,
  };
}

function isTreeResponseLike(value: unknown): value is TreeResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { path?: unknown; folders?: unknown; files?: unknown };
  const foldersOk = candidate.folders == null || Array.isArray(candidate.folders);
  const filesOk = candidate.files == null || Array.isArray(candidate.files);
  return typeof candidate.path === 'string' && foldersOk && filesOk;
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuFile, setMenuFile] = useState<TreeEntry | null>(null);
  const [menuFolder, setMenuFolder] = useState<string | null>(null);
  const [shareFile, setShareFile] = useState<FileLike | null>(null);
  const [noteFile, setNoteFile] = useState<FileLike | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [moveDestination, setMoveDestination] = useState('');
  const { toast } = useToast();

  const fetchTree = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const data = await getFilesTree(path || undefined);
      if (!isTreeResponseLike(data)) {
        throw new Error('Invalid tree response payload');
      }

      // UX helper: auto-open the default folder when root contains only folders.
      if (path === '' && (data.files?.length ?? 0) === 0 && (data.folders ?? []).includes('Main')) {
        setCurrentPath('Main');
        return;
      }

      setTreeData(data);
    } catch {
      try {
        // Compatibility fallback for environments still serving legacy endpoints only.
        const bucket = await getUserBucket();
        const objects = (bucket.bucket_data.objects ?? []).filter((o) => Boolean(o.name));
        const fallbackTree = buildTreeFromObjects(path, objects);
        const fallbackFiles = fallbackTree.files ?? [];

        if (path === '' && fallbackFiles.length === 0 && (fallbackTree.folders ?? []).includes('Main')) {
          setCurrentPath('Main');
          return;
        }

        setTreeData(fallbackTree);
        toast('info', 'Using compatibility file listing mode');
      } catch {
        toast('error', 'Failed to load files');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTree(currentPath); }, [fetchTree, currentPath]);

  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSearch('');
  };

  const handleDownload = async (file: TreeEntry) => {
    try {
      const { private_download_token } = await getPrivateDownloadToken(file.name);
      window.open(getPrivateDownloadUrl(private_download_token, 'download'), '_blank');
    } catch {
      toast('error', 'Failed to get download link');
    }
  };

  const handleDeleteFile = async (file: TreeEntry) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting(file.name);
    try {
      await deleteFile(file.name);
      toast('success', `"${file.name.split('/').pop()}" deleted`);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    const name = folderPath.split('/').pop()!;
    if (!confirm(`Delete folder "${name}" and all its contents?`)) return;
    try {
      await deleteFolder(folderPath, true);
      toast('success', `Folder "${name}" deleted`);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Failed to delete folder');
    }
  };

  const openMoveDialog = (path: string, isFolder: boolean) => {
    setMoveSource({ path, isFolder });
    setMoveDestination(path);
    setMoveDialogOpen(true);
    setMenuAnchor(null);
    setMenuFile(null);
    setMenuFolder(null);
  };

  const handleMove = async () => {
    if (!moveSource || !moveDestination || moveDestination === moveSource.path) {
      setMoveDialogOpen(false);
      return;
    }
    try {
      if (moveSource.isFolder) {
        await moveFolder(moveSource.path, moveDestination);
        toast('success', `Folder moved to "${moveDestination}"`);
      } else {
        await moveFile(moveSource.path, moveDestination);
        toast('success', `File moved to "${moveDestination}"`);
      }
      setMoveDialogOpen(false);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Move failed');
    }
  };

  const folders = treeData?.folders ?? [];
  const files = treeData?.files ?? [];
  const filteredFolders = folders.filter((f) => f.toLowerCase().includes(search.toLowerCase()));
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const totalItems = folders.length + files.length;

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
          {totalItems} item{totalItems !== 1 ? 's' : ''} in this folder
        </Typography>
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color={currentPath === '' ? 'text.primary' : 'inherit'}
          onClick={() => navigateTo('')}
          sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <FolderOpen size={14} /> Root
        </Link>
        {breadcrumbs.map((seg, i) => {
          const segPath = breadcrumbs.slice(0, i + 1).join('/');
          const isLast = i === breadcrumbs.length - 1;
          return isLast ? (
            <Typography key={segPath} color="text.primary" fontSize="0.875rem">{seg}</Typography>
          ) : (
            <Link
              key={segPath}
              component="button"
              underline="hover"
              onClick={() => navigateTo(segPath)}
              sx={{ cursor: 'pointer', fontSize: '0.875rem' }}
            >
              {seg}
            </Link>
          );
        })}
      </Breadcrumbs>

      {totalItems > 0 && (
        <TextField
          size="small"
          placeholder="Search in this folder..."
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

      {totalItems === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <FileQuestion size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No files yet</Typography>
          <Typography variant="body2" color="text.secondary">Upload your first file to get started</Typography>
        </Paper>
      ) : (filteredFolders.length === 0 && filteredFiles.length === 0) ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <Search size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No matches</Typography>
          <Typography variant="body2" color="text.secondary">No items match "{search}"</Typography>
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
              {/* Folders */}
              {filteredFolders.map((folderName) => {
                const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
                return (
                  <TableRow key={`folder:${folderName}`} hover sx={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => navigateTo(folderPath)}>
                      <div className="flex items-center gap-2">
                        <Folder size={18} className="text-yellow-500 shrink-0" />
                        <span className="font-medium text-sm">{folderName}</span>
                      </div>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }} onClick={() => navigateTo(folderPath)}>—</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }} onClick={() => navigateTo(folderPath)}>—</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuFolder(folderPath); setMenuFile(null); }}
                      >
                        <MoreVertical size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Files */}
              {filteredFiles.map((file) => (
                <TableRow key={file.name} hover>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{getFileIcon(file.file_type)}</span>
                      <span className="truncate font-medium text-sm">{file.name.split('/').pop()}</span>
                      <Chip
                        label={file.file_type?.split('/')[1]?.toUpperCase() ?? file.file_type ?? 'FILE'}
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
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>—</TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton size="small" onClick={() => handleDownload(file)} title="Download">
                        <Download size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setShareFile(treeEntryToFileLike(file))} title="Share">
                        <Share2 size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuFile(file); setMenuFolder(null); }}
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

      {/* Context menu — file */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor) && menuFile !== null}
        onClose={() => { setMenuAnchor(null); setMenuFile(null); }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) setNoteFile(treeEntryToFileLike(menuFile)); setMenuFile(null); }}>
          <ListItemIcon><StickyNote size={16} /></ListItemIcon>
          <ListItemText>Add Note</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { if (menuFile) openMoveDialog(menuFile.name, false); }}>
          <ListItemIcon><MoveRight size={16} /></ListItemIcon>
          <ListItemText>Move / Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAnchor(null); if (menuFile) handleDeleteFile(menuFile); setMenuFile(null); }}
          disabled={menuFile ? deleting === menuFile.name : false}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}><Trash2 size={16} /></ListItemIcon>
          <ListItemText>{menuFile && deleting === menuFile.name ? 'Deleting...' : 'Delete'}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Context menu — folder */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor) && menuFolder !== null}
        onClose={() => { setMenuAnchor(null); setMenuFolder(null); }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { if (menuFolder) openMoveDialog(menuFolder, true); }}>
          <ListItemIcon><MoveRight size={16} /></ListItemIcon>
          <ListItemText>Move / Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { setMenuAnchor(null); if (menuFolder) handleDeleteFolder(menuFolder); setMenuFolder(null); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}><Trash2 size={16} /></ListItemIcon>
          <ListItemText>Delete Folder</ListItemText>
        </MenuItem>
      </Menu>

      {/* Move / Rename dialog */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move / Rename {moveSource?.isFolder ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the new path (e.g. <code>work/docs/report.pdf</code>)
          </Typography>
          <TextField
            label="Destination path"
            value={moveDestination}
            onChange={(e) => setMoveDestination(e.target.value)}
            fullWidth
            autoFocus
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleMove} disabled={!moveDestination || moveDestination === moveSource?.path}>
            Move
          </Button>
        </DialogActions>
      </Dialog>

      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}
      {noteFile && <NoteModal file={noteFile} onClose={() => setNoteFile(null)} />}
    </div>
  );
}
