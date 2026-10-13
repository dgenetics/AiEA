"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  tone?: "dark" | "light";
};

export function PasswordInput({
  value,
  onChange,
  id,
  name,
  required,
  minLength,
  autoComplete = "current-password",
  placeholder,
  className,
  inputClassName,
  tone = "dark",
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          tone === "light"
            ? "w-full rounded-lg border border-cream-300 bg-cream-50 py-2 pl-3 pr-10 text-sm text-ink focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-700/20"
            : "w-full rounded-lg border border-white/10 bg-zinc-900 py-2 pl-3 pr-10 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
          inputClassName,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={
          tone === "light"
            ? "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition hover:bg-cream-200/60 hover:text-ink"
            : "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        }
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={0}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
