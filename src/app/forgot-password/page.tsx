"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/app/actions/auth";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  const submitted = state !== undefined && !state?.fieldErrors;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background-muted px-4">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-primary mb-6">
          Reset password
        </h1>
        {submitted ? (
          <p className="text-sm text-secondary">
            If that email exists, a reset link has been sent.
            {process.env.NODE_ENV !== "production" &&
              " (Dev mode: check the server console.)"}
          </p>
        ) : (
          <form action={action} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-border-strong text-sm"
              />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-error mt-1">
                  {state.fieldErrors.email[0]}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 text-sm font-medium"
            >
              {pending ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <Link
          href="/login"
          className="block text-center mt-4 text-xs text-secondary hover:text-primary"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
