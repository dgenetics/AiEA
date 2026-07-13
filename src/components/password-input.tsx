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
          "w-full rounded-lg border border-white/10 bg-zinc-900 py-2 pl-3 pr-10 text-sm text-white focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
          inputClassName,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={0}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
