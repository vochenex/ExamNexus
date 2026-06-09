import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Megaphone,
  ClipboardCheck,
  MessageCircle,
  X,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import { fetchUserNotifications } from "../utils/supabaseData";
import { formatTargetSectionsLabel } from "../utils/sections";
import { getNotificationDestination } from "../utils/notificationRoutes";
import {
  dismissNotificationItems,
  filterVisibleNotifications,
} from "../utils/notificationDismissals";
import { secondaryButtonSm } from "../utils/themeButtons";

function statusLabel(item) {
  if (item.kind === "announcement") return "Announcement";
  if (item.kind === "comment") return "Comment";
  if (item.status === "scheduled") return "Scheduled assessment";
  if (item.status === "active") return "Active assessment";
  if (item.status === "closed") return "Closed assessment";
  return "Assessment";
}

function statusColor(item, theme) {
  if (item.kind === "announcement" || item.status === "posted") {
    return theme === "dark" ? "text-purple-400" : "text-purple-700";
  }
  if (item.status === "active") {
    return theme === "dark" ? "text-emerald-400" : "text-emerald-700";
  }
  if (item.status === "scheduled") {
    return theme === "dark" ? "text-amber-400" : "text-amber-600";
  }
  if (item.kind === "comment" || item.status === "comment") {
    return theme === "dark" ? "text-cyan-400" : "text-cyan-700";
  }
  return theme === "dark" ? "text-gray-400" : "text-gray-600";
}

function kindIconStyles(item, theme) {
  if (item.kind === "announcement") {
    return theme === "dark"
      ? "bg-purple-500/10 text-purple-400"
      : "bg-purple-100 text-purple-700";
  }
  if (item.kind === "comment") {
    return theme === "dark"
      ? "bg-cyan-500/10 text-cyan-400"
      : "bg-cyan-100 text-cyan-700";
  }
  if (item.status === "active") {
    return theme === "dark"
      ? "bg-emerald-500/10 text-emerald-400"
      : "en-bg-skeleton text-teal-700";
  }
  if (item.status === "scheduled") {
    return theme === "dark"
      ? "bg-amber-500/10 text-amber-400"
      : "bg-amber-100 text-amber-700";
  }
  return theme === "dark"
    ? "bg-white/10 text-gray-400"
    : "bg-gray-100 text-gray-600";
}

function kindIcon(item) {
  if (item.kind === "announcement") return Megaphone;
  if (item.kind === "comment") return MessageCircle;
  return ClipboardCheck;
}

export default function NotificationBell() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const isStudent = user.role?.toLowerCase() === "student";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await fetchUserNotifications();
      setItems(filterVisibleNotifications(data));
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
        setShowClearConfirm(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }

    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleItemClick = (item) => {
    setOpen(false);
    setShowClearConfirm(false);
    const { path } = getNotificationDestination(item, {
      isStudent,
      userId: user.id,
    });
    navigate(path);
  };

  const handleClearAll = () => {
    dismissNotificationItems(items);
    setItems([]);
    setShowClearConfirm(false);
    setOpen(false);
  };

  const recentCount = items.filter((item) => {
    const created = new Date(item.created_at);
    const daysAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 14;
  }).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setShowClearConfirm(false);
          if (!open) loadNotifications();
        }}
        className={`relative p-3.5 rounded-2xl transition-all duration-200 ${
          open
            ? theme === "dark"
              ? "bg-emerald-500/20 ring-2 ring-emerald-500/40 text-emerald-300"
              : "en-bg-skeleton ring-2 ring-emerald-300 text-teal-800"
            : theme === "dark"
              ? "bg-white/10 hover:bg-white/15 text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              : "en-bg-elevated border border-emerald-200 text-teal-700 en-hover shadow-sm"
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={30} strokeWidth={2.25} />
        {recentCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0b1114]">
            {recentCount > 99 ? "99+" : recentCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-3 w-[min(92vw,400px)] max-h-[75vh] overflow-hidden rounded-2xl border shadow-2xl z-50 ${
            theme === "dark"
              ? "bg-[#0b1114] border-white/10"
              : "en-bg-elevated border-emerald-200"
          }`}
        >
          <div
            className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${
              theme === "dark" ? "border-white/10" : "border-emerald-100"
            }`}
          >
            <div>
              <h3
                className={`font-semibold text-base ${
                  theme === "dark" ? "text-emerald-400" : "text-teal-700"
                }`}
              >
                Notifications
              </h3>
              <p
                className={`text-xs mt-0.5 ${
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                }`}
              >
                Tap an item to go to the related page
              </p>
            </div>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    theme === "dark"
                      ? "text-gray-400 hover:bg-white/10 hover:text-red-300"
                      : "text-gray-600 en-hover hover:text-red-600"
                  }`}
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowClearConfirm(false);
                }}
                className={`p-1.5 rounded-lg transition ${
                  theme === "dark"
                    ? "text-gray-400 hover:bg-white/10"
                    : "text-gray-600 en-hover"
                }`}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {showClearConfirm && (
            <div
              className={`border-b px-5 py-4 ${
                theme === "dark"
                  ? "border-white/10 bg-red-500/5"
                  : "border-red-100 bg-red-50/80"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  theme === "dark" ? "text-red-200" : "text-red-800"
                }`}
              >
                Clear all notifications?
              </p>
              <p
                className={`mt-1 text-xs ${
                  theme === "dark" ? "text-red-300/80" : "text-red-700"
                }`}
              >
                This hides them from your feed on this device. New activity will still
                appear later.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className={secondaryButtonSm(theme, "text-xs px-3 py-1.5")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-[calc(75vh-72px)]">
            {loading ? (
              <p
                className={`p-5 text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Loading...
              </p>
            ) : items.length === 0 ? (
              <p
                className={`p-5 text-sm ${
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              >
                No recent activity yet.
              </p>
            ) : (
              items.map((item) => {
                const Icon = kindIcon(item);
                const destination = getNotificationDestination(item, {
                  isStudent,
                  userId: user.id,
                });

                return (
                  <button
                    key={`${item.kind}-${item.id}-${item.created_at}`}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={`group w-full text-left px-5 py-4 border-b transition ${
                      theme === "dark"
                        ? "border-white/5 hover:bg-white/5"
                        : "border-emerald-50 en-hover"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kindIconStyles(
                          item,
                          theme
                        )}`}
                      >
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-medium ${statusColor(item, theme)}`}
                        >
                          {statusLabel(item)}
                          {item.subject_name ? ` · ${item.subject_name}` : ""}
                        </p>
                        <p
                          className={`text-sm font-semibold truncate ${
                            theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.body && (
                          <p
                            className={`text-xs mt-1 line-clamp-2 ${
                              theme === "dark" ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {item.body}
                          </p>
                        )}
                        {item.target_sections && (
                          <p
                            className={`text-xs mt-1 ${
                              theme === "dark" ? "text-gray-500" : "text-gray-500"
                            }`}
                          >
                            {formatTargetSectionsLabel(item.target_sections)}
                          </p>
                        )}
                        <p
                          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${
                            theme === "dark"
                              ? "text-emerald-400 group-hover:text-emerald-300"
                              : "text-teal-700 group-hover:text-teal-800"
                          }`}
                        >
                          {destination.label}
                          <ArrowRight size={14} className="opacity-70" />
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${
                            theme === "dark" ? "text-gray-500" : "text-gray-500"
                          }`}
                        >
                          {new Date(item.created_at).toLocaleString("en-PH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
