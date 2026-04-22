"use client";

import { useChat, type Message } from "@/hooks/useChat";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Sidebar from "@/components/Sidebar";
import {
  getChat,
  getChatMessages,
  deleteChat,
  exportChatAsMarkdown,
} from "@/lib/chat-storage";

function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function Chat() {
  const mounted = useHasMounted();

  if (!mounted) {
    return (
      <div className="flex h-dvh">
        <div className="hidden md:block w-64 border-r border-border-subtle bg-background-muted" />
        <div className="flex-1" />
      </div>
    );
  }

  return <ChatApp />;
}

function ChatApp() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatId, setNewChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState("New Chat");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setNewChatId(null);
    setChatTitle("New Chat");
    if (window.innerWidth < 768) setSidebarCollapsed(true);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setNewChatId(null);
    if (window.innerWidth < 768) setSidebarCollapsed(true);
  }, []);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      await deleteChat(id);
      if (activeChatId === id) setActiveChatId(null);
      setRefreshKey((k) => k + 1);
    },
    [activeChatId],
  );

  const handleMessagesUpdated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleExport = useCallback(async () => {
    if (!activeChatId) return;
    const { messages } = await getChatMessages(activeChatId, 1000);
    const md = exportChatAsMarkdown(chatTitle, messages);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chatTitle.slice(0, 30) || "chat"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeChatId, chatTitle]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewChat]);

  return (
    <div className="flex h-dvh">
      <Sidebar
        activeChatId={newChatId ?? activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        refreshKey={refreshKey}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Shared Header */}
        <div className="relative flex items-center justify-between px-4 py-3 min-h-touch bg-background-muted shadow-header">
          <div className="flex items-center gap-3">
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="text-muted hover:text-secondary active:scale-90 transition-all duration-200"
                aria-label="Open sidebar"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
            )}
          </div>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-primary truncate max-w-[60vw] md:max-w-xs">
            {chatTitle}
          </h1>
          <div className="flex items-center">
            {activeChatId && (
              <button
                onClick={handleExport}
                className="text-muted hover:text-secondary transition-colors"
                title="Download chat as Markdown"
                aria-label="Download chat as Markdown"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {activeChatId ? (
          <ChatInner
            key={activeChatId}
            chatId={activeChatId}
            onMessagesUpdated={handleMessagesUpdated}
            onTitleChange={setChatTitle}
          />
        ) : (
          <NewChatView
            onChatCreated={(id: string) => {
              setNewChatId(id);
              setRefreshKey((k) => k + 1);
            }}
            onSidebarRefresh={() => setRefreshKey((k) => k + 1)}
            onTitleChange={setChatTitle}
          />
        )}
      </main>
    </div>
  );
}

function NewChatView({
  onChatCreated,
  onSidebarRefresh,
  onTitleChange,
}: {
  onChatCreated: (id: string) => void;
  onSidebarRefresh: () => void;
  onTitleChange: (title: string) => void;
}) {
  const {
    messages,
    sendMessage,
    status,
    stop,
    chatId: currentChatId,
  } = useChat();
  const [input, setInput] = useState("");
  const isLoading = status === "streaming" || status === "submitted";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Notify parent about new chatId (for sidebar highlight)
  const createdRef = useRef(false);
  useEffect(() => {
    if (currentChatId && !createdRef.current) {
      createdRef.current = true;
      onChatCreated(currentChatId);
    }
  }, [currentChatId, onChatCreated]);

  // Refresh sidebar and title when streaming finishes
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready" && currentChatId) {
      onSidebarRefresh();
      getChat(currentChatId).then((data) => onTitleChange(data.title));
    }
    prevStatus.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto chat-scroll">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-disabled">
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 space-y-5">
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] md:max-w-[42rem] text-sm md:text-base-tight leading-relaxed">
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {getMessageText(m)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="pl-1">
                    <div className="prose text-sm md:text-base-tight max-w-none text-primary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {getMessageText(m)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {status === "submitted" && (
              <div className="message-appear flex items-center gap-1.5 py-2 pl-1">
                <span className="typing-dot" />
                <span
                  className="typing-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="typing-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border-subtle bg-background px-3 py-3 md:px-4 md:py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-2 items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message..."
            rows={1}
            className="flex-1 min-w-0 resize-none rounded-xl border border-border bg-background-muted text-primary px-4 py-2.5 focus:outline-none focus:border-border-strong focus:bg-background max-h-40 placeholder:text-muted text-sm leading-snug transition-all duration-200"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="shrink-0 h-touch w-touch flex items-center justify-center rounded-xl border border-border text-secondary hover:bg-background-muted active:scale-95 transition-all duration-200"
              aria-label="Stop generating"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 h-touch w-touch flex items-center justify-center rounded-xl bg-primary text-white disabled:opacity-30 hover:bg-primary-hover active:scale-95 transition-all duration-200"
              aria-label="Send message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </form>
        <p className="hidden md:block text-center text-2xs text-disabled mt-2">
          <kbd className="px-1 py-0.5 bg-background-muted rounded">Enter</kbd>{" "}
          send
          {" · "}
          <kbd className="px-1 py-0.5 bg-background-muted rounded">
            Shift+Enter
          </kbd>{" "}
          newline
          {" · "}
          <kbd className="px-1 py-0.5 bg-background-muted rounded">
            Esc
          </kbd>{" "}
          stop
        </p>
      </div>
    </div>
  );
}

function getMessageText(m: Message): string {
  return (
    m.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}

function ChatInner({
  chatId,
  onMessagesUpdated,
  onTitleChange,
}: {
  chatId: string;
  onMessagesUpdated: () => void;
  onTitleChange: (title: string) => void;
}) {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [, setChatTitle] = useState("New Chat");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // Fetch chat data from MongoDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [chatData, result] = await Promise.all([
        getChat(chatId),
        getChatMessages(chatId, 10),
      ]);
      if (cancelled) return;
      setInitialMessages(result.messages);
      setHasMore(result.hasMore);
      if (result.messages.length > 0) {
        setCursor(result.messages[0].id);
      }
      setChatTitle(chatData.title);
      onTitleChange(chatData.title);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, onTitleChange]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-disabled">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
          <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    );
  }

  return (
    <ChatInnerReady
      chatId={chatId}
      initialMessages={initialMessages}
      onMessagesUpdated={onMessagesUpdated}
      initialHasMore={hasMore}
      initialCursor={cursor}
    />
  );
}

function ChatInnerReady({
  chatId,
  initialMessages,
  onMessagesUpdated,
  initialHasMore,
  initialCursor,
}: {
  chatId: string;
  initialMessages: Message[];
  onMessagesUpdated: () => void;
  initialHasMore: boolean;
  initialCursor: string | null;
}) {
  const { messages, sendMessage, status, error, clearError, regenerate, stop } =
    useChat({
      chatId,
      initialMessages,
    });
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination state
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const isLoading = status === "streaming" || status === "submitted";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef(status);

  // Refresh sidebar when streaming finishes
  useEffect(() => {
    if (prevStatus.current !== "ready" && status === "ready") {
      onMessagesUpdated();
    }
    prevStatus.current = status;
  }, [status, onMessagesUpdated]);

  // Load older messages on scroll-up
  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const el = scrollAreaRef.current;
    const prevScrollHeight = el ? el.scrollHeight : 0;

    const result = await getChatMessages(chatId, 10, cursor);

    setOlderMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMessages = result.messages.filter(
        (m: Message) => !existingIds.has(m.id),
      );
      return [...newMessages, ...prev];
    });
    setHasMore(result.hasMore);
    if (result.messages.length > 0) {
      setCursor(result.messages[0].id);
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);

    // Preserve scroll position after prepending older messages
    requestAnimationFrame(() => {
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeight;
      }
    });
  }, [hasMore, cursor, chatId]);

  // Combine older + current messages
  const messageIds = new Set(messages.map((m) => m.id));
  const allMessages = [
    ...olderMessages.filter((m) => !messageIds.has(m.id)),
    ...messages,
  ];

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Start at bottom once initial messages render (before browser paints)
  const initialScrollDone = useRef(false);
  const [scrollReady, setScrollReady] = useState(allMessages.length === 0);
  useLayoutEffect(() => {
    if (!initialScrollDone.current && allMessages.length > 0) {
      const el = scrollAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setTimeout(() => {
        setScrollReady(true);
        initialScrollDone.current = true;
      }, 200);
    }
  }, [allMessages.length]);

  // Detect scroll to top to load older messages using Intersection Observer
  const topSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && initialScrollDone.current) {
          loadOlderMessages();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlderMessages, hasMore]);

  // Esc to stop generation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isLoading) {
        stop();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLoading, stop]);

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mx-3 md:mx-4 mt-3 bg-error-background border border-error-border text-error px-3 md:px-4 py-3 rounded-lg flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="wrap-break-word min-w-0">{error.message}</span>
          <button
            onClick={() => {
              clearError();
              regenerate();
            }}
            className="shrink-0 px-3 py-1 text-xs bg-error text-white rounded-md hover:bg-error-hover active:scale-95 transition-all duration-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto chat-scroll relative"
        style={{ visibility: scrollReady ? "visible" : "hidden" }}
      >
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-disabled">
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 space-y-5">
            {hasMore && <div ref={topSentinelRef} className="h-1" />}
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="flex items-center gap-1.5 text-disabled">
                  <span className="typing-dot" />
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            )}
            {allMessages.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] md:max-w-[42rem] text-sm md:text-base-tight leading-relaxed">
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {getMessageText(m)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="group pl-1">
                    <div className="prose text-sm md:text-base-tight max-w-none text-primary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {getMessageText(m)}
                      </ReactMarkdown>
                    </div>
                    <div className="mt-2 h-5 flex gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(m.id, getMessageText(m))}
                        className="text-xs text-muted hover:text-secondary flex items-center gap-1 transition-colors"
                      >
                        {copiedId === m.id ? (
                          <span className="text-success">Copied!</span>
                        ) : (
                          <>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {status === "submitted" && (
              <div className="message-appear flex items-center gap-1.5 py-2 pl-1">
                <span className="typing-dot" />
                <span
                  className="typing-dot"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="typing-dot"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle bg-background px-3 py-3 md:px-4 md:py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-2 items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message..."
            rows={1}
            className="flex-1 min-w-0 resize-none rounded-xl border border-border bg-background-muted text-primary px-4 py-2.5 focus:outline-none focus:border-border-strong focus:bg-background max-h-40 placeholder:text-muted text-sm leading-snug transition-all duration-200"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              className="shrink-0 h-touch w-touch flex items-center justify-center rounded-xl border border-border text-secondary hover:bg-background-muted active:scale-95 transition-all duration-200"
              aria-label="Stop generating"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 h-touch w-touch flex items-center justify-center rounded-xl bg-primary text-white disabled:opacity-30 hover:bg-primary-hover active:scale-95 transition-all duration-200"
              aria-label="Send message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </form>
        <p className="hidden md:block text-center text-2xs text-disabled mt-2">
          <kbd className="px-1 py-0.5 bg-background-muted rounded">Enter</kbd>{" "}
          send
          {" · "}
          <kbd className="px-1 py-0.5 bg-background-muted rounded">
            Shift+Enter
          </kbd>{" "}
          newline
          {" · "}
          <kbd className="px-1 py-0.5 bg-background-muted rounded">
            Esc
          </kbd>{" "}
          stop
        </p>
      </div>
    </div>
  );
}
