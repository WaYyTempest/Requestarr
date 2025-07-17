// Format a Date object to a French date-time string (dd/mm/yyyy hh:mm:ss)
export function formatDate(date: Date): string {
  return date
    .toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .replace(",", "");
}
