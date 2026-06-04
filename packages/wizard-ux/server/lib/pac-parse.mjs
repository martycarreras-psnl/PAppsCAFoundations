// Shared PAC CLI output parsing helpers.
//
// The PAC CLI emits column-aligned tabular text (no JSON option for several
// commands such as `pac env list` and `pac solution list`). This parser finds
// the header line, derives column boundaries from header token positions, and
// slices each subsequent data line by those boundaries. It handles multi-word
// values (e.g. "Climb Tracker") and aliased columns (e.g. "pub.customizationprefix").

/**
 * Parse PAC CLI column-aligned tabular output into an array of row objects.
 * @param {string} output The raw stdout from a PAC command.
 * @param {string[]} [headerHints] Lowercase substrings used to locate the header row.
 * @returns {Array<Record<string, string>>}
 */
export function parsePacTabularRows(output, headerHints) {
  const allLines = String(output || '').split(/\r?\n/);
  const hints = headerHints || ['uniquename', 'solutionid', 'friendlyname'];

  // Find the header line — first line containing at least one of the hints.
  let headerIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    const lower = allLines[i].toLowerCase();
    if (hints.some((h) => lower.includes(h))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const headerLine = allLines[headerIdx];

  // Extract column names and their start positions from the header.
  const cols = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(headerLine)) !== null) {
    cols.push({ name: m[0].toLowerCase(), start: m.index });
  }

  // Parse each data line after the header.
  const rows = [];
  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i];
    if (!line.trim()) continue;
    if (/^(Connected|Microsoft|Version:|Online|Feedback)/i.test(line.trim())) continue;
    const row = {};
    for (let c = 0; c < cols.length; c++) {
      const start = cols[c].start;
      const end = c < cols.length - 1 ? cols[c + 1].start : line.length;
      row[cols[c].name] = (start < line.length ? line.slice(start, end) : '').trim();
    }
    if (Object.values(row).some((v) => v)) rows.push(row);
  }
  return rows;
}
