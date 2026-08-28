import { Check, GraduationCap, KeyRound, School } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Account & profile",
    description: "Choose Student or Faculty, then enter your name.",
    icon: GraduationCap,
  },
  {
    id: 2,
    title: "School & program",
    description: "School ID, department, and program details.",
    icon: School,
  },
  {
    id: 3,
    title: "Login credentials",
    description: "School email and password for sign-in.",
    icon: KeyRound,
  },
];

export default function SignupStepRail({ step, theme }) {
  const isDark = theme === "dark";

  return (
    <div className="en-signup-step-rail mt-8 w-full max-w-sm">
      <p
        className={`mb-4 text-xs font-semibold uppercase tracking-wider ${
          isDark ? "text-emerald-400/80" : "text-teal-700"
        }`}
      >
        Sign up in 3 steps
      </p>
      <ol className="space-y-3">
        {STEPS.map((item) => {
          const Icon = item.icon;
          const done = step > item.id;
          const active = step === item.id;

          return (
            <li
              key={item.id}
              className={`flex gap-3 rounded-2xl border px-3.5 py-3 transition ${
                active
                  ? isDark
                    ? "border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
                    : "border-teal-300/80 bg-white/80 shadow-sm"
                  : done
                    ? isDark
                      ? "border-emerald-500/20 bg-white/[0.03]"
                      : "border-emerald-200/70 bg-emerald-50/40"
                    : isDark
                      ? "border-white/8 bg-white/[0.02]"
                      : "border-emerald-100/80 bg-white/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? isDark
                      ? "bg-emerald-500 text-white"
                      : "bg-teal-600 text-white"
                    : done
                      ? isDark
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-emerald-100 text-teal-800"
                      : isDark
                        ? "bg-white/5 text-gray-500"
                        : "bg-emerald-50 text-gray-500"
                }`}
              >
                {done ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-semibold ${
                    active
                      ? isDark
                        ? "text-emerald-200"
                        : "text-teal-900"
                      : isDark
                        ? "text-gray-200"
                        : "text-gray-800"
                  }`}
                >
                  {item.title}
                </span>
                <span
                  className={`mt-0.5 block text-xs leading-snug ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {item.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
