import type { Message } from "@/hooks/useChat";

export type ChatListItem = { id: string; title: string; updatedAt: number };
export type PaginatedMessages = { messages: Message[]; hasMore: boolean };

export async function authedFetch(input: string, init?: RequestInit) {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return res;
}

export async function getChatList(): Promise<ChatListItem[]> {
  const res = await authedFetch("/api/chats");
  if (!res.ok) return [];
  return res.json();
}

export async function getChat(id: string): Promise<{ title: string }> {
  const res = await authedFetch(`/api/chats/${id}`);
  if (!res.ok) return { title: "New Chat" };
  const data = await res.json();
  return { title: data.title };
}

export async function getChatMessages(
  id: string,
  limit = 10,
  before?: string,
): Promise<PaginatedMessages> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);

  const res = await authedFetch(`/api/chats/${id}/messages?${params}`);
  if (!res.ok) return { messages: [], hasMore: false };
  return res.json();
}

export async function deleteChat(id: string): Promise<void> {
  await authedFetch(`/api/chats/${id}`, { method: "DELETE" });
}

export function exportChatAsMarkdown(
  title: string,
  messages: Message[],
): string {
  let md = `# ${title}\n\n`;
  for (const m of messages) {
    const text =
      m.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("") ?? "";
    md += `**${m.role === "user" ? "You" : "Assistant"}:**\n\n${text}\n\n---\n\n`;
  }
  return md;
}
