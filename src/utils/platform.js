import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { websiteUrl } from "../config/appConfig";

/**
 * True when running inside the native mobile app (Capacitor iOS/Android),
 * false on the regular web build.
 */
export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** "ios" | "android" | "web" */
export function getPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

/**
 * Open a website route in the system browser (in-app browser on native,
 * new tab on web). Assessments are always taken on the website.
 * @param {string} path in-app route/path, e.g. "/student/take-assessment/123"
 */
export async function openOnWebsite(path = "/") {
  const url = websiteUrl(path);

  if (isNativeApp()) {
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
