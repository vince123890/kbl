"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/auth/session";

export function SubmitButton({
  children,
  pendingText = "Memproses…",
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "danger" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "border border-border hover:bg-brand-soft",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`tap rounded-lg px-4 text-sm font-medium transition disabled:opacity-60 ${styles} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function Alert({ result }: { result: ActionResult | null | undefined }) {
  if (!result) return null;
  if (result.ok && !result.message) return null;
  const ok = result.ok;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${ok ? "bg-brand-soft text-brand-strong" : "bg-danger-soft text-danger"}`}
    >
      {ok ? result.message : result.error}
    </p>
  );
}

export function TextField({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  error,
  help,
  autoComplete,
  readOnly,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  error?: string;
  help?: string;
  autoComplete?: string;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        readOnly={readOnly}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`tap w-full rounded-lg border bg-surface px-3 outline-none focus:ring-2 focus:ring-brand ${
          error ? "border-danger" : "border-border"
        } ${readOnly ? "bg-background text-muted" : ""}`}
      />
      {help && !error && <span className="mt-1 block text-xs text-muted">{help}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}
