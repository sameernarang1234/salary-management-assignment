import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { api, useLogoutMutation } from '../api/api';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { pageTitle } from './pageTitle';

const DRAWER_WIDTH = 300;

const NAV_ITEMS = [
  { to: '/', label: 'Pay insights', icon: <InsightsRoundedIcon /> },
  { to: '/employees', label: 'Employees', icon: <GroupsRoundedIcon /> },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const email = useAppSelector((state) => state.session.user?.email);
  const dispatch = useAppDispatch();
  const [logout, { isLoading }] = useLogoutMutation();

  const signOut = async () => {
    await logout()
      .unwrap()
      .catch(() => undefined);
    // Drop all cached salary data from memory once signed out.
    dispatch(api.util.resetApiState());
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 3.5, pt: 4, pb: 3 }}>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 600 }}>
          ACME Corporation
        </Typography>
        <Typography
          component="p"
          sx={{ fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}
        >
          Salary Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage salaries and understand how the organisation pays people.
        </Typography>
      </Box>
      <Divider />
      <List component="nav" aria-label="Main navigation" sx={{ px: 2, py: 2 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            sx={{
              borderRadius: 999,
              mb: 0.5,
              py: 1.25,
              '&.active': {
                bgcolor: 'rgba(139, 90, 43, 0.12)',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 44 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontSize: '1.05rem' } } }}
            />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto' }}>
        <Divider />
        <Box sx={{ px: 3.5, py: 2.5 }}>
          <Typography sx={{ fontWeight: 600 }}>HR Manager</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
            {email}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<LogoutRoundedIcon />}
            onClick={signOut}
            disabled={isLoading}
            sx={{ mt: 1.5 }}
          >
            Sign out
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

/** Sidebar (permanent on desktop, a drawer on phones), a sticky top bar and the page. */
export function AppLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  const paperSx = {
    width: DRAWER_WIDTH,
    bgcolor: 'background.paper',
    borderRight: '1px solid',
    borderColor: 'divider',
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer variant="permanent" open slotProps={{ paper: { sx: paperSx } }}>
            <Sidebar />
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: paperSx } }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255, 253, 248, 0.92)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: { xs: 72, md: 80 } }}>
            {!isDesktop && (
              <IconButton
                edge="start"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Box>
              <Typography variant="body2" color="text.secondary">
                HR workspace
              </Typography>
              <Typography
                data-testid="page-title"
                sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.35rem' } }}
              >
                {pageTitle(pathname)}
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>
        <Box
          component="main"
          sx={{ px: { xs: 2, sm: 3, md: 5 }, py: { xs: 3, md: 5 }, maxWidth: 1440, mx: 'auto' }}
        >
          <Suspense fallback={<LinearProgress aria-label="Loading page" />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
