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
    { id: string; title: string; conflicts?: { title: string }[] },
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
      return request<{ id: string; title: string; conflicts?: { title: string }[] }>(url, {
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
                ? { ...e, ...newEvent, version: e.version + 1 }
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onClose();

      if (data.conflicts && data.conflicts.length > 0) {
        const conflictTitles = data.conflicts.map((c) => c.title).join(", ");
        showToast(`⚠️ Saved, but overlaps with: ${conflictTitles}`, "warning");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
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

    if (event && event.isRecurring) {
      setPendingPayload(payload);
      setScopePromptOpen(true);
    } else {
      mutation.mutate(payload);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event ? "Edit Event" : "Create Event"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="Add title"
          autoFocus
        />

        <div className="flex flex-col mb-4">
          <label htmlFor="event-description" className="text-text-secondary text-sm font-semibold mb-1">
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="px-3 py-2 border border-border bg-surface text-text-primary rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50 text-base resize-none h-24 transition-colors"
            placeholder="Add description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date"
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <div className="flex items-center pl-2 pt-6">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--color-text-main)]">All day</span>
            </label>
          </div>
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              id="event-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              id="event-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              error={errors.endTime}
            />
          </div>
        )}

        <div className="flex flex-col space-y-1">
          <label htmlFor="event-repeat" className="text-[var(--color-text-muted)] text-sm font-semibold">
            Repeat
          </label>
          <select
            id="event-repeat"
            value={repeatType}
            onChange={(e) => setRepeatType(e.target.value as "none" | "DAILY" | "WEEKLY" | "MONTHLY")}
            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-sm cursor-pointer"
          >
            <option value="none">Does not repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>

        {repeatType !== "none" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Repeat every"
                id="event-repeat-interval"
                type="number"
                min={1}
                value={repeatInterval}
                onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className="flex items-end pb-3 text-sm font-medium text-[var(--color-text-muted)]">
                {repeatType === "DAILY" ? "day(s)" : repeatType === "WEEKLY" ? "week(s)" : "month(s)"}
              </div>
            </div>

            {repeatType === "WEEKLY" && (
              <div className="flex flex-col space-y-1.5">
                <span className="text-[var(--color-text-muted)] text-sm font-semibold">Repeat on</span>
                <div className="flex flex-wrap gap-2">
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
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition border ${
                          isSelected
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]"
                        }`}
                      >
                        {day.substring(0, 1)}
                      </button>
                    );
                  })}
                </div>
                {errors.repeatByDay && (
                  <span className="text-red-500 text-xs mt-1">{errors.repeatByDay}</span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1">
                <label htmlFor="event-ends-type" className="text-[var(--color-text-muted)] text-sm font-semibold">
                  Ends
                </label>
                <select
                  id="event-ends-type"
                  value={endsType}
                  onChange={(e) => setEndsType(e.target.value as "never" | "on")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-sm cursor-pointer"
                >
                  <option value="never">Never</option>
                  <option value="on">On date</option>
                </select>
              </div>
              {endsType === "on" && (
                <Input
                  label="End date"
                  id="event-ends-date"
                  type="date"
                  value={endsOnDate}
                  onChange={(e) => setEndsOnDate(e.target.value)}
                  error={errors.endsOnDate}
                />
              )}
            </div>
          </>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border)]">
          {event ? (
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteClick}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex space-x-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
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
