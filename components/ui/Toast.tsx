"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "warning" | "error";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  show: (message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          let borderClass = "";
          if (toast.type === "success") {
            borderClass = "border-accent";
          } else if (toast.type === "warning") {
            borderClass = "border-text-secondary";
          } else if (toast.type === "error") {
            borderClass = "border-danger";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between min-w-[250px] max-w-sm p-4 bg-surface border-l-4 ${borderClass} rounded-sm shadow-sm transition-all duration-150`}
              role="alert"
            >
              <span className="text-sm font-semibold text-text-primary">
                {toast.message}
              </span>
              <button
                onClick={() => remove(toast.id)}
                className="ml-4 text-text-secondary hover:text-text-primary text-base font-semibold focus:outline-none focus:ring-1 focus:ring-accent"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
