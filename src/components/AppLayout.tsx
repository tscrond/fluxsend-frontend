import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
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
} from 'lucide-react';

const DRAWER_WIDTH = 260;

const navItems = [
  { to: '/files', label: 'My Files', icon: FolderOpen },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/shared', label: 'Shared by Me', icon: Share2 },
  { to: '/received', label: 'Received', icon: Inbox },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const drawerContent = (
    <div className="flex flex-col h-full">
      <div className="flex flex-row items-center px-5 pt-5 pb-3">
        <img src="/fs.png" alt="FluxSend logo" className="h-16 w-16" />
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: 'text.primary' }}>FluxSend</Typography>
      </div>
      <List className="flex-1 px-3">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className="no-underline">
            {({ isActive }) => (
              <ListItemButton
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.100' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  <item.icon size={18} />
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
      <List className="px-3 pb-3">
        <NavLink to="/settings" className="no-underline">
          {({ isActive }) => (
            <ListItemButton
              selected={isActive}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
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
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
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

        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 p-8 max-md:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
