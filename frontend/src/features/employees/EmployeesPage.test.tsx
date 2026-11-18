import { screen, waitFor, within } from '@testing-library/react';
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
    renderPage('/employees?country=IN&department=Engineering&sort=hireDate&order=desc&page=2');

    await screen.findByRole('table', { name: 'Employees' });

    expect(Object.fromEntries(requests.at(-1)!)).toEqual({
      country: 'IN',
      department: 'Engineering',
      sort: 'hireDate',
      order: 'desc',
      page: '2',
      pageSize: '25',
    });
  });

  it('puts a chosen filter in the URL and goes back to page 1', async () => {
    const requests = recordDirectoryRequests();
    const { user } = renderPage('/employees?page=3');
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'United States' }));

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('?country=US'));
    await waitFor(() => expect(requests.at(-1)?.get('country')).toBe('US'));
    expect(requests.at(-1)?.get('page')).toBe('1');
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

  it('moves to the next page', async () => {
    const requests = recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([asha, john], { total: 60 })),
    );
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('button', { name: 'Go to next page' }));

    await waitFor(() => expect(requests.at(-1)?.get('page')).toBe('2'));
  });

  it('shows leavers when asked, marked as left', async () => {
    const requests = recordDirectoryRequests(() =>
      HttpResponse.json(pageOf([{ ...asha, status: 'left', leftOn: '2026-01-31' }])),
    );
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Employees' });

    await user.click(screen.getByRole('switch', { name: 'Show leavers' }));

    await waitFor(() => expect(requests.at(-1)?.get('includeLeft')).toBe('true'));
    expect(await screen.findByText('Left')).toBeInTheDocument();
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
      '/api/employees/export?country=IN&sort=fullName&order=asc',
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

  it('shows cards instead of a table on a phone', async () => {
    window.innerWidth = 375;
    recordDirectoryRequests();
    renderPage();

    const list = await screen.findByRole('list', { name: 'Employees' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
