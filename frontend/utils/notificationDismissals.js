const DISMISSED_KEY = "examnexus_dismissed_notifications";

export function notificationItemKey(item) {
  return `${item.kind}-${item.id}-${item.created_at}`;
}

export function getDismissedNotificationKeys() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function filterVisibleNotifications(items = []) {
  const dismissed = getDismissedNotificationKeys();
  return items.filter((item) => !dismissed.has(notificationItemKey(item)));
}

export function dismissNotificationItems(items = []) {
  const dismissed = getDismissedNotificationKeys();
  for (const item of items) {
    dismissed.add(notificationItemKey(item));
  }
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

export function clearAllDismissedNotifications() {
  localStorage.removeItem(DISMISSED_KEY);
}
