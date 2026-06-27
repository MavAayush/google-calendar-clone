import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface EditScopePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: "THIS" | "THIS_AND_FOLLOWING" | "ALL") => void;
  actionType: "edit" | "delete";
}

const scopeOptions: {
  value: "THIS" | "THIS_AND_FOLLOWING" | "ALL";
  label: string;
  description: (action: "edit" | "delete") => string;
}[] = [
  {
    value: "THIS",
    label: "This event",
    description: (action) =>
      action === "edit"
        ? "Only this occurrence will be modified"
        : "Only this occurrence will be deleted",
  },
  {
    value: "THIS_AND_FOLLOWING",
    label: "This and following events",
    description: (action) =>
      action === "edit"
        ? "This and all future occurrences will be modified"
        : "This and all future occurrences will be deleted",
  },
  {
    value: "ALL",
    label: "All events",
    description: (action) =>
      action === "edit"
        ? "All occurrences in the series will be modified"
        : "The entire series will be deleted",
  },
];

export const EditScopePrompt: React.FC<EditScopePromptProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionType,
}) => {
  const [selectedScope, setSelectedScope] = useState<"THIS" | "THIS_AND_FOLLOWING" | "ALL">("THIS");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedScope);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={actionType === "edit" ? "Edit recurring event" : "Delete recurring event"}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          {scopeOptions.map((opt) => {
            const isSelected = selectedScope === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start space-x-3 cursor-pointer p-3 rounded-lg transition border ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-light,#EAF0FD)]"
                    : "border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-bg-app)]"
                }`}
              >
                <input
                  type="radio"
                  name="editScope"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setSelectedScope(opt.value)}
                  className="mt-0.5 h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                />
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-semibold ${
                      isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-text-main)]"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {opt.description(actionType)}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {actionType === "delete" && selectedScope === "ALL" && (
          <p className="text-xs text-[var(--color-danger,#C8442C)] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ⚠️ This will permanently delete the entire series and cannot be undone.
          </p>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={actionType === "delete" ? "danger" : "primary"}
          >
            {actionType === "delete" ? "Delete" : "OK"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
