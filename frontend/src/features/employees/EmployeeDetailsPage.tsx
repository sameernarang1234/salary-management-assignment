import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { useGetEmployeeQuery, useGetMetaQuery, useGetSalaryHistoryQuery } from '../../api/api';
import type { EmployeeDetails, SalaryComponentType, SalaryHistoryEntry } from '../../api/types';
import { SectionCard } from '../../components/SectionCard';
import { EmptyState, ErrorState } from '../../components/states';
import { formatDate, formatMoney } from '../../lib/format';
import { REASON_LABELS } from '../../lib/labels';
import { EmployeeFormDialog } from './EmployeeFormDialog';
import { MarkLeftDialog } from './MarkLeftDialog';
import { SalaryChangeDialog } from './SalaryChangeDialog';

type OpenDialog = 'edit' | 'salary' | 'leave' | null;

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

function percentChange(previous: number, next: number): string {
  const percent = ((next - previous) / previous) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function SalaryBreakdown({
  employee,
  catalogue,
  ratesAsOf,
}: {
  employee: EmployeeDetails;
  catalogue: readonly SalaryComponentType[];
  ratesAsOf?: string;
}) {
  const nameOf = (code: string) => catalogue.find((type) => type.code === code)?.name ?? code;
  return (
    <SectionCard title="Salary breakdown" subtitle={`Annual, in ${employee.currency}`}>
      <Table aria-label="Salary breakdown" size="small">
        <TableBody>
          {employee.salaryComponents.map((component) => (
            <TableRow key={component.code}>
              <TableCell component="th" scope="row" sx={{ pl: 0 }}>
                {nameOf(component.code)}
              </TableCell>
              <TableCell align="right" sx={{ pr: 0 }}>
                {formatMoney(component.annualAmount, employee.currency)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell component="th" scope="row" sx={{ pl: 0, fontWeight: 700, borderBottom: 0 }}>
              Total annual salary
            </TableCell>
            <TableCell align="right" sx={{ pr: 0, fontWeight: 700, borderBottom: 0 }}>
              {formatMoney(employee.totalSalary, employee.currency)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {employee.currency !== 'USD' && employee.totalSalaryUsd !== undefined && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>
            ≈ {formatMoney(employee.totalSalaryUsd, 'USD')} a year
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1 {employee.currency} = {employee.usdPerUnit} USD
            {ratesAsOf ? ` · rates as of ${formatDate(ratesAsOf)}` : ''}
          </Typography>
        </Box>
      )}
    </SectionCard>
  );
}

function DetailsList({ employee }: { employee: EmployeeDetails }) {
  const rows: [string, string][] = [
    ['Email', employee.email],
    ['Job title', employee.jobTitle],
    ['Department', employee.department],
    ['Country', `${employee.countryName} (${employee.currency})`],
    ['Hire date', formatDate(employee.hireDate)],
    [
      'Status',
      employee.status === 'left' ? `Left on ${formatDate(employee.leftOn ?? '')}` : 'Active',
    ],
  ];
  return (
    <SectionCard title="Details">
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
        {rows.map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" sx={{ m: 0, wordBreak: 'break-word' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
}

function HistoryTimeline({
  entries,
  currency,
}: {
  entries: SalaryHistoryEntry[];
  currency: string;
}) {
  return (
    <SectionCard
      title="Salary history"
      subtitle="Every change, newest first. Entries cannot be edited or deleted."
    >
      <Box component="ol" aria-label="Salary history" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {entries.map((entry, index) => (
          <Box
            component="li"
            key={entry.id}
            sx={{
              position: 'relative',
              pl: 3.5,
              pb: index === entries.length - 1 ? 0 : 3,
              borderLeft: index === entries.length - 1 ? 'none' : '2px solid',
              borderColor: 'divider',
              ml: 1,
              '&::before': {
                content: '""',
                position: 'absolute',
                left: -7,
                top: 4,
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: entry.reason === 'new_hire' ? 'secondary.main' : 'primary.main',
              },
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700 }}>{REASON_LABELS[entry.reason]}</Typography>
              <Typography color="text.secondary">
                · effective {formatDate(entry.effectiveDate)}
              </Typography>
            </Box>
            {entry.previousTotal === null ? (
              <Typography sx={{ mt: 0.5 }}>
                Started on {formatMoney(entry.newTotal, currency)}
              </Typography>
            ) : (
              <Typography sx={{ mt: 0.5 }}>
                {formatMoney(entry.previousTotal, currency)} →{' '}
                {formatMoney(entry.newTotal, currency)}{' '}
                <Box
                  component="span"
                  sx={{
                    color: entry.newTotal >= entry.previousTotal ? 'secondary.main' : 'error.main',
                  }}
                >
                  {percentChange(entry.previousTotal, entry.newTotal)}
                </Box>
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Recorded {formatDate(entry.recordedAt)}
            </Typography>
          </Box>
        ))}
      </Box>
    </SectionCard>
  );
}

export function EmployeeDetailsPage() {
  const id = Number(useParams().id);
  const employee = useGetEmployeeQuery(id);
  const history = useGetSalaryHistoryQuery(id);
  const meta = useGetMetaQuery();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const backLink = (
    <Link
      component={RouterLink}
      to="/employees"
      underline="hover"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <ArrowBackRoundedIcon fontSize="small" />
      Back to employees
    </Link>
  );

  if (employee.isLoading) {
    return <LinearProgress aria-label="Loading employee" />;
  }
  if (employee.isError || !employee.data) {
    return isNotFound(employee.error) ? (
      <EmptyState
        title="Employee not found"
        description="They may have been removed from the link you followed."
        action={backLink}
      />
    ) : (
      <ErrorState message="Could not load this employee." onRetry={() => employee.refetch()} />
    );
  }

  const data = employee.data;
  const hasLeft = data.status === 'left';

  return (
    <>
      <Box sx={{ mb: 2 }}>{backLink}</Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { md: 'flex-end' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h1">{data.fullName}</Typography>
            <Chip
              label={hasLeft ? 'Left' : 'Active'}
              color={hasLeft ? 'default' : 'secondary'}
              size="small"
            />
          </Box>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {data.jobTitle} · {data.department} · {data.countryName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<PaymentsRoundedIcon />}
            onClick={() => setDialog('salary')}
            disabled={hasLeft}
          >
            Change salary
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditRoundedIcon />}
            onClick={() => setDialog('edit')}
          >
            Edit details
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<LogoutRoundedIcon />}
            onClick={() => setDialog('leave')}
            disabled={hasLeft}
          >
            Mark as left
          </Button>
        </Box>
      </Box>

      {hasLeft && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 4 }}>
          Left on {formatDate(data.leftOn ?? '')}. Their record and salary history are kept, but
          they no longer appear in the directory, insights or exports by default.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        <SalaryBreakdown
          employee={data}
          catalogue={meta.data?.salaryComponents ?? []}
          ratesAsOf={meta.data?.ratesAsOf}
        />
        <DetailsList employee={data} />
        <Box sx={{ gridColumn: '1 / -1' }}>
          {history.isError && (
            <ErrorState
              message="Could not load the salary history."
              onRetry={() => history.refetch()}
            />
          )}
          {history.data && <HistoryTimeline entries={history.data} currency={data.currency} />}
        </Box>
      </Box>

      {dialog === 'salary' && (
        <SalaryChangeDialog employee={data} onClose={() => setDialog(null)} />
      )}
      {dialog === 'edit' && (
        <EmployeeFormDialog mode="edit" employee={data} onClose={() => setDialog(null)} />
      )}
      {dialog === 'leave' && <MarkLeftDialog employee={data} onClose={() => setDialog(null)} />}
    </>
  );
}
