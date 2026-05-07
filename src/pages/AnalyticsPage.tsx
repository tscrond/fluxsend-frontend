import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getUserStats, listWorkspaces, getWorkspaceQuota, type UserStats, type Workspace, type WorkspaceQuota } from '@/api';
import {
  Typography,
  Paper,
  LinearProgress,
  CircularProgress,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import {
  HardDrive,
  Upload,
  Share2,
  Inbox,
  LayoutGrid,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// int32 max is used as a sentinel for "unlimited" in the DB
const INT32_MAX = 2_147_483_647;
function planCap(val: number | undefined): number {
  if (!val || val <= 0 || val >= INT32_MAX) return 0;
  return val;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function pct(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function progressColor(p: number): 'error' | 'warning' | 'success' {
  if (p >= 90) return 'error';
  if (p >= 70) return 'warning';
  return 'success';
}

interface QuotaBarProps {
  label: string;
  used: number;
  max: number;
  formatFn?: (v: number) => string;
}

function QuotaBar({ label, used, max, formatFn }: QuotaBarProps) {
  const p = pct(used, max);
  const fmt = formatFn ?? ((v) => String(v));
  const isUnlimited = max <= 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {fmt(used)} {isUnlimited ? '/ ∞' : `/ ${fmt(max)}`}
          {!isUnlimited && (
            <span
              style={{
                marginLeft: 6,
                color: p >= 90 ? '#ef4444' : p >= 70 ? '#f59e0b' : '#22c55e',
                fontWeight: 600,
              }}
            >
              ({p}%)
            </span>
          )}
        </Typography>
      </div>
      {!isUnlimited && (
        <LinearProgress
          variant="determinate"
          value={p}
          color={progressColor(p)}
          sx={{ height: 6, borderRadius: 3 }}
        />
      )}
    </div>
  );
}

interface WorkspaceQuotaCardProps {
  workspace: Workspace;
  quota: WorkspaceQuota;
}

function WorkspaceQuotaCard({ workspace, quota }: WorkspaceQuotaCardProps) {
  return (
    <Paper variant="outlined" className="p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-slate-500" />
          <Typography variant="subtitle2" fontWeight={700}>{workspace.name}</Typography>
        </div>
        <Chip
          label={workspace.role}
          size="small"
          variant="outlined"
          color={workspace.role === 'owner' ? 'primary' : 'default'}
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      </div>
      <QuotaBar
        label="Storage"
        used={quota.total_bytes}
        max={quota.max_total_storage_bytes_workspace}
        formatFn={formatBytes}
      />
      <QuotaBar
        label="Files"
        used={quota.file_count}
        max={quota.max_files_workspace}
      />
      <QuotaBar
        label="Members"
        used={quota.member_count}
        max={quota.max_users_workspace}
      />
      <QuotaBar
        label="Folders"
        used={quota.folder_count}
        max={quota.max_workspace_folders}
      />
    </Paper>
  );
}

function mergeDailyActivity(
  uploads: { day: string; uploads?: number }[],
  shares: { day: string; shares?: number }[],
): { day: string; uploads: number; shares: number }[] {
  // Build a map keyed by day, filling in all days from the last 7
  const map = new Map<string, { uploads: number; shares: number }>();

  // Seed the last 7 days so all bars appear even with 0 activity
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { uploads: 0, shares: 0 });
  }

  for (const u of uploads) {
    const key = u.day.slice(0, 10);
    const existing = map.get(key) ?? { uploads: 0, shares: 0 };
    map.set(key, { ...existing, uploads: u.uploads ?? 0 });
  }
  for (const s of shares) {
    const key = s.day.slice(0, 10);
    const existing = map.get(key) ?? { uploads: 0, shares: 0 };
    map.set(key, { ...existing, shares: s.shares ?? 0 });
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, vals]) => ({
      day: new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      uploads: vals.uploads,
      shares: vals.shares,
    }));
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsQuotas, setWsQuotas] = useState<Record<string, WorkspaceQuota>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, wsData] = await Promise.all([getUserStats(), listWorkspaces()]);
      setStats(statsData);

      // Only fetch quota for owned workspaces
      const ownedWorkspaces = wsData.filter((ws) => ws.role === 'owner');
      setWorkspaces(ownedWorkspaces);

      const quotaResults = await Promise.all(
        ownedWorkspaces.map((ws) =>
          getWorkspaceQuota(ws.workspace_id).then((q) => ({ id: ws.workspace_id, quota: q })).catch(() => null),
        ),
      );
      const quotaMap: Record<string, WorkspaceQuota> = {};
      for (const r of quotaResults) {
        if (r) quotaMap[r.id] = r.quota;
      }
      setWsQuotas(quotaMap);
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxStorage = user?.max_total_storage_bytes ?? 0;
  const maxFiles = planCap(user?.max_files);
  const maxFilesSentPerDay = planCap(user?.max_files_sent_per_day);
  const maxSharesPerDay = planCap(user?.max_shares_per_day);
  const maxUserWorkspaces = planCap(user?.max_user_workspaces);

  const chartData = stats
    ? mergeDailyActivity(stats.daily_uploads ?? [], stats.daily_shares ?? [])
    : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress size={36} />
      </div>
    );
  }

  if (error) {
    return <Alert severity="error" className="mb-4">{error}</Alert>;
  }

  if (!stats) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Typography variant="h5" fontWeight={700}>Analytics</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Your storage and usage overview
        </Typography>
      </div>

      {/* Plan banner */}
      <div className="flex items-center gap-3 mb-5">
        <Chip
          label={`Plan: ${user?.plan_name ?? 'Free'}`}
          color="primary"
          variant="outlined"
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          All limits apply to your personal storage. Workspace limits are set per workspace.
        </Typography>
      </div>

      {/* ─── Personal Storage Quota ─── */}
      <Paper variant="outlined" className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={700}>Personal Storage</Typography>
        </div>
        <QuotaBar
          label="Total storage used"
          used={stats.total_bytes}
          max={maxStorage}
          formatFn={formatBytes}
        />
        <QuotaBar label="Total files" used={stats.total_files} max={maxFiles} />
        <Divider sx={{ my: 2 }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip icon={<Upload size={14} />} label="Uploads today" value={stats.files_today} cap={maxFilesSentPerDay} />
          <StatChip icon={<Upload size={14} />} label="Uploads last 7d" value={stats.files_last_7d} />
          <StatChip icon={<Upload size={14} />} label="Uploads last 30d" value={stats.files_last_30d} />
          <StatChip icon={<Inbox size={14} />} label="Received" value={stats.total_received} />
        </div>
      </Paper>

      {/* ─── Sharing Quota ─── */}
      <Paper variant="outlined" className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Share2 size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={700}>Sharing</Typography>
        </div>
        <QuotaBar label="Shares sent today" used={stats.shares_today} max={maxSharesPerDay} />
        <Divider sx={{ my: 2 }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip icon={<Share2 size={14} />} label="Total sent" value={stats.total_shares_sent} />
          <StatChip icon={<Activity size={14} />} label="Active shares" value={stats.active_shares} />
          <StatChip icon={<Share2 size={14} />} label="Direct shares" value={stats.targeted_shares} />
          <StatChip icon={<Share2 size={14} />} label="Public links" value={stats.public_shares} />
        </div>
      </Paper>

      {/* ─── Workspaces Quota ─── */}
      <Paper variant="outlined" className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={700}>Workspaces</Typography>
        </div>
        <QuotaBar
          label="Owned workspaces"
          used={stats.owned_workspaces}
          max={maxUserWorkspaces}
        />
        {workspaces.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You don't own any workspaces yet.
          </Typography>
        ) : (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" className="mb-3 block">
              Per-workspace usage (owned)
            </Typography>
            {workspaces.map((ws) =>
              wsQuotas[ws.workspace_id] ? (
                <WorkspaceQuotaCard key={ws.workspace_id} workspace={ws} quota={wsQuotas[ws.workspace_id]} />
              ) : null,
            )}
          </>
        )}
      </Paper>

      {/* ─── Activity Chart ─── */}
      <Paper variant="outlined" className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-slate-500" />
          <Typography variant="subtitle1" fontWeight={700}>Activity — Last 7 days</Typography>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
            <RechartsTooltip
              contentStyle={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="uploads" name="Uploads" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="shares" name="Shares sent" fill="#22d3ee" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>
    </div>
  );
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  cap?: number;
}

function StatChip({ icon, label, value, cap }: StatChipProps) {
  const atLimit = cap !== undefined && cap > 0 && value >= cap;
  const nearLimit = cap !== undefined && cap > 0 && !atLimit && value / cap >= 0.7;
  return (
    <Paper
      variant="outlined"
      className="p-3 flex flex-col gap-1"
      sx={{ borderColor: atLimit ? 'error.main' : nearLimit ? 'warning.main' : undefined }}
    >
      <div className="flex items-center gap-1" style={{ color: atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : 'inherit' }}>
        {icon}
        <Typography variant="caption" color="inherit" sx={{ lineHeight: 1.2 }}>{label}</Typography>
      </div>
      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, color: atLimit ? 'error.main' : 'text.primary' }}>
        {value.toLocaleString()}
      </Typography>
      {cap !== undefined && cap > 0 && (
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.65rem',
            color: atLimit ? 'error.main' : nearLimit ? 'warning.main' : 'text.secondary',
            fontWeight: atLimit || nearLimit ? 700 : 400,
          }}
        >
          of {cap.toLocaleString()} limit
        </Typography>
      )}
    </Paper>
  );
}
