import { DayPicker } from "react-day-picker";
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

  return (
    <div
      className={`
        box-border min-w-0 max-w-full
        rounded-2xl
        p-4 sm:p-6

        ${
          theme === "dark"
            ? "bg-[#052629] border border-white/10"
            : "en-bg-elevated border border-emerald-200 shadow-md"
        }
      `}
    >
      <div className="mb-4 sm:mb-5">
        <h3
          className={`text-lg font-semibold ${
            theme === "dark" ? "text-emerald-400" : "text-teal-700"
          }`}
        >
          Assessment Availability
        </h3>

        <p
          className={`text-sm mt-1 ${
            theme === "dark" ? "text-gray-400" : "text-gray-700"
          }`}
        >
          Choose when students can access this assessment.
        </p>
      </div>

      <div className="en-assessment-calendar flex w-full min-w-0 justify-center overflow-hidden">
        <DayPicker
          mode="range"
          selected={dateRange}
          onSelect={setDateRange}
          showOutsideDays
          classNames={{
            months:
              theme === "dark"
                ? "flex w-full max-w-full justify-center text-white"
                : "flex w-full max-w-full justify-center text-gray-900",
            month: "w-full max-w-full space-y-3",
            caption: "mb-2 flex items-center justify-between gap-1 px-0.5",
            caption_label:
              theme === "dark"
                ? "text-sm font-semibold text-white sm:text-base"
                : "text-sm font-semibold text-gray-900 sm:text-base",
            nav_button: `
              h-8 w-8 shrink-0 rounded-lg
              ${
                theme === "dark"
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "en-bg-skeleton text-teal-700 hover:bg-emerald-200"
              }
              transition-all
            `,
            table: "w-full max-w-full border-collapse",
            head_row: "mb-1 flex w-full justify-between",
            head_cell:
              theme === "dark"
                ? "w-[12.5%] max-w-[2.25rem] flex-1 text-center text-[0.65rem] font-medium text-emerald-400 sm:text-xs"
                : "w-[12.5%] max-w-[2.25rem] flex-1 text-center text-[0.65rem] font-medium text-teal-700 sm:text-xs",
            row: "mt-0.5 flex w-full justify-between",
            cell: "relative flex flex-1 justify-center p-0 text-center",
            day: `
              mx-auto h-8 w-8 max-w-full rounded-lg text-sm
              hover:bg-emerald-500/20
              transition-all
              sm:h-9 sm:w-9
            `,
            day_today:
              theme === "dark"
                ? "border border-emerald-500"
                : "border border-teal-600",
            day_outside: "opacity-30",
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
            theme === "dark"
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
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available From
          </label>

          <div
            className={`
              flex min-w-0 items-center rounded-xl px-3
              ${
                theme === "dark"
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
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="shrink-0 text-emerald-400" />
          </div>
        </div>

        <div className="min-w-0">
          <label
            className={`mb-2 block text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available Until
          </label>

          <div
            className={`
              flex min-w-0 items-center rounded-xl px-3
              ${
                theme === "dark"
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
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="shrink-0 text-emerald-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
