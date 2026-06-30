export const AUTH_NOTICE_KEY = "examnexus_auth_notice";

export function stashAuthNotice(notice) {
  if (!notice) return;
  sessionStorage.setItem(AUTH_NOTICE_KEY, JSON.stringify(notice));
}

export function peekAuthNotice() {
  const raw = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuthNotice() {
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
}

export function consumeAuthNotice() {
  const notice = peekAuthNotice();
  if (notice) clearAuthNotice();
  return notice;
}

export function buildPendingAuthNotice(profile) {
  const status = String(profile?.account_status || "pending").toLowerCase();
  const isRejected = status === "rejected";

  return {
    title: isRejected ? "Registration not approved" : "Account pending approval",
    message: isRejected
      ? "Your registration was not approved. Contact your administrator if you believe this is a mistake."
      : "Your account is still waiting for administrator approval. You will be able to log in once an admin approves your registration.",
    confirmLabel: "OK",
  };
}
