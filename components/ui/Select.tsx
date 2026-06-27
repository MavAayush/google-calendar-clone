import React from "react";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  children,
  className = "",
  id,
  ...props
}) => {
  return (
    <div className="flex flex-col mb-4">
      {label && (
        <label htmlFor={id} className="text-text-secondary text-sm font-semibold mb-1">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`px-3 py-2 border border-border bg-surface text-text-primary rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50 text-base transition-colors ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-danger text-xs mt-1">{error}</span>}
    </div>
  );
};
