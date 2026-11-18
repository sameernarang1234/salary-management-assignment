/** The title shown in the top bar for a path. */
export function pageTitle(pathname: string): string {
  if (/^\/employees\/[^/]+/.test(pathname)) {
    return 'Employee details';
  }
  if (pathname.startsWith('/employees')) {
    return 'Employees';
  }
  return 'Pay insights';
}
