import { describe, expect, it } from 'vitest';
import { toCsv } from '../../src/http/csv.js';

describe('toCsv', () => {
  it('starts with a byte order mark so Excel reads UTF-8, and ends rows with CRLF', () => {
    expect(toCsv(['Name', 'Total'], [['Asha', 1200]])).toBe('\uFEFFName,Total\r\nAsha,1200\r\n');
  });

  it('quotes values containing commas, quotes or line breaks', () => {
    expect(toCsv(['Value'], [['Smith, John'], ['Say "hi"'], ['two\nlines']])).toBe(
      '\uFEFFValue\r\n"Smith, John"\r\n"Say ""hi"""\r\n"two\nlines"\r\n',
    );
  });

  it.each(['=SUM(A1:A9)', '+1', '-1', '@cmd', '\tTab'])(
    'neutralises the spreadsheet formula %j',
    (value) => {
      const [, row] = toCsv(['Value'], [[value]])
        .replace('\uFEFF', '')
        .split('\r\n');

      expect(row?.replace(/^"|"$/g, '').startsWith("'")).toBe(true);
    },
  );

  it('writes empty cells for null', () => {
    expect(toCsv(['A', 'B'], [[null, 'x']])).toBe('\uFEFFA,B\r\n,x\r\n');
  });

  it('leaves numbers, including negatives, untouched', () => {
    expect(toCsv(['N'], [[-5]])).toBe('\uFEFFN\r\n-5\r\n');
  });
});
