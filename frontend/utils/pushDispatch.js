import { API_BASE } from "./apiBase.js";
import { getAuthSession } from "./authUser";

function readCachedActor() {
  try {
    const user = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return {
      actorName: name || user.email || "",
      actorRole: user.role || "",
      actorAvatar: user.avatar_url || "",
    };
  } catch {
    return { actorName: "", actorRole: "", actorAvatar: "" };
  }
}

async function authHeaders() {
  const session = await getAuthSession();
  const token = session?.access_token;
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Push to an explicit list of user ids. */
export async function dispatchPushToUsers({
  userIds = [],
  title,
  body = "",
  data = {},
  actorName,
  actorRole,
  actorAvatar,
  subjectName,
}) {
  try {
    const headers = await authHeaders();
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!headers || !ids.length || !title) return;

    const actor = readCachedActor();
    await fetch(`${API_BASE}/push/notify-users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userIds: ids,
        title,
        body,
        data,
        actorName: actorName ?? actor.actorName,
        actorRole: actorRole ?? actor.actorRole,
        actorAvatar: actorAvatar ?? actor.actorAvatar,
        subjectName: subjectName || "",
      }),
    });
  } catch (err) {
    console.warn("Push to users skipped:", err?.message || err);
  }
}

/** Admin platform broadcast push by audience. */
export async function dispatchBroadcastPush({
  audience = "all",
  title,
  body = "",
  path = "/student/platform-announcements",
  facultyPath = "/faculty/platform-announcements",
  studentPath = "/student/platform-announcements",
}) {
  try {
    const headers = await authHeaders();
    if (!headers || !title) return;

    const actor = readCachedActor();
    await fetch(`${API_BASE}/push/broadcast`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        audience,
        title,
        body,
        path,
        facultyPath,
        studentPath,
        ...actor,
        actorRole: actor.actorRole || "Admin",
      }),
    });
  } catch (err) {
    console.warn("Broadcast push skipped:", err?.message || err);
  }
}

/** Faculty subject announcement push (existing backend route). */
export async function dispatchSubjectAnnouncementPush({
  subjectIds = [],
  title,
  body = "",
  targetSections = null,
  subjectName = "",
}) {
  try {
    const headers = await authHeaders();
    const ids = [...new Set((subjectIds || []).filter(Boolean))];
    if (!headers || !ids.length || !title) return;

    const actor = readCachedActor();
    await Promise.allSettled(
      ids.map((subjectId) =>
        fetch(`${API_BASE}/push/announce`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            subjectId,
            title,
            body,
            targetSections,
            path: `/student/subject/${subjectId}/social`,
            subjectName,
            ...actor,
            actorRole: actor.actorRole || "Faculty",
          }),
        })
      )
    );
  } catch (err) {
    console.warn("Subject announcement push skipped:", err?.message || err);
  }
}
