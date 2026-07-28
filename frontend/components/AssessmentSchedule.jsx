import "../layouts/Calendar.css";
import { CalendarDays, Clock2 } from "lucide-react";
import { useTheme } from "../layouts/ThemeContext";
import AssessmentCalendar from "./AssessmentCalendar";

function formatRangeLabel(date) {
  if (!date) return "Not selected";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function rangeDayCount(from, to) {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export default function AssessmentSchedule({
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  dateRange,
  setDateRange,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const dayCount = rangeDayCount(dateRange?.from, dateRange?.to);

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

      <div className="flex w-full min-w-0 justify-center">
        <AssessmentCalendar
          selected={dateRange}
          onSelect={setDateRange}
          theme={theme}
        />
      </div>

      <div
        className={`
          mt-4 sm:mt-5
          p-3 sm:p-4
          rounded-xl
          text-sm

          ${
            isDark
              ? "bg-black/20 text-emerald-400 border border-white/5"
              : "bg-emerald-50 text-teal-700 border border-emerald-200"
          }
        `}
      >
        <div className="flex items-start gap-3">
          <CalendarDays size={18} className="mt-0.5 shrink-0 opacity-80" />
          <div className="min-w-0 space-y-1">
            <p>
              <span className="font-medium">From:</span>{" "}
              {formatRangeLabel(dateRange?.from)}
            </p>
            <p>
              <span className="font-medium">To:</span>{" "}
              {formatRangeLabel(dateRange?.to)}
            </p>
            {dayCount > 0 && (
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-teal-800/70"}`}>
                {dayCount} day{dayCount === 1 ? "" : "s"} selected
              </p>
            )}
          </div>
        </div>
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
