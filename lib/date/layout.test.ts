import assert from "assert";
import { computeEventLayout } from "./layout";

const testLayout = () => {
  const empty = computeEventLayout([]);
  assert.strictEqual(empty.length, 0);

  const single = computeEventLayout([
    { id: "1", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" }
  ]);
  assert.strictEqual(single.length, 1);
  assert.strictEqual(single[0].left, 0);
  assert.strictEqual(single[0].width, 100);

  const nonOverlapping = computeEventLayout([
    { id: "1", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" },
    { id: "2", startTime: "2026-07-01T11:00:00Z", endTime: "2026-07-01T12:00:00Z" }
  ]);
  assert.strictEqual(nonOverlapping.length, 2);
  const event1 = nonOverlapping.find(e => e.id === "1");
  const event2 = nonOverlapping.find(e => e.id === "2");
  assert.ok(event1 && event2);
  assert.strictEqual(event1.left, 0);
  assert.strictEqual(event1.width, 100);
  assert.strictEqual(event2.left, 0);
  assert.strictEqual(event2.width, 100);

  const overlap = computeEventLayout([
    { id: "1", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" },
    { id: "2", startTime: "2026-07-01T10:30:00Z", endTime: "2026-07-01T11:30:00Z" }
  ]);
  assert.strictEqual(overlap.length, 2);
  const ov1 = overlap.find(e => e.id === "1");
  const ov2 = overlap.find(e => e.id === "2");
  assert.ok(ov1 && ov2);
  assert.strictEqual(ov1.width, 50);
  assert.strictEqual(ov1.left, 0);
  assert.strictEqual(ov2.width, 50);
  assert.strictEqual(ov2.left, 50);

  const cascade = computeEventLayout([
    { id: "A", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" },
    { id: "B", startTime: "2026-07-01T10:30:00Z", endTime: "2026-07-01T11:30:00Z" },
    { id: "C", startTime: "2026-07-01T11:00:00Z", endTime: "2026-07-01T12:00:00Z" }
  ]);
  assert.strictEqual(cascade.length, 3);
  const a = cascade.find(e => e.id === "A");
  const b = cascade.find(e => e.id === "B");
  const c = cascade.find(e => e.id === "C");
  assert.ok(a && b && c);
  assert.strictEqual(a.width, 50);
  assert.strictEqual(a.left, 0);
  assert.strictEqual(b.width, 50);
  assert.strictEqual(b.left, 50);
  assert.strictEqual(c.width, 50);
  assert.strictEqual(c.left, 0);

  const concurrent = computeEventLayout([
    { id: "1", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" },
    { id: "2", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" },
    { id: "3", startTime: "2026-07-01T10:00:00Z", endTime: "2026-07-01T11:00:00Z" }
  ]);
  assert.strictEqual(concurrent.length, 3);
  concurrent.forEach((e) => {
    assert.strictEqual(e.width, 100 / 3);
  });
};

testLayout();
