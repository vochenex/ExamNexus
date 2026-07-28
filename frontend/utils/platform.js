import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { websiteUrl } from "../config/appConfig";

/** Assessments require a real desktop / laptop viewport (min CSS width). */
export const DESKTOP_ASSESSMENT_MIN_WIDTH = 1024;

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
 * True for phones, tablets, and iPads — including mobile/browser layouts.
 * Used to block assessment-taking outside of a computer/laptop.
 */
export function isMobileOrTabletDevice() {
  if (typeof window === "undefined") return false;

  if (isNativeApp()) return true;

  const width = window.innerWidth || window.screen?.width || 0;
  if (width > 0 && width < DESKTOP_ASSESSMENT_MIN_WIDTH) return true;

  const ua = navigator.userAgent || "";
  const uaDataMobile = navigator.userAgentData?.mobile === true;

  // Cover phones + tablets (incl. iPadOS desktop UA with Mac + touch)
  const mobileUa =
    uaDataMobile ||
    /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua) ||
    (/iPad/i.test(ua) || ( /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1));

  return Boolean(mobileUa);
}

/**
 * Students may only take assessments on a computer / laptop browser.
 * Native app, phones, tablets, and iPads are blocked.
 */
export function canTakeAssessmentOnThisDevice() {
  return !isMobileOrTabletDevice();
}

/**
 * Open a website route in the system browser (in-app browser on native,
 * new tab on web).
 * @param {string} path in-app route/path, e.g. "/student/assessments"
 */
export async function openOnWebsite(path = "/") {
  const url = websiteUrl(path);

  if (isNativeApp()) {
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
