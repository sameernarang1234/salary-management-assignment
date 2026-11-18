import { Alert, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useMarkEmployeeLeftMutation } from '../../api/api';
import { errorMessage, fieldErrors } from '../../api/errors';
import type { EmployeeDetails } from '../../api/types';
import { useAppDispatch } from '../../app/hooks';
import { ResponsiveDialog } from '../../components/ResponsiveDialog';
import { todayIso } from '../../lib/dates';
import { notify } from '../notifications/notificationsSlice';
import { validateLeaving } from './forms/employeeForm';

/** Employees are never deleted: leaving keeps their record and salary history. */
export function MarkLeftDialog({
  employee,
  onClose,
}: {
  employee: EmployeeDetails;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [markLeft, { isLoading }] = useMarkEmployeeLeftMutation();
  const [leftOn, setLeftOn] = useState(todayIso());
  const [dateError, setDateError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const submit = async () => {
    setFormError(undefined);
    const error = validateLeaving(leftOn, { today: todayIso(), hireDate: employee.hireDate });
    setDateError(error);
    if (error) {
      return;
    }
    try {
      await markLeft({ id: employee.id, leftOn }).unwrap();
      dispatch(notify({ message: `${employee.fullName} marked as left`, severity: 'success' }));
      onClose();
    } catch (serverError) {
      const fields = fieldErrors(serverError);
      setDateError(fields.leftOn);
      setFormError(fields.leftOn ? undefined : errorMessage(serverError));
    }
  };

  return (
    <ResponsiveDialog
      open
      title="Mark as left"
      submitLabel="Mark as left"
      submitting={isLoading}
      onClose={onClose}
      onSubmit={submit}
    >
      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}
      <Typography sx={{ mb: 3 }}>
        {employee.fullName} will leave the active directory, insights and exports. Their record and
        salary history are kept.
      </Typography>
      <TextField
        label="Leaving date"
        type="date"
        value={leftOn}
        onChange={(event) => setLeftOn(event.target.value)}
        error={Boolean(dateError)}
        helperText={dateError}
        fullWidth
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: employee.hireDate, max: todayIso() },
        }}
      />
    </ResponsiveDialog>
  );
}
