"use client";

import { Suspense } from "react";
import { DataProvider } from "@/components/farm/data-context";

export default function FarmLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>{children}</Suspense>
    </DataProvider>
  );
}
