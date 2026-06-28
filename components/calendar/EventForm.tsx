import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { request } from "@/lib/api/request";
import { toUTC } from "@/lib/date/toUTC";
import { toLocal } from "@/lib/date/toLocal";
import { recurrenceInputSchema } from "@/lib/validation/recurrence";
import { CalendarEvent } from "./CalendarGrid";
import { EditScopePrompt } from "./EditScopePrompt";
import { updateQueryCacheWithEvent } from "@/lib/api/cache";

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: Date;
  event?: CalendarEvent;
}

export const EventForm: React.FC<EventFormProps> = ({
  isOpen,
  onClose,
  defaultDate = new Date("2026-07-01"),
  event,
}) => {
  const queryClient = useQueryClient();
  const { show: showToast } = useToast();

  const timezone =
    process.env.NEXT_PUBLIC_TIMEZONE ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  const initialValues = (() => {
    if (!event) {
      return {
        title: "",
        description: "",
        date: format(defaultDate, "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "10:00",
        allDay: false,
        repeatType: "none" as "none" | "DAILY" | "WEEKLY" | "MONTHLY",
        repeatInterval: 1,
        repeatByDay: [] as string[],
        endsType: "never" as "never" | "on",
        endsOnDate: "",
      };
    }

    const localStart = toLocal(event.startTime, timezone, event.allDay);
    const localEnd = toLocal(event.endTime, timezone, event.allDay);
    const datePart = localStart.split("T")[0];
    const startPart = localStart.split("T")[1].substring(0, 5);
    const endPart = localEnd.split("T")[1].substring(0, 5);

    const recRule = event.recurrence;

    return {
      title: event.title,
      description: event.description || "",
      date: datePart,
      startTime: startPart,
      endTime: endPart,
      allDay: event.allDay,
      repeatType: (recRule?.frequency || "none") as "none" | "DAILY" | "WEEKLY" | "MONTHLY",
      repeatInterval: recRule?.interval || 1,
      repeatByDay: (recRule?.byDay || []) as string[],
      endsType: (recRule?.seriesEndDate ? "on" : "never") as "never" | "on",
      endsOnDate: recRule?.seriesEndDate || "",
    };
  })();

  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [date, setDate] = useState(initialValues.date);
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [endTime, setEndTime] = useState(initialValues.endTime);
  const [allDay, setAllDay] = useState(initialValues.allDay);

  const [repeatType, setRepeatType] = useState(initialValues.repeatType);
  const [repeatInterval, setRepeatInterval] = useState(initialValues.repeatInterval);
  const [repeatByDay, setRepeatByDay] = useState(initialValues.repeatByDay);
  const [endsType, setEndsType] = useState(initialValues.endsType);
  const [endsOnDate, setEndsOnDate] = useState(initialValues.endsOnDate);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [scopePromptOpen, setScopePromptOpen] = useState(false);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    allDay: boolean;
    recurrenceRule?: {
      frequency: "DAILY" | "WEEKLY" | "MONTHLY";
      interval: number;
      seriesEndDate: string | null;
      byDay: string[] | null;
    } | null;
    version?: number;
  } | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (isOpen) {
      setTitle(initialValues.title);
      setDescription(initialValues.description);
      setDate(initialValues.date);
      setStartTime(initialValues.startTime);
      setEndTime(initialValues.endTime);
      setAllDay(initialValues.allDay);
      setRepeatType(initialValues.repeatType);
      setRepeatInterval(initialValues.repeatInterval);
      setRepeatByDay(initialValues.repeatByDay);
      setEndsType(initialValues.endsType);
      setEndsOnDate(initialValues.endsOnDate);
      setErrors({});
      setScopePromptOpen(false);
      setDeletePromptOpen(false);
      setPendingPayload(null);
    }
  }, [isOpen, event, defaultDate]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-enable react-hooks/exhaustive-deps */

  const mutation = useMutation<
    CalendarEvent & { conflicts?: { title: string }[] },
    { message?: string; fields?: Record<string, string> },
    {
      title: string;
      description: string | null;
      startTime: string;
      endTime: string;
      allDay: boolean;
      recurrenceRule?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY";
        interval: number;
        seriesEndDate: string | null;
        byDay: string[] | null;
      } | null;
      version?: number;
      editScope?: "THIS" | "THIS_AND_FOLLOWING" | "ALL";
      instanceDate?: string;
    },
    { previousQueries: [unknown, unknown][] }
  >({
    mutationFn: (payload) => {
      const url = event ? `/api/events/${event.id}` : "/api/events";
      const method = event ? "PATCH" : "POST";
      return request<CalendarEvent & { conflicts?: { title: string }[] }>(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onMutate: async (newEvent) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ["events"] });

      if (event) {
        queryClient.setQueriesData({ queryKey: ["events"] }, (old: { events: CalendarEvent[] } | undefined) => {
          if (!old || !old.events) return old;
          return {
            ...old,
            events: old.events.map((e: CalendarEvent) =>
              e.id === event.id
                ? { ...e, ...newEvent }
                : e
            ),
          };
        });
      }

      return { previousQueries };
    },
    onError: (err, newEvent, context) => {
      if (context?.previousQueries) {
        for (const [key, value] of context.previousQueries) {
          queryClient.setQueryData(key as readonly unknown[], value);
        }
      }

      if (err.fields) {
        setErrors(err.fields);
      } else {
        showToast(err.message || "Failed to save event", "error");
      }
    },
    onSuccess: (data, variables) => {
      if (variables.editScope || data.isRecurring || data.recurrence) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      } else {
        updateQueryCacheWithEvent(queryClient, data as CalendarEvent);
      }
      onClose();

      if (data.conflicts && data.conflicts.length > 0) {
        const conflictTitles = data.conflicts.map((c) => c.title).join(", ");
        showToast(`Saved, but overlaps with: ${conflictTitles}`, "warning");
      } else {
        showToast(event ? "Event updated successfully" : "Event created successfully", "success");
      }
    },
  });

  const deleteMutation = useMutation<
    void,
    { message?: string },
    { editScope?: "THIS" | "THIS_AND_FOLLOWING" | "ALL"; instanceDate?: string }
  >({
    mutationFn: (params) => {
      const urlParams = new URLSearchParams();
      if (params.editScope) urlParams.append("editScope", params.editScope);
      if (params.instanceDate) urlParams.append("instanceDate", params.instanceDate);
      
      const queryStr = urlParams.toString();
      const url = `/api/events/${event!.id}${queryStr ? `?${queryStr}` : ""}`;
      
      return request<void>(url, {
        method: "DELETE",
      });
    },
    onSuccess: (data, variables) => {
      if (variables.editScope || event?.isRecurring || event?.recurrence) {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      } else {
        updateQueryCacheWithEvent(queryClient, event as CalendarEvent, true);
      }
      showToast("Event deleted successfully", "success");
      onClose();
    },
    onError: (err) => {
      showToast(err.message || "Failed to delete event", "error");
    },
  });

  const handleDeleteClick = () => {
    if (event?.isRecurring) {
      setDeletePromptOpen(true);
    } else {
      if (window.confirm("Are you sure you want to delete this event?")) {
        deleteMutation.mutate({});
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!allDay && startTime >= endTime) {
      newErrors.endTime = "End time must be after start time";
    }

    if (repeatType !== "none") {
      if (endsType === "on" && !endsOnDate) {
        newErrors.endsOnDate = "End date is required";
      }
      if (repeatType === "WEEKLY" && repeatByDay.length === 0) {
        newErrors.repeatByDay = "At least one day must be selected";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let localStart = `${date}T${startTime}:00.000`;
    let localEnd = `${date}T${endTime}:00.000`;

    if (allDay) {
      localStart = `${date}T00:00:00.000`;
      const nextDateStr = format(addDays(new Date(date), 1), "yyyy-MM-dd");
      localEnd = `${nextDateStr}T00:00:00.000`;
    }

    const startTimeUTC = toUTC(localStart, timezone, allDay);
    const endTimeUTC = toUTC(localEnd, timezone, allDay);

    let recurrenceRule = null;
    if (repeatType !== "none") {
      recurrenceRule = {
        frequency: repeatType,
        interval: repeatInterval,
        byDay: repeatType === "WEEKLY" ? repeatByDay : null,
        seriesEndDate: endsType === "on" && endsOnDate ? endsOnDate : null,
      };

      const recParsed = recurrenceInputSchema.safeParse(recurrenceRule);
      if (!recParsed.success) {
        const zodErrors: Record<string, string> = {};
        recParsed.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            zodErrors[issue.path[0].toString()] = issue.message;
          }
        });
        setErrors(zodErrors);
        return;
      }
    }

    const payload: {
      title: string;
      description: string | null;
      startTime: string;
      endTime: string;
      allDay: boolean;
      recurrenceRule?: {
        frequency: "DAILY" | "WEEKLY" | "MONTHLY";
        interval: number;
        seriesEndDate: string | null;
        byDay: string[] | null;
      } | null;
      version?: number;
    } = {
      title,
      description: description || null,
      startTime: startTimeUTC,
      endTime: endTimeUTC,
      allDay,
      recurrenceRule,
    };

    if (event) {
      payload.version = event.version;
    }

    if (event && event.isRecurring && !event.isException) {
      setPendingPayload(payload);
      setScopePromptOpen(true);
    } else {
      const finalPayload = {
        ...payload,
        ...(event && event.isException ? {
          editScope: "THIS" as const,
          instanceDate: event.id.slice(-10),
        } : {}),
      };
      mutation.mutate(finalPayload);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event ? "Edit Event" : "Create Event"}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Input
          label="Title"
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="Add title"
          autoFocus
          wrapperClassName="mb-1"
          style={{
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            padding: "6px 10px",
            fontSize: "13px",
            fontWeight: 500,
            outline: "none"
          }}
        />

        <div className="flex flex-col" style={{ marginBottom: "4px" }}>
          <label htmlFor="event-description" style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}>
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="px-3 py-2 border border-border bg-surface text-text-primary text-base resize-none transition-colors"
            style={{
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              padding: "6px 10px",
              outline: "none",
              fontSize: "13px",
              height: "56px"
            }}
            placeholder="Add description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4" style={{ marginBottom: "4px" }}>
          <Input
            label="Date"
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            wrapperClassName="mb-0"
            style={{ borderRadius: "8px", border: "1px solid var(--color-border)", padding: "6px 10px", fontSize: "13px" }}
          />

          <div className="flex items-center pl-2" style={{ paddingTop: "16px" }}>
            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  style={{ display: "none" }}
                />
                <div
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "10px",
                    backgroundColor: allDay ? "var(--color-primary)" : "#E2E4E8",
                    transition: "background-color 0.2s"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "3px",
                    top: "3px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    transform: allDay ? "translateX(16px)" : "translateX(0)",
                    transition: "transform 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
                  }}
                />
              </div>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-main)" }}>All day</span>
            </label>
          </div>
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-4" style={{ marginBottom: "4px" }}>
            <Input
              label="Start Time"
              id="event-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              wrapperClassName="mb-0"
              style={{ borderRadius: "8px", border: "1px solid var(--color-border)", padding: "6px 10px", fontSize: "13px" }}
            />
            <Input
              label="End Time"
              id="event-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              error={errors.endTime}
              wrapperClassName="mb-0"
              style={{ borderRadius: "8px", border: "1px solid var(--color-border)", padding: "6px 10px", fontSize: "13px" }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: "4px" }}>
          <div className="flex flex-col">
            <label htmlFor="event-repeat" style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "2px" }}>
              Repeat
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <select
                id="event-repeat"
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value as "none" | "DAILY" | "WEEKLY" | "MONTHLY")}
                style={{
                  width: "100%",
                  padding: "6px 28px 6px 10px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-text-main)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "6px",
                  outline: "none",
                  appearance: "none",
                  cursor: "pointer"
                }}
              >
                <option value="none">Does not repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <div style={{ pointerEvents: "none", position: "absolute", top: "50%", right: "8px", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
                <svg style={{ height: "14px", width: "14px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {repeatType !== "none" ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", width: "100%" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  label="Repeat every"
                  id="event-repeat-interval"
                  type="number"
                  min={1}
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  wrapperClassName="mb-0"
                  style={{ borderRadius: "6px", border: "1px solid var(--color-border)", padding: "5px 10px", fontSize: "13px", width: "100%" }}
                />
              </div>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", paddingBottom: "6px", whiteSpace: "nowrap", flexShrink: 0 }}>
                {repeatInterval === 1
                  ? (repeatType === "DAILY" ? "day" : repeatType === "WEEKLY" ? "week" : "month")
                  : (repeatType === "DAILY" ? "days" : repeatType === "WEEKLY" ? "weeks" : "months")
                }
              </span>
            </div>
          ) : (
            <div />
          )}
        </div>

        {repeatType !== "none" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "4px" }}>
            {repeatType === "WEEKLY" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)" }}>Repeat on</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => {
                    const isSelected = repeatByDay.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setRepeatByDay(repeatByDay.filter((d) => d !== day));
                          } else {
                            setRepeatByDay([...repeatByDay, day]);
                          }
                        }}
                        className="transition"
                        style={{
                          display: "flex",
                          height: "24px",
                          width: "24px",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          backgroundColor: isSelected ? "var(--color-primary)" : "var(--color-surface)",
                          color: isSelected ? "#FFFFFF" : "var(--color-text-muted)",
                          boxShadow: isSelected ? "0 1px 3px rgba(59, 111, 224, 0.15)" : "none"
                        }}
                      >
                        {day.substring(0, 1)}
                      </button>
                    );
                  })}
                </div>
                {errors.repeatByDay && (
                  <span style={{ color: "var(--color-danger)", fontSize: "11px", marginTop: "2px" }}>{errors.repeatByDay}</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label htmlFor="event-ends-type" style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "2px" }}>
                  Ends
                </label>
                <div style={{ position: "relative", width: "100%" }}>
                  <select
                    id="event-ends-type"
                    value={endsType}
                    onChange={(e) => setEndsType(e.target.value as "never" | "on")}
                    style={{
                      width: "100%",
                      padding: "6px 28px 6px 10px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--color-text-main)",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                      borderRadius: "6px",
                      outline: "none",
                      appearance: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="never">Never</option>
                    <option value="on">On date</option>
                  </select>
                  <div style={{ pointerEvents: "none", position: "absolute", top: "50%", right: "8px", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex", alignItems: "center" }}>
                    <svg style={{ height: "14px", width: "14px" }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              {endsType === "on" && (
                <Input
                  label="End date"
                  id="event-ends-date"
                  type="date"
                  value={endsOnDate}
                  onChange={(e) => setEndsOnDate(e.target.value)}
                  error={errors.endsOnDate}
                  wrapperClassName="mb-0"
                  style={{ borderRadius: "6px", border: "1px solid var(--color-border)", padding: "5px 10px", fontSize: "13px" }}
                />
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid var(--color-border)", marginTop: "8px" }}>
          {event ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteClick}
              loading={deleteMutation.isPending}
              style={{ borderRadius: "8px", fontSize: "12px", padding: "6px 14px" }}
              className="hover:bg-danger/10 transition"
            >
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              style={{ borderRadius: "8px", fontSize: "12px", padding: "6px 14px" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              style={{ borderRadius: "8px", fontSize: "12px", padding: "6px 18px" }}
            >
              Save
            </Button>
          </div>
        </div>
      </form>

      {scopePromptOpen && (
        <EditScopePrompt
          isOpen={scopePromptOpen}
          onClose={() => {
            setScopePromptOpen(false);
            setPendingPayload(null);
          }}
          onConfirm={(scope) => {
            setScopePromptOpen(false);
            if (pendingPayload) {
              mutation.mutate({
                ...pendingPayload,
                editScope: scope,
                instanceDate: initialValues.date,
              });
            }
            setPendingPayload(null);
          }}
          actionType="edit"
        />
      )}

      {deletePromptOpen && (
        <EditScopePrompt
          isOpen={deletePromptOpen}
          onClose={() => setDeletePromptOpen(false)}
          onConfirm={(scope) => {
            setDeletePromptOpen(false);
            deleteMutation.mutate({
              editScope: scope,
              instanceDate: initialValues.date,
            });
          }}
          actionType="delete"
        />
      )}
    </Modal>
  );
};
