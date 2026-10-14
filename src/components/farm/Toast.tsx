"use client";

import { useEffect, useRef } from "react";

/** Short confirmation above the bottom bar. No undo. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]"
    >
      <p className="max-w-sm rounded-full bg-stone-900 px-4 py-2.5 text-center text-sm font-medium text-[#f7f3eb] shadow-lg">
        {message}
      </p>
    </div>
  );
}
