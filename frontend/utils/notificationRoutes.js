/** True when a route param looks like a real id (not missing / "undefined"). */
export function isValidRouteId(value) {
  if (value == null || value === "") return false;
  const text = String(value).trim();
  return text.length > 0 && text !== "undefined" && text !== "null";
}

function roleDashboard(isStudent) {
  return isStudent ? "/student/dashboard" : "/faculty/dashboard";
}

function roleAnnouncementsHub(isStudent) {
  return isStudent ? "/student/announcements" : "/faculty/announcements";
}

function subjectSocialBase(subjectId, isStudent) {
  if (!isValidRouteId(subjectId)) {
    return roleAnnouncementsHub(isStudent);
  }
  return isStudent
    ? `/student/subject/${subjectId}/social`
    : `/faculty/subject/${subjectId}/social`;
}

/**
 * Normalize notification / push target paths so we never navigate to a
 * non-existent route (which renders a blank green shell).
 */
export function sanitizeAppPath(path, { isStudent = true } = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    return roleDashboard(isStudent);
  }

  // Legacy alias — /login was never registered in App routes (only /auth).
  if (path === "/login" || path.startsWith("/login?")) {
    const query = path.includes("?") ? path.slice(path.indexOf("?")) : "";
    return `/auth${query}`;
  }

  if (/\/subject\/(undefined|null)(\/|\?|$)/i.test(path)) {
    return roleAnnouncementsHub(isStudent);
  }

  if (/\/results\/(undefined|null)(\/|\?|$)/i.test(path)) {
    return isStudent ? "/student/results" : roleDashboard(isStudent);
  }

  if (/\/(take-assessment|assessment|edit-assessment)\/(undefined|null)(\/|\?|$)/i.test(path)) {
    return isStudent ? "/student/assessments" : "/faculty/dashboard";
  }

  return path;
}

export function getNotificationDestination(item, { isStudent, userId } = {}) {
  if (!item) {
    return {
      path: roleDashboard(isStudent),
      label: "Go to dashboard",
    };
  }

  if (item.kind === "admin_announcement") {
    const id = item.id || item.announcement_id;
    const base = isStudent
      ? "/student/platform-announcements"
      : "/faculty/platform-announcements";
    return {
      path: sanitizeAppPath(
        isValidRouteId(id) ? `${base}?highlight=${id}&comments=1` : base,
        { isStudent }
      ),
      label: "View platform announcement",
    };
  }

  if (item.kind === "comment" && (item.platform || !item.subject_id)) {
    const announcementId = item.announcement_id || item.id;
    const base = isStudent
      ? "/student/platform-announcements"
      : "/faculty/platform-announcements";
    return {
      path: sanitizeAppPath(
        isValidRouteId(announcementId)
          ? `${base}?highlight=${announcementId}&comments=1`
          : base,
        { isStudent }
      ),
      label: "View platform comment",
    };
  }

  if (item.kind === "reaction" && (item.platform || !item.subject_id)) {
    const announcementId = item.announcement_id || item.id;
    const base = isStudent
      ? "/student/platform-announcements"
      : "/faculty/platform-announcements";
    return {
      path: sanitizeAppPath(
        isValidRouteId(announcementId)
          ? `${base}?highlight=${announcementId}`
          : base,
        { isStudent }
      ),
      label: "View platform announcement",
    };
  }

  if (item.kind === "account") {
    // In-app users are already signed in — send them home, not /login
    // (which never existed as a route and produced a blank page).
    return {
      path: roleDashboard(isStudent),
      label: "Go to dashboard",
    };
  }

  if (item.kind === "retake") {
    const examId = item.exam_id || item.id;
    if (!isStudent && isValidRouteId(examId)) {
      return {
        path: sanitizeAppPath(`/faculty/assessment/${examId}?tab=retakes`, {
          isStudent,
        }),
        label: "Review retake request",
      };
    }
    return {
      path: sanitizeAppPath("/student/assessments", { isStudent }),
      label: "View My Assessments",
    };
  }

  if (item.kind === "reaction") {
    const announcementId = item.announcement_id || item.id;
    const base = subjectSocialBase(item.subject_id, isStudent);
    const path =
      base.includes("/social") && isValidRouteId(announcementId)
        ? `${base}?highlight=${announcementId}`
        : base;
    return {
      path: sanitizeAppPath(path, { isStudent }),
      label: item.subject_name
        ? `Open ${item.subject_name} announcements`
        : "View announcement",
    };
  }

  if (item.kind === "announcement") {
    const base = subjectSocialBase(item.subject_id, isStudent);
    const path =
      base.includes("/social") && isValidRouteId(item.id)
        ? `${base}?highlight=${item.id}`
        : base;
    return {
      path: sanitizeAppPath(path, { isStudent }),
      label: item.subject_name
        ? `Open ${item.subject_name} announcements`
        : "View announcement",
    };
  }

  if (item.kind === "comment") {
    const announcementId = item.announcement_id || item.id;
    const base = subjectSocialBase(item.subject_id, isStudent);
    const path =
      base.includes("/social") && isValidRouteId(announcementId)
        ? `${base}?highlight=${announcementId}&comments=1`
        : base;
    return {
      path: sanitizeAppPath(path, { isStudent }),
      label: item.subject_name
        ? `View comment in ${item.subject_name}`
        : "View comment thread",
    };
  }

  if (item.kind === "assessment") {
    if (!isValidRouteId(item.id)) {
      return {
        path: isStudent ? "/student/assessments" : "/faculty/dashboard",
        label: isStudent ? "View in My Assessments" : "Go to dashboard",
      };
    }

    if (isStudent) {
      if (item.status === "active") {
        return {
          path: sanitizeAppPath(`/student/take-assessment/${item.id}`, {
            isStudent,
          }),
          label: "Take assessment now",
        };
      }
      if (item.status === "closed" && isValidRouteId(userId)) {
        return {
          path: sanitizeAppPath(`/student/results/${item.id}/${userId}`, {
            isStudent,
          }),
          label: "View your results",
        };
      }
      return {
        path: sanitizeAppPath(`/student/assessments?focus=${item.id}`, {
          isStudent,
        }),
        label:
          item.status === "scheduled"
            ? "View scheduled assessment"
            : "View in My Assessments",
      };
    }

    return {
      path: sanitizeAppPath(`/faculty/assessment/${item.id}`, { isStudent }),
      label: "Open assessment details",
    };
  }

  return {
    path: roleDashboard(isStudent),
    label: "Go to dashboard",
  };
}
