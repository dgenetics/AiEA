"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronRight, KeyRound, User } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

/** Two words use the first and last initials. One word uses its first letter. */
export function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && first?.[0] && last?.[0]) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first?.[0]) return first[0].toUpperCase();
  const fromEmail = email.trim()[0];
  return fromEmail ? fromEmail.toUpperCase() : "?";
}

/**
 * Signed-in account control. Phone: a cream sheet under the header.
 * Desktop: a 320px dropdown. The dim layer sits under the header so the
 * icon stays tappable.
 */
export function AccountMenu({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
    setPasswordOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      firstRowRef.current?.focus();
      return;
    }
    if (wasOpen.current) buttonRef.current?.focus();
    wasOpen.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let pressedInside = false;

    function isInside(target: EventTarget | null) {
      return (
        target instanceof Node &&
        (Boolean(panelRef.current?.contains(target)) || Boolean(buttonRef.current?.contains(target)))
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPasswordOpen(false);
      setOpen(false);
    }

    function onPointerDown(e: PointerEvent) {
      pressedInside = isInside(e.target);
    }

    function onClick(e: MouseEvent) {
      if (pressedInside || isInside(e.target)) return;
      setPasswordOpen(false);
      setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  function toggle() {
    setPasswordOpen(false);
    setOpen((value) => !value);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={toggle}
        className={cn(
          "absolute right-2 top-0 flex h-10 w-10 items-center justify-center",
          open ? "text-white" : "text-zinc-400 hover:text-white",
        )}
      >
        <User className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        {open ? (
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white"
          />
        ) : null}
      </button>
      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-30 bg-[#1c19172e] md:bg-transparent"
              aria-hidden="true"
            />,
            document.body,
          )
        : null}
      {open ? (
        <div
          ref={panelRef}
          id="account-menu"
          role="dialog"
          aria-label="Account"
          className="absolute inset-x-0 top-full z-10 rounded-b-[20px] border-b border-cream-200 bg-cream-50 shadow-[0_12px_32px_#1c191726] md:inset-x-auto md:right-3 md:top-[calc(100%+6px)] md:w-80 md:rounded-2xl md:border"
        >
          <span
            aria-hidden="true"
            className="absolute -top-1.5 right-5 hidden h-2.5 w-2.5 rotate-45 border-l border-t border-cream-200 bg-cream-50 md:block"
          />
          <div className="max-h-[calc(100dvh-2.5rem-3.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto pb-2 pt-1.5">
          <div className="flex items-center gap-3 border-b border-cream-200 px-4 pb-3.5 pt-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-100 text-[15px] font-semibold text-forest-900">
              {initials(name, email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-5 text-ink">{name}</p>
              <p className="truncate text-[13px] leading-5 text-muted">{email}</p>
            </div>
          </div>
          <button
            ref={firstRowRef}
            type="button"
            aria-expanded={passwordOpen}
            onClick={() => setPasswordOpen((value) => !value)}
            className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-[15px] text-ink"
          >
            <KeyRound className="h-[18px] w-[18px] text-forest-800" strokeWidth={1.75} aria-hidden="true" />
            Change password
            <ChevronRight
              className={cn(
                "ml-auto h-4 w-4 text-stone-400 transition-transform",
                passwordOpen && "rotate-90",
              )}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
          {passwordOpen ? (
            <div className="px-4 pb-3.5">
              <p className="mb-2.5 text-xs text-muted">Other signed-in devices will be logged out.</p>
              <ChangePasswordForm
                onCancel={() => setPasswordOpen(false)}
                onSuccess={() => setPasswordOpen(false)}
              />
            </div>
          ) : null}
          <div className="mt-1 border-t border-cream-200 pt-1">
            <SignOutButton
              className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-[15px] text-rose-700 disabled:opacity-50"
              iconClassName="h-[18px] w-[18px]"
            />
          </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
