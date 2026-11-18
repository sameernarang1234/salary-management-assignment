import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 4,
      }}
    >
      <Box>
        <Typography variant="h1">{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
          {description}
        </Typography>
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>{actions}</Box>}
    </Box>
  );
}
