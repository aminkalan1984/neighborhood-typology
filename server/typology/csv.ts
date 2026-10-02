export function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

/** RFC 4180 parser with quoted commas, quotes and newlines. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = stripBom(text);

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('Malformed CSV: unterminated quoted field');
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header)) {
    throw new Error('Malformed CSV: empty header');
  }

  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length > headers.length) {
      throw new Error(`Malformed CSV: row ${rowIndex + 2} has ${cells.length} fields, expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

