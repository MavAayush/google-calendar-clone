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
import { CalendarEvent } from "./CalendarGrid";

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
      };
    }

    const localStart = toLocal(event.startTime, timezone, event.allDay);
    const localEnd = toLocal(event.endTime, timezone, event.allDay);
    const datePart = localStart.split("T")[0];
    const startPart = localStart.split("T")[1].substring(0, 5);
    const endPart = localEnd.split("T")[1].substring(0, 5);

    return {
      title: event.title,
      description: event.description || "",
      date: datePart,
      startTime: startPart,
      endTime: endPart,
      allDay: event.allDay,
    };
  })();

  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [date, setDate] = useState(initialValues.date);
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [endTime, setEndTime] = useState(initialValues.endTime);
  const [allDay, setAllDay] = useState(initialValues.allDay);

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      setErrors({});
    }
  }, [isOpen, event, defaultDate]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-enable react-hooks/exhaustive-deps */

  const mutation = useMutation<
    { id: string; title: string; conflicts?: { title: string }[] },
    { message?: string; fields?: Record<string, string> },
    { title: string; description: string | null; startTime: string; endTime: string; allDay: boolean; version?: number },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!allDay && startTime >= endTime) {
      newErrors.endTime = "End time must be after start time";
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

    const payload: {
      title: string;
      description: string | null;
      startTime: string;
      endTime: string;
      allDay: boolean;
      version?: number;
    } = {
      title,
      description: description || null,
      startTime: startTimeUTC,
      endTime: endTimeUTC,
      allDay,
    };

    if (event) {
      payload.version = event.version;
    }

    mutation.mutate(payload);
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

        <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};
