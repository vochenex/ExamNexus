import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { supabase } from "../../supabaseClient";
import { isFacultyRole } from "../../utils/avatar";
import FacultyExportPanel from "../../components/FacultyExportPanel";
import PageHeader from "../../components/ui/PageHeader";
import { pageShellWithBellClass } from "../../utils/themeInputs";

export default function FacultyExportsPage() {
  const { theme } = useTheme();
  const cachedUser = JSON.parse(localStorage.getItem("examnexus_user") || "{}");
  const [facultyProfile, setFacultyProfile] = useState(cachedUser);
  const teacherSchoolId = facultyProfile.school_id || cachedUser.school_id || "";

  useEffect(() => {
    const loadProfile = async () => {
      if (!cachedUser.id || !isFacultyRole(cachedUser.role)) return;
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", cachedUser.id)
        .maybeSingle();
      if (data) {
        setFacultyProfile(data);
        localStorage.setItem("examnexus_user", JSON.stringify(data));
      }
    };
    loadProfile();
  }, [cachedUser.id, cachedUser.role]);

  return (
    <div className={pageShellWithBellClass(theme)}>
      <PageHeader
        theme={theme}
        title="Export data"
        subtitle="Download CSV or HTML reports for your subjects and assessments"
        icon={Download}
      />

      {!teacherSchoolId ? (
        <p className={`mt-4 text-sm ${theme === "dark" ? "text-amber-300" : "text-amber-800"}`}>
          Add a valid faculty School ID in your profile before exporting.
        </p>
      ) : (
        <div className="mt-6 max-w-3xl">
          <FacultyExportPanel teacherSchoolId={teacherSchoolId} />
        </div>
      )}
    </div>
  );
}
