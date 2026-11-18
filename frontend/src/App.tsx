import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { Notifications } from './features/notifications/Notifications';

// Pages load on demand, so signing in doesn't download the charts library.
const InsightsPage = lazy(() =>
  import('./features/insights/InsightsPage').then((module) => ({ default: module.InsightsPage })),
);
const EmployeesPage = lazy(() =>
  import('./features/employees/EmployeesPage').then((module) => ({
    default: module.EmployeesPage,
  })),
);
const EmployeeDetailsPage = lazy(() =>
  import('./features/employees/EmployeeDetailsPage').then((module) => ({
    default: module.EmployeeDetailsPage,
  })),
);

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<InsightsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/:id" element={<EmployeeDetailsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Notifications />
    </>
  );
}
