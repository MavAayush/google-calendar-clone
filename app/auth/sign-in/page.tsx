"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithEmail } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInWithEmail, null);

  return (
    <div
      className="flex flex-col items-center justify-center bg-[var(--color-bg-app)]"
      style={{ minHeight: "100vh", padding: "24px" }}
    >
      <div
        className="border border-border rounded-md bg-surface shadow-sm"
        style={{ width: "100%", maxWidth: "420px", padding: "32px" }}
      >
        <div className="flex flex-col items-center" style={{ marginBottom: "24px" }}>
          <div
            className="flex items-center justify-center bg-[var(--color-primary-light)] text-[var(--color-primary)]"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              marginBottom: "16px",
            }}
          >
            <svg
              style={{ width: "24px", height: "24px" }}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="4" width="18" height="18" rx="4" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <circle cx="12" cy="14" r="2" fill="currentColor" />
            </svg>
          </div>
          <h1
            className="font-semibold text-xl text-text-primary"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            Sign in to your account
          </h1>
          <p
            className="text-sm text-text-secondary"
            style={{ marginTop: "4px", textAlign: "center" }}
          >
            Welcome back! Please enter your details.
          </p>
        </div>

        <form action={formAction} className="flex flex-col">
          <Input
            id="email"
            name="email"
            type="email"
            label="Email address"
            placeholder="john@example.com"
            required
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            required
          />

          {state?.error && (
            <div
              className="border border-danger text-danger text-sm rounded-sm"
              style={{
                backgroundColor: "rgba(200, 68, 44, 0.08)",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            loading={isPending}
            className="w-full bg-accent text-surface hover:opacity-90 transition-colors"
            style={{ height: "42px", marginTop: "8px" }}
          >
            Sign In
          </Button>
        </form>

        <div
          className="text-center text-sm text-text-secondary"
          style={{ marginTop: "24px" }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/sign-up"
            className="font-semibold text-accent hover:underline transition"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
