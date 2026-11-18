export type CsvCell = string | number | null;

/** Characters that make Excel or Sheets treat a cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function formatCell(cell: CsvCell): string {
  if (cell === null) {
    return '';
  }
  if (typeof cell === 'number') {
    return String(cell);
  }
  const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * RFC 4180 CSV with CRLF line endings and a UTF-8 byte order mark, so Excel shows names with
 * accents correctly. Text that looks like a formula is prefixed with an apostrophe.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(formatCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
