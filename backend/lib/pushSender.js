/**
 * Soft push sender for ExamNexus native apps.
 *
 * Delivery backends:
 * - FCM_SERVER_KEY  → legacy FCM HTTP API (Android + iOS via FCM)
 * - No key configured → tokens are stored but sends are logged/no-op
 *
 * For production APNs certs you can later swap this for Firebase Admin SDK.
 */

function getFcmServerKey() {
  return process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || "";
}

async function sendViaFcm(tokens, { title, body, data = {} }) {
  const key = getFcmServerKey();
  if (!key) {
    return { sent: 0, skipped: tokens.length, reason: "FCM_SERVER_KEY not configured" };
  }

  if (!tokens.length) {
    return { sent: 0, skipped: 0 };
  }

  // FCM registration_ids accepts up to 1000 tokens per request.
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
    // Table may not exist yet — don't break announcement posting.
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
    // Fallback: all enrolled students in the subject.
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
};
