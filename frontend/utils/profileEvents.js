export const PROFILE_UPDATED_EVENT = "examnexus:profile-updated";

export function broadcastProfileUpdate(profile) {
  if (!profile || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, {
      detail: profile,
    })
  );
}
