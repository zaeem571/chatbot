"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { createSession, destroySession } from "@/lib/session";
import {
  signupSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from "@/lib/validation";

export type ActionState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export async function signup(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await dbConnect();
  const existing = await User.findOne({ email: parsed.data.email }).lean();
  if (existing) return { error: "Email already registered" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await User.create({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash,
  });

  await createSession(user._id.toString());
  redirect("/");
}

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await dbConnect();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user) return { error: "Invalid email or password" };

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return { error: "Invalid email or password" };

  await createSession(user._id.toString());
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function forgotPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await dbConnect();
  const user = await User.findOne({ email: parsed.data.email });

  // Always act like the email exists to prevent user enumeration
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetTokenHash = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new Error("APP_URL env var must be set to generate reset links");
    }
    const link = `${appUrl}/reset-password?token=${token}`;
    // DEV MODE: log the link. Swap this for Resend/SMTP later.
    console.log(`[Password Reset] ${user.email} -> ${link}`);
  }

  return { error: undefined }; // success shown in UI regardless
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokenHash = crypto
    .createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");

  await dbConnect();
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) return { error: "Invalid or expired reset link" };

  user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  await user.save();

  await createSession(user._id.toString());
  redirect("/");
}
