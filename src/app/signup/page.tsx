"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background-muted px-4">
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-primary mb-6">
          Create account
        </h1>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">
              Name
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-border-strong text-sm"
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-error mt-1">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>
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
          <div>
            <label className="block text-xs font-medium text-secondary mb-1.5">
              Password
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
            {pending ? "Creating..." : "Create account"}
          </button>
        </form>
        <Link
          href="/login"
          className="block text-center mt-4 text-xs text-secondary hover:text-primary"
        >
          Already have an account?
        </Link>
      </div>
    </div>
  );
}
