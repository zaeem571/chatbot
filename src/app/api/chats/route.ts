import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Chat from "@/models/Chat";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const { error, user } = await requireUser();
  if (error) return error;

  try {
    await dbConnect();
    const chats = await Chat.find(
      { userId: user.id },
      { title: 1, updatedAt: 1 },
    )
      .sort({ updatedAt: -1 })
      .lean();

    const list = chats.map((c) => ({
      id: (c._id as object).toString(),
      title: c.title,
      updatedAt: c.updatedAt,
    }));
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/chats error:", err);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
