export const DATA_REFRESH_EVENT = 'fluxsend:data-refresh';

export interface DataRefreshDetail {
  personalFiles?: boolean;
  analytics?: boolean;
  workspaceId?: string;
  workspaceFiles?: boolean;
  workspaceQuota?: boolean;
}

export function emitDataRefresh(detail: DataRefreshDetail): void {
  window.dispatchEvent(new CustomEvent<DataRefreshDetail>(DATA_REFRESH_EVENT, { detail }));
}

export function onDataRefresh(listener: (detail: DataRefreshDetail) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<DataRefreshDetail>;
    listener(customEvent.detail ?? {});
  };

  window.addEventListener(DATA_REFRESH_EVENT, handler);
  return () => window.removeEventListener(DATA_REFRESH_EVENT, handler);
}