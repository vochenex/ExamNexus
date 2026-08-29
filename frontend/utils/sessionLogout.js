import { supabase } from "../supabaseClient";
import { isNativeApp } from "./platform";
import { sealAuthNavigation } from "./nativeBack";

/**
 * Clear session and optionally keep push bindings for Saved Accounts
 * so those users still get OS notification banners on this device.
 */
export async function clearLocalSessionAndLogout({
  email,
  userId,
  navigate,
  navigateTo = "/auth",
  replace = false,
} = {}) {
  try {
    const { releasePushTokenOnLogout } = await import("./pushNotifications");
    await releasePushTokenOnLogout({ email, userId });
  } catch {
    // ignore push cleanup errors
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out network errors; still clear local session below.
  }

  localStorage.removeItem("examnexus_user");

  // Clear any leftover per-tab auth keys from older builds.
  try {
    const staleKeys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && (key.includes("auth-token") || key === "examnexus-auth-token")) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }

  const useReplace = replace || isNativeApp();
  if (typeof navigate === "function") {
    navigate(navigateTo, useReplace ? { replace: true } : undefined);
  }

  if (isNativeApp()) {
    sealAuthNavigation(navigateTo);
  }
}
