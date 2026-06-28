import { fromZonedTime } from "date-fns-tz";
export { fromZonedTime };

export const toUTC = (
  localDateTimeStr: string,
  timezone: string,
  allDay: boolean = false
): string => {
  let targetStr = localDateTimeStr;
  if (allDay) {
    const datePart = localDateTimeStr.split("T")[0];
    targetStr = `${datePart}T00:00:00.000`;
  }
  const utcDate = fromZonedTime(targetStr, timezone);
  return utcDate.toISOString();
};
