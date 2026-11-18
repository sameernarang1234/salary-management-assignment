import {
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { EmployeeSortField, EmployeeSummary } from '../../api/types';
import { formatDate, formatMoney } from '../../lib/format';

interface ListProps {
  employees: EmployeeSummary[];
  countryName: (code: string) => string;
}

interface TableProps extends ListProps {
  sort: EmployeeSortField;
  order: 'asc' | 'desc';
  onSort: (field: EmployeeSortField) => void;
}

function EmployeeName({ employee }: { employee: EmployeeSummary }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Link
          component={RouterLink}
          to={`/employees/${employee.id}`}
          underline="hover"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          {employee.fullName}
        </Link>
        {employee.status === 'left' && <Chip label="Left" size="small" color="default" />}
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {employee.email}
      </Typography>
    </Box>
  );
}

function Salary({ employee }: { employee: EmployeeSummary }) {
  return (
    <>
      <Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>
        {formatMoney(employee.totalSalary, employee.currency)}
      </Typography>
      {employee.currency !== 'USD' && (
        <Typography component="span" variant="body2" color="text.secondary">
          ≈ {formatMoney(employee.totalSalaryUsd, 'USD')}
        </Typography>
      )}
    </>
  );
}

/** Desktop: a sortable table. Job title and department share a column to fit beside the sidebar. */
export function EmployeeTable({ employees, countryName, sort, order, onSort }: TableProps) {
  const sortLabel = (field: EmployeeSortField, label: string) => (
    <TableSortLabel
      active={sort === field}
      direction={sort === field ? order : 'asc'}
      onClick={() => onSort(field)}
    >
      {label}
    </TableSortLabel>
  );
  const direction = (...fields: EmployeeSortField[]) => (fields.includes(sort) ? order : false);

  return (
    <TableContainer>
      <Table aria-label="Employees">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={direction('fullName')}>
              {sortLabel('fullName', 'Employee')}
            </TableCell>
            <TableCell sortDirection={direction('jobTitle', 'department')}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {sortLabel('jobTitle', 'Job title')}
                {sortLabel('department', 'Department')}
              </Box>
            </TableCell>
            <TableCell sortDirection={direction('country')}>
              {sortLabel('country', 'Country')}
            </TableCell>
            <TableCell align="right">Annual salary</TableCell>
            <TableCell sortDirection={direction('hireDate')}>
              {sortLabel('hireDate', 'Hired')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id} hover>
              <TableCell>
                <EmployeeName employee={employee} />
              </TableCell>
              <TableCell>
                <Typography component="span" sx={{ display: 'block' }}>
                  {employee.jobTitle}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {employee.department}
                </Typography>
              </TableCell>
              <TableCell>{countryName(employee.countryCode)}</TableCell>
              <TableCell align="right">
                <Salary employee={employee} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(employee.hireDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Phones: one card per employee. */
export function EmployeeCards({ employees, countryName }: ListProps) {
  return (
    <Stack component="ul" spacing={2} aria-label="Employees" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {employees.map((employee) => (
        <Card component="li" key={employee.id} sx={{ borderRadius: 6 }}>
          <CardContent sx={{ p: 2.5 }}>
            <EmployeeName employee={employee} />
            <Typography sx={{ mt: 1 }}>{employee.jobTitle}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Chip size="small" variant="outlined" label={employee.department} />
              <Chip size="small" variant="outlined" label={countryName(employee.countryCode)} />
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                mt: 2,
                gap: 1,
              }}
            >
              <Box>
                <Salary employee={employee} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Hired {formatDate(employee.hireDate)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
