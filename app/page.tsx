"use client";

import React, { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { CalendarGrid, CalendarEvent } from "@/components/calendar/CalendarGrid";

const mockEvents: CalendarEvent[] = [
  {
    id: "mock-1",
    title: "Sprint Planning",
    description: "Align on next sprint goals",
    startTime: "2026-07-01T10:00:00Z",
    endTime: "2026-07-01T11:00:00Z",
    allDay: false,
    version: 1,
  },
  {
    id: "mock-2",
    title: "Design Sync",
    description: "Review new design tokens",
    startTime: "2026-07-01T10:30:00Z",
    endTime: "2026-07-01T11:30:00Z",
    allDay: false,
    version: 1,
  },
  {
    id: "mock-3",
    title: "Tech Spec Review",
    description: "Review event layout math spec",
    startTime: "2026-07-01T11:00:00Z",
    endTime: "2026-07-01T12:00:00Z",
    allDay: false,
    version: 1,
  },
  {
    id: "mock-4",
    title: "Lunch Break",
    description: "Standalone lunch event",
    startTime: "2026-07-01T12:30:00Z",
    endTime: "2026-07-01T13:30:00Z",
    allDay: false,
    version: 1,
  },
  {
    id: "mock-5",
    title: "Prisma & Neon Session",
    description: "Verify DB adapters",
    startTime: "2026-07-02T14:00:00Z",
    endTime: "2026-07-02T15:30:00Z",
    allDay: false,
    version: 1,
  },
];

export default function Page() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-07-01"));

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
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-app)]">
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
          <button className="flex items-center justify-center space-x-2 rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--color-primary-light)] hover:bg-[var(--color-primary-hover)] transition duration-[var(--transition-fast)] transform hover:-translate-y-0.5">
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

        <main className="flex-1 p-6 flex overflow-hidden">
          {view === "month" ? (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="max-w-md p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg text-center flex flex-col items-center space-y-6 transition hover:shadow-xl duration-[var(--transition-normal)]">
                <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-main)]">
                    No views active
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Welcome to your Calendar. Setup is complete and all design tokens are verified. Choose a view or create an event to get started.
                  </p>
                </div>
                <button className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-app)] text-sm font-medium transition duration-[var(--transition-fast)]">
                  Explore Settings
                </button>
              </div>
            </div>
          ) : (
            <CalendarGrid view={view} currentDate={currentDate} events={mockEvents} />
          )}
        </main>
      </div>
    </div>
  );
}
