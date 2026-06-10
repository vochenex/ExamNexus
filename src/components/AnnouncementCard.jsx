import { useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ProfileAvatar from "./ProfileAvatar";
import { useAppModal } from "../contexts/AppModalContext";
import { formatTargetSectionsLabel } from "../utils/sections";
import {
  fetchAnnouncementComments,
  postAnnouncementComment,
  toggleAnnouncementHeart,
  deleteAnnouncement,
} from "../utils/supabaseData";

export default function AnnouncementCard({
  announcement,
  canDelete = false,
  allowInteract = true,
  highlighted = false,
  autoExpandComments = false,
  onDeleted,
  onUpdated,
}) {
  const { theme } = useTheme();
  const { error, confirm } = useAppModal();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");

  const [heartCount, setHeartCount] = useState(announcement.heart_count || 0);
  const [userReacted, setUserReacted] = useState(Boolean(announcement.user_reacted));
  const [commentCount, setCommentCount] = useState(announcement.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setHeartCount(announcement.heart_count || 0);
    setUserReacted(Boolean(announcement.user_reacted));
    setCommentCount(announcement.comment_count || 0);
  }, [announcement]);

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const rows = await fetchAnnouncementComments(announcement.id);
      setComments(rows);
      setCommentCount(rows.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (!autoExpandComments) return;
    setShowComments(true);
    loadComments();
  }, [autoExpandComments, announcement.id]);

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      await loadComments();
    }
  };

  const handleHeart = async () => {
    if (!allowInteract) return;

    try {
      const result = await toggleAnnouncementHeart(announcement.id);
      setUserReacted(result.user_reacted);
      setHeartCount(result.heart_count);
      onUpdated?.();
    } catch (err) {
      error(err.message || "Could not update reaction.");
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!allowInteract || !commentText.trim()) return;

    try {
      setSubmitting(true);
      const row = await postAnnouncementComment(announcement.id, commentText.trim());
      setComments((prev) => [...prev, row]);
      setCommentText("");
      setCommentCount((prev) => prev + 1);
      setShowComments(true);
      onUpdated?.();
    } catch (err) {
      error(err.message || "Could not post comment.");
    } finally {
      setSubmitting(false);
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
      await deleteAnnouncement(announcement.id);
      onDeleted?.(announcement.id);
    } catch (err) {
      error(err.message || "Could not delete announcement.");
    }
  };

  const authorName = announcement.author_first_name
    ? `${announcement.author_first_name} ${announcement.author_last_name || ""}`.trim()
    : "Faculty";

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

      <p
        className={`mt-2 text-xs ${
          theme === "dark" ? "text-emerald-400" : "text-teal-700"
        }`}
      >
        {formatTargetSectionsLabel(announcement.target_sections)}
      </p>

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
          {loadingComments ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              Loading comments...
            </p>
          ) : comments.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No comments yet.
            </p>
          ) : (
            comments.map((comment) => (
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
                  <p
                    className={`text-xs font-medium ${
                      theme === "dark" ? "text-emerald-400" : "text-teal-700"
                    }`}
                  >
                    {`${comment.first_name || "User"} ${comment.last_name || ""}`.trim()}
                  </p>
                  <p className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>
                    {comment.body}
                  </p>
                </div>
              </div>
            ))
          )}

          {allowInteract && (
            <form onSubmit={handleComment} className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className={`flex-1 p-2.5 rounded-xl text-sm outline-none ${
                  theme === "dark"
                    ? "bg-white/10 border border-white/10 text-white"
                    : "en-bg-elevated border border-emerald-200 text-gray-900"
                }`}
              />
              <button
                type="submit"
                disabled={submitting || !commentText.trim()}
                className={`p-2.5 rounded-xl ${
                  theme === "dark"
                    ? "bg-emerald-500 text-black"
                    : "bg-emerald-500 text-white"
                } disabled:opacity-50`}
                aria-label="Post comment"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
