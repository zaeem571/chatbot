import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Chat from "@/models/Chat";
import Message from "@/models/Message";
import { requireUser } from "@/lib/auth";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

function deriveTitle(
  messages: { role: string; parts?: { type: string; text?: string }[] }[],
): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  return (
    firstUserMsg?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("")
      .slice(0, 40) || "New Chat"
  );
}

export async function POST(req: Request) {
  const { error, user } = await requireUser();
  if (error) return error;

  const { messages, chatId } = await req.json();
  await dbConnect();

  let currentChatId: string;

  if (chatId) {
    if (!mongoose.isValidObjectId(chatId)) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const existingChat = await Chat.findOne({
      _id: chatId,
      userId: user.id,
    }).select("_id");
    if (!existingChat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    currentChatId = chatId;
  } else {
    const newChat = await Chat.create({
      title: deriveTitle(messages),
      updatedAt: Date.now(),
      userId: user.id,
    });
    currentChatId = newChat._id.toString();
  }

  const isExistingChat = Boolean(chatId);

  const lastUserMessage = messages[messages.length - 1];
  const userMessageSave = lastUserMessage
    ? Message.create({
        chatId: currentChatId,
        role: lastUserMessage.role,
        parts: lastUserMessage.parts,
      }).catch((err) => console.error("User message save error:", err))
    : Promise.resolve();

  const result = streamText({
    model: openrouter.chat("google/gemini-2.0-flash-001"),
    messages: messages.map(
      (m: { role: string; parts: { type: string; text?: string }[] }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.parts
          .filter((p: { type: string }) => p.type === "text")
          .map((p: { text?: string }) => p.text)
          .join(""),
      }),
    ),
    onFinish: async (result) => {
      try {
        await userMessageSave;
        const docs: Array<{ chatId: string; role: string; parts: unknown[] }> =
          [];
        for (const m of result.response.messages) {
          const content =
            typeof m.content === "string"
              ? [{ type: "text", text: m.content }]
              : m.content.map((c) =>
                  c.type === "text" ? { type: "text", text: c.text } : c,
                );
          docs.push({ chatId: currentChatId, role: m.role, parts: content });
        }
        if (docs.length > 0) await Message.insertMany(docs);
        if (isExistingChat) {
          await Chat.findByIdAndUpdate(currentChatId, {
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("onFinish save error:", err);
      }
    },
  });

  return new Response(result.textStream.pipeThrough(new TextEncoderStream()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-chat-id": currentChatId,
    },
  });
}
