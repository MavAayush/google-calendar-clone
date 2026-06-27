import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  loading = false,
  className = "",
  disabled,
  ...props
}) => {
  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = "bg-accent text-surface hover:opacity-90 disabled:opacity-50";
  } else if (variant === "secondary") {
    variantClasses = "bg-surface-muted border border-border text-text-primary hover:bg-border disabled:opacity-50";
  } else if (variant === "danger") {
    variantClasses = "bg-danger text-surface hover:opacity-90 disabled:opacity-50";
  }

  return (
    <button
      disabled={disabled || loading}
      className={`px-4 py-2 font-semibold text-base rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
};
