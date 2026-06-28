import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  wrapperClassName?: string;
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  wrapperClassName = "mb-4",
  id,
  ...props
}) => {
  return (
    <div className={`flex flex-col ${wrapperClassName}`}>
      {label && (
        <label htmlFor={id} className="text-text-secondary text-xs font-semibold mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`px-3 py-2 border border-border bg-surface text-text-primary rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent disabled:opacity-50 text-base transition-colors ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      />
      {error && <span className="text-danger text-xs mt-1">{error}</span>}
    </div>
  );
};
