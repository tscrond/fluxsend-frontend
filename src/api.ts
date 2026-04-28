const API_BASE = import.meta.env.VITE_API_BASE ?? '';

interface ApiEnvelope {
  status: number;
  msg?: string;
  response: unknown;
}

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

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body, getApiErrorMessage(res.status, body));
  }

  // Backend may return JSON with text/plain content-type, so try parsing body as JSON
  const text = await res.text();
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
      throw new ApiError(res.status, 'Unexpected HTML response from API route');
    }
    return text as unknown as T;
  }
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

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

// ─── User ───────────────────────────────────────────────────────────────────

export interface UserData {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  provider: string;
}

export interface UserDataResponse {
  user_data: UserData;
}

export function getUserData(): Promise<UserDataResponse> {
  return request<UserDataResponse>('/user/data');
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

export function uploadFile(file: File, folder?: string): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (folder) formData.append('folder', folder);
  return request<{ message: string }>('/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export function deleteFile(fileName: string): Promise<{ file_deleted: string }> {
  return request<{ file_deleted: string }>(
    `/files/delete?file=${encodeURIComponent(fileName)}`,
    { method: 'DELETE' },
  );
}

export interface BatchDeleteFilesResponse {
  files_deleted: string[];
  files_failed: string[];
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

export function renameWorkspace(workspaceId: string, name: string): Promise<Workspace> {
  return request<Workspace>('/workspaces/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
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

