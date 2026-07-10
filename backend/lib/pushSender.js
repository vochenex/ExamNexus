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

async function sendViaFcmV1(tokens, { title, body, data = {} }) {
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
                  notification: { title, body },
                  data: dataPayload,
                  android: { priority: "HIGH" },
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

async function sendViaFcmLegacy(tokens, { title, body, data = {} }) {
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
    const response = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: chunk,
        priority: "high",
        notification: {
          title,
          body,
          sound: "default",
        },
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

/**
 * Send a push notification to a list of user ids.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: Record<string, string|number> }} payload
 */
async function sendPushToUsers(admin, userIds, payload) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueIds.length) {
    return { sent: 0, skipped: 0, recipients: 0 };
  }

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
  const result = await sendViaFcm(tokens, payload);
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

  return sendPushToUsers(admin, recipientIds, {
    title: title || "New announcement",
    body: body || "You have a new ExamNexus announcement.",
    data: {
      kind: "announcement",
      path,
      subject_id: subjectId || "",
    },
  });
}

module.exports = {
  sendPushToUsers,
  notifyAnnouncementRecipients,
  getFcmServerKey,
  isPushConfigured,
  getPushApiMode,
  getFcmProjectId,
};
