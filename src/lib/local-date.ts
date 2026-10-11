/** Civil date in the runtime timezone, `YYYY-MM-DD`. Same call `daily_logs` uses. */
export function localDate(instant: Date = new Date()): string {
  return instant.toLocaleDateString("en-CA");
}
