"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-100 disabled:opacity-50"
      }
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
