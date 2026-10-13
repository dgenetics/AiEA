"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CaptureComposer } from "@/components/capture-composer";

/** Capture sits above the board and refreshes it when tasks land or are edited. */
export function TasksRefresh() {
  const router = useRouter();
  const [flash, setFlash] = useState<string[]>([]);

  useEffect(() => {
    if (!flash.length) return;
    const apply = () => {
      document.querySelectorAll("[data-task-id]").forEach((el) => {
        const id = el.getAttribute("data-task-id") || "";
        if (flash.includes(id)) el.classList.add("task-flash");
      });
    };
    apply();
    const tick = window.setInterval(apply, 200);
    const stop = window.setTimeout(() => {
      window.clearInterval(tick);
      document.querySelectorAll(".task-flash").forEach((el) => el.classList.remove("task-flash"));
      setFlash([]);
    }, 3000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stop);
    };
  }, [flash]);

  return (
    <CaptureComposer
      onCreated={(ids) => {
        setFlash(ids);
        router.refresh();
      }}
    />
  );
}
