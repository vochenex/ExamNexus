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
      <p className="en-signup-label mb-2 text-xs font-semibold uppercase tracking-wider">
        Account type
      </p>
      <div
        className={`${
          isStack ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"
        } en-signup-role-toggle rounded-2xl border p-1.5`}
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
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                  : "text-emerald-200/70 hover:bg-emerald-500/10 hover:text-emerald-100"
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
