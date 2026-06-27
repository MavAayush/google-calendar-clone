import React, { useState, useRef } from "react";
import { startOfWeek, addDays, format, startOfDay, endOfDay } from "date-fns";
import { computeEventLayout } from "@/lib/date/layout";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  version: number;
}

interface CalendarGridProps {
  view: "day" | "week";
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventMove: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
  onEventResize: (event: CalendarEvent, newEnd: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  view,
  currentDate,
  events,
  onEventClick,
  onEventMove,
  onEventResize,
}) => {
  const start = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = view === "day"
    ? [currentDate]
    : Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const [resizing, setResizing] = useState<{
    id: string;
    tempTop: number;
    tempHeight: number;
    isTop: boolean;
  } | null>(null);
  const ignoreNextClickRef = useRef(false);

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    const draggedEvent = events.find((ev) => ev.id === eventId);
    if (!draggedEvent) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - rect.top;

    const hourFraction = dropY / 60;
    const dropMinutes = Math.round(hourFraction * 60);
    const roundedMinutes = Math.round(dropMinutes / 15) * 15;

    const newStart = new Date(day);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(roundedMinutes);

    const durationMs = new Date(draggedEvent.endTime).getTime() - new Date(draggedEvent.startTime).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    onEventMove(draggedEvent, newStart, newEnd);
  };

  const handleResizeStart = (
    e: React.MouseEvent<HTMLDivElement>,
    event: CalendarEvent,
    originalTop: number,
    originalHeight: number,
    isTop: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    ignoreNextClickRef.current = false;

    const startY = e.clientY;
    const startTop = originalTop;
    const startHeight = originalHeight;
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);

    const card = document.getElementById(`event-card-${event.id}`);
    if (card) card.setAttribute("draggable", "false");

    const handleMouseMove = (moveEvent: MouseEvent) => {
      ignoreNextClickRef.current = true;
      const deltaY = moveEvent.clientY - startY;

      if (isTop) {
        const tempHeight = Math.max(15, startHeight - deltaY);
        const tempTop = startTop + (startHeight - tempHeight);
        setResizing({ id: event.id, tempTop, tempHeight, isTop: true });
      } else {
        const tempHeight = Math.max(15, startHeight + deltaY);
        setResizing({ id: event.id, tempTop: startTop, tempHeight, isTop: false });
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const deltaY = upEvent.clientY - startY;
      const card = document.getElementById(`event-card-${event.id}`);
      if (card) card.setAttribute("draggable", "true");

      if (ignoreNextClickRef.current) {
        setTimeout(() => {
          ignoreNextClickRef.current = false;
        }, 100);
      }

      setResizing(null);

      if (isTop) {
        const newDurationMinutes = Math.max(15, startHeight - deltaY);
        const roundedMinutes = Math.round(newDurationMinutes / 15) * 15;
        const newStart = new Date(endTime.getTime() - roundedMinutes * 60 * 1000);

        if (newStart.getTime() !== startTime.getTime()) {
          onEventMove(event, newStart, endTime);
        }
      } else {
        const newDurationMinutes = Math.max(15, startHeight + deltaY);
        const roundedMinutes = Math.round(newDurationMinutes / 15) * 15;
        const newEnd = new Date(startTime.getTime() + roundedMinutes * 60 * 1000);

        if (newEnd.getTime() !== endTime.getTime()) {
          onEventResize(event, newEnd);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm">
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-app)]">
        <div className="w-16 flex-shrink-0" />
        <div className="flex flex-1">
          {days.map((day) => {
            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
            return (
              <div
                key={day.toISOString()}
                className="flex-1 py-4 text-center border-r border-[var(--color-border)] last:border-r-0"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {format(day, "EEE")}
                </span>
                <div className="mt-1 flex items-center justify-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition ${
                      isToday
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-main)]"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-y-auto">
        <div className="w-16 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-app)] select-none">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] pr-2 text-right text-[10px] font-semibold text-[var(--color-text-muted)] pt-1">
              {hour > 0 ? formatHour(hour) : ""}
            </div>
          ))}
        </div>

        <div className="relative flex flex-1 h-[1440px]">
          <div className="absolute inset-0 pointer-events-none">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-[var(--color-border)] last:border-b-0"
              />
            ))}
          </div>

          <div className="relative flex flex-1 h-full z-10">
            {days.map((day) => {
              const dayStart = startOfDay(day);
              const dayEnd = endOfDay(day);

              const dayEvents = events.filter((e) => {
                const eStart = new Date(e.startTime);
                const eEnd = new Date(e.endTime);
                return eStart < dayEnd && eEnd > dayStart;
              });

              const layouts = computeEventLayout(
                dayEvents.map((e) => ({
                  id: e.id,
                  startTime: e.startTime,
                  endTime: e.endTime,
                }))
              );

              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, day)}
                  className="relative flex-1 h-full border-r border-[var(--color-border)] last:border-r-0"
                >
                  {dayEvents.map((event) => {
                    const layout = layouts.find((l) => l.id === event.id);
                    if (!layout) return null;

                    const eStart = new Date(event.startTime);
                    const eEnd = new Date(event.endTime);

                    const startOffset = Math.max(0, (eStart.getTime() - dayStart.getTime()) / (1000 * 60 * 60));
                    const endOffset = Math.min(24, (eEnd.getTime() - dayStart.getTime()) / (1000 * 60 * 60));

                    const originalTop = startOffset * 60;
                    const originalHeight = Math.max(24, (endOffset - startOffset) * 60);

                    const isResizingThis = resizing && resizing.id === event.id;
                    const top = isResizingThis ? resizing.tempTop : originalTop;
                    const height = isResizingThis ? resizing.tempHeight : originalHeight;

                    let eStartToRender = eStart;
                    let eEndToRender = eEnd;

                    if (isResizingThis) {
                      const roundedTempMinutes = Math.round(resizing.tempHeight / 15) * 15;
                      if (resizing.isTop) {
                        eStartToRender = new Date(eEnd.getTime() - roundedTempMinutes * 60 * 1000);
                      } else {
                        eEndToRender = new Date(eStart.getTime() + roundedTempMinutes * 60 * 1000);
                      }
                    }

                    return (
                      <div
                        key={event.id}
                        id={`event-card-${event.id}`}
                        draggable={true}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", event.id)}
                        onClick={(e) => {
                          if (ignoreNextClickRef.current) {
                            e.stopPropagation();
                            e.preventDefault();
                            return;
                          }
                          onEventClick(event);
                        }}
                        className="absolute p-2 rounded-lg bg-[var(--color-primary-light)] border-l-4 border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm cursor-pointer hover:shadow-md transition-[box-shadow,transform] duration-[var(--transition-fast)] overflow-hidden select-none hover:scale-[1.01] active:opacity-60"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `${layout.left}%`,
                          width: `${layout.width - 1}%`,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-3 cursor-n-resize hover:bg-black/10 transition-colors select-none z-20"
                          onMouseDown={(e) => handleResizeStart(e, event, originalTop, originalHeight, true)}
                          onMouseEnter={(e) => {
                            const cardEl = e.currentTarget.closest("[draggable]");
                            if (cardEl) cardEl.setAttribute("draggable", "false");
                          }}
                          onMouseLeave={(e) => {
                            if (!resizing) {
                              const cardEl = e.currentTarget.closest("[draggable]");
                              if (cardEl) cardEl.setAttribute("draggable", "true");
                            }
                          }}
                        />
                        <div className="font-semibold text-xs truncate leading-tight">
                          {event.title}
                        </div>
                        {height >= 40 && (
                          <div className="text-[10px] opacity-80 mt-0.5 truncate">
                            {format(eStartToRender, "h:mm a")} - {format(eEndToRender, "h:mm a")}
                          </div>
                        )}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize hover:bg-black/10 transition-colors select-none z-20"
                          onMouseDown={(e) => handleResizeStart(e, event, originalTop, originalHeight, false)}
                          onMouseEnter={(e) => {
                            const cardEl = e.currentTarget.closest("[draggable]");
                            if (cardEl) cardEl.setAttribute("draggable", "false");
                          }}
                          onMouseLeave={(e) => {
                            if (!resizing) {
                              const cardEl = e.currentTarget.closest("[draggable]");
                              if (cardEl) cardEl.setAttribute("draggable", "true");
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
