import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useLoginMutation } from '../../api/api';
import { errorMessage } from '../../api/errors';
import { useSession } from '../../app/hooks';
import { validateLogin, type LoginErrors } from './loginForm';

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  if (session.status === 'unknown') {
    return <LinearProgress aria-label="Checking your session" />;
  }
  if (session.status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateLogin({ email, password });
    setErrors(found);
    if (Object.keys(found).length === 0) {
      // Errors are shown from the mutation state; nothing else to do here.
      login({ email: email.trim(), password }).catch(() => undefined);
    }
  };

  return (
    <Box
      component="main"
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 600 }}>
            ACME Corporation · Salary Management
          </Typography>
          <Typography variant="h1" sx={{ mt: 1 }}>
            Sign in
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            For the HR Manager. Salary data is confidential.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(error)}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={submit} sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={Boolean(errors.email)}
              helperText={errors.email}
              fullWidth
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={Boolean(errors.password)}
              helperText={errors.password}
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
