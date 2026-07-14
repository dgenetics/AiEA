"use client";

import { cn } from "@/lib/utils";

/**
 * Native date input clipped to the parent content box.
 * WebKit/iOS date controls ignore max-width and paint past padding unless
 * the border lives on a shell with overflow:hidden.
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
        onChange={(e) => onChange(e.target.value)}
        className={cn("date-field-input", inputClassName)}
      />
    </div>
  );
}
