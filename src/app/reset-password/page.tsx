"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { resetPassword } from "@/app/actions/auth";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, action, pending] = useActionState(resetPassword, undefined);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background-muted px-4">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-primary mb-6">
          Set new password
        </h1>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">
              New password
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-border-strong text-sm"
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-error mt-1">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
          {state?.error && (
            <p className="text-sm text-error">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 text-sm font-medium"
          >
            {pending ? "Saving..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
