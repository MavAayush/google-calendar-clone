import React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  startOfDay,
  endOfDay,
} from "date-fns";
import { CalendarEvent } from "./CalendarGrid";

interface MonthGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  currentDate,
  events,
  onEventClick,
}) => {
  const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rowCount = days.length / 7;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm h-full">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-app)] text-center py-2 select-none">
        {weekdays.map((day) => (
          <span
            key={day}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            {day}
          </span>
        ))}
      </div>

      <div
        className="grid grid-cols-7 flex-1 divide-x divide-y divide-[var(--color-border)] border-l border-t border-[var(--color-border)] -ml-[1px] -mt-[1px]"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);

          const dayEvents = events.filter((e) => {
            const eStart = new Date(e.startTime);
            const eEnd = new Date(e.endTime);
            return eStart < dayEnd && eEnd > dayStart;
          });

          const maxVisible = 3;
          const visibleEvents = dayEvents.slice(0, maxVisible);
          const extraCount = dayEvents.length - maxVisible;

          return (
            <div
              key={day.toISOString()}
              className={`p-2 flex flex-col h-full overflow-hidden transition ${
                inMonth ? "bg-[var(--color-surface)]" : "bg-[var(--color-bg-app)] opacity-60"
              }`}
            >
              <div className="flex justify-between items-center mb-1 select-none">
                <span
                  className={`text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-[var(--color-primary)] text-white"
                      : inMonth
                      ? "text-[var(--color-text-main)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                    {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col space-y-1 overflow-hidden">
                {visibleEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--color-primary-light)] border-l-2 border-[var(--color-primary)] text-[var(--color-primary)] truncate cursor-pointer hover:shadow-sm transition select-none"
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {extraCount > 0 && (
                  <button className="text-[10px] font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-left pl-1 transition cursor-pointer select-none">
                    + {extraCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
