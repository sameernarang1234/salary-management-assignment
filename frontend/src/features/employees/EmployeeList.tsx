import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
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

/**
 * Former employees: name in muted italics, a "Former" chip, and an info button whose tooltip
 * (also its accessible name) gives the leaving date.
 */
function FormerEmployeeMarker({ leftOn }: { leftOn: string | null }) {
  const message = `Left on ${formatDate(leftOn ?? '')}. Their record and salary history are kept.`;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      <Chip label="Former" size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
      <Tooltip title={message} arrow>
        <IconButton size="small" aria-label={message} sx={{ color: 'text.secondary' }}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function EmployeeName({ employee }: { employee: EmployeeSummary }) {
  const isFormer = employee.status === 'left';
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Link
          component={RouterLink}
          to={`/employees/${employee.id}`}
          underline="hover"
          sx={{
            fontWeight: 700,
            color: isFormer ? 'text.secondary' : 'text.primary',
            fontStyle: isFormer ? 'italic' : 'normal',
          }}
        >
          {employee.fullName}
        </Link>
        {isFormer && <FormerEmployeeMarker leftOn={employee.leftOn} />}
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {employee.email}
      </Typography>
      {isFormer && employee.leftOn && (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Last working day: {formatDate(employee.leftOn)}
        </Typography>
      )}
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
            <TableCell align="right" sortDirection={direction('salary')}>
              <Tooltip
                describeChild
                title="Sorted by the USD equivalent, so salaries in different currencies compare fairly"
              >
                {sortLabel('salary', 'Annual salary')}
              </Tooltip>
            </TableCell>
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
