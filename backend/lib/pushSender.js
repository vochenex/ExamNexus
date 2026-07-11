/**
 * Push sender for ExamNexus native apps.
 *
 * Delivery backends (first match wins):
 * - FCM_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS → FCM HTTP v1 (recommended)
 * - FCM_SERVER_KEY → legacy FCM HTTP API (deprecated; unavailable on new Firebase projects)
 */

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const ALERTS_CHANNEL_ID = "examnexus_alerts";
const BRAND_COLOR = "#10B981";

let cachedServiceAccount = null;
let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function getFcmServerKey() {
  return process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || "";
}

function getServiceAccountPath() {
  const raw =
    process.env.FCM_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  if (!raw) return "";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function loadServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  const jsonEnv =
    process.env.FCM_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    "";
  if (jsonEnv) {
    try {
      cachedServiceAccount = JSON.parse(jsonEnv);
      return cachedServiceAccount;
    } catch {
      console.warn("FCM_SERVICE_ACCOUNT_JSON is set but invalid JSON");
    }
  }

  const accountPath = getServiceAccountPath();
  if (!accountPath || !fs.existsSync(accountPath)) return null;
  try {
    cachedServiceAccount = JSON.parse(fs.readFileSync(accountPath, "utf8"));
    return cachedServiceAccount;
  } catch {
    return null;
  }
}

function getFcmProjectId() {
  return process.env.FCM_PROJECT_ID || loadServiceAccount()?.project_id || "";
}

function isPushConfigured() {
  return Boolean(getFcmServerKey() || loadServiceAccount());
}

function getPushApiMode() {
  if (loadServiceAccount()) return "v1";
  if (getFcmServerKey()) return "legacy";
  return "none";
}

function truncate(text, max) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function roleLabel(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "Admin";
  if (normalized === "faculty" || normalized === "teacher") return "Faculty";
  if (normalized === "student") return "Student";
  return role ? String(role) : "";
}

function kindLabel(kind) {
  switch (String(kind || "").toLowerCase()) {
    case "admin_announcement":
      return "Admin announcement";
    case "assessment":
      return "New assessment";
    case "comment":
      return "New comment";
    case "reaction":
      return "New reaction";
    case "account":
      return "Account update";
    case "announcement":
    default:
      return "Announcement";
  }
}

/**
 * Build a themed, scannable notification: category title + who/where + content.
 */
function buildRichPushPayload({
  kind = "announcement",
  title,
  body,
  actorName = "",
  actorRole = "",
  actorAvatar = "",
  subjectName = "",
  path = "",
  tag = "",
  extraData = {},
}) {
  const category = kindLabel(kind);
  const actor = String(actorName || "").trim();
  const role = roleLabel(actorRole);
  const subject = String(subjectName || "").trim();
  const contentTitle = String(title || "").trim();
  const contentBody = String(body || "").trim();

  const displayTitle = subject
    ? truncate(`${category} · ${subject}`, 65)
    : truncate(category, 65);

  const lines = [];
  if (actor) {
    lines.push(role ? `From ${actor} · ${role}` : `From ${actor}`);
  }
  if (contentTitle && contentTitle.toLowerCase() !== category.toLowerCase()) {
    lines.push(contentTitle);
  }
  if (contentBody) {
    lines.push(contentBody);
  }
  if (!lines.length) {
    lines.push("Open ExamNexus to view details.");
  }

  return {
    title: displayTitle,
    body: truncate(lines.join("\n"), 240),
    imageUrl: String(actorAvatar || "").trim(),
    tag: tag || undefined,
    data: {
      kind: String(kind || "announcement"),
      path: String(path || ""),
      actor_name: actor,
      actor_role: role,
      actor_avatar: String(actorAvatar || "").trim(),
      subject_name: subject,
      content_title: contentTitle,
      content_body: contentBody,
      ...Object.fromEntries(
        Object.entries(extraData || {}).map(([k, v]) => [k, String(v ?? "")])
      ),
    },
  };
}

async function getFcmAccessToken() {
  const account = loadServiceAccount();
  if (!account?.private_key || !account?.client_email) {
    throw new Error("FCM service account not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const assertion = jwt.sign(
    {
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    },
    account.private_key,
    { algorithm: "RS256" }
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM token exchange failed: ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  cachedAccessToken = json.access_token;
  cachedAccessTokenExpiresAt = now + Number(json.expires_in || 3600);
  return cachedAccessToken;
}

async function sendViaFcmV1(tokens, { title, body, data = {}, imageUrl = "", tag }) {
  const projectId = getFcmProjectId();
  if (!projectId) {
    return { sent: 0, skipped: tokens.length, reason: "FCM_PROJECT_ID not configured" };
  }

  let accessToken;
  try {
    accessToken = await getFcmAccessToken();
  } catch (err) {
    return { sent: 0, skipped: tokens.length, reason: err.message };
  }

  const dataPayload = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
  );

  const notification = {
    title,
    body,
  };
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    notification.image = imageUrl;
  }

  const androidNotification = {
    channel_id: ALERTS_CHANNEL_ID,
    sound: "default",
    default_sound: true,
    default_vibrate_timings: true,
    notification_priority: "PRIORITY_MAX",
    visibility: "PUBLIC",
    color: BRAND_COLOR,
    ticker: title,
  };
  if (notification.image) {
    androidNotification.image = notification.image;
  }
  if (tag) {
    androidNotification.tag = String(tag).slice(0, 64);
  }

  let sent = 0;
  const failures = [];
  const concurrency = 20;

  for (let i = 0; i < tokens.length; i += concurrency) {
    const batch = tokens.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (token) => {
        try {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification,
                  data: dataPayload,
                  android: {
                    priority: "HIGH",
                    ttl: "3600s",
                    collapse_key: String(data.kind || "examnexus").slice(0, 32),
                    notification: androidNotification,
                  },
                  apns: {
                    headers: {
                      "apns-priority": "10",
                      "apns-push-type": "alert",
                    },
                    payload: {
                      aps: {
                        alert: { title, body },
                        sound: "default",
                        "mutable-content": 1,
                        "interruption-level": "time-sensitive",
                      },
                    },
                    fcm_options: notification.image
                      ? { image: notification.image }
                      : undefined,
                  },
                },
              }),
            }
          );

          if (!response.ok) {
            const text = await response.text();
            failures.push(text.slice(0, 200));
            return;
          }
          sent += 1;
        } catch (err) {
          failures.push(err.message || "send failed");
        }
      })
    );
  }

  return {
    sent,
    skipped: 0,
    failures: failures.length ? failures.slice(0, 5) : undefined,
  };
}

async function sendViaFcmLegacy(tokens, { title, body, data = {}, imageUrl = "" }) {
  const key = getFcmServerKey();
  if (!key) {
    return { sent: 0, skipped: tokens.length, reason: "FCM not configured" };
  }

  if (!tokens.length) {
    return { sent: 0, skipped: 0 };
  }

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 900) {
    chunks.push(tokens.slice(i, i + 900));
  }

  let sent = 0;
  const failures = [];

  for (const chunk of chunks) {
    const notification = {
      title,
      body,
      sound: "default",
      android_channel_id: ALERTS_CHANNEL_ID,
      color: BRAND_COLOR,
      priority: "high",
    };
    if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
      notification.image = imageUrl;
    }

    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: chunk,
        priority: "high",
        content_available: true,
        notification,
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
        ),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      failures.push(text.slice(0, 300));
      continue;
    }

    const json = await response.json();
    sent += Number(json.success || 0);
    if (json.failure) {
      failures.push(`${json.failure} device(s) failed`);
    }
  }

  return { sent, skipped: 0, failures };
}

async function sendViaFcm(tokens, payload) {
  if (loadServiceAccount()) {
    return sendViaFcmV1(tokens, payload);
  }
  return sendViaFcmLegacy(tokens, payload);
}

async function loadUserProfile(admin, userId) {
  if (!userId) return null;
  const { data, error } = await admin
    .from("users")
    .select("id, first_name, last_name, role, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const name = `${data.first_name || ""} ${data.last_name || ""}`.trim();
  return {
    id: data.id,
    name: name || "ExamNexus user",
    role: data.role || "",
    avatar: data.avatar_url || "",
  };
}

async function loadSubjectName(admin, subjectId) {
  if (!subjectId) return "";
  const { data } = await admin
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .maybeSingle();
  return data?.name || "";
}

/**
 * Send a push notification to a list of user ids.
 */
async function sendPushToUsers(admin, userIds, payload) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return { sent: 0, skipped: 0, recipients: 0 };
  }

  const rich =
    payload?.rich === false
      ? {
          title: payload.title,
          body: payload.body || "",
          imageUrl: payload.imageUrl || "",
          tag: payload.tag,
          data: payload.data || {},
        }
      : buildRichPushPayload({
          kind: payload?.data?.kind || payload?.kind || "announcement",
          title: payload.title,
          body: payload.body,
          actorName: payload.actorName || payload.data?.actor_name,
          actorRole: payload.actorRole || payload.data?.actor_role,
          actorAvatar: payload.actorAvatar || payload.data?.actor_avatar || payload.imageUrl,
          subjectName: payload.subjectName || payload.data?.subject_name,
          path: payload.path || payload.data?.path,
          tag: payload.tag,
          extraData: payload.data || {},
        });

  const { data: devices, error } = await admin
    .from("push_devices")
    .select("token, user_id, platform")
    .in("user_id", uniqueIds);

  if (error) {
    if (
      error.message?.includes("push_devices") ||
      error.message?.includes("does not exist")
    ) {
      return { sent: 0, skipped: uniqueIds.length, reason: "push_devices missing" };
    }
    throw error;
  }

  const tokens = [...new Set((devices || []).map((row) => row.token).filter(Boolean))];
  const result = await sendViaFcm(tokens, rich);
  return { ...result, recipients: uniqueIds.length, devices: tokens.length };
}

/**
 * Push a faculty/admin announcement to enrolled students for the subject.
 */
async function notifyAnnouncementRecipients(admin, {
  subjectId,
  title,
  body,
  targetSections = null,
  path = "/student/subjects",
  actorUserId = null,
  actorName = "",
  actorRole = "",
  actorAvatar = "",
  subjectName = "",
}) {
  let recipientIds = [];

  const { data: rpcIds, error: rpcError } = await admin.rpc(
    "get_announcement_recipient_ids",
    {
      p_subject_id: subjectId,
      p_target_sections: targetSections,
    }
  );

  if (!rpcError && Array.isArray(rpcIds)) {
    recipientIds = rpcIds;
  } else {
    const { data: rows, error } = await admin
      .from("subject_students")
      .select("student_id, section")
      .eq("subject_id", subjectId);

    if (error) throw error;

    recipientIds = (rows || [])
      .filter((row) => {
        if (!targetSections?.length) return true;
        return targetSections.some(
          (section) =>
            String(row.section || "")
              .toUpperCase()
              .includes(String(section).toUpperCase())
        );
      })
      .map((row) => row.student_id);
  }

  const [actor, resolvedSubjectName] = await Promise.all([
    actorName
      ? Promise.resolve({
          name: actorName,
          role: actorRole,
          avatar: actorAvatar,
        })
      : loadUserProfile(admin, actorUserId),
    subjectName || loadSubjectName(admin, subjectId),
  ]);

  return sendPushToUsers(admin, recipientIds, {
    kind: "announcement",
    title: title || "New announcement",
    body: body || "You have a new ExamNexus announcement.",
    actorName: actor?.name || actorName,
    actorRole: actor?.role || actorRole || "Faculty",
    actorAvatar: actor?.avatar || actorAvatar,
    subjectName: resolvedSubjectName || subjectName,
    path,
    tag: `announcement-${subjectId || "general"}`,
    data: {
      kind: "announcement",
      path,
      subject_id: subjectId || "",
    },
  });
}

/**
 * Push an admin broadcast to faculty and/or students by audience.
 */
async function notifyBroadcastAudience(admin, {
  audience = "all",
  title,
  body,
  path = "/student/dashboard",
  actorUserId = null,
  actorName = "",
  actorRole = "",
  actorAvatar = "",
}) {
  const normalized = String(audience || "all").toLowerCase();
  const { data: rows, error } = await admin
    .from("users")
    .select("id, role, account_status")
    .in("role", ["Student", "student", "Faculty", "faculty", "Teacher", "teacher"]);

  if (error) throw error;

  const recipientIds = (rows || [])
    .filter((row) => {
      const role = String(row.role || "").toLowerCase();
      const status = String(row.account_status || "approved").toLowerCase();
      if (status && status !== "approved") return false;
      if (normalized === "faculty") return role === "faculty" || role === "teacher";
      if (normalized === "students") return role === "student";
      return role === "faculty" || role === "teacher" || role === "student";
    })
    .map((row) => row.id);

  const actor = actorName
    ? { name: actorName, role: actorRole || "Admin", avatar: actorAvatar }
    : await loadUserProfile(admin, actorUserId);

  return sendPushToUsers(admin, recipientIds, {
    kind: "admin_announcement",
    title: title || "ExamNexus announcement",
    body: body || "You have a new platform announcement.",
    actorName: actor?.name || "ExamNexus Admin",
    actorRole: actor?.role || "Admin",
    actorAvatar: actor?.avatar || "",
    path,
    tag: `broadcast-${normalized}`,
    data: {
      kind: "admin_announcement",
      path,
      audience: normalized,
    },
  });
}

module.exports = {
  sendPushToUsers,
  notifyAnnouncementRecipients,
  notifyBroadcastAudience,
  buildRichPushPayload,
  getFcmServerKey,
  isPushConfigured,
  getPushApiMode,
  getFcmProjectId,
};
