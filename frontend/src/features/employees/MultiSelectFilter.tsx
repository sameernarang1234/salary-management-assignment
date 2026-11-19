import { Checkbox, ListItemText, MenuItem, TextField } from '@mui/material';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * A filter where several values can be ticked at once. The chosen values are kept in the
 * options' order, so the URL stays the same however they were clicked.
 */
export function MultiSelectFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  /** Shown when nothing is ticked, e.g. "All countries". */
  allLabel: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const labelOf = new Map(options.map((option) => [option.value, option.label]));
  // Until the options arrive, show "All …" rather than values the menu doesn't know yet.
  const value = options.length > 0 ? [...selected] : [];

  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => {
        const raw = event.target.value as unknown as string[] | string;
        const chosen = new Set(typeof raw === 'string' ? raw.split(',') : raw);
        onChange(
          options.filter((option) => chosen.has(option.value)).map((option) => option.value),
        );
      }}
      slotProps={{
        inputLabel: { shrink: true },
        select: {
          multiple: true,
          displayEmpty: true,
          renderValue: (values) => {
            const chosen = values as unknown as string[];
            return chosen.length === 0
              ? allLabel
              : chosen.map((item) => labelOf.get(item) ?? item).join(', ');
          },
          MenuProps: { slotProps: { paper: { sx: { maxHeight: 360 } } } },
        },
      }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} dense>
          <Checkbox
            size="small"
            checked={selected.includes(option.value)}
            tabIndex={-1}
            disableRipple
            sx={{ py: 0, pl: 0 }}
          />
          <ListItemText primary={option.label} />
        </MenuItem>
      ))}
    </TextField>
  );
}
