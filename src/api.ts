const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

interface ApiEnvelope {
  status: number;
  msg?: string;
  response: unknown;
}

const DEFAULT_UPLOAD_CHUNK_CONCURRENCY = 4;
const DEFAULT_UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;

function getApiErrorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body) as Partial<ApiEnvelope>;
    // Prefer the human-readable message nested inside the response object
    // (used by plan-limit errors: { msg: "exceeded_plan_limits", response: { msg: "...", ... } })
    if (
      typeof json.response === 'object' &&
      json.response !== null &&
      'msg' in (json.response as object) &&
      typeof (json.response as Record<string, unknown>).msg === 'string'
    ) {
      const inner = ((json.response as Record<string, unknown>).msg as string).trim();
      if (inner !== '') return inner;
    }
    if (typeof json.msg === 'string' && json.msg.trim() !== '') {
      return json.msg;
    }
    if (typeof json.response === 'string' && json.response.trim() !== '') {
      return json.response;
    }
  } catch {
    // Fall back to a generic message when the body is not JSON.
  }

  return `Request failed (${status})`;
}

function parseApiResponseBody<T>(text: string): T {
  try {
    const json = JSON.parse(text);
    // Backend wraps all responses in { status, msg, response }
    if (json && typeof json === 'object' && 'response' in json) {
      return (json as ApiEnvelope).response as T;
    }
    return json as T;
  } catch {
    const normalized = text.trim().toLowerCase();
    // If an API route returns the SPA index page, force an error so callers can fallback.
    if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
      throw new ApiError(200, 'Unexpected HTML response from API route');
    }
    return text as T;
  }
}

async function request<T>(path: string, options: RequestInit & { rawResponse?: boolean } = {}): Promise<T> {
  const { rawResponse, ...fetchOptions } = options;
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      const onLoginScreen = window.location.pathname.startsWith('/login');
      const isPasswordLoginRequest = path === '/auth/password/login';
      if (!onLoginScreen && !isPasswordLoginRequest) {
        window.location.href = '/login';
      }
    }
    throw new ApiError(res.status, body, getApiErrorMessage(res.status, body));
  }

  const text = await res.text();
  return parseApiResponseBody<T>(text);
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface AuthStatus {
  authenticated: boolean;
  user_info?: {
    sub: string;
    email: string;
    email_verified: string;
  };
}

export interface AuthProviders {
  google: boolean;
  github: boolean;
  password: boolean;
}

export function getLoginUrl(provider: string): string {
  return `${API_BASE}/auth/${provider}/login`;
}

export async function checkAuth(): Promise<AuthStatus> {
  try {
    return await request<AuthStatus>('/auth/is_valid');
  } catch {
    // 403 is the expected response when not logged in
    return { authenticated: false };
  }
}

export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    return await request<AuthProviders>('/auth/providers');
  } catch {
    return { google: false, github: false, password: false };
  }
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

export interface PasswordRegisterResponse {
  challenge_id: string;
}

export function passwordRegister(email: string, password: string): Promise<PasswordRegisterResponse> {
  return request<PasswordRegisterResponse>('/auth/password/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function passwordVerifyNewUser(challengeId: string, email: string, code: string): Promise<void> {
  return request<void>(`/auth/password/new/verify/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
}

export function passwordLogin(email: string, password: string): Promise<{ user_id: string }> {
  return request<{ user_id: string }>('/auth/password/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export interface PasswordResetRequestResponse {
  sent: boolean;
}

export function requestPasswordReset(email: string): Promise<PasswordResetRequestResponse> {
  return request<PasswordResetRequestResponse>('/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export interface PasswordResetVerifyResponse {
  verified?: boolean;
  password_reset?: boolean;
}

export function verifyPasswordReset(
  challengeId: string,
  email: string,
  code: string,
  newPassword?: string,
): Promise<PasswordResetVerifyResponse> {
  return request<PasswordResetVerifyResponse>(`/auth/password/reset/verify/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, new_password: newPassword ?? '' }),
  });
}

export interface PasswordAttachRequestResponse {
  challenge_id: string;
}

export function requestPasswordAttach(password: string): Promise<PasswordAttachRequestResponse> {
  return request<PasswordAttachRequestResponse>('/auth/password/attach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export interface PasswordAttachVerifyResponse {
  attached: boolean;
}

export function verifyPasswordAttach(challengeId: string, email: string, code: string): Promise<PasswordAttachVerifyResponse> {
  return request<PasswordAttachVerifyResponse>(`/auth/password/attach/verify/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
}

// ─── User ───────────────────────────────────────────────────────────────────

export interface UserData {
  user_id: string;
  provider_user_id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  provider: string;
  // Plan fields (from AuthorizedUserWithPlan)
  plan_id?: string;
  plan_name?: string;
  max_file_size_bytes?: number;
  max_total_storage_bytes?: number;
  max_files?: number;
  max_files_sent_per_day?: number;
  max_shares_per_day?: number;
  max_user_workspaces?: number;
  max_files_workspace?: number;
  max_total_storage_bytes_workspace?: number;
  max_users_workspace?: number;
  max_workspace_folders?: number;
}

export interface UserDataResponse {
  user_data: UserData;
}

export function getUserData(): Promise<UserDataResponse> {
  return request<UserDataResponse>('/user/data');
}

export interface UserIdentity {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string;
  email_verified: boolean;
  name: string;
  avatar_url: string;
  created_at: string;
}

export interface UserIdentitiesResponse {
  identities: UserIdentity[];
  has_password_identity: boolean;
}

export function getUserIdentities(): Promise<UserIdentitiesResponse> {
  return request<UserIdentitiesResponse>('/user/identities');
}

export interface DailyActivity {
  day: string;
  uploads?: number;
  shares?: number;
}

export interface UserStats {
  total_files: number;
  total_bytes: number;
  files_today: number;
  files_last_7d: number;
  files_last_30d: number;
  total_shares_sent: number;
  shares_today: number;
  targeted_shares: number;
  public_shares: number;
  active_shares: number;
  total_received: number;
  owned_workspaces: number;
  daily_uploads: DailyActivity[];
  daily_shares: DailyActivity[];
  workspace_api_keys: number;
}

export function getUserStats(): Promise<UserStats> {
  return request<UserStats>('/user/stats');
}

// ─── Bucket / Files ─────────────────────────────────────────────────────────

export interface ObjectMetadata {
  name: string;
  content_type: string;
  date_created: string;
  date_deleted: string;
  date_updated: string;
  md5: string;
  size: number;
  media_link: string;
  bucket: string;
}

export interface BucketData {
  bucket_data: {
    bucket_name: string;
    storage_class: string;
    time_created: string;
    labels: Record<string, string>;
    objects: ObjectMetadata[] | null;
  };
}

export function getUserBucket(): Promise<BucketData> {
  return request<BucketData>('/user/bucket');
}

interface CreateMultipartUploadResponse {
  upload_id: string;
  chunk_size: number;
}

interface UploadMultipartPartResponse {
  part_number: number;
  size: number;
  storage_metadata?: Record<string, unknown>;
}

interface MultipartUploadPaths {
  initPath: string;
  partPath: (uploadId: string, partNumber: number) => string;
  completePath: (uploadId: string) => string;
  abortPath: (uploadId: string) => string;
}

export interface CompleteMultipartUploadResponse {
  upload_id: string;
  file_name: string;
  md5_checksum: string;
  size: number;
}

export interface MultipartUploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  fraction: number;
}

export interface UploadFileOptions {
  onProgress?: (progress: MultipartUploadProgress) => void;
  chunkConcurrency?: number;
  signal?: AbortSignal;
}

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

function normalizeChunkSize(rawChunkSize: number, fileSize: number): number {
  if (Number.isFinite(rawChunkSize) && rawChunkSize > 0) {
    return Math.max(1, Math.floor(rawChunkSize));
  }

  if (fileSize > 0) {
    return Math.min(fileSize, DEFAULT_UPLOAD_CHUNK_SIZE);
  }

  return DEFAULT_UPLOAD_CHUNK_SIZE;
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof UploadCancelledError
    || (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.message === 'Upload cancelled');
}

function buildMultipartUploadInitBody(file: File, folder?: string): Record<string, unknown> {
  return {
    filename: file.name,
    size: file.size,
    content_type: file.type || 'application/octet-stream',
    folder: folder ?? '',
  };
}

async function abortMultipartUpload(uploadId: string, paths: MultipartUploadPaths): Promise<void> {
  try {
    await request(paths.abortPath(uploadId), { method: 'DELETE' });
  } catch {
    // Best-effort cleanup only.
  }
}

async function uploadMultipartFile(
  file: File,
  folder: string | undefined,
  options: UploadFileOptions,
  paths: MultipartUploadPaths,
): Promise<CompleteMultipartUploadResponse> {
  const signal = options.signal;

  if (file.size <= 0) {
    throw new Error('Cannot upload an empty file');
  }

  if (signal?.aborted) {
    throw new UploadCancelledError();
  }

  let uploadId: string | null = null;
  let uploadCompleted = false;

  const activeAborts = new Set<() => void>();
  const activeProgress = new Map<number, number>();

  const abortActiveRequests = () => {
    for (const abort of activeAborts) abort();
  };

  const handleSignalAbort = () => {
    abortActiveRequests();
  };

  signal?.addEventListener('abort', handleSignalAbort);

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new UploadCancelledError();
    }
  };

  try {
    throwIfAborted();

    const initResponse = await request<CreateMultipartUploadResponse>(paths.initPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildMultipartUploadInitBody(file, folder)),
      signal,
    });
    uploadId = initResponse.upload_id;

    const chunkSize = normalizeChunkSize(initResponse.chunk_size, file.size);
    const partCount = Math.max(1, Math.ceil(file.size / chunkSize));
    const configuredConcurrency = options.chunkConcurrency ?? DEFAULT_UPLOAD_CHUNK_CONCURRENCY;
    const chunkConcurrency = Math.max(1, Math.min(Math.floor(configuredConcurrency), partCount));

    let completedBytes = 0;
    let nextPartNumber = 1;
    let firstError: unknown = null;

    const emitProgress = () => {
      let uploadedBytes = completedBytes;
      for (const value of activeProgress.values()) uploadedBytes += value;

      options.onProgress?.({
        uploadedBytes,
        totalBytes: file.size,
        fraction: file.size > 0 ? Math.min(uploadedBytes / file.size, 1) : 1,
      });
    };

    emitProgress();

    const uploadPart = async (partNumber: number) => {
      throwIfAborted();

      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      const requestHandle = uploadChunkRequest<UploadMultipartPartResponse>(
        paths.partPath(initResponse.upload_id, partNumber),
        chunk,
        (loaded) => {
          activeProgress.set(partNumber, Math.min(loaded, chunk.size));
          emitProgress();
        },
      );

      activeAborts.add(requestHandle.abort);

      try {
        await requestHandle.promise;
        completedBytes += chunk.size;
        activeProgress.delete(partNumber);
        emitProgress();
      } finally {
        activeAborts.delete(requestHandle.abort);
      }
    };

    const workers = Array.from({ length: chunkConcurrency }, async () => {
      while (!firstError) {
        throwIfAborted();

        const partNumber = nextPartNumber;
        if (partNumber > partCount) return;
        nextPartNumber += 1;

        try {
          await uploadPart(partNumber);
        } catch (error) {
          if (!firstError) {
            firstError = error;
            abortActiveRequests();
          }
          throw error;
        }
      }
    });

    try {
      await Promise.all(workers);
    } catch (error) {
      throw firstError instanceof Error ? firstError : error;
    }

    throwIfAborted();

    const completeResponse = await request<CompleteMultipartUploadResponse>(
      paths.completePath(initResponse.upload_id),
      { method: 'POST', signal },
    );
    uploadCompleted = true;

    options.onProgress?.({
      uploadedBytes: file.size,
      totalBytes: file.size,
      fraction: 1,
    });

    return completeResponse;
  } catch (error) {
    if (isAbortLikeError(error) || signal?.aborted) {
      if (uploadId !== null && !uploadCompleted) {
        await abortMultipartUpload(uploadId, paths);
      }
      throw new UploadCancelledError();
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', handleSignalAbort);
  }
}

const privateMultipartUploadPaths: MultipartUploadPaths = {
  initPath: '/files/uploads',
  partPath: (uploadId, partNumber) => `/files/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}`,
  completePath: (uploadId) => `/files/uploads/${encodeURIComponent(uploadId)}/complete`,
  abortPath: (uploadId) => `/files/uploads/${encodeURIComponent(uploadId)}`,
};

function workspaceMultipartUploadPaths(workspaceId: string): MultipartUploadPaths {
  const encodedWorkspaceId = encodeURIComponent(workspaceId);
  return {
    initPath: `/workspaces/${encodedWorkspaceId}/files/uploads`,
    partPath: (uploadId, partNumber) => `/workspaces/${encodedWorkspaceId}/files/uploads/${encodeURIComponent(uploadId)}/parts/${partNumber}`,
    completePath: (uploadId) => `/workspaces/${encodedWorkspaceId}/files/uploads/${encodeURIComponent(uploadId)}/complete`,
    abortPath: (uploadId) => `/workspaces/${encodedWorkspaceId}/files/uploads/${encodeURIComponent(uploadId)}`,
  };
}

function uploadChunkRequest<T>(
  path: string,
  body: Blob,
  onProgress?: (loaded: number, total: number) => void,
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.addEventListener('progress', (event) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : body.size;
      onProgress?.(Math.min(event.loaded, total), total);
    });

    xhr.addEventListener('load', () => {
      const responseText = xhr.responseText ?? '';

      if (xhr.status === 401) {
        window.location.href = '/login';
        reject(new Error('Unauthorized'));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(xhr.status, responseText, getApiErrorMessage(xhr.status, responseText)));
        return;
      }

      try {
        onProgress?.(body.size, body.size);
        resolve(parseApiResponseBody<T>(responseText));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse upload response'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error while uploading chunk'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.send(body);
  });

  return {
    promise,
    abort: () => xhr.abort(),
  };
}

export async function uploadFile(
  file: File,
  folder?: string,
  options: UploadFileOptions = {},
): Promise<CompleteMultipartUploadResponse> {
  return uploadMultipartFile(file, folder, options, privateMultipartUploadPaths);
}

export function deleteFile(fileName: string): Promise<{ file_deleted: string }> {
  return request<{ file_deleted: string }>(
    `/files/delete?file=${encodeURIComponent(fileName)}`,
    { method: 'DELETE' },
  );
}

export interface BatchDeleteFilesResponse {
  files_deleted: string[] | null;
  files_failed: string[] | null;
}

export function deleteFilesBatch(files: string[]): Promise<BatchDeleteFilesResponse> {
  return request<BatchDeleteFilesResponse>('/files/delete/batch', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
}

export interface PrivateTokenResponse {
  private_download_token: string;
}

export function getPrivateDownloadToken(fileName: string): Promise<PrivateTokenResponse> {
  return request<PrivateTokenResponse>(
    `/user/private/download_token?file=${encodeURIComponent(fileName)}`,
  );
}

export function getPrivateDownloadUrl(token: string, mode: 'inline' | 'download' = 'download'): string {
  return `${API_BASE}/d/private/${token}?mode=${mode}`;
}

// ─── Sharing ────────────────────────────────────────────────────────────────

export interface ShareRequest {
  email: string;
  objects: string[];
  duration: string;
  send_email: boolean;
  password?: string;
}

export interface SharingInfo {
  file_name: string;
  shared_for: string;
  sharing_token: string;
  expires_at: string;
}

export interface ShareResponse {
  sharing_info: SharingInfo[];
  notification_status: string;
}

export function shareFiles(data: ShareRequest): Promise<ShareResponse> {
  return request<ShareResponse>('/files/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface SharedFile {
  file_name: string;
  file_type: string;
  size: number;
  shared_by?: string;
  shared_for?: string;
  sharing_token: string;
  created_at: string;
  expires_at: string;
  seen: boolean;
  password_protected?: boolean;
}

export function getReceivedFiles(): Promise<{ files: SharedFile[] | null }> {
  return request<{ files: SharedFile[] | null }>('/files/received');
}

export function getSharedByUser(): Promise<{ files: SharedFile[] | null }> {
  return request<{ files: SharedFile[] | null }>('/files/shared_by_user');
}

export function getSharedDownloadUrl(token: string, mode: 'inline' | 'download' = 'download'): string {
  return `${API_BASE}/d/${token}?mode=${mode}`;
}

export function revokeShare(token: string): Promise<void> {
  return request<void>(`/share/revoke/${token}`, { method: 'POST' });
}

// ─── Quick Share ────────────────────────────────────────────────────────────

export interface QuickShareResponse {
  sharing_token: string;
  expires_at: string;
  sharing_link: string;
}

export function quickShare(object: string, duration: string, password?: string): Promise<QuickShareResponse> {
  return request<QuickShareResponse>('/files/quick_share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ object, duration, password: password ?? '' }),
  });
}

// ─── Received / Unseen ─────────────────────────────────────────────────────

// ─── Public Share ───────────────────────────────────────────────────────────

export interface ShareInfoResponse {
  file_name: string;
  expires_at: string;
  password_protected: boolean;
}

export interface ResolveShareResponse {
  url: string;
  file_name: string;
}

export async function getShareInfo(token: string): Promise<ShareInfoResponse> {
  return request<ShareInfoResponse>(`/share/info/${encodeURIComponent(token)}`);
}

export async function resolvePublicShare(
  token: string,
  mode: 'inline' | 'download',
  password: string,
): Promise<ResolveShareResponse> {
  return request<ResolveShareResponse>(`/share/resolve/${encodeURIComponent(token)}?mode=${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

// ─── Received / Unseen ──────────────────────────────────────────────────────

export function getUnseenReceivedCount(): Promise<{ count: number }> {
  return request<{ count: number }>('/files/received/unseen_count');
}

export function markReceivedSeen(sharingToken: string): Promise<unknown> {
  return request('/files/received/mark_seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sharing_token: sharingToken }),
  });
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function getNote(checksum: string): Promise<{ content: string }> {
  return request<{ content: string }>(`/files/${encodeURIComponent(checksum)}/note`);
}

export function saveNote(checksum: string, content: string): Promise<{ note: string }> {
  return request<{ note: string }>(`/files/${encodeURIComponent(checksum)}/note`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

// ─── Account ────────────────────────────────────────────────────────────────

export interface DeleteAccountResponse {
  bucket: { name: string; deleted: boolean };
  account_deleted: { id: string; email: string; user_name: string };
}

export function deleteAccount(deleteUserData: boolean): Promise<DeleteAccountResponse> {
  return request<DeleteAccountResponse>('/user/account/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete_user_data: deleteUserData }),
  });
}

// ─── Folders ────────────────────────────────────────────────────────────────

export interface TreeEntry {
  name: string;
  file_type: string;
  size: number;
  md5_checksum: string;
}

export interface TreeResponse {
  path: string;
  folders: string[] | null;
  files: TreeEntry[] | null;
}

export function getFilesTree(path?: string): Promise<TreeResponse> {
  const qs = path ? `?path=${encodeURIComponent(path)}` : '';
  return request<TreeResponse>(`/files/tree${qs}`);
}

export function getFolders(parentPath?: string): Promise<{ path: string; folders: string[] | null }> {
  const qs = parentPath ? `?path=${encodeURIComponent(parentPath)}` : '';
  return request<{ path: string; folders: string[] | null }>(`/folders${qs}`);
}

export function deleteFolder(folderPath: string, recursive: boolean): Promise<{ folder_deleted: string; files_deleted: number }> {
  return request(`/folders?path=${encodeURIComponent(folderPath)}&recursive=${recursive}`, {
    method: 'DELETE',
  });
}

export function moveFile(source: string, destination: string): Promise<{ source: string; destination: string }> {
  return request('/files/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination }),
  });
}

export function moveFolder(source: string, destination: string): Promise<{ source: string; destination: string; files_moved: number }> {
  return request('/folders/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination }),
  });
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

export interface Workspace {
  workspace_id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  role: string;
}

export interface WorkspaceMember {
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joined_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  expires_at: string;
}

export interface UserInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  email: string;
  token: string;
  role: 'admin' | 'editor' | 'viewer';
  expires_at: string;
}

export function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/workspaces/list');
}

export function createWorkspace(name: string, slug: string): Promise<unknown> {
  return request('/workspaces/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug }),
  });
}

export function deleteWorkspace(workspaceId: string): Promise<unknown> {
  return request(`/workspaces/delete?workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
  });
}

export function renameWorkspace(workspaceId: string, name: string, slug?: string): Promise<Workspace> {
  return request<Workspace>('/workspaces/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name, ...(slug ? { slug } : {}) }),
  });
}

export function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return request<WorkspaceMember[]>(`/workspaces/members?workspace_id=${encodeURIComponent(workspaceId)}`);
}

export function removeWorkspaceMember(workspaceId: string, userId: string): Promise<unknown> {
  return request(`/workspaces/members/remove?workspace_id=${encodeURIComponent(workspaceId)}&user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export function changeMemberRole(workspaceId: string, userId: string, role: 'owner' | 'admin' | 'editor' | 'viewer'): Promise<unknown> {
  return request('/workspaces/members/role', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, user_id: userId, role }),
  });
}

export function getWorkspaceInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  return request<WorkspaceInvite[]>(`/workspaces/invites?workspace_id=${encodeURIComponent(workspaceId)}`);
}

export function createWorkspaceInvite(workspaceId: string, email: string, role: 'admin' | 'editor' | 'viewer'): Promise<WorkspaceInvite> {
  return request<WorkspaceInvite>('/workspaces/invites/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, email, role }),
  });
}

export function deleteWorkspaceInvite(inviteId: string, workspaceId: string): Promise<unknown> {
  return request(`/workspaces/invites/delete?invite_id=${encodeURIComponent(inviteId)}&workspace_id=${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
  });
}

export function getMyInvites(): Promise<UserInvite[]> {
  return request<UserInvite[]>('/workspaces/invites/mine');
}

export function acceptInvite(token: string): Promise<unknown> {
  return request('/workspaces/invites/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export function rejectInvite(token: string): Promise<unknown> {
  return request(`/workspaces/invites/reject?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
}

export interface WorkspaceQuota {
  file_count: number;
  total_bytes: number;
  folder_count: number;
  member_count: number;
  api_key_count: number;
  max_files_workspace: number;
  max_total_storage_bytes_workspace: number;
  max_users_workspace: number;
  max_workspace_folders: number;
  max_workspace_api_keys: number;
}

export function getWorkspaceQuota(workspaceId: string): Promise<WorkspaceQuota> {
  return request<WorkspaceQuota>(`/workspaces/${encodeURIComponent(workspaceId)}/quota`);
}

export interface WorkspaceAPIKey {
  id: string;
  name: string;
  description: string;
  status: string;
  scopes: string[];
  created_by: string;
  created_at: string;
  last_used_at?: string | null;
}

export interface CreatedWorkspaceAPIKey {
  id: string;
  name: string;
  description: string;
  key: string;
  scopes: string[];
  workspace_id: string;
  created_by: string;
  created_at: string;
}

export type PrivateAPIKey = WorkspaceAPIKey;

export interface CreatedPrivateAPIKey {
  id: string;
  name: string;
  description: string;
  key: string;
  scopes: string[];
  user_id: string;
  created_by: string;
  created_at: string;
}

export function listWorkspaceAPIKeys(workspaceId: string): Promise<{ api_keys: WorkspaceAPIKey[] }> {
  return request<{ api_keys: WorkspaceAPIKey[] }>(`/api_keys/${encodeURIComponent(workspaceId)}/list`);
}

export function createWorkspaceAPIKey(
  workspaceId: string,
  payload: { name: string; description: string; scopes: string[] },
): Promise<{ api_key: CreatedWorkspaceAPIKey }> {
  return request<{ api_key: CreatedWorkspaceAPIKey }>(`/api_keys/${encodeURIComponent(workspaceId)}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteWorkspaceAPIKey(workspaceId: string, apiKeyId: string): Promise<void> {
  return request<void>(`/api_keys/${encodeURIComponent(workspaceId)}/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key_id: apiKeyId }),
  });
}

export function listPrivateAPIKeys(): Promise<{ api_keys: PrivateAPIKey[] }> {
  return request<{ api_keys: PrivateAPIKey[] }>('/api_keys/private/list');
}

export function createPrivateAPIKey(
  payload: { name: string; description: string; scopes: string[] },
): Promise<{ api_key: CreatedPrivateAPIKey }> {
  return request<{ api_key: CreatedPrivateAPIKey }>('/api_keys/private/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deletePrivateAPIKey(apiKeyId: string): Promise<void> {
  return request<void>('/api_keys/private/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key_id: apiKeyId }),
  });
}

// ─── Workspace Files ─────────────────────────────────────────────────────────

export interface WorkspaceFileEntry {
  id: string;
  name: string;
  file_type: string;
  size: number;
  md5_checksum: string;
  uploaded_by: string;
  uploaded_by_email: string;
  created_at: string;
}

export interface WorkspaceFolderEntry {
  name: string;
  size: number;
  created_by_email?: string;
  created_at?: string;
}

export interface WorkspaceFilesTree {
  path: string;
  files: WorkspaceFileEntry[] | null;
  folders: WorkspaceFolderEntry[] | null;
}

export interface WorkspaceFolderResult {
  id: string;
  workspace_id: string;
  name: string;
  path: string;
  created_by: string;
  created_at: string;
}

export function getWorkspaceFilesTree(workspaceId: string, path?: string): Promise<WorkspaceFilesTree> {
  const qs = path && path !== '/' ? `?path=${encodeURIComponent(path)}` : '';
  return request<WorkspaceFilesTree>(`/workspaces/${encodeURIComponent(workspaceId)}/files/tree${qs}`);
}

export function uploadWorkspaceFile(
  workspaceId: string,
  file: File,
  folder?: string,
  options: UploadFileOptions = {},
): Promise<CompleteMultipartUploadResponse> {
  return uploadMultipartFile(file, folder, options, workspaceMultipartUploadPaths(workspaceId));
}

export function mkdirWorkspace(workspaceId: string, folderName: string, parentPath: string): Promise<WorkspaceFolderResult> {
  return request<WorkspaceFolderResult>(`/workspaces/${encodeURIComponent(workspaceId)}/files/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_name: folderName, parent_path: parentPath }),
  });
}

export function deleteWorkspaceFile(workspaceId: string, fileId: string): Promise<unknown> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/files/delete?file_id=${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

export function deleteWorkspaceFolder(workspaceId: string, folderPath: string): Promise<unknown> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/files/folder/delete?path=${encodeURIComponent(folderPath)}`, {
    method: 'DELETE',
  });
}

export function moveWorkspaceFile(workspaceId: string, fileId: string, destination: string): Promise<unknown> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/files/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, destination }),
  });
}

export function moveWorkspaceFolder(workspaceId: string, source: string, destination: string): Promise<unknown> {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/files/folder/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, destination }),
  });
}

export function getWorkspaceFileDownloadUrl(workspaceId: string, fileId: string, mode: 'inline' | 'download' = 'download'): string {
  return `${API_BASE}/workspaces/${encodeURIComponent(workspaceId)}/files/download?file_id=${encodeURIComponent(fileId)}&mode=${mode}`;
}

