import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UploadCancelledError, uploadFile, uploadWorkspaceFile, type UploadFileOptions } from '@/api';
import { useToast } from '@/hooks/useToast';
import { emitDataRefresh } from '@/lib/dataRefresh';

const MAX_CONCURRENT_UPLOADS = 3;

export type UploadSource = 'upload-page' | 'global-drag' | 'workspace-browser';
export type UploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'cancelled';

export interface PersonalUploadTarget {
  kind: 'personal';
  folder?: string;
}

export interface WorkspaceUploadTarget {
  kind: 'workspace';
  workspaceId: string;
  workspaceName: string;
  folder?: string;
}

export type UploadTarget = PersonalUploadTarget | WorkspaceUploadTarget;

export interface UploadItem {
  id: number;
  file: File;
  fileName: string;
  size: number;
  source: UploadSource;
  target: UploadTarget;
  status: UploadStatus;
  progress: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

interface EnqueueUploadsParams {
  files: File[];
  source: UploadSource;
  target: UploadTarget;
}

interface UploadManagerContextValue {
  uploads: UploadItem[];
  activeCount: number;
  pendingCount: number;
  failedCount: number;
  completedCount: number;
  drawerOpen: boolean;
  enqueueUploads: (params: EnqueueUploadsParams) => UploadItem[];
  cancelUpload: (id: number) => void;
  cancelAllUploads: () => void;
  retryUpload: (id: number) => void;
  retryFailedUploads: () => void;
  removeUpload: (id: number) => void;
  clearCompleted: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

let nextUploadId = 0;

function normalizeUploadError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return 'Upload failed';
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const uploadsRef = useRef<UploadItem[]>([]);
  const controllersRef = useRef(new Map<number, AbortController>());
  const activeTaskIdsRef = useRef(new Set<number>());
  const { toast } = useToast();

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => () => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    activeTaskIdsRef.current.clear();
  }, []);

  useEffect(() => {
    const hasActiveUploads = uploads.some((item) => item.status === 'queued' || item.status === 'uploading');
    if (!hasActiveUploads) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploads]);

  const updateUpload = useCallback((id: number, updater: (item: UploadItem) => Partial<UploadItem>) => {
    setUploads((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        ...updater(item),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const emitSuccessRefresh = useCallback((target: UploadTarget) => {
    if (target.kind === 'personal') {
      emitDataRefresh({ personalFiles: true, analytics: true });
      return;
    }

    emitDataRefresh({
      analytics: true,
      workspaceId: target.workspaceId,
      workspaceFiles: true,
      workspaceQuota: true,
    });
  }, []);

  const startUpload = useCallback(async (id: number) => {
    const current = uploadsRef.current.find((item) => item.id === id);
    if (!current || current.status !== 'queued' || activeTaskIdsRef.current.has(id)) return;

    activeTaskIdsRef.current.add(id);

    const controller = new AbortController();
    controllersRef.current.set(id, controller);
    updateUpload(id, () => ({ status: 'uploading', progress: 0, error: undefined }));

    const options: UploadFileOptions = {
      signal: controller.signal,
      onProgress: (progress) => {
        updateUpload(id, () => ({ progress: Math.round(progress.fraction * 100) }));
      },
    };

    try {
      if (current.target.kind === 'personal') {
        await uploadFile(current.file, current.target.folder, options);
      } else {
        await uploadWorkspaceFile(current.target.workspaceId, current.file, current.target.folder, options);
      }

      updateUpload(id, () => ({ status: 'success', progress: 100, error: undefined }));
      emitSuccessRefresh(current.target);
    } catch (error) {
      if (error instanceof UploadCancelledError) {
        updateUpload(id, (item) => ({
          status: item.status === 'success' ? 'success' : 'cancelled',
          error: undefined,
        }));
      } else {
        updateUpload(id, () => ({
          status: 'error',
          error: normalizeUploadError(error),
        }));
      }
    } finally {
      controllersRef.current.delete(id);
      activeTaskIdsRef.current.delete(id);
    }
  }, [emitSuccessRefresh, updateUpload]);

  useEffect(() => {
    const runningCount = uploads.filter((item) => item.status === 'uploading').length;
    if (runningCount >= MAX_CONCURRENT_UPLOADS) return;

    const nextQueued = uploads
      .filter((item) => item.status === 'queued')
      .slice(0, MAX_CONCURRENT_UPLOADS - runningCount);

    nextQueued.forEach((item) => {
      void startUpload(item.id);
    });
  }, [startUpload, uploads]);

  const enqueueUploads = useCallback(({ files, source, target }: EnqueueUploadsParams): UploadItem[] => {
    const now = Date.now();
    const created = files.map((file) => ({
      id: ++nextUploadId,
      file,
      fileName: file.name,
      size: file.size,
      source,
      target,
      status: 'queued' as const,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    }));

    if (created.length > 0) {
      setUploads((prev) => [...created, ...prev]);
      toast('info', `Queued ${created.length} upload${created.length !== 1 ? 's' : ''}`);
    }

    return created;
  }, [toast]);

  const cancelUpload = useCallback((id: number) => {
    const item = uploadsRef.current.find((entry) => entry.id === id);
    if (!item) return;
    if (item.status === 'success') return;

    if (item.status === 'uploading') {
      updateUpload(id, () => ({ status: 'cancelled', error: undefined }));
      controllersRef.current.get(id)?.abort();
      return;
    }

    if (item.status === 'queued' || item.status === 'error') {
      updateUpload(id, () => ({ status: 'cancelled', error: undefined }));
    }
  }, [updateUpload]);

  const cancelAllUploads = useCallback(() => {
    const idsToAbort: number[] = [];
    setUploads((prev) => prev.map((item) => {
      if (item.status === 'uploading') {
        idsToAbort.push(item.id);
        return { ...item, status: 'cancelled', error: undefined, updatedAt: Date.now() };
      }
      if (item.status === 'queued') {
        return { ...item, status: 'cancelled', error: undefined, updatedAt: Date.now() };
      }
      return item;
    }));

    idsToAbort.forEach((id) => {
      controllersRef.current.get(id)?.abort();
    });
  }, []);

  const retryUpload = useCallback((id: number) => {
    updateUpload(id, (item) => {
      if (item.status !== 'error' && item.status !== 'cancelled') {
        return {};
      }
      return {
        status: 'queued',
        progress: 0,
        error: undefined,
      };
    });
  }, [updateUpload]);

  const retryFailedUploads = useCallback(() => {
    setUploads((prev) => prev.map((item) => {
      if (item.status !== 'error' && item.status !== 'cancelled') return item;
      return {
        ...item,
        status: 'queued',
        progress: 0,
        error: undefined,
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const removeUpload = useCallback((id: number) => {
    const item = uploadsRef.current.find((entry) => entry.id === id);
    if (!item || item.status === 'uploading') return;
    setUploads((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((item) => item.status !== 'success'));
  }, []);

  const value = useMemo<UploadManagerContextValue>(() => {
    const activeCount = uploads.filter((item) => item.status === 'queued' || item.status === 'uploading').length;
    const failedCount = uploads.filter((item) => item.status === 'error' || item.status === 'cancelled').length;
    const completedCount = uploads.filter((item) => item.status === 'success').length;
    const pendingCount = activeCount + failedCount;

    return {
      uploads,
      activeCount,
      pendingCount,
      failedCount,
      completedCount,
      drawerOpen,
      enqueueUploads,
      cancelUpload,
      cancelAllUploads,
      retryUpload,
      retryFailedUploads,
      removeUpload,
      clearCompleted,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    };
  }, [uploads, drawerOpen, enqueueUploads, cancelUpload, cancelAllUploads, retryUpload, retryFailedUploads, removeUpload, clearCompleted]);

  return (
    <UploadManagerContext value={value}>
      {children}
    </UploadManagerContext>
  );
}

export function useUploadManager(): UploadManagerContextValue {
  const context = useContext(UploadManagerContext);
  if (!context) {
    throw new Error('useUploadManager must be used within UploadManagerProvider');
  }
  return context;
}