import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Message from "@/models/Message";
import Chat from "@/models/Chat";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error, user } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await dbConnect();

    // Confirm chat belongs to user before exposing messages
    const chat = await Chat.findOne({ _id: id, userId: user.id })
      .select("_id")
      .lean();
    if (!chat)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 100);
    const before = searchParams.get("before");

    const query: Record<string, unknown> = { chatId: id };
    if (before) query._id = { $lt: before };

    const docs = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = docs.length > limit;
    if (hasMore) docs.pop();

    const messages = docs.reverse().map((m) => ({
      id: (m._id as object).toString(),
      role: m.role,
      parts: m.parts,
    }));

    return NextResponse.json({ messages, hasMore });
  } catch (err) {
    console.error("GET /api/chats/[id]/messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
