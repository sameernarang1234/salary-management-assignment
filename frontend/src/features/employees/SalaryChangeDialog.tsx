import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useChangeSalaryMutation, useGetMetaQuery } from '../../api/api';
import { errorMessage, fieldErrors } from '../../api/errors';
import type { EmployeeDetails, SalaryChangeReason, SalaryComponent } from '../../api/types';
import { useAppDispatch } from '../../app/hooks';
import { ResponsiveDialog } from '../../components/ResponsiveDialog';
import { todayIso } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { REASON_LABELS } from '../../lib/labels';
import { notify } from '../notifications/notificationsSlice';
import { validateSalaryChange } from './forms/employeeForm';
import { SalaryComponentsFields } from './forms/SalaryComponentsFields';
import {
  amountsFromComponents,
  componentErrorsFromServer,
  componentsFromAmounts,
  isSameSalary,
  totalOf,
  type ComponentAmounts,
  type ComponentErrors,
} from './forms/salaryForm';

/** Change an employee's salary: new components, when it takes effect, and why. */
export function SalaryChangeDialog({
  employee,
  onClose,
}: {
  employee: EmployeeDetails;
  onClose: () => void;
}) {
  const meta = useGetMetaQuery();
  const dispatch = useAppDispatch();
  const [changeSalary, { isLoading }] = useChangeSalaryMutation();

  const [amounts, setAmounts] = useState<ComponentAmounts>(
    amountsFromComponents(employee.salaryComponents),
  );
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [reason, setReason] = useState<SalaryChangeReason | ''>('');
  const [componentErrors, setComponentErrors] = useState<ComponentErrors>({});
  const [fieldError, setFieldError] = useState<{ effectiveDate?: string; reason?: string }>({});
  const [salaryError, setSalaryError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const newTotal = totalOf(amounts);
  const difference = newTotal - employee.totalSalary;
  const differenceText =
    difference === 0
      ? 'no change'
      : `${difference > 0 ? '+' : '−'}${formatMoney(Math.abs(difference), employee.currency)}`;

  const showServerErrors = (error: unknown, submitted: SalaryComponent[]) => {
    const fields = fieldErrors(error);
    const { byCode, general } = componentErrorsFromServer(fields, submitted);
    setComponentErrors(byCode);
    setSalaryError(general);
    const serverFieldErrors = { effectiveDate: fields.effectiveDate, reason: fields.reason };
    setFieldError(serverFieldErrors);
    const hasFieldErrors =
      Object.keys(byCode).length > 0 || general || fields.effectiveDate || fields.reason;
    setFormError(hasFieldErrors ? undefined : errorMessage(error));
  };

  const submit = async () => {
    setFormError(undefined);
    setSalaryError(undefined);
    const { components, errors } = componentsFromAmounts(
      amounts,
      meta.data?.salaryComponents ?? [],
    );
    const otherErrors = validateSalaryChange(
      { effectiveDate, reason },
      { today: todayIso(), hireDate: employee.hireDate },
    );
    setComponentErrors(errors);
    setFieldError(otherErrors);
    if (Object.keys(errors).length > 0 || Object.keys(otherErrors).length > 0 || !reason) {
      return;
    }
    if (isSameSalary(employee.salaryComponents, components)) {
      setSalaryError('The new salary is the same as the current salary');
      return;
    }
    try {
      await changeSalary({
        id: employee.id,
        change: { components, effectiveDate, reason },
      }).unwrap();
      dispatch(notify({ message: 'Salary updated', severity: 'success' }));
      onClose();
    } catch (error) {
      showServerErrors(error, components);
    }
  };

  return (
    <ResponsiveDialog
      open
      title="Change salary"
      submitLabel="Save new salary"
      submitting={isLoading}
      onClose={onClose}
      onSubmit={submit}
    >
      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {employee.fullName} currently earns{' '}
        <strong>{formatMoney(employee.totalSalary, employee.currency)}</strong> a year. The change
        is recorded in their salary history and cannot be edited later.
      </Typography>

      <SalaryComponentsFields
        catalogue={meta.data?.salaryComponents ?? []}
        amounts={amounts}
        errors={componentErrors}
        currency={employee.currency}
        onChange={(code, value) => setAmounts((current) => ({ ...current, [code]: value }))}
      />
      <Typography sx={{ mt: 2, fontWeight: 600 }}>
        New total: {formatMoney(newTotal, employee.currency)} ({differenceText})
      </Typography>
      {salaryError && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {salaryError}
        </Typography>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mt: 3 }}
      >
        <TextField
          label="Effective date"
          type="date"
          value={effectiveDate}
          onChange={(event) => setEffectiveDate(event.target.value)}
          error={Boolean(fieldError.effectiveDate)}
          helperText={fieldError.effectiveDate}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: employee.hireDate, max: todayIso() },
          }}
        />
        <TextField
          select
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as SalaryChangeReason)}
          error={Boolean(fieldError.reason)}
          helperText={fieldError.reason}
        >
          {(meta.data?.salaryChangeReasons ?? []).map((option) => (
            <MenuItem key={option} value={option}>
              {REASON_LABELS[option]}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </ResponsiveDialog>
  );
}
