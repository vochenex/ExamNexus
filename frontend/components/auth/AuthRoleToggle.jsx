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
        className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${
          theme === "dark" ? "text-emerald-400/80" : "text-emerald-700"
        }`}
      >
        Account type
      </p>
      <div
        className={`${
          isStack ? "flex flex-col gap-1.5" : "grid grid-cols-2 gap-1.5"
        } rounded-xl border p-1 ${
          theme === "dark"
            ? "border-white/10 bg-white/[0.03]"
            : "border-emerald-200/80 bg-emerald-50/40"
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
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                isStack ? "justify-start" : "justify-center"
              } ${
                active
                  ? theme === "dark"
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/25"
                    : "bg-emerald-600 text-white shadow-sm"
                  : theme === "dark"
                    ? "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    : "text-gray-600 hover:bg-white/80 hover:text-emerald-800"
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
