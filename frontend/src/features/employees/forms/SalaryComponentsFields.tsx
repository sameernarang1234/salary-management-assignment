import { Box, InputAdornment, TextField, Typography } from '@mui/material';
import type { SalaryComponentCode, SalaryComponentType } from '../../../api/types';
import type { ComponentAmounts, ComponentErrors } from './salaryForm';

/** One amount field per component in the catalogue. Basic is required; allowances are optional. */
export function SalaryComponentsFields({
  catalogue,
  amounts,
  errors,
  currency,
  onChange,
}: {
  catalogue: readonly SalaryComponentType[];
  amounts: ComponentAmounts;
  errors: ComponentErrors;
  currency?: string;
  onChange: (code: SalaryComponentCode, value: string) => void;
}) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Annual amounts{currency ? ` in ${currency}` : ''}. Basic is required; leave allowances empty
        if they don't apply.
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {catalogue.map(({ code, name }) => (
          <TextField
            key={code}
            label={name}
            value={amounts[code] ?? ''}
            onChange={(event) => onChange(code, event.target.value)}
            error={Boolean(errors[code])}
            helperText={errors[code]}
            slotProps={{
              htmlInput: { inputMode: 'numeric', autoComplete: 'off' },
              input: currency
                ? { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> }
                : {},
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
