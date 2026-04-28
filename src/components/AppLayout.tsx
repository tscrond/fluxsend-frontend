import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import { getUnseenReceivedCount, getMyInvites } from '@/api';
import {
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  List,
  ListItemButton,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Upload,
  FolderOpen,
  Share2,
  Inbox,
  Settings,
  LogOut,
  Menu as MenuIcon,
  Sun,
  Moon,
  LayoutGrid,
} from 'lucide-react';

const DRAWER_WIDTH = 240;

const navItems = [
  { to: '/files', label: 'My Files', icon: FolderOpen },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/shared', label: 'Shared by Me', icon: Share2 },
  { to: '/received', label: 'Received', icon: Inbox },
  { to: '/workspaces', label: 'Workspaces', icon: LayoutGrid },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const fetchUnseenCount = useCallback(async () => {
    try {
      const { count } = await getUnseenReceivedCount();
      setUnseenCount(count);
    } catch {
      // silently ignore
    }
  }, []);

  const fetchPendingInviteCount = useCallback(async () => {
    try {
      const invites = await getMyInvites();
      setPendingInviteCount(invites.length);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Fetch counts on mount, window focus, and invite-changed events
  useEffect(() => {
    fetchUnseenCount();
    fetchPendingInviteCount();
    const onFocus = () => { fetchUnseenCount(); fetchPendingInviteCount(); };
    const onInvitesChanged = () => fetchPendingInviteCount();
    window.addEventListener('focus', onFocus);
    window.addEventListener('invites-changed', onInvitesChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('invites-changed', onInvitesChanged);
    };
  }, [fetchUnseenCount, fetchPendingInviteCount]);

  // Re-fetch when navigating away from received/workspaces pages
  useEffect(() => {
    if (location.pathname !== '/received') {
      fetchUnseenCount();
    }
    if (location.pathname !== '/workspaces') {
      fetchPendingInviteCount();
    }
  }, [location.pathname, fetchUnseenCount, fetchPendingInviteCount]);

  const drawerContent = (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center px-4 pt-4 pb-3 gap-2">
        <img src="/fs.png" alt="FluxSend logo" className="h-8 w-8" />
        {/* <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: 'text.primary', letterSpacing: '0.04em', fontFamily: 'monospace' }}>fluxsend</Typography> */}
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{ letterSpacing: '-0.02em' }}
        >
          FLUX<span style={{ color: '#6366f1' }}>SEND</span>
        </Typography>
      </div>
      <List className="flex-1 px-2">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="no-underline">
            {({ isActive }) => (
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  pl: isActive ? 1.5 : 2,
                  borderLeft: isActive ? '3px solid' : '3px solid transparent',
                  borderColor: isActive ? 'primary.main' : 'transparent',
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'action.selected' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  {item.to === '/received' && unseenCount > 0 ? (
                    <Badge badgeContent={unseenCount} color="error" max={99}>
                      <item.icon size={18} />
                    </Badge>
                  ) : item.to === '/workspaces' && pendingInviteCount > 0 ? (
                    <Badge badgeContent={pendingInviteCount} color="warning" max={99}>
                      <item.icon size={18} />
                    </Badge>
                  ) : (
                    <item.icon size={18} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700 }}
                />
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>
      <Divider />
      <List className="px-2 pb-2">
        <NavLink to="/settings" className="no-underline">
          {({ isActive }) => (
            <ListItemButton
              selected={isActive}
              sx={{
                borderRadius: 1,
                pl: isActive ? 1.5 : 2,
                borderLeft: isActive ? '3px solid' : '3px solid transparent',
                borderColor: isActive ? 'primary.main' : 'transparent',
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                  color: 'primary.main',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                <Settings size={18} />
              </ListItemIcon>
              <ListItemText
                primary="Settings"
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 700 }}
              />
            </ListItemButton>
          )}
        </NavLink>
      </List>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid', borderColor: 'divider' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col min-h-screen">
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon size={20} />
              </IconButton>
            )}
            <div className="flex-1" />
            <IconButton onClick={toggleMode} size="small" sx={{ mr: 1 }}>
              {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar
                src={user?.picture}
                alt={user?.given_name}
                imgProps={{ referrerPolicy: 'no-referrer' }}
                sx={{ width: 32, height: 32 }}
              >
                {user?.given_name?.[0] ?? '?'}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { width: 240, mt: 1 } } }}
            >
              <Box className="px-4 py-3">
                <Typography variant="subtitle2">{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
                <ListItemIcon><LogOut size={16} /></ListItemIcon>
                <ListItemText>Sign out</ListItemText>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 p-6 max-md:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
