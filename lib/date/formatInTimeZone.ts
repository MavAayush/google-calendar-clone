import { formatInTimeZone as dateFnsFormatInTimeZone } from "date-fns-tz";

export const formatInTimeZone = (
  date: Date | string | number,
  timezone: string,
  formatStr: string
): string => {
  return dateFnsFormatInTimeZone(date, timezone, formatStr);
};
