import { GraduationCap, UserRound } from "lucide-react";

export default function AuthRoleToggle({
  value,
  onChange,
  theme,
  className = "",
  layout = "grid",
}) {
  const isStack = layout === "stack";

  return (
    <div className={className}>
      <p
        className={`mb-2 text-xs font-semibold uppercase tracking-wider ${
          theme === "dark" ? "text-emerald-400/80" : "text-teal-700"
        }`}
      >
        Account type
      </p>
      <div
        className={`${
          isStack ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"
        } rounded-2xl border p-1.5 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 bg-emerald-50/50"
        }`}
      >
        {[
          { value: "Student", label: "Student", icon: GraduationCap },
          { value: "Faculty", label: "Faculty", icon: UserRound },
        ].map(({ value: roleValue, label, icon: Icon }) => {
          const active = value === roleValue;
          return (
            <button
              key={roleValue}
              type="button"
              onClick={() => onChange(roleValue)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isStack ? "justify-start" : "justify-center"
              } ${
                active
                  ? theme === "dark"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-white text-teal-800 shadow-md ring-1 ring-emerald-200/80"
                  : theme === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    : "text-gray-600 hover:bg-white/80 hover:text-teal-800"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
