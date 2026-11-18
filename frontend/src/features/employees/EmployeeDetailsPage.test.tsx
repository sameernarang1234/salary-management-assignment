import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import type { EmployeeDetails } from '../../api/types';
import { Notifications } from '../notifications/Notifications';
import { ashaDetails, ashaHistory } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { EmployeeDetailsPage } from './EmployeeDetailsPage';

const validationFailed = (fields: Record<string, string>) =>
  HttpResponse.json(
    { error: { code: 'VALIDATION_FAILED', message: 'Validation failed', fields } },
    { status: 400 },
  );

/** Serves Asha's details and history; returns the latest version of her record. */
function serveAsha(initial: EmployeeDetails = ashaDetails) {
  let employee = initial;
  server.use(
    http.get('/api/employees/1', () => HttpResponse.json({ ...employee, totalSalaryUsd: 20_160 })),
    http.get('/api/employees/1/history', () => HttpResponse.json({ items: ashaHistory })),
  );
  return {
    update: (changes: Partial<EmployeeDetails>) => {
      employee = { ...employee, ...changes };
    },
  };
}

const renderPage = (id = '1') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
        <Route path="/employees" element={<h1>Directory</h1>} />
      </Routes>
      <Notifications />
    </>,
    { route: `/employees/${id}` },
  );

const dialog = () => screen.findByRole('dialog');

describe('<EmployeeDetailsPage />', () => {
  it('shows the employee’s details and salary breakdown by component', async () => {
    serveAsha();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Asha Verma', level: 1 }),
    ).toBeInTheDocument();
    const breakdown = screen.getByRole('table', { name: 'Salary breakdown' });
    expect(within(breakdown).getByRole('row', { name: 'Basic ₹12,00,000' })).toBeInTheDocument();
    expect(
      within(breakdown).getByRole('row', { name: 'House Rent Allowance ₹4,80,000' }),
    ).toBeInTheDocument();
    expect(
      within(breakdown).getByRole('row', { name: /Total annual salary ₹16,80,000/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('≈ $20,160 a year')).toBeInTheDocument();
    expect(screen.getByText(/1 INR = 0\.012 USD · rates as of 1 Jan 2026/)).toBeInTheDocument();
  });

  it('shows the salary history newest first, with each change and its reason', async () => {
    serveAsha();
    renderPage();

    const history = await screen.findByRole('list', { name: 'Salary history' });
    const entries = within(history).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('Promotion');
    expect(entries[0]).toHaveTextContent('1 Apr 2025');
    expect(entries[0]).toHaveTextContent('₹14,00,000 → ₹16,80,000');
    expect(entries[0]).toHaveTextContent('+20.0%');
    expect(entries[1]).toHaveTextContent('New hire');
    expect(entries[1]).toHaveTextContent('Started on ₹14,00,000');
  });

  it('says so when the employee does not exist', async () => {
    server.use(
      http.get('/api/employees/999', () =>
        HttpResponse.json({ error: { code: 'EMPLOYEE_NOT_FOUND', message: 'x' } }, { status: 404 }),
      ),
      http.get('/api/employees/999/history', () =>
        HttpResponse.json({ error: { code: 'EMPLOYEE_NOT_FOUND', message: 'x' } }, { status: 404 }),
      ),
    );
    renderPage('999');

    expect(await screen.findByText('Employee not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
  });

  describe('changing the salary', () => {
    it('sends the new components, effective date and reason, then shows the new salary', async () => {
      const asha = serveAsha();
      let body: unknown;
      server.use(
        http.post('/api/employees/1/salary', async ({ request }) => {
          body = await request.json();
          asha.update({
            salaryComponents: [
              { code: 'BASIC', annualAmount: 1_320_000 },
              { code: 'HRA', annualAmount: 480_000 },
            ],
            totalSalary: 1_800_000,
          });
          return HttpResponse.json({}, { status: 201 });
        }),
      );
      const { user } = renderPage();

      await user.click(await screen.findByRole('button', { name: 'Change salary' }));
      const form = await dialog();
      const basic = within(form).getByLabelText('Basic');
      expect(basic).toHaveValue('1200000');
      expect(within(form).getByLabelText('House Rent Allowance')).toHaveValue('480000');
      await user.clear(basic);
      await user.type(basic, '1320000');
      expect(within(form).getByText('New total: ₹18,00,000 (+₹1,20,000)')).toBeInTheDocument();
      fireEvent.change(within(form).getByLabelText('Effective date'), {
        target: { value: '2026-04-01' },
      });
      await user.click(within(form).getByRole('combobox', { name: 'Reason' }));
      await user.click(await screen.findByRole('option', { name: 'Annual increment' }));
      await user.click(within(form).getByRole('button', { name: 'Save new salary' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(body).toEqual({
        components: [
          { code: 'BASIC', annualAmount: 1_320_000 },
          { code: 'HRA', annualAmount: 480_000 },
        ],
        effectiveDate: '2026-04-01',
        reason: 'annual_increment',
      });
      expect(await screen.findByText('Salary updated')).toBeInTheDocument();
      const breakdown = screen.getByRole('table', { name: 'Salary breakdown' });
      expect(
        await within(breakdown).findByRole('row', { name: 'Basic ₹13,20,000' }),
      ).toBeInTheDocument();
    });

    it('checks the form before sending: Basic is required and the salary must change', async () => {
      serveAsha();
      let requests = 0;
      server.use(
        http.post('/api/employees/1/salary', () => {
          requests += 1;
          return HttpResponse.json({}, { status: 201 });
        }),
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'Change salary' }));
      const form = await dialog();
      await user.click(within(form).getByRole('combobox', { name: 'Reason' }));
      await user.click(await screen.findByRole('option', { name: 'Correction' }));

      await user.click(within(form).getByRole('button', { name: 'Save new salary' }));
      expect(
        await within(form).findByText('The new salary is the same as the current salary'),
      ).toBeInTheDocument();

      await user.clear(within(form).getByLabelText('Basic'));
      await user.click(within(form).getByRole('button', { name: 'Save new salary' }));
      expect(await within(form).findByText('Basic is required')).toBeInTheDocument();
      expect(requests).toBe(0);
    });

    it('shows the server’s field errors next to the right fields', async () => {
      serveAsha();
      server.use(
        http.post('/api/employees/1/salary', () =>
          validationFailed({
            effectiveDate: 'Effective date cannot be before the hire date',
            'components.1.annualAmount': 'Must be at most 100,000,000',
          }),
        ),
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'Change salary' }));
      const form = await dialog();
      const basic = within(form).getByLabelText('Basic');
      await user.clear(basic);
      await user.type(basic, '1300000');
      await user.click(within(form).getByRole('combobox', { name: 'Reason' }));
      await user.click(await screen.findByRole('option', { name: 'Other' }));

      await user.click(within(form).getByRole('button', { name: 'Save new salary' }));

      expect(
        await within(form).findByText('Effective date cannot be before the hire date'),
      ).toBeInTheDocument();
      expect(within(form).getByLabelText('House Rent Allowance')).toHaveAccessibleDescription(
        'Must be at most 100,000,000',
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('explains when the server refuses because the employee has left', async () => {
      serveAsha();
      server.use(
        http.post('/api/employees/1/salary', () =>
          HttpResponse.json(
            { error: { code: 'EMPLOYEE_LEFT', message: 'Employee 1 has left' } },
            { status: 409 },
          ),
        ),
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'Change salary' }));
      const form = await dialog();
      const basic = within(form).getByLabelText('Basic');
      await user.clear(basic);
      await user.type(basic, '1300000');
      await user.click(within(form).getByRole('combobox', { name: 'Reason' }));
      await user.click(await screen.findByRole('option', { name: 'Other' }));

      await user.click(within(form).getByRole('button', { name: 'Save new salary' }));

      expect(await within(form).findByRole('alert')).toHaveTextContent('Employee 1 has left');
    });
  });

  describe('editing details', () => {
    it('saves the changed details', async () => {
      const asha = serveAsha();
      let body: unknown;
      server.use(
        http.put('/api/employees/1', async ({ request }) => {
          body = await request.json();
          asha.update({ jobTitle: 'Senior Software Engineer' });
          return HttpResponse.json({ ...ashaDetails, jobTitle: 'Senior Software Engineer' });
        }),
      );
      const { user } = renderPage();

      await user.click(await screen.findByRole('button', { name: 'Edit details' }));
      const form = await dialog();
      const jobTitle = within(form).getByLabelText('Job title');
      await user.clear(jobTitle);
      await user.type(jobTitle, 'Senior Software Engineer');
      await user.click(within(form).getByRole('button', { name: 'Save details' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(body).toEqual({
        fullName: 'Asha Verma',
        email: 'asha.verma@acme.example',
        jobTitle: 'Senior Software Engineer',
        department: 'Engineering',
        countryCode: 'IN',
        hireDate: '2023-04-01',
      });
      expect(await screen.findByText('Details saved')).toBeInTheDocument();
    });

    it('shows a duplicate email error under the email field', async () => {
      serveAsha();
      server.use(
        http.put('/api/employees/1', () =>
          HttpResponse.json(
            {
              error: {
                code: 'EMAIL_IN_USE',
                message: 'Email already in use',
                fields: { email: 'This email is already used by another employee' },
              },
            },
            { status: 409 },
          ),
        ),
      );
      const { user } = renderPage();
      await user.click(await screen.findByRole('button', { name: 'Edit details' }));
      const form = await dialog();

      await user.click(within(form).getByRole('button', { name: 'Save details' }));

      expect(
        await within(form).findByText('This email is already used by another employee'),
      ).toBeInTheDocument();
      expect(within(form).getByLabelText('Email')).toHaveAccessibleDescription(
        'This email is already used by another employee',
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('marking as left', () => {
    it('records the leaving date and shows the employee as left', async () => {
      const asha = serveAsha();
      let body: unknown;
      server.use(
        http.post('/api/employees/1/leave', async ({ request }) => {
          body = await request.json();
          asha.update({ status: 'left', leftOn: '2026-05-31' });
          return HttpResponse.json({ ...ashaDetails, status: 'left', leftOn: '2026-05-31' });
        }),
      );
      const { user } = renderPage();

      await user.click(await screen.findByRole('button', { name: 'Mark as left' }));
      const form = await dialog();
      expect(form).toHaveTextContent('Their record and salary history are kept');
      fireEvent.change(within(form).getByLabelText('Leaving date'), {
        target: { value: '2026-05-31' },
      });
      await user.click(within(form).getByRole('button', { name: 'Mark as left' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(body).toEqual({ leftOn: '2026-05-31' });
      expect(await screen.findByText('Left on 31 May 2026')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change salary' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Mark as left' })).toBeDisabled();
    });
  });
});
