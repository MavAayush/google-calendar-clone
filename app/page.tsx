"use client";

import React, { useState, useEffect } from "react";
import { format, addDays, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useQuery, useMutation, useQueryClient, useIsMutating } from "@tanstack/react-query";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventForm } from "@/components/calendar/EventForm";
import { request } from "@/lib/api/request";
import { useToast } from "@/components/ui/Toast";
import { toUTC } from "@/lib/date/toUTC";

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

export default function Page() {
  const queryClient = useQueryClient();
  const isMutating = useIsMutating();
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-07-01"));
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const { show: showToast } = useToast();

  const startRange = (() => {
    if (view === "day") {
      return startOfDay(currentDate);
    } else if (view === "week") {
      return startOfDay(startOfWeek(currentDate, { weekStartsOn: 0 }));
    } else {
      return startOfDay(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }));
    }
  })();

  const endRange = (() => {
    if (view === "day") {
      return endOfDay(currentDate);
    } else if (view === "week") {
      return endOfDay(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), 6));
    } else {
      return endOfDay(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }));
    }
  })();

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["events", view, startRange.toISOString(), endRange.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        start: startRange.toISOString(),
        end: endRange.toISOString(),
      });
      return request<{ events: CalendarEvent[] }>(`/api/events?${params.toString()}`);
    },
  });

  useEffect(() => {
    if (isError && error) {
      showToast(error.message || "Failed to load events", "error");
    }
  }, [isError, error, showToast]);

  const moveEventMutation = useMutation<
    { id: string; title: string; conflicts?: { title: string }[] },
    { message?: string },
    { event: CalendarEvent; startTime: string; endTime: string },
    { previousQueries: [unknown, unknown][] }
  >({
    mutationFn: ({ event, startTime, endTime }) => {
      return request<{ id: string; title: string; conflicts?: { title: string }[] }>(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: event.version,
          startTime,
          endTime,
        }),
      });
    },
    onMutate: async ({ event, startTime, endTime }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ["events"] });

      queryClient.setQueriesData({ queryKey: ["events"] }, (old: { events: CalendarEvent[] } | undefined) => {
        if (!old || !old.events) return old;
        return {
          ...old,
          events: old.events.map((e: CalendarEvent) =>
            e.id === event.id
              ? { ...e, startTime, endTime, version: e.version + 1 }
              : e
          ),
        };
      });

      return { previousQueries };
    },
    onError: (err, variables, context) => {
      if (context?.previousQueries) {
        for (const [key, value] of context.previousQueries) {
          queryClient.setQueryData(key as readonly unknown[], value);
        }
      }
      showToast(err.message || "Failed to move event", "error");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      if (data.conflicts && data.conflicts.length > 0) {
        const conflictTitles = data.conflicts.map((c) => c.title).join(", ");
        showToast(`⚠️ Moved, but overlaps with: ${conflictTitles}`, "warning");
      } else {
        showToast("Event moved successfully", "success");
      }
    },
  });

  const handleEventMove = (event: CalendarEvent, newStart: Date, newEnd: Date) => {
    const timezone =
      process.env.NEXT_PUBLIC_TIMEZONE ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    const localStartStr = format(newStart, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    const localEndStr = format(newEnd, "yyyy-MM-dd'T'HH:mm:ss.SSS");

    const startTimeUTC = toUTC(localStartStr, timezone, event.allDay);
    const endTimeUTC = toUTC(localEndStr, timezone, event.allDay);

    moveEventMutation.mutate({
      event,
      startTime: startTimeUTC,
      endTime: endTimeUTC,
    });
  };

  const handleEventResize = (event: CalendarEvent, newEnd: Date) => {
    const timezone =
      process.env.NEXT_PUBLIC_TIMEZONE ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    const localEndStr = format(newEnd, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    const endTimeUTC = toUTC(localEndStr, timezone, event.allDay);

    moveEventMutation.mutate({
      event,
      startTime: event.startTime,
      endTime: endTimeUTC,
    });
  };

  const handlePrev = () => {
    if (view === "day") {
      setCurrentDate(subDays(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 7));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-app)] relative">
      {isMutating > 0 && (
        <div className="absolute top-16 left-0 right-0 h-0.5 bg-[var(--color-primary-light)] z-50 overflow-hidden pointer-events-none">
          <div className="w-full h-full bg-[var(--color-primary)] origin-left animate-loading-slide" />
        </div>
      )}
      <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 shadow-sm">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <svg
              className="h-8 w-8 text-[var(--color-primary)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="4" width="18" height="18" rx="4" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <circle cx="12" cy="14" r="2" fill="currentColor" />
            </svg>
            <span className="font-display text-xl font-bold tracking-tight text-[var(--color-text-main)]">
              Calendar
            </span>
          </div>
          <button
            onClick={handleToday}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-app)] transition duration-[var(--transition-fast)]"
          >
            Today
          </button>
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrev}
              className="p-2 rounded-full hover:bg-[var(--color-bg-app)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-full hover:bg-[var(--color-bg-app)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <h1 className="font-display text-lg font-semibold text-[var(--color-text-main)]">
            {format(currentDate, "MMMM yyyy")}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <select
              value={view}
              onChange={(e) => setView(e.target.value as "day" | "week" | "month")}
              className="appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-4 pr-10 text-sm font-medium text-[var(--color-text-main)] hover:border-[var(--color-border-hover)] focus:outline-none transition cursor-pointer"
            >
              <option value="week">Week</option>
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-bold text-sm shadow-md">
            U
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col space-y-6 overflow-y-auto">
          <button
            onClick={() => {
              setEditingEvent(null);
              setFormOpen(true);
            }}
            className="flex items-center justify-center space-x-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--color-primary-light)] hover:bg-[var(--color-primary-hover)] transition duration-[var(--transition-fast)] transform hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create</span>
          </button>

          <div className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-bg-app)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[var(--color-text-main)]">July 2026</span>
              <div className="flex space-x-1">
                <button className="p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-xs text-[var(--color-text-muted)] font-medium">
              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <div
                  key={day}
                  className={`py-1 rounded-full text-center transition cursor-pointer hover:bg-[var(--color-surface)] ${
                    day === 27
                      ? "bg-[var(--color-primary)] text-white font-bold"
                      : "text-[var(--color-text-main)]"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              My Calendars
            </h3>
            <div className="space-y-2.5">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4.5 w-4.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition">
                  Work
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4.5 w-4.5 rounded border-[var(--color-border)] text-green-500 focus:ring-green-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-main)] group-hover:text-green-500 transition">
                  Personal
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4.5 w-4.5 rounded border-[var(--color-border)] text-purple-500 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-[var(--color-text-main)] group-hover:text-purple-500 transition">
                  Reminders
                </span>
              </label>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 flex overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] flex items-center justify-center z-50">
              <div className="flex flex-col space-y-4 w-80 p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6"></div>
              </div>
            </div>
          )}
          <div key={view + currentDate.toISOString()} className="flex flex-1 overflow-hidden animate-fade-in">
            {view === "month" ? (
              <MonthGrid
                currentDate={currentDate}
                events={data?.events || []}
                onEventClick={(event) => {
                  setEditingEvent(event);
                  setFormOpen(true);
                }}
              />
            ) : (
              <CalendarGrid
                view={view}
                currentDate={currentDate}
                events={data?.events || []}
                onEventClick={(event) => {
                  setEditingEvent(event);
                  setFormOpen(true);
                }}
                onEventMove={handleEventMove}
                onEventResize={handleEventResize}
              />
            )}
          </div>
        </main>
      </div>

      <EventForm
        isOpen={isFormOpen}
        onClose={() => setFormOpen(false)}
        defaultDate={currentDate}
        event={editingEvent || undefined}
      />
    </div>
  );
}
