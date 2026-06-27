/** Parse YYYY-MM-DD or ISO string for advance / finance entry dates. */
function parseAdvanceDate(dateInput) {
  if (!dateInput) return new Date();
  const s = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

module.exports = { parseAdvanceDate };
