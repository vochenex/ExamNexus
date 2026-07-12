import { useEffect, useRef, useState } from "react";
import { Check, Heart, MessageCircle, Pencil, Send, Trash2, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ProfileAvatar from "./ProfileAvatar";
import { useAppModal } from "../contexts/AppModalContext";
import { formatTargetSectionsLabel } from "../utils/sections";
import {
  fetchAnnouncementComments,
  postAnnouncementComment,
  toggleAnnouncementHeart,
  deleteAnnouncement,
  updateAnnouncementComment,
  deleteAnnouncementComment,
} from "../utils/supabaseData";

function formatCommentTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default function AnnouncementCard({
  announcement,
  canDelete = false,
  allowInteract = true,
  highlighted = false,
  autoExpandComments = false,
  hideSections = false,
  onDeleted,
  onUpdated,
  fetchComments = fetchAnnouncementComments,
  postComment = postAnnouncementComment,
  toggleHeart = toggleAnnouncementHeart,
  removeAnnouncement = deleteAnnouncement,
  updateComment = updateAnnouncementComment,
  removeComment = deleteAnnouncementComment,
}) {
  const { theme } = useTheme();
  const { error, confirm } = useAppModal();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const myUserId = cachedUser.id || cachedUser.user_id || "";
  const isModerator =
    canDelete ||
    String(cachedUser.role || "").toLowerCase() === "admin" ||
    announcement.created_by === myUserId;

  const [heartCount, setHeartCount] = useState(announcement.heart_count || 0);
  const [userReacted, setUserReacted] = useState(Boolean(announcement.user_reacted));
  const [commentCount, setCommentCount] = useState(announcement.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const commentsOpenRef = useRef(false);
  const lastCountRef = useRef(announcement.comment_count || 0);

  useEffect(() => {
    setHeartCount(announcement.heart_count || 0);
    setUserReacted(Boolean(announcement.user_reacted));
    setCommentCount(announcement.comment_count || 0);
  }, [announcement]);

  const loadComments = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingComments(true);
      const rows = await fetchComments(announcement.id);
      setComments((prev) => {
        const byId = new Map((rows || []).map((row) => [row.id, row]));
        for (const row of prev) {
          if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
        }
        return [...byId.values()].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
      });
      setCommentCount((rows || []).length);
      lastCountRef.current = (rows || []).length;
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (!autoExpandComments) return;
    setShowComments(true);
    commentsOpenRef.current = true;
    loadComments({ silent: comments.length > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpandComments, announcement.id]);

  useEffect(() => {
    const nextCount = Number(announcement.comment_count || 0);
    if (!showComments) {
      lastCountRef.current = nextCount;
      return;
    }
    if (nextCount !== lastCountRef.current) {
      lastCountRef.current = nextCount;
      loadComments({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement.comment_count, showComments, announcement.id]);

  useEffect(() => {
    if (!showComments) return undefined;

    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") return;
      await loadComments({ silent: true });
    };

    const timer = window.setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    const kick = window.setTimeout(tick, 400);

    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(kick);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments, announcement.id]);

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    commentsOpenRef.current = next;
    if (next) {
      await loadComments({ silent: comments.length > 0 });
    }
  };

  const notifyParentQuietly = () => {
    if (typeof onUpdated === "function") onUpdated(true);
  };

  const handleHeart = async () => {
    if (!allowInteract) return;

    try {
      const result = await toggleHeart(announcement.id);
      setUserReacted(result.user_reacted);
      setHeartCount(result.heart_count);
      notifyParentQuietly();
    } catch (err) {
      error(err.message || "Could not update reaction.");
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!allowInteract || !commentText.trim() || submitting) return;

    const body = commentText.trim();
    try {
      setSubmitting(true);
      const row = await postComment(announcement.id, body);
      setComments((prev) => {
        if (prev.some((c) => c.id === row?.id)) return prev;
        return [...prev, row];
      });
      setCommentText("");
      setCommentCount((prev) => prev + 1);
      lastCountRef.current += 1;
      setShowComments(true);
      notifyParentQuietly();
      window.setTimeout(() => loadComments({ silent: true }), 600);
    } catch (err) {
      error(err.message || "Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const canManageComment = (comment) => {
    if (!comment) return false;
    if (comment.user_id && myUserId && comment.user_id === myUserId) return true;
    return Boolean(isModerator);
  };

  const canEditComment = (comment) =>
    Boolean(comment?.user_id && myUserId && comment.user_id === myUserId);

  const startEdit = (comment) => {
    setEditingId(comment.id);
    setEditText(comment.body || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (commentId) => {
    if (!editText.trim() || savingEdit) return;
    try {
      setSavingEdit(true);
      const updated = await updateComment(commentId, editText.trim());
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated, body: updated.body || editText.trim() } : c))
      );
      cancelEdit();
      notifyParentQuietly();
    } catch (err) {
      error(err.message || "Could not update comment.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    const ok = await confirm({
      title: "Delete comment?",
      message: "This comment will be removed permanently.",
      tone: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!ok) return;

    try {
      await removeComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setCommentCount((prev) => Math.max(0, prev - 1));
      lastCountRef.current = Math.max(0, lastCountRef.current - 1);
      if (editingId === comment.id) cancelEdit();
      notifyParentQuietly();
    } catch (err) {
      error(err.message || "Could not delete comment.");
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    const confirmed = await confirm({
      title: "Delete announcement?",
      message: "This announcement will be permanently removed.",
      tone: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Keep",
    });
    if (!confirmed) return;

    try {
      await removeAnnouncement(announcement.id);
      onDeleted?.(announcement.id);
    } catch (err) {
      error(err.message || "Could not delete announcement.");
    }
  };

  const authorName = announcement.author_first_name
    ? `${announcement.author_first_name} ${announcement.author_last_name || ""}`.trim()
    : hideSections
      ? "ExamNexus Admin"
      : "Faculty";

  const inputClass = `min-w-0 flex-1 bg-transparent p-2.5 text-base outline-none ${
    theme === "dark" ? "text-white placeholder:text-gray-500" : "text-gray-900"
  } disabled:opacity-70`;

  return (
    <article
      id={`announcement-${announcement.id}`}
      className={`rounded-xl p-4 border transition-shadow duration-300 ${
        highlighted
          ? theme === "dark"
            ? "bg-emerald-500/10 border-emerald-400/50 ring-2 ring-emerald-400/30"
            : "en-bg-muted border-emerald-400 ring-2 ring-emerald-300/50"
          : theme === "dark"
            ? "bg-black/20 border-white/10"
            : "en-bg-elevated border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className={`font-semibold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            {announcement.title}
          </h3>
          <p
            className={`text-xs mt-1 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {new Date(announcement.created_at).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {` · ${authorName}`}
          </p>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className={`shrink-0 p-2 rounded-lg ${
              theme === "dark"
                ? "hover:bg-red-500/20 text-red-400"
                : "hover:bg-red-50 text-red-600"
            }`}
            aria-label="Delete announcement"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <p
        className={`mt-3 text-sm whitespace-pre-wrap ${
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        }`}
      >
        {announcement.body || "—"}
      </p>

      {!hideSections && (
        <p
          className={`mt-2 text-xs ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          {formatTargetSectionsLabel(announcement.target_sections)}
        </p>
      )}

      {hideSections && announcement.audience && (
        <p
          className={`mt-2 text-xs ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Audience: {announcement.audience}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={handleHeart}
          disabled={!allowInteract}
          className={`inline-flex items-center gap-1.5 text-sm transition ${
            userReacted
              ? "text-red-500"
              : theme === "dark"
                ? "text-gray-400 hover:text-red-400"
                : "text-gray-600 hover:text-red-500"
          } disabled:opacity-50`}
        >
          <Heart size={16} fill={userReacted ? "currentColor" : "none"} />
          {heartCount}
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          className={`inline-flex items-center gap-1.5 text-sm ${
            theme === "dark"
              ? "text-gray-400 hover:text-emerald-400"
              : "text-gray-600 hover:text-teal-700"
          }`}
        >
          <MessageCircle size={16} />
          {commentCount}
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-3">
          {loadingComments && comments.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Loading comments...
            </p>
          ) : comments.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No comments yet.
            </p>
          ) : (
            <div className="en-announcement-comments en-scroll-region max-h-48 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2">
                  <ProfileAvatar
                    src={comment.avatar_url}
                    alt={comment.first_name || "User"}
                    size="xs"
                    showRing={false}
                  />
                  <div
                    className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                      theme === "dark" ? "bg-white/5" : "en-bg-muted"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <p
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-emerald-400" : "text-teal-700"
                        }`}
                      >
                        {`${comment.first_name || "User"} ${comment.last_name || ""}`.trim()}
                      </p>
                      <div className="flex items-center gap-1">
                        {comment.created_at && (
                          <p
                            className={`text-[10px] ${
                              theme === "dark" ? "text-gray-500" : "text-gray-500"
                            }`}
                          >
                            {formatCommentTime(comment.created_at)}
                          </p>
                        )}
                        {allowInteract && canEditComment(comment) && editingId !== comment.id && (
                          <button
                            type="button"
                            onClick={() => startEdit(comment)}
                            className={`rounded p-1 ${
                              theme === "dark"
                                ? "text-gray-400 hover:text-emerald-300"
                                : "text-gray-500 hover:text-teal-700"
                            }`}
                            aria-label="Edit comment"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {allowInteract && canManageComment(comment) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment)}
                            className={`rounded p-1 ${
                              theme === "dark"
                                ? "text-gray-400 hover:text-red-400"
                                : "text-gray-500 hover:text-red-600"
                            }`}
                            aria-label="Delete comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {editingId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          disabled={savingEdit}
                          className={`w-full rounded-lg border px-2.5 py-2 text-base outline-none ${
                            theme === "dark"
                              ? "border-white/15 bg-black/20 text-white"
                              : "border-emerald-200 bg-white text-gray-900"
                          }`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={savingEdit || !editText.trim()}
                            onClick={() => saveEdit(comment.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Check size={12} />
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={cancelEdit}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              theme === "dark" ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            <X size={12} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                        {comment.body}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {allowInteract && (
            <form onSubmit={handleComment} className="flex w-full min-w-0 items-center gap-0">
              <div
                className={`flex min-w-0 flex-1 items-center gap-1 rounded-xl border pr-1 ${
                  theme === "dark"
                    ? "border-white/10 bg-white/10"
                    : "border-emerald-200 en-bg-elevated"
                }`}
              >
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={submitting ? "Posting…" : "Write a comment..."}
                  disabled={submitting}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className={`shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold ${
                    theme === "dark"
                      ? "bg-emerald-500 text-black"
                      : "bg-emerald-500 text-white"
                  } disabled:opacity-50`}
                  aria-label={submitting ? "Posting comment" : "Post comment"}
                >
                  {submitting ? "Posting…" : <Send size={16} />}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
