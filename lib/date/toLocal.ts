import { formatInTimeZone } from "date-fns-tz";

export const toLocal = (
  utcDateTimeStr: string,
  timezone: string,
  allDay: boolean = false
): string => {
  const date = new Date(utcDateTimeStr);
  const formatted = formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  if (allDay) {
    const datePart = formatted.split("T")[0];
    return `${datePart}T00:00:00.000`;
  }
  return formatted;
};
