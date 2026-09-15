import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Heart, MessageCircle, Pencil, Reply, Send, Trash2, X } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import ProfileAvatar from "./ProfileAvatar";
import { useAppModal } from "../contexts/AppModalContext";
import { formatTargetSectionsLabel } from "../utils/sections";
import {
  fetchAnnouncementComments,
  postAnnouncementComment,
  toggleAnnouncementHeart,
  toggleAnnouncementCommentHeart,
  deleteAnnouncement,
  updateAnnouncementComment,
  deleteAnnouncementComment,
} from "../utils/supabaseData";
import PanelContentSkeleton from "./ui/PanelContentSkeleton";

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

function commentAuthorName(comment) {
  return `${comment?.first_name || "User"} ${comment?.last_name || ""}`.trim();
}

function hasReactionFields(row) {
  return (
    row != null &&
    Object.prototype.hasOwnProperty.call(row, "user_reacted") &&
    Object.prototype.hasOwnProperty.call(row, "heart_count")
  );
}

function applyReactionOverride(row, overrides) {
  const override = overrides?.get(row?.id);
  if (!override) return row;
  return {
    ...row,
    user_reacted: override.user_reacted,
    heart_count: override.heart_count,
  };
}

export default function AnnouncementCard({
  announcement,
  canDelete = false,
  canModerateComments,
  allowInteract = true,
  highlighted = false,
  autoExpandComments = false,
  hideSections = false,
  onDeleted,
  onUpdated,
  fetchComments = fetchAnnouncementComments,
  postComment = postAnnouncementComment,
  toggleHeart = toggleAnnouncementHeart,
  toggleCommentHeart = toggleAnnouncementCommentHeart,
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
    canModerateComments ||
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
  const [replyTo, setReplyTo] = useState(null);
  const [heartBurst, setHeartBurst] = useState(false);
  const [commentIconPop, setCommentIconPop] = useState(false);
  const [sendBurst, setSendBurst] = useState(false);
  const [replyFlashId, setReplyFlashId] = useState(null);
  const [appearIds, setAppearIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [commentHeartBurstId, setCommentHeartBurstId] = useState(null);
  const [revealWave, setRevealWave] = useState(false);
  const [dispersingIds, setDispersingIds] = useState(() => new Set());
  const commentsOpenRef = useRef(false);
  const lastCountRef = useRef(announcement.comment_count || 0);
  const knownIdsRef = useRef(new Set());
  const commentInputRef = useRef(null);
  const commentsPanelRef = useRef(null);
  const commentsListRef = useRef(null);
  const postingLockRef = useRef(false);
  const revealTimeoutRef = useRef(null);
  const disperseTimersRef = useRef(new Map());
  const reactionOverridesRef = useRef(new Map());
  const reactionBusyRef = useRef(new Set());
  const skipPollUntilRef = useRef(0);
  const [focusCommentKey, setFocusCommentKey] = useState(null);
  const dispersingIdsRef = useRef(new Set());

  useEffect(() => {
    dispersingIdsRef.current = dispersingIds;
  }, [dispersingIds]);

  const startCommentsReveal = () => {
    setRevealWave(true);
    if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = window.setTimeout(() => {
      setRevealWave(false);
      revealTimeoutRef.current = null;
    }, 1600);
  };

  useEffect(() => {
    const disperseTimers = disperseTimersRef.current;
    return () => {
      if (revealTimeoutRef.current) window.clearTimeout(revealTimeoutRef.current);
      for (const timer of disperseTimers.values()) {
        window.clearTimeout(timer);
      }
      disperseTimers.clear();
    };
  }, []);

  useEffect(() => {
    setHeartCount(announcement.heart_count || 0);
    setUserReacted(Boolean(announcement.user_reacted));
    setCommentCount(announcement.comment_count || 0);
  }, [announcement]);

  const markAppeared = (ids) => {
    const list = [...ids].filter(Boolean);
    if (!list.length) return;
    setAppearIds((prev) => new Set([...prev, ...list]));
    window.setTimeout(() => {
      setAppearIds((prev) => {
        const copy = new Set(prev);
        for (const id of list) copy.delete(id);
        return copy;
      });
    }, 650);
  };

  const scrollToComment = (commentKey, { focus = true, force = false } = {}) => {
    if (!commentKey) return;
    // Block unrelated auto-scroll while a delete fade is playing.
    if (!force && dispersingIdsRef.current.size > 0) return;
    const run = () => {
      if (!force && dispersingIdsRef.current.size > 0) return;
      const list = commentsListRef.current;
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(String(commentKey))
          : String(commentKey).replace(/"/g, '\\"');
      const el =
        list?.querySelector(`[data-comment-key="${escaped}"]`) ||
        commentsPanelRef.current?.querySelector(`[data-comment-key="${escaped}"]`);
      if (!el) return;

      if (list) {
        const listRect = list.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const nextTop =
          elRect.top - listRect.top + list.scrollTop - list.clientHeight / 2 + elRect.height / 2;
        list.scrollTo({
          top: Math.max(0, nextTop),
          behavior: "smooth",
        });
      }

      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

      if (focus) {
        setFocusCommentKey(String(commentKey));
        el.setAttribute("tabindex", "-1");
        if (typeof el.focus === "function") {
          try {
            el.focus({ preventScroll: true });
          } catch {
            el.focus();
          }
        }
        if (!force) {
          window.setTimeout(() => {
            setFocusCommentKey((prev) => (prev === String(commentKey) ? null : prev));
          }, 1600);
        }
      }
    };

    window.requestAnimationFrame(() => {
      run();
      window.setTimeout(run, 50);
      window.setTimeout(run, 180);
    });
  };

  const loadComments = async ({ silent = false, animateNew = false } = {}) => {
    try {
      if (!silent) setLoadingComments(true);
      const rows = await fetchComments(announcement.id);
      const sorted = [...(rows || [])].sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );

      // Keep optimistic pending rows until their real id replaces them
      setComments((prev) => {
        const prevById = new Map(prev.map((row) => [row.id, row]));
        const clientKeyById = new Map();
        for (const row of prev) {
          if (row?.id && row._clientKey) clientKeyById.set(row.id, row._clientKey);
        }
        const pending = prev.filter((row) => row._pending);
        const matchedPending = new Set();
        const overrides = reactionOverridesRef.current;
        const merged = sorted.map((serverRow) => {
          const prevRow = prevById.get(serverRow.id);
          const pendingMatch = pending.find(
            (row) =>
              !matchedPending.has(row.id) &&
              row.user_id === serverRow.user_id &&
              row.body === serverRow.body &&
              (row.parent_comment_id || null) === (serverRow.parent_comment_id || null)
          );
          let nextRow = serverRow;
          if (pendingMatch) {
            matchedPending.add(pendingMatch.id);
            nextRow = {
              ...serverRow,
              _clientKey: pendingMatch._clientKey || pendingMatch.id,
              _pending: false,
            };
          } else {
            nextRow = {
              ...serverRow,
              _clientKey: clientKeyById.get(serverRow.id) || serverRow.id,
            };
          }

          // Preserve local reactions when get-comments omits reaction fields
          // (e.g. replies SQL ran after reactions SQL without heart columns).
          if (!hasReactionFields(serverRow) && prevRow) {
            nextRow = {
              ...nextRow,
              user_reacted: Boolean(prevRow.user_reacted),
              heart_count: Number(prevRow.heart_count || 0),
            };
          } else {
            nextRow = {
              ...nextRow,
              user_reacted: Boolean(serverRow.user_reacted),
              heart_count: Number(serverRow.heart_count || 0),
            };
          }

          nextRow = applyReactionOverride(nextRow, overrides);
          const override = overrides.get(nextRow.id);
          if (
            override &&
            hasReactionFields(serverRow) &&
            Boolean(serverRow.user_reacted) === override.user_reacted &&
            Number(serverRow.heart_count || 0) === Number(override.heart_count)
          ) {
            overrides.delete(nextRow.id);
          }
          return nextRow;
        });
        const stillPending = pending.filter((row) => !matchedPending.has(row.id));
        // Keep comments that are mid delete-animation even if the server already dropped them.
        const dispersingKept = prev.filter(
          (row) =>
            dispersingIdsRef.current.has(row.id) &&
            !merged.some((m) => m.id === row.id) &&
            !stillPending.some((p) => p.id === row.id)
        );
        return [...merged, ...stillPending, ...dispersingKept].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
      });

      if (animateNew && dispersingIdsRef.current.size === 0) {
        const nextAppear = [];
        for (const row of sorted) {
          if (row?.id && !knownIdsRef.current.has(row.id)) {
            nextAppear.push(row.id);
            knownIdsRef.current.add(row.id);
          }
        }
        if (nextAppear.length) {
          markAppeared(nextAppear);
          // Only nudge scroll for remote comments when the user isn't typing.
          if (document.activeElement !== commentInputRef.current) {
            const latest = nextAppear[nextAppear.length - 1];
            scrollToComment(latest, { focus: false });
          }
        }
      } else {
        for (const row of sorted) {
          if (row?.id) knownIdsRef.current.add(row.id);
        }
      }

      if (dispersingIdsRef.current.size === 0) {
        setCommentCount(sorted.length);
        lastCountRef.current = sorted.length;
      }
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
    startCommentsReveal();
    loadComments({ silent: comments.length > 0, animateNew: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpandComments, announcement.id]);

  useEffect(() => {
    const nextCount = Number(announcement.comment_count || 0);
    if (!showComments) {
      lastCountRef.current = nextCount;
      return;
    }
    if (nextCount !== lastCountRef.current) {
      // During tear animation, only sync the count — don't reload/scroll.
      if (dispersingIdsRef.current.size > 0) {
        lastCountRef.current = nextCount;
        return;
      }
      lastCountRef.current = nextCount;
      loadComments({ silent: true, animateNew: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcement.comment_count, showComments, announcement.id]);

  useEffect(() => {
    if (!showComments) return undefined;

    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") return;
      if (Date.now() < skipPollUntilRef.current) return;
      await loadComments({ silent: true, animateNew: true });
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

  const threadedComments = useMemo(() => {
    const roots = [];
    const byParent = new Map();
    for (const comment of comments) {
      const parentId = comment.parent_comment_id || null;
      if (!parentId) {
        roots.push(comment);
        continue;
      }
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId).push(comment);
    }
    return roots.map((root) => ({
      root,
      replies: byParent.get(root.id) || [],
    }));
  }, [comments]);

  const handleToggleComments = async () => {
    const next = !showComments;
    setCommentIconPop(true);
    window.setTimeout(() => setCommentIconPop(false), 650);
    setShowComments(next);
    commentsOpenRef.current = next;
    if (next) {
      startCommentsReveal();
      await loadComments({ silent: comments.length > 0, animateNew: false });
    } else {
      setRevealWave(false);
      setReplyTo(null);
    }
  };

  const notifyParentQuietly = () => {
    if (typeof onUpdated === "function") onUpdated(true);
  };

  const handleHeart = async () => {
    if (!allowInteract) return;
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 700);

    try {
      const result = await toggleHeart(announcement.id);
      setUserReacted(result.user_reacted);
      setHeartCount(result.heart_count);
      notifyParentQuietly();
    } catch (err) {
      error(err.message || "Could not update reaction.");
    }
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    setReplyFlashId(comment.id);
    window.setTimeout(() => setReplyFlashId(null), 700);
    setShowComments(true);
    window.setTimeout(() => commentInputRef.current?.focus(), 120);
  };

  const cancelReply = () => setReplyTo(null);

  const submitComment = async (body, parentId) => {
    try {
      return await postComment(announcement.id, body, parentId || null);
    } catch (err) {
      // Soft-fallback if reply SQL / 3-arg RPC is not applied yet
      if (parentId) {
        const parent = comments.find((c) => c.id === parentId);
        const name = commentAuthorName(parent) || "comment";
        return await postComment(announcement.id, `↪ ${name}: ${body}`);
      }
      throw err;
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!allowInteract || !commentText.trim() || postingLockRef.current) return;

    const body = commentText.trim();
    const parentId = replyTo
      ? replyTo.parent_comment_id || replyTo.id
      : null;
    const replySnapshot = replyTo;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimistic = {
      id: tempId,
      _clientKey: tempId,
      announcement_id: announcement.id,
      user_id: myUserId,
      body,
      parent_comment_id: parentId,
      created_at: new Date().toISOString(),
      first_name: cachedUser.first_name || "You",
      last_name: cachedUser.last_name || "",
      avatar_url: cachedUser.avatar_url || "",
      heart_count: 0,
      user_reacted: false,
      _pending: true,
    };

    postingLockRef.current = true;
    setSubmitting(true);
    setSendBurst(true);
    window.setTimeout(() => setSendBurst(false), 600);
    knownIdsRef.current.add(tempId);
    markAppeared([tempId]);
    setPendingIds((prev) => new Set(prev).add(tempId));
    setComments((prev) => [...prev, optimistic]);
    setCommentText("");
    setReplyTo(null);
    setCommentCount((prev) => prev + 1);
    lastCountRef.current += 1;
    setShowComments(true);
    scrollToComment(tempId, { focus: true });

    try {
      const row = await submitComment(body, parentId);
      if (row?.id) {
        knownIdsRef.current.add(row.id);
        knownIdsRef.current.delete(tempId);
        setComments((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? { ...row, _clientKey: tempId, _pending: false }
              : c
          )
        );
        setPendingIds((prev) => {
          const copy = new Set(prev);
          copy.delete(tempId);
          return copy;
        });
        scrollToComment(tempId, { focus: true });
      } else {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, _pending: false } : c))
        );
        setPendingIds((prev) => {
          const copy = new Set(prev);
          copy.delete(tempId);
          return copy;
        });
      }
      notifyParentQuietly();
      // Refresh quietly — no second appear animation
      window.setTimeout(() => loadComments({ silent: true, animateNew: false }), 400);
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setPendingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(tempId);
        return copy;
      });
      knownIdsRef.current.delete(tempId);
      setCommentCount((prev) => Math.max(0, prev - 1));
      lastCountRef.current = Math.max(0, lastCountRef.current - 1);
      setCommentText(body);
      if (replySnapshot) setReplyTo(replySnapshot);
      error(err.message || "Could not post comment.");
    } finally {
      postingLockRef.current = false;
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
        prev.map((c) =>
          c.id === commentId ? { ...c, ...updated, body: updated.body || editText.trim() } : c
        )
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

    const removeIds = new Set([comment.id]);
    for (const row of comments) {
      if (row.parent_comment_id === comment.id) removeIds.add(row.id);
    }

    const commentKey = String(comment._clientKey || comment.id);
    skipPollUntilRef.current = Date.now() + 2200;
    if (editingId === comment.id) cancelEdit();
    if (replyTo?.id === comment.id || removeIds.has(replyTo?.id)) cancelReply();

    // Lock view on this comment, then fade it out.
    setFocusCommentKey(commentKey);
    scrollToComment(commentKey, { focus: true, force: true });
    const keepFocusTimer = window.setInterval(() => {
      scrollToComment(commentKey, { focus: true, force: true });
    }, 250);

    dispersingIdsRef.current = new Set([
      ...dispersingIdsRef.current,
      ...removeIds,
    ]);
    setDispersingIds((prev) => new Set([...prev, ...removeIds]));

    const FADE_MS = 900;
    try {
      const deletePromise = removeComment(comment.id);
      await Promise.all([
        deletePromise,
        new Promise((resolve) => {
          const timer = window.setTimeout(resolve, FADE_MS);
          disperseTimersRef.current.set(comment.id, timer);
        }),
      ]);
      window.clearInterval(keepFocusTimer);
      disperseTimersRef.current.delete(comment.id);

      setComments((prev) => prev.filter((c) => !removeIds.has(c.id)));
      setDispersingIds((prev) => {
        const next = new Set(prev);
        for (const id of removeIds) next.delete(id);
        dispersingIdsRef.current = next;
        return next;
      });
      setFocusCommentKey((prev) => (prev === commentKey ? null : prev));
      setCommentCount((prev) => Math.max(0, prev - removeIds.size));
      lastCountRef.current = Math.max(0, lastCountRef.current - removeIds.size);
      for (const id of removeIds) knownIdsRef.current.delete(id);
      notifyParentQuietly();
    } catch (err) {
      window.clearInterval(keepFocusTimer);
      const timer = disperseTimersRef.current.get(comment.id);
      if (timer) {
        window.clearTimeout(timer);
        disperseTimersRef.current.delete(comment.id);
      }
      setDispersingIds((prev) => {
        const next = new Set(prev);
        for (const id of removeIds) next.delete(id);
        dispersingIdsRef.current = next;
        return next;
      });
      setFocusCommentKey((prev) => (prev === commentKey ? null : prev));
      error(err.message || "Could not delete comment.");
    }
  };

  const handleCommentHeart = async (comment) => {
    if (!allowInteract || !comment?.id || comment._pending) return;
    if (String(comment.id).startsWith("temp-")) return;
    if (reactionBusyRef.current.has(comment.id)) return;

    reactionBusyRef.current.add(comment.id);
    setCommentHeartBurstId(comment.id);
    window.setTimeout(() => setCommentHeartBurstId(null), 700);

    const prevReacted = Boolean(comment.user_reacted);
    const prevCount = Number(comment.heart_count || 0);
    const nextReacted = !prevReacted;
    const nextCount = Math.max(0, prevCount + (prevReacted ? -1 : 1));

    reactionOverridesRef.current.set(comment.id, {
      user_reacted: nextReacted,
      heart_count: nextCount,
    });
    skipPollUntilRef.current = Date.now() + 8000;

    setComments((prev) =>
      prev.map((row) =>
        row.id === comment.id || row._clientKey === comment._clientKey
          ? {
              ...row,
              user_reacted: nextReacted,
              heart_count: nextCount,
            }
          : row
      )
    );

    try {
      const result = await toggleCommentHeart(comment.id);
      const confirmed = {
        user_reacted: Boolean(result?.user_reacted),
        heart_count: Number(result?.heart_count ?? nextCount),
      };
      reactionOverridesRef.current.set(comment.id, confirmed);
      setComments((prev) =>
        prev.map((row) =>
          row.id === comment.id || row._clientKey === comment._clientKey
            ? {
                ...row,
                ...confirmed,
              }
            : row
        )
      );
      // Do not notify parent — list refresh was wiping comment reactions.
    } catch (err) {
      reactionOverridesRef.current.delete(comment.id);
      setComments((prev) =>
        prev.map((row) =>
          row.id === comment.id || row._clientKey === comment._clientKey
            ? {
                ...row,
                user_reacted: prevReacted,
                heart_count: prevCount,
              }
            : row
        )
      );
      error(err.message || "Could not update comment reaction.");
    } finally {
      reactionBusyRef.current.delete(comment.id);
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

  const renderCommentRow = (
    comment,
    { isReply = false, revealIndex = 0 } = {}
  ) => {
    const appearing = appearIds.has(comment.id);
    const isPending = Boolean(comment._pending) || pendingIds.has(comment.id);
    const isDispersing = dispersingIds.has(comment.id);
    const commentKey = String(comment._clientKey || comment.id);
    const isFocused = focusCommentKey === commentKey;
    return (
      <div
        key={commentKey}
        data-comment-key={commentKey}
        tabIndex={isFocused || isDispersing ? -1 : undefined}
        className={`relative flex items-start gap-2 outline-none ${
          isDispersing
            ? "en-comment-fade-out"
            : revealWave
              ? "en-comment-reveal"
              : appearing
                ? isReply
                  ? "en-comment-appear-reply"
                  : "en-comment-appear"
                : ""
        } ${replyTo?.id === comment.id ? "en-comment-reply-target" : ""} ${
          replyFlashId === comment.id ? "en-comment-reply-flash" : ""
        } ${isFocused || isDispersing ? "en-comment-focus" : ""}`}
        style={
          revealWave && !isDispersing
            ? { "--en-comment-i": revealIndex }
            : undefined
        }
      >
        <ProfileAvatar
          src={comment.avatar_url}
          alt={comment.first_name || "User"}
          size="xs"
          showRing={false}
        />
        <div
          className={`en-comment-body flex-1 rounded-xl px-3 py-2 text-sm ${
            theme === "dark" ? "bg-white/5" : "en-bg-muted"
          } ${isReply ? "en-comment-reply-shell" : ""} ${
            isPending ? "opacity-90" : ""
          }`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <p
              className={`text-xs font-medium ${
                theme === "dark" ? "text-emerald-400" : "text-teal-700"
              }`}
            >
              {commentAuthorName(comment)}
              {isReply ? (
                <span
                  className={`ml-1.5 font-normal ${
                    theme === "dark" ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  replied
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-1">
              {comment.created_at && !isPending && (
                <p
                  className={`text-[10px] ${
                    theme === "dark" ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  {formatCommentTime(comment.created_at)}
                </p>
              )}
              {allowInteract && editingId !== comment.id && !isPending && !isDispersing && (
                <button
                  type="button"
                  onClick={() => startReply(comment)}
                  className={`en-comment-reply-btn rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    theme === "dark"
                      ? "text-emerald-300/90 hover:bg-emerald-500/15"
                      : "text-teal-700 hover:bg-teal-50"
                  }`}
                >
                  <span className="inline-flex items-center gap-0.5">
                    <Reply size={11} />
                    Reply
                  </span>
                </button>
              )}
              {allowInteract &&
                canEditComment(comment) &&
                editingId !== comment.id &&
                !isPending &&
                !isDispersing && (
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
              {allowInteract &&
                canManageComment(comment) &&
                !isPending &&
                !isDispersing && (
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
                    theme === "dark"
                      ? "text-gray-300 hover:bg-white/10"
                      : "text-gray-600 hover:bg-gray-100"
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
          {isPending ? (
            <p
              className={`mt-1 text-[10px] font-medium ${
                theme === "dark" ? "text-emerald-300/80" : "text-teal-700"
              }`}
            >
              Posting…
            </p>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCommentHeart(comment)}
                disabled={!allowInteract || isDispersing}
                className={`en-react-btn inline-flex items-center gap-1 text-[11px] font-medium transition ${
                  commentHeartBurstId === comment.id ? "en-react-burst" : ""
                } ${
                  comment.user_reacted
                    ? "text-red-500"
                    : theme === "dark"
                      ? "text-gray-400 hover:text-red-400"
                      : "text-gray-500 hover:text-red-500"
                } disabled:opacity-50`}
                aria-label={
                  comment.user_reacted ? "Remove reaction" : "React to comment"
                }
              >
                <Heart
                  size={13}
                  className={
                    commentHeartBurstId === comment.id ? "en-react-heart-pop" : ""
                  }
                  fill={comment.user_reacted ? "currentColor" : "none"}
                />
                {Number(comment.heart_count || 0)}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <article
      id={`announcement-${announcement.id}`}
      className={`rounded-xl p-4 border transition-shadow duration-300 ${
        revealWave ? "overflow-clip" : ""
      } ${
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
          className={`en-react-btn inline-flex items-center gap-1.5 text-sm transition ${
            heartBurst ? "en-react-burst" : ""
          } ${
            userReacted
              ? "text-red-500"
              : theme === "dark"
                ? "text-gray-400 hover:text-red-400"
                : "text-gray-600 hover:text-red-500"
          } disabled:opacity-50`}
        >
          <Heart
            size={16}
            className={heartBurst ? "en-react-heart-pop" : ""}
            fill={userReacted ? "currentColor" : "none"}
          />
          {heartCount}
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          className={`en-comment-toggle-btn inline-flex items-center gap-1.5 text-sm ${
            commentIconPop ? "en-comment-icon-burst" : ""
          } ${
            theme === "dark"
              ? "text-gray-400 hover:text-emerald-400"
              : "text-gray-600 hover:text-teal-700"
          }`}
        >
          <MessageCircle size={16} className={commentIconPop ? "en-comment-icon-spin" : ""} />
          {commentCount}
        </button>
      </div>

      {showComments && (
        <div
          ref={commentsPanelRef}
          className="en-comments-panel mt-4 space-y-3"
        >
          {loadingComments && comments.length === 0 ? (
            <PanelContentSkeleton rows={3} variant="comments" />
          ) : comments.length === 0 ? (
            <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              No comments yet.
            </p>
          ) : (
            <div
              ref={commentsListRef}
              className={`en-announcement-comments max-h-56 space-y-3 overscroll-contain ${
                dispersingIds.size > 0
                  ? "overflow-x-clip overflow-y-auto"
                  : revealWave
                    ? "en-comments-revealing overflow-clip"
                    : "overflow-x-clip overflow-y-auto"
              }`}
            >
              {threadedComments.map(({ root, replies }, threadIndex) => {
                let revealCursor = 0;
                for (let i = 0; i < threadIndex; i += 1) {
                  revealCursor += 1 + (threadedComments[i].replies?.length || 0);
                }
                return (
                <div key={root.id} className="en-comment-thread space-y-2">
                  {renderCommentRow(root, { revealIndex: revealCursor })}
                  {replies.length > 0 ? (
                    <div className="en-comment-replies ml-5 space-y-2 border-l-2 border-emerald-500/35 pl-3 sm:ml-7 sm:pl-4">
                      {replies.map((reply, replyIndex) =>
                        renderCommentRow(reply, {
                          isReply: true,
                          revealIndex: revealCursor + 1 + replyIndex,
                        })
                      )}
                    </div>
                  ) : null}
                </div>
                );
              })}
            </div>
          )}

          {allowInteract && (
            <form
              onSubmit={handleComment}
              className={`space-y-2 ${sendBurst ? "en-comment-send-burst" : ""}`}
            >
              {replyTo ? (
                <div
                  className={`en-reply-banner flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                    theme === "dark"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-teal-50 text-teal-800"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    Replying to{" "}
                    <strong>{commentAuthorName(replyTo)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={cancelReply}
                    className="shrink-0 rounded p-0.5 hover:opacity-80"
                    aria-label="Cancel reply"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              <div className="flex w-full min-w-0 items-center gap-0">
                <div
                  className={`flex min-w-0 flex-1 items-center gap-1 rounded-xl border pr-1 ${
                    theme === "dark"
                      ? "border-white/10 bg-white/10"
                      : "border-emerald-200 en-bg-elevated"
                  } ${sendBurst ? "en-comment-input-pulse" : ""}`}
                >
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      replyTo
                        ? `Reply to ${commentAuthorName(replyTo)}…`
                        : "Write a comment..."
                    }
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className={`en-comment-send-btn shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold ${
                      theme === "dark"
                        ? "bg-emerald-500 text-black"
                        : "bg-emerald-500 text-white"
                    } disabled:opacity-50 ${sendBurst ? "en-comment-send-pop" : ""}`}
                    aria-label="Post comment"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
              {submitting || pendingIds.size > 0 ? (
                <p
                  className={`text-[11px] font-medium ${
                    theme === "dark" ? "text-emerald-300/85" : "text-teal-700"
                  }`}
                >
                  Posting…
                </p>
              ) : null}
            </form>
          )}
        </div>
      )}
    </article>
  );
}
