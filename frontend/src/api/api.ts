import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { notify } from '../features/notifications/notificationsSlice';
import { sessionExpired } from '../features/session/sessionActions';
import type {
  CountryJobTitlePay,
  CountryPay,
  Credentials,
  DepartmentCost,
  EmployeeDetails,
  InsightsOverview,
  EmployeeInput,
  EmployeeListParams,
  EmployeeSummary,
  Meta,
  NewEmployeeInput,
  Page,
  SalaryChangeInput,
  SalaryHistoryEntry,
  SignedInUser,
} from './types';

const rawBaseQuery = fetchBaseQuery({
  // Absolute so the same code works in the browser and in tests; same origin as the app.
  baseUrl: new URL('/api/', window.location.origin).toString(),
  credentials: 'same-origin',
});

/** Endpoints where a 401 is an expected answer, not an expired session. */
const SESSION_ENDPOINTS = new Set(['getMe', 'login', 'logout']);

/** Any other 401 means the session has expired: sign out and tell the HR Manager why. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiContext,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, apiContext, extraOptions);
  if (result.error?.status === 401 && !SESSION_ENDPOINTS.has(apiContext.endpoint)) {
    apiContext.dispatch(sessionExpired());
    apiContext.dispatch(
      notify({ message: 'Your session has expired. Please sign in again.', severity: 'warning' }),
    );
  }
  return result;
};

/** All server data goes through this one RTK Query API slice. */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Meta', 'Employees', 'Employee', 'History', 'Insights'],
  endpoints: (build) => ({
    getMe: build.query<SignedInUser, void>({
      query: () => 'auth/me',
      transformResponse: (response: { user: SignedInUser }) => response.user,
    }),
    login: build.mutation<SignedInUser, Credentials>({
      query: (credentials) => ({ url: 'auth/login', method: 'POST', body: credentials }),
      transformResponse: (response: { user: SignedInUser }) => response.user,
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
    }),
    getMeta: build.query<Meta, void>({
      query: () => 'meta',
      providesTags: ['Meta'],
    }),
    listEmployees: build.query<Page<EmployeeSummary>, EmployeeListParams>({
      query: (params) => ({ url: 'employees', params }),
      providesTags: ['Employees'],
    }),
    getEmployee: build.query<EmployeeDetails, number>({
      query: (id) => `employees/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Employee', id }],
    }),
    getSalaryHistory: build.query<SalaryHistoryEntry[], number>({
      query: (id) => `employees/${id}/history`,
      transformResponse: (response: { items: SalaryHistoryEntry[] }) => response.items,
      providesTags: (_result, _error, id) => [{ type: 'History', id }],
    }),

    getInsightsOverview: build.query<InsightsOverview, void>({
      query: () => 'insights/overview',
      providesTags: ['Insights'],
    }),
    getPayByCountry: build.query<CountryPay[], void>({
      query: () => 'insights/countries',
      transformResponse: (response: { items: CountryPay[] }) => response.items,
      providesTags: ['Insights'],
    }),
    getPayByJobTitle: build.query<CountryJobTitlePay, string>({
      query: (countryCode) => `insights/countries/${encodeURIComponent(countryCode)}/job-titles`,
      providesTags: ['Insights'],
    }),
    getCostByDepartment: build.query<DepartmentCost[], void>({
      query: () => 'insights/departments',
      transformResponse: (response: { items: DepartmentCost[] }) => response.items,
      providesTags: ['Insights'],
    }),

    // Each change refreshes exactly the cached data it affects.
    createEmployee: build.mutation<EmployeeDetails, NewEmployeeInput>({
      query: (body) => ({ url: 'employees', method: 'POST', body }),
      invalidatesTags: ['Employees', 'Insights', 'Meta'],
    }),
    updateEmployee: build.mutation<EmployeeDetails, { id: number; details: EmployeeInput }>({
      query: ({ id, details }) => ({ url: `employees/${id}`, method: 'PUT', body: details }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Employee', id },
        'Employees',
        'Insights',
        'Meta',
      ],
    }),
    changeSalary: build.mutation<unknown, { id: number; change: SalaryChangeInput }>({
      query: ({ id, change }) => ({ url: `employees/${id}/salary`, method: 'POST', body: change }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Employee', id },
        { type: 'History', id },
        'Employees',
        'Insights',
      ],
    }),
    markEmployeeLeft: build.mutation<unknown, { id: number; leftOn: string }>({
      query: ({ id, leftOn }) => ({
        url: `employees/${id}/leave`,
        method: 'POST',
        body: { leftOn },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Employee', id },
        'Employees',
        'Insights',
        'Meta',
      ],
    }),
  }),
});

export const {
  useGetMeQuery,
  useLoginMutation,
  useLogoutMutation,
  useGetMetaQuery,
  useListEmployeesQuery,
  useGetEmployeeQuery,
  useGetSalaryHistoryQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useChangeSalaryMutation,
  useMarkEmployeeLeftMutation,
  useGetInsightsOverviewQuery,
  useGetPayByCountryQuery,
  useGetPayByJobTitleQuery,
  useGetCostByDepartmentQuery,
} = api;
