import { Card, CardContent, Skeleton, Typography } from '@mui/material';
import { useId } from 'react';

/** A headline figure. A labelled group, so screen readers announce "Headcount, 9,547". */
export function StatCard({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  const labelId = useId();
  return (
    <Card role="group" aria-labelledby={labelId} sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography id={labelId} variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography
          sx={{ fontSize: { xs: '1.8rem', md: '2.1rem' }, fontWeight: 700, lineHeight: 1.2, mt: 1 }}
        >
          {loading ? <Skeleton width="70%" /> : value}
        </Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
