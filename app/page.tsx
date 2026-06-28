"use client";

import React, { useState, useEffect, useRef } from "react";
import { format, addDays, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useQuery, useMutation, useQueryClient, useIsMutating } from "@tanstack/react-query";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { EventForm } from "@/components/calendar/EventForm";
import { request } from "@/lib/api/request";
import { EditScopePrompt } from "@/components/calendar/EditScopePrompt";
import { useToast } from "@/components/ui/Toast";
import { toUTC } from "@/lib/date/toUTC";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

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
  isException?: boolean;
}

export default function Page() {
  const queryClient = useQueryClient();
  const isMutating = useIsMutating();

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-07-01"));
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [pendingRecurrenceAction, setPendingRecurrenceAction] = useState<{
    type: "move" | "resize";
    event: CalendarEvent;
    newStart?: Date;
    newEnd: Date;
  } | null>(null);
  const { show: showToast } = useToast();

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/auth/sign-in";
  };


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

  const { data, error, isError } = useQuery({
    queryKey: ["events", view, startRange.toISOString(), endRange.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        start: startRange.toISOString(),
        end: endRange.toISOString(),
      });
      return request<{ events: CalendarEvent[] }>(`/api/events?${params.toString()}`);
    },
    enabled: !sessionPending && !!session?.user,
  });

  useEffect(() => {
    if (isError && error) {
      showToast(error.message || "Failed to load events", "error");
    }
  }, [isError, error, showToast]);

  const moveEventMutation = useMutation<
    { id: string; title: string; conflicts?: { title: string }[] },
    { message?: string },
    {
      event: CalendarEvent;
      startTime: string;
      endTime: string;
      editScope?: "THIS" | "THIS_AND_FOLLOWING" | "ALL";
      instanceDate?: string;
    },
    { previousQueries: [unknown, unknown][] }
  >({
    mutationFn: ({ event, startTime, endTime, editScope, instanceDate }) => {
      return request<{ id: string; title: string; conflicts?: { title: string }[] }>(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: event.version,
          startTime,
          endTime,
          editScope,
          instanceDate,
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
              ? { ...e, startTime, endTime }
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
        showToast(`Moved, but overlaps with: ${conflictTitles}`, "warning");
      } else {
        showToast("Event moved successfully", "success");
      }
    },
  });

  const executeEventMove = (
    event: CalendarEvent,
    newStart: Date,
    newEnd: Date,
    editScope?: "THIS" | "THIS_AND_FOLLOWING" | "ALL"
  ) => {
    const timezone =
      process.env.NEXT_PUBLIC_TIMEZONE ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    const localStartStr = format(newStart, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    const localEndStr = format(newEnd, "yyyy-MM-dd'T'HH:mm:ss.SSS");

    const startTimeUTC = toUTC(localStartStr, timezone, event.allDay);
    const endTimeUTC = toUTC(localEndStr, timezone, event.allDay);

    let instanceDate: string | undefined = undefined;
    if (event.isRecurring) {
      instanceDate = event.id.slice(-10);
    }

    moveEventMutation.mutate({
      event,
      startTime: startTimeUTC,
      endTime: endTimeUTC,
      editScope,
      instanceDate,
    });
  };

  const executeEventResize = (
    event: CalendarEvent,
    newEnd: Date,
    editScope?: "THIS" | "THIS_AND_FOLLOWING" | "ALL"
  ) => {
    const timezone =
      process.env.NEXT_PUBLIC_TIMEZONE ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";

    const localEndStr = format(newEnd, "yyyy-MM-dd'T'HH:mm:ss.SSS");
    const endTimeUTC = toUTC(localEndStr, timezone, event.allDay);

    let instanceDate: string | undefined = undefined;
    if (event.isRecurring) {
      instanceDate = event.id.slice(-10);
    }

    moveEventMutation.mutate({
      event,
      startTime: event.startTime,
      endTime: endTimeUTC,
      editScope,
      instanceDate,
    });
  };

  const handleEventMove = (event: CalendarEvent, newStart: Date, newEnd: Date) => {
    if (event.isRecurring && !event.isException) {
      setPendingRecurrenceAction({ type: "move", event, newStart, newEnd });
    } else {
      executeEventMove(event, newStart, newEnd, event.isException ? "THIS" : undefined);
    }
  };

  const handleEventResize = (event: CalendarEvent, newEnd: Date) => {
    if (event.isRecurring && !event.isException) {
      setPendingRecurrenceAction({ type: "resize", event, newEnd });
    } else {
      executeEventResize(event, newEnd, event.isException ? "THIS" : undefined);
    }
  };

  const handlePrev = () => {
    if (view === "day") {
      setCurrentDate(subDays(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subDays(currentDate, 7));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      setCurrentDate(addDays(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const miniCalendarDays = (() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const daysList: Date[] = [];
    let day = start;
    while (day <= end) {
      daysList.push(day);
      day = addDays(day, 1);
    }
    return daysList;
  })();

  if (sessionPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-app)]">
        <div
          className="flex flex-col items-center border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm animate-pulse"
          style={{ width: "320px", padding: "24px", borderRadius: "16px" }}
        >
          <div
            className="bg-border"
            style={{ height: "24px", width: "75%", borderRadius: "4px", marginBottom: "16px" }}
          />
          <div
            className="bg-border"
            style={{ height: "16px", width: "100%", borderRadius: "4px", marginBottom: "8px" }}
          />
          <div
            className="bg-border"
            style={{ height: "16px", width: "83%", borderRadius: "4px" }}
          />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[var(--color-bg-app)]">
        <p className="text-text-secondary" style={{ marginBottom: "16px" }}>
          You are not signed in.
        </p>
        <Link href="/auth/sign-in" className="font-semibold text-accent hover:underline">
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-app)] relative">
      {isMutating > 0 && (
        <div className="absolute top-16 left-0 right-0 h-0.5 bg-[var(--color-primary-light)] z-50 overflow-hidden pointer-events-none">
          <div className="w-full h-full bg-[var(--color-primary)] origin-left animate-loading-slide" />
        </div>
      )}
      <header
        style={{
          height: "64px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          paddingLeft: "24px",
          paddingRight: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 30,
          position: "relative"
        }}
      >
        {}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(59, 111, 224, 0.2)"
              }}
            >
              <svg
                style={{ height: "20px", width: "20px", color: "#FFFFFF" }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="18" rx="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v4m-3-2h6" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "var(--color-text-main)", lineHeight: "1.1" }}>
                Calendar
              </span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginTop: "2px" }}>
                Workspace
              </span>
            </div>
          </div>

          {}
          <div style={{ height: "24px", width: "1px", backgroundColor: "var(--color-border)" }} />

          {}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "var(--color-bg-app)",
                padding: "2px",
                borderRadius: "6px",
                border: "1px solid var(--color-border)"
              }}
            >
              <button
                onClick={handlePrev}
                title="Previous"
                className="hover:bg-surface hover:shadow-sm transition"
                style={{
                  padding: "6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)"
                }}
              >
                <svg style={{ height: "16px", width: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleToday}
                className="hover:bg-surface hover:shadow-sm transition"
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--color-text-main)"
                }}
              >
                Today
              </button>
              <button
                onClick={handleNext}
                title="Next"
                className="hover:bg-surface hover:shadow-sm transition"
                style={{
                  padding: "6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)"
                }}
              >
                <svg style={{ height: "16px", width: "16px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {}
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--color-text-main)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                userSelect: "none",
                whiteSpace: "nowrap"
              }}
            >
              <svg style={{ height: "18px", width: "18px", color: "var(--color-text-muted)" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {format(currentDate, "MMMM yyyy")}
            </h1>
          </div>
        </div>

        {}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {}
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--color-bg-app)",
              padding: "2px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)"
            }}
          >
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="transition"
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  textTransform: "capitalize",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: view === v ? "var(--color-surface)" : "transparent",
                  color: view === v ? "var(--color-primary)" : "var(--color-text-muted)",
                  boxShadow: view === v ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              className="hover:bg-surface hover:shadow-sm transition"
              title="Search"
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                background: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg style={{ height: "18px", width: "18px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button
              className="hover:bg-surface hover:shadow-sm transition"
              title="Notifications"
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                background: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg style={{ height: "18px", width: "18px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
              </svg>
              <span
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  height: "8px",
                  width: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-danger)",
                  border: "2px solid var(--color-surface)"
                }}
              />
            </button>
          </div>

          {/* User Menu */}
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setUserMenuOpen(!isUserMenuOpen)}
              className="hover:opacity-90 transition"
              style={{
                height: "32px",
                width: "32px",
                borderRadius: "50%",
                backgroundColor: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "14px",
                border: "2px solid var(--color-surface)",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                outline: "none"
              }}
            >
              {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
            </button>
            {isUserMenuOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: "absolute",
                  right: 0,
                  marginTop: "8px",
                  width: "240px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  padding: "4px",
                  zIndex: 50,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)"
                }}
              >
                <div style={{ padding: "12px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      height: "32px",
                      width: "32px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-bg-app)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-main)",
                      fontWeight: 600,
                      fontSize: "12px",
                      border: "1px solid var(--color-border)"
                    }}
                  >
                    {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                      {session.user.name || "User"}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0, marginTop: "2px" }}>
                      {session.user.email}
                    </p>
                  </div>
                </div>

                <div style={{ padding: "4px 0" }}>
                  <button
                    onClick={() => {}}
                    className="hover:bg-surface-muted hover:text-text-primary transition"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      border: "none",
                      background: "none",
                      cursor: "pointer"
                    }}
                  >
                    <svg style={{ height: "16px", width: "16px", color: "var(--color-text-muted)" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="hover:bg-surface-muted transition"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--color-danger)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      border: "none",
                      background: "none",
                      cursor: "pointer"
                    }}
                  >
                    <svg style={{ height: "16px", width: "16px", color: "var(--color-danger)" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col overflow-y-auto"
          style={{ width: "260px", minWidth: "260px", flexShrink: 0, padding: "24px", gap: "24px" }}
        >
          <button
            onClick={() => {
              setEditingEvent(null);
              setFormOpen(true);
            }}
            className="flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-md hover:bg-[var(--color-primary-hover)] transition duration-[var(--transition-fast)] transform hover:-translate-y-0.5 cursor-pointer"
            style={{ padding: "8px 16px", gap: "8px", width: "fit-content", fontWeight: 600, fontSize: "14px" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Create</span>
          </button>

          <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-app)]" style={{ padding: "16px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
              <span className="text-sm font-semibold text-[var(--color-text-main)]">
                {format(currentDate, "MMMM yyyy")}
              </span>
              <div className="flex" style={{ gap: "4px" }}>
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition cursor-pointer"
                  style={{ border: "none", background: "none" }}
                >
                  <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-1 rounded hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] transition cursor-pointer"
                  style={{ border: "none", background: "none" }}
                >
                  <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div
              className="text-center text-xs text-[var(--color-text-muted)] font-medium"
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: "8px" }}
            >
              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
              {miniCalendarDays.map((day) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isSelected = format(day, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");
                const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setCurrentDate(day)}
                    className="rounded-full text-center transition cursor-pointer hover:bg-[var(--color-surface)]"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      margin: "0 auto",
                      fontSize: "11px",
                      border: "none",
                      backgroundColor: isSelected
                        ? "var(--color-primary)"
                        : isToday
                        ? "var(--color-primary-light)"
                        : "transparent",
                      color: isSelected
                        ? "#FFFFFF"
                        : isToday
                        ? "var(--color-primary)"
                        : isCurrentMonth
                        ? "var(--color-text-main)"
                        : "var(--color-text-muted)",
                      fontWeight: isSelected || isToday ? "bold" : "normal",
                    }}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
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
          <div key={view + currentDate.toISOString()} className="flex flex-1 overflow-hidden">
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

      {pendingRecurrenceAction && (
        <EditScopePrompt
          isOpen={!!pendingRecurrenceAction}
          onClose={() => setPendingRecurrenceAction(null)}
          onConfirm={(scope) => {
            if (pendingRecurrenceAction.type === "move") {
              executeEventMove(
                pendingRecurrenceAction.event,
                pendingRecurrenceAction.newStart!,
                pendingRecurrenceAction.newEnd,
                scope
              );
            } else {
              executeEventResize(
                pendingRecurrenceAction.event,
                pendingRecurrenceAction.newEnd,
                scope
              );
            }
            setPendingRecurrenceAction(null);
          }}
          actionType="edit"
        />
      )}
    </div>
  );
}
