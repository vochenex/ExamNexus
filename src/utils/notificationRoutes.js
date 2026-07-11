export function getNotificationDestination(item, { isStudent, userId } = {}) {
  if (!item) {
    return {
      path: isStudent ? "/student/dashboard" : "/faculty/dashboard",
      label: "Go to dashboard",
    };
  }

  if (item.kind === "admin_announcement") {
    return {
      path: isStudent ? "/student/dashboard" : "/faculty/dashboard",
      label: "View platform announcement",
    };
  }

  if (item.kind === "account") {
    return {
      path: "/login",
      label: "Open sign in",
    };
  }

  if (item.kind === "reaction") {
    const announcementId = item.announcement_id || item.id;
    const base = isStudent
      ? `/student/subject/${item.subject_id}/social`
      : `/faculty/subject/${item.subject_id}/social`;
    return {
      path: `${base}?highlight=${announcementId}`,
      label: item.subject_name
        ? `Open ${item.subject_name} announcements`
        : "View announcement",
    };
  }

  if (item.kind === "announcement") {
    const base = isStudent
      ? `/student/subject/${item.subject_id}/social`
      : `/faculty/subject/${item.subject_id}/social`;
    return {
      path: `${base}?highlight=${item.id}`,
      label: item.subject_name
        ? `Open ${item.subject_name} announcements`
        : "View announcement",
    };
  }

  if (item.kind === "comment") {
    const announcementId = item.announcement_id || item.id;
    const base = isStudent
      ? `/student/subject/${item.subject_id}/social`
      : `/faculty/subject/${item.subject_id}/social`;
    return {
      path: `${base}?highlight=${announcementId}&comments=1`,
      label: item.subject_name
        ? `View comment in ${item.subject_name}`
        : "View comment thread",
    };
  }

  if (item.kind === "assessment") {
    if (isStudent) {
      if (item.status === "active") {
        return {
          path: `/student/take-assessment/${item.id}`,
          label: "Take assessment now",
        };
      }
      if (item.status === "closed" && userId) {
        return {
          path: `/student/results/${item.id}/${userId}`,
          label: "View your results",
        };
      }
      return {
        path: `/student/assessments?focus=${item.id}`,
        label:
          item.status === "scheduled"
            ? "View scheduled assessment"
            : "View in My Assessments",
      };
    }

    return {
      path: `/faculty/assessment/${item.id}`,
      label: "Open assessment details",
    };
  }

  return {
    path: isStudent ? "/student/dashboard" : "/faculty/dashboard",
    label: "Go to dashboard",
  };
}
