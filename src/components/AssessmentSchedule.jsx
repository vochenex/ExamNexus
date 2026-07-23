import { DayPicker, getDefaultClassNames } from "react-day-picker";
import "react-day-picker/dist/style.css";
import "../layouts/Calendar.css";
import { Clock2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";

export default function AssessmentSchedule({
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  dateRange,
  setDateRange,
}) {
  const { theme } = useTheme();
  const defaultClassNames = getDefaultClassNames();
  const isDark = theme === "dark";

  const dayButtonClass = `
    mx-auto flex h-8 w-8 max-w-full items-center justify-center rounded-lg text-sm
    transition-all hover:bg-emerald-500/20 sm:h-9 sm:w-9
  `;

  const navButtonClass = `
    inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all
    ${
      isDark
        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
        : "en-bg-skeleton text-teal-700 hover:bg-emerald-200"
    }
  `;

  return (
    <div
      className={`
        box-border min-w-0 max-w-full
        rounded-2xl
        p-4 sm:p-6

        ${
          isDark
            ? "bg-[#052629] border border-white/10"
            : "en-bg-elevated border border-emerald-200 shadow-md"
        }
      `}
    >
      <div className="mb-4 sm:mb-5">
        <h3
          className={`text-lg font-semibold ${
            isDark ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Assessment Availability
        </h3>

        <p
          className={`text-sm mt-1 ${
            isDark ? "text-gray-400" : "text-gray-700"
          }`}
        >
          Choose when students can access this assessment.
        </p>
      </div>

      <div className="en-assessment-calendar flex w-full min-w-0 justify-center">
        <DayPicker
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          showOutsideDays
          classNames={{
            ...defaultClassNames,
            root: `${defaultClassNames.root} en-rdp-root w-full max-w-full`,
            months: `${defaultClassNames.months} w-full max-w-full`,
            month: `${defaultClassNames.month} w-full max-w-full space-y-3`,
            month_caption: `${defaultClassNames.month_caption} mb-2 flex items-center justify-between gap-2 px-0.5`,
            caption_label: `${
              isDark ? "text-sm font-semibold text-white sm:text-base" : "text-sm font-semibold text-gray-900 sm:text-base"
            }`,
            button_previous: navButtonClass,
            button_next: navButtonClass,
            month_grid: `${defaultClassNames.month_grid} en-rdp-month-grid w-full max-w-full`,
            weekdays: `${defaultClassNames.weekdays} en-rdp-weekdays`,
            weekday: `${
              isDark
                ? "en-rdp-weekday text-[0.65rem] font-medium text-emerald-400 sm:text-xs"
                : "en-rdp-weekday text-[0.65rem] font-medium text-teal-700 sm:text-xs"
            }`,
            weeks: `${defaultClassNames.weeks} w-full`,
            week: `${defaultClassNames.week} en-rdp-week`,
            day: `${defaultClassNames.day} en-rdp-day p-0 text-center`,
            day_button: dayButtonClass,
            today: isDark ? "border border-emerald-500" : "border border-teal-600",
            outside: "opacity-30",
          }}
        />
      </div>

      <div
        className={`
          mt-4 sm:mt-5
          p-3 sm:p-4
          rounded-xl
          text-sm space-y-1

          ${
            isDark
              ? "bg-black/20 text-emerald-400"
              : "bg-emerald-50 text-teal-700 border border-emerald-200"
          }
        `}
      >
        <p>From: {dateRange?.from?.toLocaleDateString() || "Not selected"}</p>
        <p>To: {dateRange?.to?.toLocaleDateString() || "Not selected"}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            className={`mb-2 block text-sm font-medium ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available From
          </label>

          <div
            className={`
              flex min-w-0 items-center rounded-xl px-3
              ${
                isDark
                  ? "bg-black/20 border border-white/10"
                  : "en-bg-elevated border border-emerald-200"
              }
            `}
          >
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`min-w-0 flex-1 bg-transparent py-3 outline-none ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="shrink-0 text-emerald-400" />
          </div>
        </div>

        <div className="min-w-0">
          <label
            className={`mb-2 block text-sm font-medium ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available Until
          </label>

          <div
            className={`
              flex min-w-0 items-center rounded-xl px-3
              ${
                isDark
                  ? "bg-black/20 border border-white/10"
                  : "en-bg-elevated border border-emerald-200"
              }
            `}
          >
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`min-w-0 flex-1 bg-transparent py-3 outline-none ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="shrink-0 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
