export function isNetworkIssue(error, message = "") {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const text = String(error?.message || message || "");
  return (
    error?.name === "TypeError" ||
    error?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|network request failed|offline|internet|reach the server|timed out|timeout|health_failed/i.test(
      text
    )
  );
}
