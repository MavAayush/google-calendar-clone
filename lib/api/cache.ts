import { QueryClient } from "@tanstack/react-query";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isRecurring: boolean;
  recurrence: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    seriesEndDate: string | null;
    byDay: string[] | null;
  } | null;
  version: number;
}

export function updateQueryCacheWithEvent(
  queryClient: QueryClient,
  newEvent: CalendarEvent,
  isDelete = false
) {
  if (newEvent.isRecurring || newEvent.recurrence) {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    return;
  }

  const queries = queryClient.getQueryCache().getAll();
  queries.forEach((query) => {
    if (
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "events" &&
      query.state.data
    ) {
      const [, , startStr, endStr] = query.queryKey as [string, string, string, string];

      const queryStart = new Date(startStr);
      const queryEnd = new Date(endStr);

      const eventStart = new Date(newEvent.startTime);
      const eventEnd = new Date(newEvent.endTime);

      const overlaps = eventStart < queryEnd && eventEnd > queryStart;

      if (overlaps && !isDelete) {
        queryClient.setQueryData(query.queryKey, (old: { events: CalendarEvent[] } | undefined) => {
          if (!old || !old.events) return old;
          const exists = old.events.some((e: CalendarEvent) => e.id === newEvent.id);
          if (exists) {
            return {
              ...old,
              events: old.events.map((e: CalendarEvent) =>
                e.id === newEvent.id ? { ...e, ...newEvent } : e
              ),
            };
          } else {
            return {
              ...old,
              events: [...old.events, newEvent],
            };
          }
        });
      } else {
        queryClient.setQueryData(query.queryKey, (old: { events: CalendarEvent[] } | undefined) => {
          if (!old || !old.events) return old;
          return {
            ...old,
            events: old.events.filter((e: CalendarEvent) => e.id !== newEvent.id),
          };
        });
      }
    }
  });
}
