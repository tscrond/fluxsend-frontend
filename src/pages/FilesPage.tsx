import { useState, useEffect, useCallback } from 'react';
import {
  getFilesTree, deleteFile, deleteFilesBatch, deleteFolder, moveFile, moveFolder,
  getPrivateDownloadToken, getPrivateDownloadUrl,
  getUserBucket,
  type TreeEntry, type TreeResponse, type ObjectMetadata,
} from '@/api';
import { useToast } from '@/hooks/useToast';
import { formatBytes, getFileIcon } from '@/lib/utils';
import ShareModal from '@/components/ShareModal';
import FilePreviewDrawer from '@/components/FilePreviewDrawer';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, TextField, InputAdornment, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Chip, CircularProgress, Box,
  Breadcrumbs, Link, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Checkbox, Toolbar,
} from '@mui/material';
import {
  Download, Trash2, Share2, Search, FileQuestion, MoreVertical,
  Folder, FolderOpen, MoveRight, AlertTriangle, X,
  Eye,
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

type PendingDeleteAction =
  | { kind: 'file'; file: TreeEntry }
  | { kind: 'folder'; folderPath: string }
  | { kind: 'batch'; files: string[] };

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [treeData, setTreeData] = useState<TreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuFile, setMenuFile] = useState<TreeEntry | null>(null);
  const [menuFolder, setMenuFolder] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<FileLike[] | null>(null);
  const [previewFile, setPreviewFile] = useState<TreeEntry | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [folderDeleting, setFolderDeleting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteAction | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<{ path: string; isFolder: boolean } | null>(null);
  const [moveDestination, setMoveDestination] = useState('');
  const { toast } = useToast();

  const toggleFileSelection = (name: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = (fileNames: string[]) => {
    setSelectedFiles((prev) =>
      prev.size === fileNames.length ? new Set() : new Set(fileNames),
    );
  };

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

  useEffect(() => { fetchTree(currentPath); setSelectedFiles(new Set()); }, [fetchTree, currentPath]);

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

  const handleDeleteFile = (file: TreeEntry) => {
    setPendingDelete({ kind: 'file', file });
  };

  const handleDeleteFolder = (folderPath: string) => {
    setPendingDelete({ kind: 'folder', folderPath });
  };

  const handleBatchDelete = () => {
    const names = Array.from(selectedFiles);
    if (names.length === 0) return;
    setPendingDelete({ kind: 'batch', files: names });
  };

  const closeDeleteDialog = () => {
    if (deleting || batchDeleting || folderDeleting) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.kind === 'file') {
      const { file } = pendingDelete;
      setDeleting(file.name);
      try {
        await deleteFile(file.name);
        toast('success', `"${file.name.split('/').pop()}" deleted`);
        setSelectedFiles((prev) => {
          const next = new Set(prev);
          next.delete(file.name);
          return next;
        });
        setPendingDelete(null);
        fetchTree(currentPath);
      } catch {
        toast('error', 'Failed to delete file');
      } finally {
        setDeleting(null);
      }
      return;
    }

    if (pendingDelete.kind === 'folder') {
      const folderName = pendingDelete.folderPath.split('/').pop() || pendingDelete.folderPath;
      setFolderDeleting(true);
      try {
        await deleteFolder(pendingDelete.folderPath, true);
        toast('success', `Folder "${folderName}" deleted`);
        setPendingDelete(null);
        fetchTree(currentPath);
      } catch {
        toast('error', 'Failed to delete folder');
      } finally {
        setFolderDeleting(false);
      }
      return;
    }

    setBatchDeleting(true);
    try {
      const { files_deleted, files_failed } = await deleteFilesBatch(pendingDelete.files);
      const succeeded = files_deleted.length;
      const failed = files_failed.length;
      if (succeeded > 0) toast('success', `${succeeded} file${succeeded !== 1 ? 's' : ''} deleted`);
      if (failed > 0) toast('error', `${failed} file${failed !== 1 ? 's' : ''} could not be deleted`);
      setSelectedFiles(new Set());
      setPendingDelete(null);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Failed to delete selected files');
    } finally {
      setBatchDeleting(false);
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
  const deleteDialogBusy = Boolean(deleting) || batchDeleting || folderDeleting;

  const deleteDialogData = (() => {
    if (!pendingDelete) return null;

    if (pendingDelete.kind === 'file') {
      const fileName = pendingDelete.file.name.split('/').pop() || pendingDelete.file.name;
      return {
        title: `Delete ${fileName}?`,
        body: 'This file will be permanently removed. This action cannot be undone.',
        highlight: pendingDelete.file.name,
      };
    }

    if (pendingDelete.kind === 'folder') {
      const folderName = pendingDelete.folderPath.split('/').pop() || pendingDelete.folderPath;
      return {
        title: `Delete folder ${folderName}?`,
        body: 'All files and nested folders inside this folder will be permanently removed.',
        highlight: pendingDelete.folderPath,
      };
    }

    const preview = pendingDelete.files.slice(0, 3);
    const remaining = pendingDelete.files.length - preview.length;
    return {
      title: `Delete ${pendingDelete.files.length} selected file${pendingDelete.files.length !== 1 ? 's' : ''}?`,
      body: 'Selected files will be permanently removed and cannot be recovered.',
      highlight: remaining > 0 ? `${preview.join(', ')} + ${remaining} more` : preview.join(', '),
    };
  })();

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
        <div className="mb-4">
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
        </div>
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
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={selectedFiles.size > 0 && selectedFiles.size < filteredFiles.length}
                    checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                    onChange={() => toggleSelectAll(filteredFiles.map((f) => f.name))}
                    disabled={filteredFiles.length === 0}
                  />
                </TableCell>
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
                    <TableCell padding="checkbox" />
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
                <TableRow
                  key={file.name}
                  hover
                  selected={selectedFiles.has(file.name)}
                  onClick={() => toggleFileSelection(file.name)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selectedFiles.has(file.name)}
                      onChange={() => toggleFileSelection(file.name)}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: { xs: '45vw', sm: 'none' } }}>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      {getFileIcon(file.file_type)}
                      <span className="font-medium text-sm" style={{ wordBreak: 'break-word' }}>{file.name.split('/').pop()}</span>
                      <Chip
                        label={file.file_type?.split('/')[1]?.toUpperCase() ?? file.file_type ?? 'FILE'}
                        size="small"
                        color="primary"
                        variant="outlined"
                        className="shrink-0"
                        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                      />
                    </div>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>—</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <IconButton size="small" onClick={() => setPreviewFile(file)} title="Preview" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                        <Eye size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDownload(file)} title="Download" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                        <Download size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setShareTarget([treeEntryToFileLike(file)])} title="Share" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
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
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) setPreviewFile(menuFile); setMenuFile(null); }}>
          <ListItemIcon><Eye size={16} /></ListItemIcon>
          <ListItemText>Preview / Note</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) handleDownload(menuFile); setMenuFile(null); }}>
          <ListItemIcon><Download size={16} /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) setShareTarget([treeEntryToFileLike(menuFile)]); setMenuFile(null); }}>
          <ListItemIcon><Share2 size={16} /></ListItemIcon>
          <ListItemText>Share</ListItemText>
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

      {/* Pretty delete confirmation dialog */}
      <Dialog open={Boolean(pendingDelete)} onClose={closeDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1.25 }}>
          <Box className="flex items-center gap-3">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(239, 68, 68, 0.16)',
                color: 'error.main',
              }}
            >
              <AlertTriangle size={18} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                {deleteDialogData?.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Please confirm this destructive action.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '6px !important' }}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderColor: 'rgba(239, 68, 68, 0.4)',
              bgcolor: 'rgba(239, 68, 68, 0.04)',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {deleteDialogData?.body}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
              {deleteDialogData?.highlight}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.25 }}>
          <Button onClick={closeDeleteDialog} disabled={deleteDialogBusy}>
            Keep Files
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={deleteDialogBusy}
            startIcon={deleteDialogBusy ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
          >
            {deleteDialogBusy ? 'Removing...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {selectedFiles.size > 0 && (
        <Toolbar
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            boxShadow: 4,
            borderRadius: 2,
            gap: { xs: 0.75, sm: 2 },
            px: { xs: 1.5, sm: 3 },
            minHeight: { xs: 44, sm: 56 },
            zIndex: 1200,
            border: 1,
            borderColor: 'divider',
            width: { xs: 'auto', sm: 'auto' },
          }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
            {selectedFiles.size} selected
          </Typography>

          {/* Mobile: icon-only buttons */}
          <IconButton
            size="small"
            color="primary"
            title="Share selected"
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            onClick={() => {
              const targets = filteredFiles
                .filter((f) => selectedFiles.has(f.name))
                .map(treeEntryToFileLike);
              setShareTarget(targets);
            }}
          >
            <Share2 size={18} />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            title="Delete selected"
            disabled={batchDeleting}
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            onClick={handleBatchDelete}
          >
            {batchDeleting ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={18} />}
          </IconButton>
          <IconButton
            size="small"
            title="Clear selection"
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            onClick={() => setSelectedFiles(new Set())}
          >
            <X size={18} />
          </IconButton>

          {/* Desktop: text buttons */}
          <Button
            variant="contained"
            size="small"
            startIcon={<Share2 size={14} />}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            onClick={() => {
              const targets = filteredFiles
                .filter((f) => selectedFiles.has(f.name))
                .map(treeEntryToFileLike);
              setShareTarget(targets);
            }}
          >
            Share Selected
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={batchDeleting ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {batchDeleting ? 'Deleting...' : 'Delete Selected'}
          </Button>
          <Button
            size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            onClick={() => setSelectedFiles(new Set())}
          >
            Clear
          </Button>
        </Toolbar>
      )}
      {shareTarget && <ShareModal files={shareTarget} onClose={() => { setShareTarget(null); setSelectedFiles(new Set()); }} />}
      <FilePreviewDrawer
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
