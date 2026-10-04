import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppModal } from "../contexts/AppModalContext";
import { getAuthSession } from "../utils/authUser";

const SESSION_KEY_PREFIX = "en_temp_pw_notice_";

/**
 * Accounts created by an admin bulk import carry user_metadata.temp_password.
 * Reminds the student once per browser session; never blocks them.
 */
export default function TemporaryPasswordNotice({ profilePath }) {
  const navigate = useNavigate();
  const { confirm } = useAppModal();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getAuthSession();
      const user = session?.user;
      if (cancelled || user?.user_metadata?.temp_password !== true) return;

      const key = `${SESSION_KEY_PREFIX}${user.id}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // sessionStorage unavailable: still show the reminder.
      }

      const goToProfile = await confirm({
        title: "Update your password",
        message:
          "You're signed in with a temporary password from the admin. For your account's security, change it in Profile → Change password.",
        confirmLabel: "Change password",
        cancelLabel: "Later",
        tone: "warning",
        forceModal: true,
      });
      if (goToProfile && !cancelled) navigate(`${profilePath}#change-password`);
    })();

    return () => {
      cancelled = true;
    };
  }, [confirm, navigate, profilePath]);

  return null;
}
