import { readSession } from "@/lib/session";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export type AuthedUser = { id: string; email?: string; name?: string };

type RequireUserResult =
  | { error: NextResponse; user: null }
  | { error: null; user: AuthedUser };

export async function requireUser(
  opts: { loadProfile?: boolean } = {},
): Promise<RequireUserResult> {
  const session = await readSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
      user: null,
    };
  }

  if (!opts.loadProfile) {
    return { error: null, user: { id: session.userId } };
  }

  await dbConnect();
  const user = await User.findById(session.userId)
    .select("email name")
    .lean<{ email: string; name: string } | null>();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
      user: null,
    };
  }
  return {
    error: null,
    user: { id: session.userId, email: user.email, name: user.name },
  };
}
