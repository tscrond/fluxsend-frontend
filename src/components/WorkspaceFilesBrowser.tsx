import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getWorkspaceFilesTree,
  uploadWorkspaceFile,
  mkdirWorkspace,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  moveWorkspaceFile,
  moveWorkspaceFolder,
  getWorkspaceFileDownloadUrl,
  ApiError,
  type WorkspaceFileEntry,
  type WorkspaceFolderEntry,
  type WorkspaceFilesTree,
} from '@/api';
import WorkspaceFilePreviewDrawer from '@/components/WorkspaceFilePreviewDrawer';
import { useToast } from '@/hooks/useToast';
import { formatBytes, getFileIcon, runWithConcurrency } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, TextField, InputAdornment, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Chip, CircularProgress, Box,
  Breadcrumbs, Link, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Checkbox, Toolbar, Tooltip,
} from '@mui/material';
import {
  Download, Trash2, Search, FileQuestion, MoreVertical,
  Folder, FolderOpen, MoveRight, AlertTriangle, X, Eye,
  Upload, FolderPlus,
} from 'lucide-react';
import type { } from 'react'; // keep React in scope

interface Props {
  workspaceId: string;
  role: string;
}

type PendingDeleteAction =
  | { kind: 'file'; file: WorkspaceFileEntry }
  | { kind: 'folder'; folderPath: string };

function canWrite(role: string) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

const WORKSPACE_FILE_UPLOAD_CONCURRENCY = 3;

export default function WorkspaceFilesBrowser({ workspaceId, role }: Props) {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [treeData, setTreeData] = useState<WorkspaceFilesTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Context menu
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuFile, setMenuFile] = useState<WorkspaceFileEntry | null>(null);
  const [menuFolder, setMenuFolder] = useState<string | null>(null);

  // Selection
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Delete
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteAction | null>(null);

  // Move
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveSource, setMoveSource] = useState<{ path: string; isFolder: boolean; fileId?: string } | null>(null);
  const [moveDestination, setMoveDestination] = useState('');

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Mkdir
  const [mkdirDialogOpen, setMkdirDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mkdirLoading, setMkdirLoading] = useState(false);

  // Preview drawer
  const [previewFile, setPreviewFile] = useState<WorkspaceFileEntry | null>(null);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);

  const { toast } = useToast();
  const writeAllowed = canWrite(role);

  const fetchTree = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const data = await getWorkspaceFilesTree(workspaceId, path);
      setTreeData(data);
    } catch {
      toast('error', 'Failed to load workspace files');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    fetchTree(currentPath);
    setSelectedFiles(new Set());
  }, [fetchTree, currentPath]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSearch('');
  };

  // Build breadcrumb segments from path like "/docs/sub"
  const pathSegments = currentPath === '/' ? [] : currentPath.replace(/^\//, '').split('/');

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedFiles((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const handleDownload = (file: WorkspaceFileEntry) => {
    window.open(getWorkspaceFileDownloadUrl(workspaceId, file.id, 'download'), '_blank');
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'file') {
        await deleteWorkspaceFile(workspaceId, pendingDelete.file.id);
        toast('success', `"${pendingDelete.file.name}" deleted`);
        setSelectedFiles((prev) => {
          const next = new Set(prev);
          next.delete(pendingDelete.file.id);
          return next;
        });
      } else {
        await deleteWorkspaceFolder(workspaceId, pendingDelete.folderPath);
        const name = pendingDelete.folderPath.split('/').pop() || pendingDelete.folderPath;
        toast('success', `Folder "${name}" deleted`);
      }
      setPendingDelete(null);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Move ────────────────────────────────────────────────────────────────────

  const openMoveDialog = (source: { path: string; isFolder: boolean; fileId?: string }) => {
    setMoveSource(source);
    setMoveDestination(source.path);
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
        await moveWorkspaceFolder(workspaceId, moveSource.path, moveDestination);
        toast('success', `Folder moved to "${moveDestination}"`);
      } else if (moveSource.fileId) {
        await moveWorkspaceFile(workspaceId, moveSource.fileId, moveDestination);
        toast('success', `File moved to "${moveDestination}"`);
      }
      setMoveDialogOpen(false);
      fetchTree(currentPath);
    } catch {
      toast('error', 'Move failed');
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    let success = 0;
    let failed = 0;
    let quotaHit = false;

    await runWithConcurrency(files, WORKSPACE_FILE_UPLOAD_CONCURRENCY, async (file) => {
      if (quotaHit) return;

      try {
        await uploadWorkspaceFile(workspaceId, file, currentPath);
        success++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          quotaHit = true;
          toast('error', err.message);
          return;
        }
        failed++;
      }
    });

    if (success > 0) toast('success', `${success} file${success !== 1 ? 's' : ''} uploaded`);
    if (failed > 0 && !quotaHit) toast('error', `${failed} file${failed !== 1 ? 's' : ''} failed to upload`);
    setUploading(false);
    if (uploadRef.current) uploadRef.current.value = '';
    fetchTree(currentPath);
  };

  // ── Mkdir ───────────────────────────────────────────────────────────────────

  const handleMkdir = async () => {
    if (!newFolderName.trim()) return;
    setMkdirLoading(true);
    try {
      await mkdirWorkspace(workspaceId, newFolderName.trim(), currentPath);
      toast('success', `Folder "${newFolderName.trim()}" created`);
      setMkdirDialogOpen(false);
      setNewFolderName('');
      fetchTree(currentPath);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast('error', err.message);
      } else {
        toast('error', 'Failed to create folder');
      }
    } finally {
      setMkdirLoading(false);
    }
  };

  const openPreview = (file: WorkspaceFileEntry) => {
    setPreviewFile(file);
    setPreviewDrawerOpen(true);
  };

  const folders: WorkspaceFolderEntry[] = treeData?.folders ?? [];
  const files = treeData?.files ?? [];
  const lowerSearch = search.toLowerCase();
  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(lowerSearch));
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(lowerSearch));
  const totalItems = folders.length + files.length;
  const deleteDialogBusy = deleting;

  const deleteDialogData = (() => {
    if (!pendingDelete) return null;
    if (pendingDelete.kind === 'file') {
      return {
        title: `Delete ${pendingDelete.file.name}?`,
        body: 'This file will be permanently removed from the workspace.',
        highlight: pendingDelete.file.name,
      };
    }
    const name = pendingDelete.folderPath.split('/').pop() || pendingDelete.folderPath;
    return {
      title: `Delete folder ${name}?`,
      body: 'All files inside this folder will be permanently removed.',
      highlight: pendingDelete.folderPath,
    };
  })();

  if (loading && !treeData) {
    return (
      <Box className="flex items-center justify-center py-20">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {writeAllowed && (
            <>
              <input
                ref={uploadRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <Upload size={15} />}
                disabled={uploading}
                onClick={() => uploadRef.current?.click()}
              >
                Upload
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderPlus size={15} />}
                onClick={() => { setNewFolderName(''); setMkdirDialogOpen(true); }}
              >
                New Folder
              </Button>
            </>
          )}
        </Box>

        {totalItems > 0 && (
          <TextField
            size="small"
            placeholder="Search in this folder…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ maxWidth: 300 }}
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
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color={currentPath === '/' ? 'text.primary' : 'inherit'}
          onClick={() => navigateTo('/')}
          sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <FolderOpen size={14} /> Root
        </Link>
        {pathSegments.map((seg, i) => {
          const segPath = '/' + pathSegments.slice(0, i + 1).join('/');
          const isLast = i === pathSegments.length - 1;
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

      {loading && (
        <Box className="flex justify-center py-4"><CircularProgress size={24} /></Box>
      )}

      {!loading && totalItems === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <FileQuestion size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No files yet</Typography>
          {writeAllowed && (
            <Typography variant="body2" color="text.secondary">Upload files or create a folder to get started</Typography>
          )}
        </Paper>
      ) : !loading && filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <Paper variant="outlined" className="flex flex-col items-center py-16 text-center">
          <Search size={48} className="text-slate-400 mb-4" />
          <Typography variant="subtitle1" fontWeight={600}>No matches</Typography>
          <Typography variant="body2" color="text.secondary">No items match "{search}"</Typography>
        </Paper>
      ) : !loading ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={selectedFiles.size > 0 && selectedFiles.size < filteredFiles.length}
                    checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                    onChange={() => toggleSelectAll(filteredFiles.map((f) => f.id))}
                    disabled={filteredFiles.length === 0}
                  />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Size</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Uploaded by</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Uploaded</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Folders */}
              {filteredFolders.map((folder) => {
                const folderPath = currentPath === '/' ? `/${folder.name}` : `${currentPath}/${folder.name}`;
                return (
                  <TableRow key={`folder:${folder.name}`} hover sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox" />
                    <TableCell onClick={() => navigateTo(folderPath)}>
                      <div className="flex items-center gap-2">
                        <Folder size={18} className="text-yellow-500 shrink-0" />
                        <span className="font-medium text-sm">{folder.name}</span>
                      </div>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }} onClick={() => navigateTo(folderPath)}>
                      {folder.size != null ? formatBytes(folder.size) : '—'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }} onClick={() => navigateTo(folderPath)}>
                      {folder.created_by_email || '—'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }} onClick={() => navigateTo(folderPath)}>
                      {folder.created_at ? new Date(folder.created_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {writeAllowed && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchor(e.currentTarget);
                            setMenuFolder(folderPath);
                            setMenuFile(null);
                          }}
                        >
                          <MoreVertical size={16} />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Files */}
              {filteredFiles.map((file) => (
                <TableRow
                  key={file.id}
                  hover
                  selected={selectedFiles.has(file.id)}
                  onClick={() => toggleFileSelection(file.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="small"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: { xs: '45vw', sm: 'none' } }}>
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      {getFileIcon(file.file_type)}
                      <span className="font-medium text-sm" style={{ wordBreak: 'break-word' }}>{file.name}</span>
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
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>
                    {file.uploaded_by_email || file.uploaded_by || '—'}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontSize: '0.8125rem' }}>
                    {file.created_at ? new Date(file.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Tooltip title="Preview">
                        <IconButton size="small" onClick={() => openPreview(file)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                          <Eye size={16} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => handleDownload(file)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                          <Download size={16} />
                        </IconButton>
                      </Tooltip>
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
      ) : null}

      {/* Context menu — file */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor) && menuFile !== null}
        onClose={() => { setMenuAnchor(null); setMenuFile(null); }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) openPreview(menuFile); setMenuFile(null); }}>
          <ListItemIcon><Eye size={16} /></ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); if (menuFile) handleDownload(menuFile); setMenuFile(null); }}>
          <ListItemIcon><Download size={16} /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        {writeAllowed && (
          <MenuItem onClick={() => { if (menuFile) openMoveDialog({ path: currentPath, isFolder: false, fileId: menuFile.id }); }}>
            <ListItemIcon><MoveRight size={16} /></ListItemIcon>
            <ListItemText>Move to Folder</ListItemText>
          </MenuItem>
        )}
        {writeAllowed && (
          <MenuItem
            onClick={() => { setMenuAnchor(null); if (menuFile) setPendingDelete({ kind: 'file', file: menuFile }); setMenuFile(null); }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}><Trash2 size={16} /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Context menu — folder */}
      {writeAllowed && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor) && menuFolder !== null}
          onClose={() => { setMenuAnchor(null); setMenuFolder(null); }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={() => { if (menuFolder) openMoveDialog({ path: menuFolder, isFolder: true }); }}>
            <ListItemIcon><MoveRight size={16} /></ListItemIcon>
            <ListItemText>Move / Rename</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => { setMenuAnchor(null); if (menuFolder) setPendingDelete({ kind: 'folder', folderPath: menuFolder }); setMenuFolder(null); }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}><Trash2 size={16} /></ListItemIcon>
            <ListItemText>Delete Folder</ListItemText>
          </MenuItem>
        </Menu>
      )}

      {/* Move dialog */}
      <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Move {moveSource?.isFolder ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the destination path (e.g. <code>/docs/reports</code>)
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
          <Button
            variant="contained"
            onClick={handleMove}
            disabled={!moveDestination || moveDestination === moveSource?.path}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={mkdirDialogOpen} onClose={() => !mkdirLoading && setMkdirDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            label="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newFolderName.trim() && !mkdirLoading) handleMkdir(); }}
            fullWidth
            autoFocus
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMkdirDialogOpen(false)} disabled={mkdirLoading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMkdir}
            disabled={mkdirLoading || !newFolderName.trim()}
            startIcon={mkdirLoading ? <CircularProgress size={14} color="inherit" /> : <FolderPlus size={14} />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(pendingDelete)} onClose={() => !deleteDialogBusy && setPendingDelete(null)} maxWidth="xs" fullWidth>
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
                This action cannot be undone.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: '6px !important' }}>
          <Paper
            variant="outlined"
            sx={{ p: 1.5, borderColor: 'rgba(239,68,68,0.4)', bgcolor: 'rgba(239,68,68,0.04)' }}
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
          <Button onClick={() => setPendingDelete(null)} disabled={deleteDialogBusy}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={deleteDialogBusy}
            startIcon={deleteDialogBusy ? <CircularProgress size={14} color="inherit" /> : <Trash2 size={14} />}
          >
            {deleteDialogBusy ? 'Deleting…' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* File preview drawer */}
      <WorkspaceFilePreviewDrawer
        open={previewDrawerOpen}
        file={previewFile}
        workspaceId={workspaceId}
        onClose={() => { setPreviewDrawerOpen(false); setPreviewFile(null); }}
      />

      {/* Batch selection floating toolbar */}
      {selectedFiles.size > 0 && writeAllowed && (
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
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<Trash2 size={14} />}
            onClick={() => {
              // Delete selected files one by one
              const ids = Array.from(selectedFiles);
              (async () => {
                let ok = 0;
                let fail = 0;
                for (const id of ids) {
                  try {
                    await deleteWorkspaceFile(workspaceId, id);
                    ok++;
                  } catch {
                    fail++;
                  }
                }
                if (ok > 0) toast('success', `${ok} file${ok !== 1 ? 's' : ''} deleted`);
                if (fail > 0) toast('error', `${fail} file${fail !== 1 ? 's' : ''} could not be deleted`);
                setSelectedFiles(new Set());
                fetchTree(currentPath);
              })();
            }}
          >
            Delete Selected
          </Button>
          <IconButton
            size="small"
            color="error"
            onClick={() => setSelectedFiles(new Set())}
            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
            title="Clear selection"
          >
            <X size={16} />
          </IconButton>
        </Toolbar>
      )}
    </div>
  );
}
