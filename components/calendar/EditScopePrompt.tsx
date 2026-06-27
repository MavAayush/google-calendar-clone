import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface EditScopePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: "THIS" | "THIS_AND_FOLLOWING" | "ALL") => void;
  actionType: "edit" | "delete";
}

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
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer p-2.5 rounded-lg hover:bg-[var(--color-bg-app)] hover:bg-opacity-50 transition border border-transparent hover:border-[var(--color-border)]">
            <input
              type="radio"
              name="editScope"
              value="THIS"
              checked={selectedScope === "THIS"}
              onChange={() => setSelectedScope("THIS")}
              className="h-4.5 w-4.5 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-text-main)]">
                This event
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Only this occurrence will be modified
              </span>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-2.5 rounded-lg opacity-40 cursor-not-allowed border border-transparent bg-slate-50/50">
            <input
              type="radio"
              name="editScope"
              value="THIS_AND_FOLLOWING"
              disabled
              checked={selectedScope === "THIS_AND_FOLLOWING"}
              className="h-4.5 w-4.5 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-not-allowed"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-text-main)]">
                This and following events
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                This and all future occurrences (Coming soon)
              </span>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-2.5 rounded-lg opacity-40 cursor-not-allowed border border-transparent bg-slate-50/50">
            <input
              type="radio"
              name="editScope"
              value="ALL"
              disabled
              checked={selectedScope === "ALL"}
              className="h-4.5 w-4.5 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-not-allowed"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-text-main)]">
                All events
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                All occurrences in the series (Coming soon)
              </span>
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            OK
          </Button>
        </div>
      </form>
    </Modal>
  );
};
