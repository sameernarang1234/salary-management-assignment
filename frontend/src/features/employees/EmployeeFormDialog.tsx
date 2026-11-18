import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import {
  useCreateEmployeeMutation,
  useGetMetaQuery,
  useUpdateEmployeeMutation,
} from '../../api/api';
import { errorMessage, fieldErrors } from '../../api/errors';
import type { EmployeeDetails, SalaryComponent } from '../../api/types';
import { useAppDispatch } from '../../app/hooks';
import { ResponsiveDialog } from '../../components/ResponsiveDialog';
import { todayIso } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { notify } from '../notifications/notificationsSlice';
import {
  EMPTY_EMPLOYEE,
  cleanDetails,
  detailsFromEmployee,
  validateEmployeeDetails,
  type EmployeeFormErrors,
  type EmployeeFormValues,
} from './forms/employeeForm';
import { SalaryComponentsFields } from './forms/SalaryComponentsFields';
import {
  componentErrorsFromServer,
  componentsFromAmounts,
  totalOf,
  type ComponentAmounts,
  type ComponentErrors,
} from './forms/salaryForm';

type Props =
  | { mode: 'create'; onClose: () => void; onCreated: (employee: EmployeeDetails) => void }
  | { mode: 'edit'; employee: EmployeeDetails; onClose: () => void };

const DETAIL_FIELDS: { field: keyof EmployeeFormValues; label: string; type?: string }[] = [
  { field: 'fullName', label: 'Full name' },
  { field: 'email', label: 'Email', type: 'email' },
  { field: 'jobTitle', label: 'Job title' },
  { field: 'department', label: 'Department' },
];

/** Add an employee (details and first salary) or edit an employee's details. */
export function EmployeeFormDialog(props: Props) {
  const isCreate = props.mode === 'create';
  const meta = useGetMetaQuery();
  const dispatch = useAppDispatch();
  const [createEmployee, creating] = useCreateEmployeeMutation();
  const [updateEmployee, updating] = useUpdateEmployeeMutation();

  const [values, setValues] = useState<EmployeeFormValues>(
    isCreate ? EMPTY_EMPLOYEE : detailsFromEmployee(props.employee),
  );
  const [amounts, setAmounts] = useState<ComponentAmounts>({});
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [componentErrors, setComponentErrors] = useState<ComponentErrors>({});
  const [formError, setFormError] = useState<string>();

  const catalogue = meta.data?.salaryComponents ?? [];
  const currency = meta.data?.countries.find(
    (country) => country.code === values.countryCode,
  )?.currency;

  const setValue = (field: keyof EmployeeFormValues, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const showServerErrors = (error: unknown, submitted: SalaryComponent[]) => {
    const fields = fieldErrors(error);
    const detailErrors: EmployeeFormErrors = {};
    for (const { field } of [
      ...DETAIL_FIELDS,
      { field: 'countryCode' as const },
      { field: 'hireDate' as const },
    ]) {
      if (fields[field]) {
        detailErrors[field] = fields[field];
      }
    }
    const { byCode, general } = componentErrorsFromServer(fields, submitted);
    setErrors(detailErrors);
    setComponentErrors(byCode);
    const hasFieldErrors = Object.keys(detailErrors).length + Object.keys(byCode).length > 0;
    setFormError(general ?? (hasFieldErrors ? undefined : errorMessage(error)));
  };

  const submit = async () => {
    setFormError(undefined);
    const detailErrors = validateEmployeeDetails(values, todayIso());
    const { components, errors: salaryErrors } = isCreate
      ? componentsFromAmounts(amounts, catalogue)
      : { components: [], errors: {} };
    setErrors(detailErrors);
    setComponentErrors(salaryErrors);
    if (Object.keys(detailErrors).length > 0 || Object.keys(salaryErrors).length > 0) {
      return;
    }

    const details = cleanDetails(values);
    try {
      if (props.mode === 'create') {
        const created = await createEmployee({ ...details, components }).unwrap();
        dispatch(notify({ message: `${created.fullName} added`, severity: 'success' }));
        props.onCreated(created);
      } else {
        await updateEmployee({ id: props.employee.id, details }).unwrap();
        dispatch(notify({ message: 'Details saved', severity: 'success' }));
        props.onClose();
      }
    } catch (error) {
      showServerErrors(error, components);
    }
  };

  return (
    <ResponsiveDialog
      open
      title={isCreate ? 'Add employee' : 'Edit details'}
      submitLabel={isCreate ? 'Add employee' : 'Save details'}
      submitting={creating.isLoading || updating.isLoading}
      onClose={props.onClose}
      onSubmit={submit}
    >
      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {DETAIL_FIELDS.map(({ field, label, type }) => (
          <TextField
            key={field}
            label={label}
            type={type}
            value={values[field]}
            onChange={(event) => setValue(field, event.target.value)}
            error={Boolean(errors[field])}
            helperText={errors[field]}
          />
        ))}
        <TextField
          select
          label="Country"
          value={meta.data ? values.countryCode : ''}
          onChange={(event) => setValue('countryCode', event.target.value)}
          error={Boolean(errors.countryCode)}
          helperText={errors.countryCode ?? (isCreate ? 'Sets the salary currency' : undefined)}
        >
          {meta.data?.countries.map((country) => (
            <MenuItem key={country.code} value={country.code}>
              {country.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Hire date"
          type="date"
          value={values.hireDate}
          onChange={(event) => setValue('hireDate', event.target.value)}
          error={Boolean(errors.hireDate)}
          helperText={errors.hireDate}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
        />
      </Box>

      {isCreate && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Salary
          </Typography>
          <SalaryComponentsFields
            catalogue={catalogue}
            amounts={amounts}
            errors={componentErrors}
            currency={currency}
            onChange={(code, value) => setAmounts((current) => ({ ...current, [code]: value }))}
          />
          {currency && (
            <Typography sx={{ mt: 2, fontWeight: 600 }}>
              Total: {formatMoney(totalOf(amounts), currency)} a year
            </Typography>
          )}
        </Box>
      )}
    </ResponsiveDialog>
  );
}
