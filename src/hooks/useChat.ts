import { useState, useRef, useCallback } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: string; text?: string }>;
};

type UseChatOptions = {
  chatId?: string;
  initialMessages?: Message[];
};

export function useChat({ chatId, initialMessages = [] }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">(
    "ready",
  );
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef<string | null>(chatId ?? null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(
    async (text: string) => {
      // Temp ID for React key — not persisted to DB
      const userMessage: Message = {
        id: `temp-${crypto.randomUUID()}`,
        role: "user",
        parts: [{ type: "text", text }],
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setStatus("submitted");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              parts: m.parts,
            })),
            chatId: chatIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const newChatId = res.headers.get("x-chat-id");
        if (newChatId) chatIdRef.current = newChatId;

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        const assistantMessage: Message = {
          id: `temp-${crypto.randomUUID()}`,
          role: "assistant",
          parts: [{ type: "text", text: "" }],
        };

        setMessages([...updatedMessages, assistantMessage]);
        setStatus("streaming");

        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          setMessages([
            ...updatedMessages,
            {
              ...assistantMessage,
              parts: [{ type: "text", text: fullText }],
            },
          ]);
        }

        setStatus("ready");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        setStatus("ready");
      }
    },
    [messages],
  );

  const regenerate = useCallback(async () => {
    const lastAssistantIdx = messages.findLastIndex(
      (m) => m.role === "assistant",
    );
    if (lastAssistantIdx === -1) return;

    const withoutLast = messages.slice(0, lastAssistantIdx);
    setMessages(withoutLast);

    const lastUserMsg = withoutLast.findLast((m) => m.role === "user");
    if (lastUserMsg) {
      const text = lastUserMsg.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      // Remove the last user message too, sendMessage will re-add it
      setMessages(withoutLast.slice(0, -1));
      // Small delay to let state update
      setTimeout(() => sendMessage(text), 0);
    }
  }, [messages, sendMessage]);

  return {
    messages,
    sendMessage,
    status,
    error,
    clearError,
    stop,
    regenerate,
    chatId: chatIdRef.current,
  };
}
