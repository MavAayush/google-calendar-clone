import prisma from "@/lib/db/client";

export interface CanonicalEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isRecurring: boolean;
  recurrence: null;
  version: number;
}

export const findConflictingEvents = async (
  userId: string,
  start: Date,
  end: Date,
  excludeEventId?: string
): Promise<CanonicalEvent[]> => {
  const conflicts = await prisma.event.findMany({
    where: {
      userId,
      startTime: { lt: end },
      endTime: { gt: start },
      id: excludeEventId ? { not: excludeEventId } : undefined,
    },
  });

  return conflicts.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    allDay: e.allDay,
    isRecurring: false,
    recurrence: null,
    version: e.version,
  }));
};
