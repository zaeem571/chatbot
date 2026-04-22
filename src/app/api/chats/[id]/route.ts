import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Chat from "@/models/Chat";
import Message from "@/models/Message";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { error, user } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await dbConnect();
    const chat = await Chat.findOne({ _id: id, userId: user.id }).lean();
    if (!chat)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });

    return NextResponse.json({
      id: (chat._id as object).toString(),
      title: chat.title,
      updatedAt: chat.updatedAt,
    });
  } catch (err) {
    console.error("GET /api/chats/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await requireUser();
  if (error) return error;

  try {
    const { id } = await params;
    await dbConnect();
    const chat = await Chat.findOneAndDelete({ _id: id, userId: user.id });
    if (!chat)
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    await Message.deleteMany({ chatId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/chats/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
