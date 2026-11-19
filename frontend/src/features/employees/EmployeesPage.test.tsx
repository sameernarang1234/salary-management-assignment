import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { asha, john, pageOf } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { EmployeesPage } from './EmployeesPage';

/** Records the query string of every directory request. */
function recordDirectoryRequests(respond = () => HttpResponse.json(pageOf([asha, john]))) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get('/api/employees', ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return respond();
    }),
  );
  return requests;
}

/** The button is enabled once the countries have loaded (the form needs them). */
async function addEmployeeButton() {
  const button = await screen.findByRole('button', { name: 'Add employee' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

function CurrentSearch() {
  return <output data-testid="url">{useLocation().search}</output>;
}

const renderPage = (route = '/employees') =>
  renderWithProviders(
    <Routes>
      <Route
        path="/employees"
        element={
          <>
            <EmployeesPage />
            <CurrentSearch />
          </>
        }
      />
      <Route path="/employees/:id" element={<h1>Details page</h1>} />
    </Routes>,
    { route },
  );

describe('<EmployeesPage />', () => {
  it('lists employees with job, country and salary in local currency and USD', async () => {
    recordDirectoryRequests();
    renderPage();

    const table = await screen.findByRole('table', { name: 'Employees' });
    const ashaRow = within(table).getByRole('row', { name: /Asha Verma/ });
    expect(within(ashaRow).getByText('Software Engineer')).toBeInTheDocument();
    expect(within(ashaRow).getByText('India')).toBeInTheDocument();
    expect(within(ashaRow).getByText('₹16,80,000')).toBeInTheDocument();
    expect(within(ashaRow).getByText('≈ $20,160')).toBeInTheDocument();
    // USD salaries are not repeated in USD.
    const johnRow = within(table).getByRole('row', { name: /John Smith/ });
    expect(within(johnRow).queryByText(/≈/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 employees' })).toBeInTheDocument();
  });

  it('sends the filters in the URL to the API', async () => {
    const requests = recordDirectoryRequests();
    renderPage(
      '/employees?country=IN&country=US&department=Engineering&sort=hireDate&order=desc&page=2',
    );

    await screen.findByRole('table', { name: 'Employees' });

    const request = requests.at(-1)!;
    expect(request.getAll('country')).toEqual(['IN', 'US']);
    expect(request.getAll('department')).toEqual(['Engineering']);
    expect(request.get('status')).toBe('active');
    expect(request.get('sort')).toBe('hireDate');
    expect(request.get('order')).toBe('desc');
    expect(request.get('page')).toBe('2');
  });

  it('lets several countries be chosen at once, puts them in the URL and goes back to page 1', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage('/employees?page=3');
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'United States' }));
    await user.click(screen.getByRole('option', { name: 'India' }));
    await user.keyboard('{Escape}');

    // Kept in the list's order, whatever order they were clicked in.
    await waitFor(() =>
      expect(screen.getByTestId('url')).toHaveTextContent('?country=IN&country=US'),
    );
    await waitFor(() => expect(requests.at(-1)?.getAll('country')).toEqual(['IN', 'US']));
    expect(requests.at(-1)?.get('page')).toBe('1');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent(
      'India, United States',
    );
  });

  it('lets several departments and job titles be chosen, and unticking removes one', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage('/employees?department=Sales');
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(await screen.findByRole('option', { name: 'Engineering' }));
    await user.click(screen.getByRole('option', { name: 'Sales' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: 'Job title' }));
    await user.click(await screen.findByRole('option', { name: 'Account Executive' }));
    await user.click(screen.getByRole('option', { name: 'Software Engineer' }));
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(requests.at(-1)?.getAll('jobTitle')).toEqual([
        'Account Executive',
        'Software Engineer',
      ]),
    );
    expect(requests.at(-1)?.getAll('department')).toEqual(['Engineering']);
  });

  it('searches after typing stops', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.type(screen.getByRole('textbox', { name: 'Search name or email' }), 'verma');

    await waitFor(() => expect(requests.at(-1)?.get('search')).toBe('verma'));
    expect(requests.filter((request) => request.has('search'))).toHaveLength(1);
  });

  it('sorts by a column, then reverses it on a second click', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('button', { name: 'Hired' }));
    await waitFor(() => expect(requests.at(-1)?.get('sort')).toBe('hireDate'));
    expect(requests.at(-1)?.get('order')).toBe('asc');

    await user.click(screen.getByRole('button', { name: 'Hired' }));
    await waitFor(() => expect(requests.at(-1)?.get('order')).toBe('desc'));
  });

  it('sorts by annual salary in USD, then reverses it on a second click', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('button', { name: 'Annual salary' }));
    await waitFor(() => expect(requests.at(-1)?.get('sort')).toBe('salary'));
    expect(requests.at(-1)?.get('order')).toBe('asc');

    await user.click(screen.getByRole('button', { name: 'Annual salary' }));
    await waitFor(() => expect(requests.at(-1)?.get('order')).toBe('desc'));
  });

  it('moves to the next page', async () => {
    const requests = recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([asha, john], { total: 60 })),
    );
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('button', { name: 'Go to next page' }));

    await waitFor(() => expect(requests.at(-1)?.get('page')).toBe('2'));
  });

  it('shows current employees by default, and former or all employees when chosen', async () => {
    const requests = recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([john, { ...asha, status: 'left', leftOn: '2026-01-31' }])),
    );
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });
    const status = screen.getByRole('combobox', { name: 'Employees to show' });
    expect(status).toHaveTextContent('Current employees');
    expect(requests.at(-1)?.get('status')).toBe('active');

    await user.click(status);
    await user.click(await screen.findByRole('option', { name: 'Former employees' }));
    await waitFor(() => expect(requests.at(-1)?.get('status')).toBe('left'));
    expect(screen.getByTestId('url')).toHaveTextContent('?status=left');

    await user.click(screen.getByRole('combobox', { name: 'Employees to show' }));
    await user.click(await screen.findByRole('option', { name: 'All employees' }));
    await waitFor(() => expect(requests.at(-1)?.get('status')).toBe('all'));
  });

  it('marks former employees clearly, with their leaving date on the info button', async () => {
    recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([john, { ...asha, status: 'left', leftOn: '2026-01-31' }])),
    );
    const { user } = renderPage('/employees?status=all');

    const table = await screen.findByRole('table', { name: 'Employees' });
    const ashaRow = within(table).getByRole('row', { name: /Asha Verma/ });
    expect(within(ashaRow).getByText('Former')).toBeInTheDocument();
    const info = within(ashaRow).getByRole('button', {
      name: 'Left on 31 Jan 2026. Their record and salary history are kept.',
    });
    expect(within(ashaRow).getByText('Last working day: 31 Jan 2026')).toBeInTheDocument();
    const johnRow = within(table).getByRole('row', { name: /John Smith/ });
    expect(within(johnRow).queryByText('Former')).not.toBeInTheDocument();
    expect(within(johnRow).queryByText(/Last working day/)).not.toBeInTheDocument();

    await user.hover(info);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Left on 31 Jan 2026');
  });

  it('links each employee to their details page', async () => {
    recordDirectoryRequests();
    const { user } = renderPage();

    await user.click(await screen.findByRole('link', { name: 'Asha Verma' }));

    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
  });

  it('links the export button to a CSV of the current filters', async () => {
    recordDirectoryRequests();
    renderPage('/employees?country=IN&page=2');

    const exportLink = await screen.findByRole('link', { name: 'Export CSV' });

    expect(exportLink).toHaveAttribute(
      'href',
      '/api/employees/export?country=IN&status=active&sort=fullName&order=asc',
    );
  });

  it('explains when nothing matches and offers to clear the filters', async () => {
    recordDirectoryRequests(() => HttpResponse.json(pageOf([])));
    const { user } = renderPage('/employees?search=nobody');

    expect(await screen.findByText('No employees match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show everyone' }));

    await waitFor(() => expect(screen.getByTestId('url')).toBeEmptyDOMElement());
  });

  it('shows an error with a retry button when loading fails', async () => {
    let fail = true;
    recordDirectoryRequests(() =>
      fail
        ? HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })
        : HttpResponse.json(pageOf([asha])),
    );
    const { user } = renderPage();

    expect(await screen.findByText('Could not load employees.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Asha Verma' })).toBeInTheDocument();
  });

  it('adds an employee with their first salary and opens their page', async () => {
    recordDirectoryRequests();
    let body: unknown;
    server.use(
      http.post('/api/employees', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...asha, id: 42 }, { status: 201 });
      }),
    );
    const { user } = renderPage();

    await user.click(await addEmployeeButton());
    const form = await screen.findByRole('dialog');
    await user.type(within(form).getByLabelText('Full name'), 'Meera Nair');
    await user.type(within(form).getByLabelText('Email'), 'meera.nair@acme.example');
    await user.type(within(form).getByLabelText('Job title'), 'Data Analyst');
    await user.type(within(form).getByLabelText('Department'), 'Data');
    await user.click(within(form).getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'India' }));
    fireEvent.change(within(form).getByLabelText('Hire date'), { target: { value: '2026-01-05' } });
    await user.type(within(form).getByLabelText('Basic'), '900000');
    await user.type(within(form).getByLabelText('House Rent Allowance'), '360000');
    expect(within(form).getByText('Total: ₹12,60,000 a year')).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
    expect(body).toEqual({
      fullName: 'Meera Nair',
      email: 'meera.nair@acme.example',
      jobTitle: 'Data Analyst',
      department: 'Data',
      countryCode: 'IN',
      hireDate: '2026-01-05',
      components: [
        { code: 'BASIC', annualAmount: 900_000 },
        { code: 'HRA', annualAmount: 360_000 },
      ],
    });
  });

  it('checks the new employee form before sending', async () => {
    recordDirectoryRequests();
    const { user } = renderPage();

    await user.click(await addEmployeeButton());
    const form = await screen.findByRole('dialog');
    await user.click(within(form).getByRole('button', { name: 'Add employee' }));

    expect(within(form).getByLabelText('Full name')).toHaveAccessibleDescription('Required');
    expect(within(form).getByText('Choose a country')).toBeInTheDocument();
    expect(within(form).getByText('Basic is required')).toBeInTheDocument();
  });

  it('shows the last working day of former employees on phone cards too', async () => {
    window.innerWidth = 375;
    recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([john, { ...asha, status: 'left', leftOn: '2026-01-31' }])),
    );
    renderPage('/employees?status=left');

    const list = await screen.findByRole('list', { name: 'Employees' });
    const [johnCard, ashaCard] = within(list).getAllByRole('listitem');
    expect(within(ashaCard!).getByText('Last working day: 31 Jan 2026')).toBeInTheDocument();
    expect(within(ashaCard!).getByText('Former')).toBeInTheDocument();
    expect(within(johnCard!).queryByText(/Last working day/)).not.toBeInTheDocument();
  });

  it('shows cards instead of a table on a phone', async () => {
    window.innerWidth = 375;
    recordDirectoryRequests();
    renderPage();

    const list = await screen.findByRole('list', { name: 'Employees' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
