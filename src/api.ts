const API_BASE = import.meta.env.VITE_API_BASE ?? '';

interface ApiEnvelope {
  status: number;
  msg?: string;
  response: unknown;
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
    throw new ApiError(res.status, body);
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
    return text as unknown as T;
  }
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`);
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

export function getLoginUrl(): string {
  return `${API_BASE}/auth/oauth`;
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

export function uploadFile(file: File): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append('file', file);
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
