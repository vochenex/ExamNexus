import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Megaphone } from "lucide-react";
import BackButton from "../components/BackButton";
import AnnouncementCard from "../components/AnnouncementCard";
import PageHeader from "../components/ui/PageHeader";
import AlertBanner from "../components/ui/AlertBanner";
import { useTheme } from "../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../utils/themeInputs";
import { PageLoadingSkeleton } from "../components/ui/PageLoadingSkeleton";
import { usePolling } from "../hooks/useRealtimeFetch";
import {
  fetchPlatformAnnouncements,
  fetchAdminAnnouncementComments,
  postAdminAnnouncementComment,
  toggleAdminAnnouncementHeart,
} from "../utils/supabaseData";

/**
 * Shared student/faculty view for admin platform announcements.
 * Supports react + comment like class announcements.
 */
export default function PlatformAnnouncements() {
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const openComments = searchParams.get("comments") === "1";

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const rows = await fetchPlatformAnnouncements();
      setAnnouncements(rows);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load platform announcements.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  usePolling(loadPage, []);

  useEffect(() => {
    if (!highlightId || loading) return;
    const timer = setTimeout(() => {
      document
        .getElementById(`announcement-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightId, loading, announcements.length]);

  if (loading) {
    return <PageLoadingSkeleton theme={theme} variant="list" />;
  }

  return (
    <div className={pageShellClass(theme)}>
      <div className="mx-auto max-w-3xl">
        <BackButton />
        <PageHeader
          theme={theme}
          icon={Megaphone}
          title="Platform announcements"
          subtitle="Messages from ExamNexus admin. React and comment freely."
        />

        <div className={panelClass(theme)}>
          {error && <AlertBanner variant="error">{error}</AlertBanner>}

          {announcements.length === 0 ? (
            <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
              No platform announcements yet.
            </p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  allowInteract
                  hideSections
                  highlighted={highlightId === String(announcement.id)}
                  autoExpandComments={
                    openComments && highlightId === String(announcement.id)
                  }
                  onUpdated={() => loadPage(true)}
                  fetchComments={fetchAdminAnnouncementComments}
                  postComment={postAdminAnnouncementComment}
                  toggleHeart={toggleAdminAnnouncementHeart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
