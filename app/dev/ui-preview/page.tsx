"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function UIPreview() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [textVal, setTextVal] = useState("");
  const [selectVal, setSelectVal] = useState("daily");
  const toast = useToast();

  return (
    <div className="p-8 bg-surface min-h-screen text-text-primary">
      <h1 className="text-xl font-semibold mb-6">UI Primitives Preview</h1>

      <div className="flex flex-col gap-8">
        <section className="border border-border p-6 rounded-md">
          <h2 className="text-lg font-semibold mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </section>

        <section className="border border-border p-6 rounded-md">
          <h2 className="text-lg font-semibold mb-4">Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="text-input"
              label="Text Input"
              placeholder="Enter some text"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
            />
            <Input
              id="error-input"
              label="Input with Error"
              error="This field is required"
              defaultValue="Invalid value"
            />
            <Input id="date-input" label="Date Input" type="date" />
            <Input id="time-input" label="Time Input" type="time" />
          </div>
        </section>

        <section className="border border-border p-6 rounded-md">
          <h2 className="text-lg font-semibold mb-4">Selects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              id="freq-select"
              label="Frequency"
              value={selectVal}
              onChange={(e) => setSelectVal(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
            <Select id="error-select" label="Select with Error" error="Select a valid frequency">
              <option value="">Choose one</option>
            </Select>
          </div>
        </section>

        <section className="border border-border p-6 rounded-md">
          <h2 className="text-lg font-semibold mb-4">Modal & Toasts</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.show("Success toast triggered!", "success")}
            >
              Trigger Success Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.show("Warning toast triggered!", "warning")}
            >
              Trigger Warning Toast
            </Button>
            <Button
              variant="danger"
              onClick={() => toast.show("Error toast triggered!", "error")}
            >
              Trigger Error Toast
            </Button>
          </div>
        </section>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Test Modal">
        <div className="flex flex-col gap-4">
          <p className="text-base text-text-secondary">
            This modal traps focus, closes on Escape, and closes on clicking the backdrop overlay.
          </p>
          <Input id="modal-input" label="Modal Field" placeholder="Type here..." />
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => {
              toast.show("Action confirmed!", "success");
              setIsModalOpen(false);
            }}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
