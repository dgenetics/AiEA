"use client";

import { cn } from "@/lib/utils";

/**
 * Native date input clipped to the parent content box.
 * appearance:none plus min-width:0 lets the control match a text input's box.
 * The border stays on the shell so WebKit cannot paint past it.
 */
export function DateField({
  value,
  onChange,
  muted,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  muted?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  return (
    <div
      className={cn(
        "date-field-shell",
        muted && "date-field-shell--muted",
        className,
      )}
    >
      <input
        type="date"
        value={value}
        placeholder="mm/dd/yyyy"
        onChange={(e) => onChange(e.target.value)}
        className={cn("date-field-input", inputClassName)}
      />
    </div>
  );
}
