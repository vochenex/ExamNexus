import { Shield, Users, BookOpen } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { pageShellClass, panelClass } from "../../utils/themeInputs";
import PageHeader from "../../components/ui/PageHeader";

export default function AdminDashboard() {
  const { theme } = useTheme();

  return (
    <div className={pageShellClass(theme)}>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          theme={theme}
          icon={Shield}
          title="Admin Dashboard"
          subtitle="Welcome to ExamNexus Administration."
        />

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Users, label: "User management", hint: "Coming soon" },
            { icon: BookOpen, label: "School settings", hint: "Coming soon" },
            { icon: Shield, label: "System policies", hint: "Coming soon" },
          ].map(({ icon: Icon, label, hint }) => (
            <div key={label} className={panelClass(theme)}>
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                  theme === "dark"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "en-bg-skeleton text-teal-700"
                }`}
              >
                <Icon size={20} />
              </div>
              <h2
                className={`font-semibold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {label}
              </h2>
              <p className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
