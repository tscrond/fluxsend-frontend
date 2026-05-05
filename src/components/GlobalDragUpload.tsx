import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  List, ListItemButton, ListItemIcon, ListItemText, TextField, CircularProgress,
  Paper, Breadcrumbs, Link, IconButton, Chip,
} from '@mui/material';
import {
  HardDrive, LayoutGrid, Folder, ArrowLeft, CheckCircle, XCircle,
  CloudUpload, ChevronRight, X,
} from 'lucide-react';
import {
  uploadFile, uploadWorkspaceFile, getFolders, getWorkspaceFilesTree,
  listWorkspaces, mkdirWorkspace, type Workspace,
} from '@/api';
import { formatBytes } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

type Step = 'destination' | 'folder' | 'upload';

let _qid = 0;

// ─── Path helpers ─────────────────────────────────────────────────────────────

/** Join current path with a folder name for navigation */
function joinPath(current: string, name: string, ws: boolean): string {
  return ws
    ? (current === '/' ? '/' + name : current + '/' + name)
    : (current ? current + '/' + name : name);
}

/** Split a path into its segment names */
function getSegments(path: string, ws: boolean): string[] {
  if (ws) return path === '/' ? [] : path.replace(/^\//, '').split('/').filter(Boolean);
  return path ? path.split('/').filter(Boolean) : [];
}

/** Reconstruct the path up to segment index idx */
function segPath(segs: string[], idx: number, ws: boolean): string {
  const parts = segs.slice(0, idx + 1);
  return ws ? '/' + parts.join('/') : parts.join('/');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalDragUpload() {
  // ── Overlay ────────────────────────────────────────────────────────────────
  const [dragActive, setDragActive] = useState(false);
  const dragCount = useRef(0);

  // ── Dialog ─────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('destination');

  // ── Step 1: destination ────────────────────────────────────────────────────
  const [destType, setDestType] = useState<'personal' | 'workspace' | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWs, setLoadingWs] = useState(false);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);

  // ── Step 2: folder ─────────────────────────────────────────────────────────
  const [folderPath, setFolderPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [pathCreating, setPathCreating] = useState(false);

  // ── Step 3: upload ─────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  const isWs = destType === 'workspace';
  const segments = getSegments(folderPath, isWs);

  // ── Window drag listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCount.current++;
      if (dragCount.current === 1) setDragActive(true);
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current = Math.max(0, dragCount.current - 1);
      if (dragCount.current === 0) setDragActive(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current = 0;
      setDragActive(false);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // ── Fetch workspaces when workspace type is selected ───────────────────────
  useEffect(() => {
    if (destType !== 'workspace') return;
    setLoadingWs(true);
    listWorkspaces()
      .then(ws =>
        setWorkspaces(
          ws.filter(w => w.role === 'owner' || w.role === 'admin' || w.role === 'editor'),
        ),
      )
      .catch(() => setWorkspaces([]))
      .finally(() => setLoadingWs(false));
  }, [destType]);

  // ── Fetch folders when path or step changes ────────────────────────────────
  useEffect(() => {
    if (step !== 'folder') return;
    setLoadingFolders(true);
    const p = isWs ? (folderPath || '/') : (folderPath || undefined);
    const fetch =
      isWs && selectedWs
        ? getWorkspaceFilesTree(selectedWs.workspace_id, p as string).then(r => (r.folders ?? []).map(f => f.name))
        : getFolders(p as string | undefined).then(r => r.folders ?? []);
    fetch
      .then(f => setFolders(f))
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false));
  }, [step, folderPath, isWs, selectedWs]);

  // ── Keep path text input in sync with breadcrumb navigation ───────────────
  useEffect(() => {
    if (isWs) setPathInput(folderPath);
  }, [folderPath, isWs]);

  // ── Overlay drop ───────────────────────────────────────────────────────────
  const handleOverlayDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    // Reset all state and open dialog
    setQueue(files.map(f => ({ id: ++_qid, file: f, status: 'pending' })));
    setStep('destination');
    setDestType(null);
    setSelectedWs(null);
    setFolderPath('');
    setPathInput('');
    setFolders([]);
    setOpen(true);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToFolder = () => {
    const initial = isWs ? '/' : '';
    setFolderPath(initial);
    setStep('folder');
  };

  const goBack = useCallback(() => {
    if (step === 'folder') setStep('destination');
    else if (step === 'upload') setStep('folder');
  }, [step]);

  const handlePathGo = async () => {
    let p = pathInput.trim();
    if (!p) p = '/';
    if (!p.startsWith('/')) p = '/' + p;

    // For workspace paths, create each segment of the path that doesn't exist yet
    if (isWs && selectedWs && p !== '/') {
      setPathCreating(true);
      const segs = p.replace(/^\//, '').split('/').filter(Boolean);
      let current = '/';
      for (const seg of segs) {
        try {
          await mkdirWorkspace(selectedWs.workspace_id, seg, current);
        } catch {
          // Folder likely already exists — ignore and continue
        }
        current = current === '/' ? '/' + seg : current + '/' + seg;
      }
      setPathCreating(false);
    }

    setFolderPath(p);
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    setUploading(true);
    const pending = queue.filter(q => q.status === 'pending' || q.status === 'error');
    let ok = 0, fail = 0;

    for (const item of pending) {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));
      try {
        if (destType === 'personal') {
          await uploadFile(item.file, folderPath || undefined);
        } else if (destType === 'workspace' && selectedWs) {
          await uploadWorkspaceFile(
            selectedWs.workspace_id,
            item.file,
            folderPath === '/' ? undefined : folderPath,
          );
        }
        ok++;
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
      } catch (err) {
        fail++;
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id
              ? { ...q, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : q,
          ),
        );
      }
    }

    setUploading(false);
    if (ok > 0) toast('success', `Uploaded ${ok} file${ok !== 1 ? 's' : ''}`);
    if (fail > 0) toast('error', `${fail} file${fail !== 1 ? 's' : ''} failed to upload`);
  }, [queue, destType, folderPath, selectedWs, toast]);

  // ── Close / reset ──────────────────────────────────────────────────────────
  const handleClose = () => {
    if (uploading) return;
    setOpen(false);
    setTimeout(() => {
      setStep('destination');
      setDestType(null);
      setSelectedWs(null);
      setFolderPath('');
      setPathInput('');
      setFolders([]);
      setQueue([]);
    }, 300);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const canNext = destType === 'personal' || (destType === 'workspace' && selectedWs !== null);
  const allDone = queue.length > 0 && queue.every(q => q.status === 'success');
  const hasErrors = queue.some(q => q.status === 'error');
  const retryable = queue.filter(q => q.status === 'pending' || q.status === 'error').length;

  const destSummary = destType === 'personal'
    ? `Personal Storage${folderPath ? ` › ${folderPath.replace(/\//g, ' › ')}` : ''}`
    : `${selectedWs?.name ?? ''}${folderPath && folderPath !== '/' ? folderPath.replace(/\//g, ' › ') : ''}`;

  const folderLabel = segments.length === 0 ? 'Root' : (isWs ? folderPath : folderPath);

  // ── Destination card shared styles ────────────────────────────────────────
  const cardSx = (active: boolean) => ({
    p: 2.5,
    cursor: 'pointer',
    border: 2,
    borderColor: active ? 'primary.main' : 'divider',
    transition: 'border-color 150ms ease',
    '&:hover': { borderColor: 'primary.main' },
  });

  return (
    <>
      {/* ── Drag overlay ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          bgcolor: 'rgba(0,0,0,0.82)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dragActive ? 1 : 0,
          pointerEvents: dragActive ? 'all' : 'none',
          transition: 'opacity 200ms ease',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleOverlayDrop}
      >
        <Box
          sx={{
            border: '3px dashed',
            borderColor: 'primary.light',
            borderRadius: 1,
            px: { xs: 6, sm: 10 },
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'rgba(255,255,255,0.04)',
            transform: dragActive ? 'scale(1)' : 'scale(0.92)',
            transition: 'transform 220ms ease',
            userSelect: 'none',
          }}
        >
          <CloudUpload size={72} color="white" strokeWidth={1.2} />
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
            Drop to upload
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Personal storage or workspace — your choice
          </Typography>
        </Box>
      </Box>

      {/* ── Upload dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={uploading}
      >
        {/* ─── Step 1: Destination ─────────────────────────────────────────── */}
        {step === 'destination' && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Where to upload?</span>
                <IconButton size="small" onClick={handleClose} edge="end">
                  <X size={18} />
                </IconButton>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
                {queue.length} file{queue.length !== 1 ? 's' : ''} ready
              </Typography>
            </DialogTitle>

            <DialogContent>
              {/* Destination cards */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Paper
                  variant="outlined"
                  onClick={() => { setDestType('personal'); setSelectedWs(null); }}
                  sx={cardSx(destType === 'personal')}
                >
                  <HardDrive size={28} className={destType === 'personal' ? 'text-indigo-500' : 'text-slate-400'} />
                  <Typography variant="subtitle2" sx={{ mt: 1.5, fontWeight: 600 }}>Personal Storage</Typography>
                  <Typography variant="caption" color="text.secondary">Your private files</Typography>
                </Paper>

                <Paper
                  variant="outlined"
                  onClick={() => setDestType('workspace')}
                  sx={cardSx(destType === 'workspace')}
                >
                  <LayoutGrid size={28} className={destType === 'workspace' ? 'text-indigo-500' : 'text-slate-400'} />
                  <Typography variant="subtitle2" sx={{ mt: 1.5, fontWeight: 600 }}>Workspace</Typography>
                  <Typography variant="caption" color="text.secondary">Shared team storage</Typography>
                </Paper>
              </Box>

              {/* Workspace list */}
              {destType === 'workspace' && (
                loadingWs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : workspaces.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No writable workspaces found
                  </Typography>
                ) : (
                  <Box sx={{ border: 1, borderColor: 'divider', maxHeight: 210, overflow: 'auto' }}>
                    <List dense disablePadding>
                      {workspaces.map(ws => (
                        <ListItemButton
                          key={ws.workspace_id}
                          selected={selectedWs?.workspace_id === ws.workspace_id}
                          onClick={() => setSelectedWs(ws)}
                        >
                          <ListItemIcon sx={{ minWidth: 34 }}>
                            <LayoutGrid size={16} />
                          </ListItemIcon>
                          <ListItemText
                            primary={ws.name}
                            secondary={`/${ws.slug}`}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: selectedWs?.workspace_id === ws.workspace_id ? 600 : 400,
                            }}
                          />
                          <Chip label={ws.role} size="small" variant="outlined" sx={{ ml: 1 }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Box>
                )
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={handleClose} variant="text">Cancel</Button>
              <Button
                onClick={goToFolder}
                variant="contained"
                disabled={!canNext}
                endIcon={<ChevronRight size={16} />}
              >
                Choose folder
              </Button>
            </DialogActions>
          </>
        )}

        {/* ─── Step 2: Folder picker ────────────────────────────────────────── */}
        {step === 'folder' && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" onClick={goBack} edge="start">
                  <ArrowLeft size={16} />
                </IconButton>
                <span>Choose destination folder</span>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400, pl: '36px' }}>
                {destType === 'personal' ? 'Personal Storage' : selectedWs?.name}
              </Typography>
            </DialogTitle>

            <DialogContent>
              {/* Breadcrumb */}
              <Breadcrumbs separator="›" sx={{ mb: 2, fontSize: '0.875rem' }}>
                <Link
                  component="button"
                  variant="body2"
                  underline="hover"
                  onClick={() => setFolderPath(isWs ? '/' : '')}
                  color={segments.length === 0 ? 'text.primary' : 'text.secondary'}
                  sx={{ fontWeight: segments.length === 0 ? 600 : 400 }}
                >
                  Root
                </Link>
                {segments.map((seg, i) =>
                  i < segments.length - 1 ? (
                    <Link
                      key={i}
                      component="button"
                      variant="body2"
                      underline="hover"
                      color="text.secondary"
                      onClick={() => setFolderPath(segPath(segments, i, isWs))}
                    >
                      {seg}
                    </Link>
                  ) : (
                    <Typography key={i} variant="body2" color="text.primary" fontWeight={600}>
                      {seg}
                    </Typography>
                  ),
                )}
              </Breadcrumbs>

              {/* Folder list */}
              <Box
                sx={{
                  border: 1, borderColor: 'divider',
                  minHeight: 100, maxHeight: 200, overflow: 'auto',
                }}
              >
                {loadingFolders ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : folders.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 1 }}>
                    <Folder size={32} className="text-slate-300" />
                    <Typography variant="body2" color="text.secondary">No subfolders here</Typography>
                  </Box>
                ) : (
                  <List dense disablePadding>
                    {folders.map(name => (
                      <ListItemButton
                        key={name}
                        onClick={() => setFolderPath(joinPath(folderPath, name, isWs))}
                      >
                        <ListItemIcon sx={{ minWidth: 34 }}>
                          <Folder size={18} className="text-yellow-500" />
                        </ListItemIcon>
                        <ListItemText
                          primary={name}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                        <ChevronRight size={16} className="text-slate-400" />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>

              {/* Manual path override (workspace only) */}
              {isWs && (
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Path override"
                    placeholder="/docs/reports"
                    value={pathInput}
                    onChange={e => setPathInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handlePathGo(); }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePathGo}
                    disabled={pathCreating}
                    sx={{ flexShrink: 0 }}
                  >
                    {pathCreating ? <CircularProgress size={14} /> : 'Go'}
                  </Button>
                </Box>
              )}

              {/* Current destination summary */}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover' }}>
                <Typography variant="body2" color="text.secondary">
                  Will upload to:{' '}
                  <strong style={{ color: 'inherit' }}>{folderLabel}</strong>
                </Typography>
              </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={handleClose} variant="text">Cancel</Button>
              <Button
                onClick={() => setStep('upload')}
                variant="contained"
                endIcon={<ChevronRight size={16} />}
              >
                Upload here
              </Button>
            </DialogActions>
          </>
        )}

        {/* ─── Step 3: Upload ───────────────────────────────────────────────── */}
        {step === 'upload' && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!uploading && !allDone && (
                  <IconButton size="small" onClick={goBack} edge="start">
                    <ArrowLeft size={16} />
                  </IconButton>
                )}
                <span>{allDone ? 'Upload complete!' : `Upload ${queue.length} file${queue.length !== 1 ? 's' : ''}`}</span>
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, fontWeight: 400, pl: !uploading && !allDone ? '36px' : 0 }}
              >
                → {destSummary || 'Root'}
              </Typography>
            </DialogTitle>

            <DialogContent>
              <List dense disablePadding>
                {queue.map(item => (
                  <Box
                    key={item.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}
                  >
                    {/* Status icon */}
                    {item.status === 'uploading' ? (
                      <CircularProgress size={18} sx={{ flexShrink: 0 }} />
                    ) : item.status === 'success' ? (
                      <CheckCircle size={18} className="text-green-500 shrink-0" />
                    ) : item.status === 'error' ? (
                      <XCircle size={18} className="text-red-500 shrink-0" />
                    ) : (
                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid', borderColor: 'divider', flexShrink: 0 }} />
                    )}

                    {/* Name + error */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap fontWeight={500}>
                        {item.file.name}
                      </Typography>
                      {item.status === 'error' && item.error && (
                        <Typography variant="caption" color="error">
                          {item.error}
                        </Typography>
                      )}
                    </Box>

                    {/* Size */}
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {formatBytes(item.file.size)}
                    </Typography>
                  </Box>
                ))}
              </List>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              {allDone ? (
                <Button onClick={handleClose} variant="contained">Done</Button>
              ) : (
                <>
                  <Button onClick={handleClose} variant="text" disabled={uploading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    variant="contained"
                    disabled={uploading}
                    startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : undefined}
                  >
                    {uploading
                      ? 'Uploading…'
                      : hasErrors
                        ? `Retry failed (${retryable})`
                        : `Upload ${retryable} file${retryable !== 1 ? 's' : ''}`}
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
