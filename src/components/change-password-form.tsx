"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

const fieldClass = "h-10 bg-white py-0 focus:ring-[3px] focus:ring-forest-100";

export function ChangePasswordForm({
  onCancel,
  onSuccess,
}: {
  onCancel?: () => void;
  onSuccess?: () => void;
} = {}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => onSuccessRef.current?.(), 2000);
    return () => window.clearTimeout(id);
  }, [success]);

  function clearFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not change password");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-stone-600">Current password</label>
        <PasswordInput
          tone="light"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={setCurrentPassword}
          inputClassName={fieldClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-stone-600">
          New password (8+ characters)
        </label>
        <PasswordInput
          tone="light"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={setNewPassword}
          inputClassName={fieldClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-stone-600">Confirm new password</label>
        <PasswordInput
          tone="light"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={setConfirmPassword}
          inputClassName={fieldClass}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-[#c9dccf] bg-forest-100 px-3 py-2 text-sm text-forest-900">
          Password updated. Other sessions were signed out.
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-forest-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Update password"
          )}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={() => {
              clearFields();
              onCancel();
            }}
            className="px-1.5 py-2 text-sm text-muted"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
