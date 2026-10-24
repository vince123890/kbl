"use client";

import { useActionState } from "react";
import { updateParameterAction } from "@/app/(app)/admin/parameters/actions";
import { SubmitButton } from "@/components/form";

export interface ParameterRow {
  key: string;
  value: string;
  type: "int" | "bool" | "text";
  label: string;
  min_value: number | null;
  max_value: number | null;
  row_version: number;
}

export function ParameterForm({ p }: { p: ParameterRow }) {
  const [state, action] = useActionState(updateParameterAction.bind(null, p.key, p.row_version), null);
  const range =
    p.type === "int" && (p.min_value !== null || p.max_value !== null)
      ? `Rentang ${p.min_value ?? "−∞"} – ${p.max_value ?? "∞"}`
      : p.type === "bool"
        ? "true / false"
        : "";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      {p.type === "bool" ? (
        <select name="value" defaultValue={p.value} aria-label={p.label} className="tap rounded-lg border border-border bg-surface px-2 text-sm">
          <option value="true">Aktif (true)</option>
          <option value="false">Nonaktif (false)</option>
        </select>
      ) : (
        <input
          name="value"
          defaultValue={p.value}
          aria-label={p.label}
          inputMode={p.type === "int" ? "numeric" : "text"}
          className="tap w-32 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
      )}
      <SubmitButton variant="ghost" pendingText="…">
        Simpan
      </SubmitButton>
      {range && <span className="text-xs text-muted">{range}</span>}
      {state && (
        <span role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-foreground" : "text-danger"}`}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  );
}
