import { createElement, type ReactNode } from 'react';
import {
  Image,
  Film,
  Music,
  FileText,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getFileIcon(contentType: string): ReactNode {
  const type = contentType.toLowerCase();
  const iconNode = (Icon: LucideIcon) => createElement(Icon, { className: 'w-5 h-5' });

  if (type.startsWith('image/')) return iconNode(Image);
  if (type.startsWith('video/')) return iconNode(Film);
  if (type.startsWith('audio/')) return iconNode(Music);
  if (type.includes('pdf')) return iconNode(FileText);

  if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) {
    return iconNode(FileArchive);
  }

  if (type.includes('text')) return iconNode(FileText);
  if (type.includes('spreadsheet') || type.includes('excel')) return iconNode(FileSpreadsheet);
  if (type.includes('presentation') || type.includes('powerpoint')) return iconNode(Presentation);
  if (type.includes('document') || type.includes('word')) return iconNode(FileText);

  return iconNode(Paperclip);
}

export function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}
