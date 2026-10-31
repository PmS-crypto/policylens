// One source of truth for "covered from" dates, so every screen shows the same month.
// Cover starts the day after the waiting period ends, counted from the day you buy (today).

const label = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

/** e.g. a 12-month wait bought on 31 Oct 2026 ends 31 Oct 2027, so cover starts 1 Nov 2027 → "Nov 2027". */
export function coverStartsAfterMonths(months: number) {
  const now = new Date();
  const day = now.getDate();
  const end = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, daysInMonth) + 1);
  return label(end);
}

/** e.g. the 30-day initial wait: illnesses are covered from day 31. */
export function coverStartsAfterDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return label(d);
}
