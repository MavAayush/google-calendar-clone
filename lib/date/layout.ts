export interface LayoutInput {
  id: string;
  startTime: string;
  endTime: string;
}

export interface LayoutOutput {
  id: string;
  left: number;
  width: number;
}

export const computeEventLayout = (events: LayoutInput[]): LayoutOutput[] => {
  if (events.length === 0) return [];

  const parsed = events.map((e) => ({
    id: e.id,
    start: new Date(e.startTime).getTime(),
    end: new Date(e.endTime).getTime(),
  }));

  const sorted = [...parsed].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return a.end - b.end;
  });

  const groups: typeof sorted[] = [];
  let currentGroup: typeof sorted = [];
  let groupEnd = 0;

  for (const event of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(event);
      groupEnd = event.end;
    } else if (event.start < groupEnd) {
      currentGroup.push(event);
      groupEnd = Math.max(groupEnd, event.end);
    } else {
      groups.push(currentGroup);
      currentGroup = [event];
      groupEnd = event.end;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const results: LayoutOutput[] = [];

  for (const group of groups) {
    const columns: number[] = [];
    const eventColumnIndices: { [eventId: string]: number } = {};

    for (const event of group) {
      let columnIndex = -1;
      for (let i = 0; i < columns.length; i++) {
        if (event.start >= columns[i]) {
          columnIndex = i;
          break;
        }
      }

      if (columnIndex === -1) {
        columns.push(event.end);
        columnIndex = columns.length - 1;
      } else {
        columns[columnIndex] = event.end;
      }

      eventColumnIndices[event.id] = columnIndex;
    }

    const maxColumns = columns.length;
    const width = 100 / maxColumns;

    for (const event of group) {
      const colIndex = eventColumnIndices[event.id];
      results.push({
        id: event.id,
        left: colIndex * width,
        width: width,
      });
    }
  }

  return results;
};
