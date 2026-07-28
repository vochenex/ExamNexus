import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { usePolling } from "../hooks/useRealtimeFetch";
import { formatTargetSectionsLabel } from "../utils/sections";
import { getNotificationDestination } from "../utils/notificationRoutes";
import { canTakeAssessmentOnThisDevice } from "../utils/platform";
import { useAppModal } from "../contexts/AppModalContext";
import {
  dismissNotificationItems,
  filterVisibleNotifications,
} from "../utils/notificationDismissals";
import { stripAssessmentCategoryFromDescription } from "../utils/assessmentCategories";
import { secondaryButtonSm } from "../utils/themeButtons";
import { motion } from "../utils/motion";
import ModalPortal from "./ui/ModalPortal";

function statusLabel(item) {
  if (item.kind === "admin_announcement") return "Platform announcement";
  if (item.kind === "announcement") return "Announcement";
  if (item.kind === "comment") return "Comment";
  if (item.kind === "reaction") return "Reaction";
  if (item.kind === "account") return "Account";
  if (item.status === "scheduled") return "Scheduled assessment";
  if (item.status === "active") return "Active assessment";
  if (item.status === "closed") return "Closed assessment";
  return "Assessment";
}

function statusColor(item, theme) {
  if (item.kind === "admin_announcement") {
    return theme === "dark" ? "text-violet-300" : "text-violet-700";
  }
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
  if (item.kind === "reaction" || item.status === "reaction") {
    return theme === "dark" ? "text-rose-300" : "text-rose-700";
  }
  if (item.kind === "account") {
    return theme === "dark" ? "text-teal-300" : "text-teal-700";
  }
  return theme === "dark" ? "text-gray-400" : "text-gray-600";
}

function kindIconStyles(item, theme) {
  if (item.kind === "admin_announcement") {
    return theme === "dark"
      ? "bg-violet-500/15 text-violet-300"
      : "bg-violet-100 text-violet-700";
  }
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
  if (item.kind === "reaction") {
    return theme === "dark"
      ? "bg-rose-500/10 text-rose-300"
      : "bg-rose-100 text-rose-700";
  }
  if (item.kind === "account") {
    return theme === "dark"
      ? "bg-teal-500/10 text-teal-300"
      : "bg-teal-100 text-teal-800";
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
  if (item.kind === "admin_announcement" || item.kind === "announcement") {
    return Megaphone;
  }
  if (item.kind === "comment") return MessageCircle;
  if (item.kind === "reaction") return Bell;
  if (item.kind === "account") return Bell;
  return ClipboardCheck;
}

function accountLabelForItem(item, fallbackUser) {
  if (item?.for_account) return item.for_account;
  const name = `${fallbackUser?.first_name || ""} ${fallbackUser?.last_name || ""}`.trim();
  return name || fallbackUser?.email || "Your account";
}

export default function NotificationBell({ compact = false }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { warning } = useAppModal();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const isStudent = user.role?.toLowerCase() === "student";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);

  const closePanel = () => {
    setOpen(false);
    setShowClearConfirm(false);
  };

  const loadNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchUserNotifications();
      setItems(filterVisibleNotifications(data));
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(loadNotifications, []);

  // Tab / route changes must dismiss the panel — otherwise it keeps eating touches.
  useEffect(() => {
    closePanel();
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPanelStyle(null);
      return undefined;
    }

    const place = () => {
      const width = Math.min(400, window.innerWidth - 24);
      const top = Math.max(
        12,
        Math.min(
          (triggerRef.current?.getBoundingClientRect().bottom || 56) + 10,
          window.innerHeight * 0.12
        )
      );
      const maxHeight = Math.max(220, window.innerHeight - top - 24);
      // True viewport centering (avoid translateX + scrollbar-gutter skew).
      setPanelStyle({
        position: "fixed",
        top,
        left: 12,
        right: 12,
        width: "auto",
        maxWidth: width,
        marginLeft: "auto",
        marginRight: "auto",
        maxHeight,
        zIndex: 80,
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === "Escape") closePanel();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleItemClick = async (item) => {
    closePanel();
    const { path } = getNotificationDestination(item, {
      isStudent,
      userId: user.id,
    });

    if (path.includes("/take-assessment/") && !canTakeAssessmentOnThisDevice()) {
      await warning(
        "Assessments can only be taken on a computer or laptop browser. Phones, tablets, iPads, and the ExamNexus mobile app cannot start an exam.",
        "Desktop or laptop required"
      );
      navigate("/student/assessments");
      return;
    }

    navigate(path);
  };

  const handleClearAll = () => {
    dismissNotificationItems(items);
    setItems([]);
    closePanel();
  };

  const recentCount = items.filter((item) => {
    const created = new Date(item.created_at);
    const daysAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 14;
  }).length;

  return (
    <div
      className={`relative ${compact ? "inline-flex h-10 w-10 items-center justify-center" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setShowClearConfirm(false);
          if (!open) loadNotifications();
        }}
        className={`relative en-notif-btn en-header-action-btn flex shrink-0 items-center justify-center transition-all duration-200 ${
          compact ? "h-10 w-10 rounded-xl p-0" : "p-3.5 rounded-2xl"
        } ${open ? "en-bell-ring" : ""} ${
          open
            ? theme === "dark"
              ? "bg-emerald-500/20 ring-2 ring-emerald-500/40 text-emerald-300"
              : "en-bg-skeleton ring-2 ring-emerald-300 text-teal-800"
            : theme === "dark"
              ? "border border-white/15 bg-white/10 text-emerald-200 hover:bg-white/15"
              : "en-bg-elevated border border-emerald-200 text-teal-700 en-hover shadow-sm"
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={compact ? 20 : 30} strokeWidth={2.25} />
        {recentCount > 0 && (
          <span
            className={`en-notif-badge pointer-events-none absolute flex items-center justify-center rounded-full bg-red-500 font-bold text-white ring-2 ring-[#031d1f] en-badge-pulse ${
              compact
                ? "right-0 top-0 min-h-[1.05rem] min-w-[1.05rem] translate-x-[20%] -translate-y-[20%] px-0.5 text-[10px] leading-none"
                : "-right-1 -top-1 min-h-[22px] min-w-[22px] px-1 text-xs ring-white dark:ring-[#0b1114]"
            }`}
          >
            {recentCount > 99 ? "99+" : recentCount}
          </span>
        )}
      </button>

      {open && panelStyle && (
        <ModalPortal lockScroll>
          <div className="en-notif-layer" role="presentation">
            <button
              type="button"
              className="en-notif-backdrop"
              aria-label="Close notifications"
              onClick={closePanel}
            />
            <div
              ref={panelRef}
              style={panelStyle}
              className={`${motion.dropdown} en-notif-panel overflow-hidden rounded-2xl border shadow-2xl ${
                theme === "dark"
                  ? "bg-[#0b1114] border-white/10"
                  : "en-bg-elevated border-emerald-200"
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
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
                      className={`inline-flex items-center justify-center rounded-lg p-2 transition ${
                        theme === "dark"
                          ? "text-gray-400 hover:bg-white/10 hover:text-red-300"
                          : "text-gray-600 en-hover hover:text-red-600"
                      }`}
                      aria-label="Clear all notifications"
                      title="Clear all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closePanel}
                    className={`p-1.5 rounded-lg transition ${
                      theme === "dark"
                        ? "text-gray-400 hover:bg-white/10"
                        : "text-gray-600 en-hover"
                    }`}
                    aria-label="Close"
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

              <div className="en-scroll-region min-h-0 flex-1 overflow-y-auto">
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
                    const forAccount = accountLabelForItem(item, user);

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
                              className={`mt-0.5 text-[11px] font-semibold ${
                                theme === "dark" ? "text-amber-300/90" : "text-amber-700"
                              }`}
                            >
                              For: {forAccount}
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
                                {stripAssessmentCategoryFromDescription(item.body)}
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
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
