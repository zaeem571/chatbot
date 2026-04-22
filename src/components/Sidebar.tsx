"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getChatList,
  authedFetch,
  type ChatListItem,
} from "@/lib/chat-storage";
import { logout } from "@/app/actions/auth";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

type SidebarProps = {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  refreshKey: number;
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  refreshKey,
  collapsed,
  onToggle,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [visible, setVisible] = useState(!collapsed);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [user, setUser] = useState<{ email: string; name: string } | null>(
    null,
  );

  const fetchChats = useCallback(async () => {
    const list = await getChatList();
    setChats(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, refreshKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    authedFetch("/api/me", { signal: ctrl.signal })
      .then(async (r) => {
        if (r.ok) setUser(await r.json());
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const filtered = search
    ? chats.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : chats;

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!collapsed) {
      setVisible(true);
      setAnimating(true);
      timeoutRef.current = setTimeout(() => setAnimating(false), 300);
    } else {
      setAnimating(true);
      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        setAnimating(false);
      }, 250);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [collapsed]);

  if (!visible && !animating) return null;

  const entering = visible && !collapsed;
  const exiting = collapsed && (visible || animating);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 bg-overlay z-40 md:hidden ${entering ? "backdrop-enter" : ""} ${exiting ? "backdrop-exit" : ""}`}
        onClick={onToggle}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-sidebar sm:w-72 md:relative md:w-64 md:max-w-none md:z-auto border-r border-border-subtle flex flex-col h-dvh bg-background-muted shrink-0 ${entering ? "sidebar-enter" : ""} ${exiting ? "sidebar-exit" : ""}`}
      >
        <div className="relative px-4 min-h-touch flex items-center justify-end bg-background-muted shadow-header shrink-0">
          <h2 className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-primary tracking-tight">
            Smart Chat
          </h2>
          <button
            onClick={onToggle}
            className="text-muted hover:text-secondary transition-colors duration-200"
            aria-label="Collapse sidebar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>
        </div>
        <div className="p-4 pt-3">
          <button
            onClick={onNewChat}
            className="w-full py-2 px-3 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-[0.97] text-sm font-medium transition-all duration-200 mb-2"
          >
            + New Chat
          </button>
          {chats.length > 3 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:border-border-strong placeholder:text-muted transition-colors duration-200"
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto sidebar-scroll px-2">
          {filtered.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-lg mb-0.5 transition-all duration-200 ${
                chat.id === activeChatId
                  ? "bg-border/70 text-primary font-medium"
                  : "text-secondary hover:bg-background-subtle hover:text-primary active:bg-border/50"
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              <span className="truncate flex-1">{chat.title}</span>
              <span className="text-2xs text-muted shrink-0 ml-2 hidden md:inline md:group-hover:hidden">
                {timeAgo(chat.updatedAt)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="text-disabled hover:text-error-strong active:text-error ml-2 transition-colors duration-200 shrink-0 md:hidden md:group-hover:block"
                aria-label="Delete chat"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                </svg>
              </button>
            </div>
          ))}
          {filtered.length === 0 && chats.length > 0 && (
            <p className="text-xs text-muted px-3 py-4 text-center">
              No matches
            </p>
          )}
          {chats.length === 0 && (
            <p className="text-xs text-muted px-3 py-4 text-center">
              No conversations yet
            </p>
          )}
        </div>
        {user && (
          <div className="p-3 border-t border-border-subtle flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary truncate">
                {user.name}
              </p>
              <p className="text-3xs text-secondary truncate">{user.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs text-muted hover:text-error-strong transition-colors shrink-0"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
}
