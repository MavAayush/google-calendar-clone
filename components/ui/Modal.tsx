import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animate, setAnimate] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setShouldRender(true);
    } else {
      setAnimate(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimate(true), 10);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const focusable = modalRef.current?.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    if (focusable && focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${
        animate ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(26, 29, 33, 0.4)" }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`bg-[var(--color-surface)] border border-[var(--color-border)] w-full max-w-md rounded-2xl shadow-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          animate ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-main)]">{title}</h2>
            <button
              onClick={onClose}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] text-xl p-1 rounded-sm focus:outline-none"
            >
              &times;
            </button>
          </div>
        )}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};
