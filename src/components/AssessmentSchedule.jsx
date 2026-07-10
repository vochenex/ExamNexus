
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
        rounded-2xl
        p-6

        ${
          theme === "dark"
            ? "bg-[#052629] border border-white/10"
            : "en-bg-elevated border border-emerald-200 shadow-md"
        }
      `}
    >
      <div className="mb-5">
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

      <div className="flex justify-center overflow-x-auto pb-2">
        <div className="min-w-[320px]">
          <DayPicker
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            showOutsideDays
            classNames={{
              months:
                theme === "dark"
                  ? "flex justify-center text-white"
                  : "flex justify-center text-gray-900",
              month: "space-y-4 w-full",
              caption: "flex justify-between items-center px-2 mb-2",
              caption_label:
                theme === "dark"
                  ? "text-white font-semibold"
                  : "text-gray-900 font-semibold",
              nav_button: `
                h-9 w-9 rounded-xl
                ${
                  theme === "dark"
                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "en-bg-skeleton text-teal-700 hover:bg-emerald-200"
                }
                transition-all
              `,
              table: "w-full border-collapse",
              head_row: "flex justify-between mb-2",
              head_cell:
                theme === "dark"
                  ? "text-emerald-400 font-medium w-10 text-center text-xs"
                  : "text-teal-700 font-medium w-10 text-center text-xs",
              row: "flex justify-between w-full mt-1",
              cell: "relative p-0 text-center",
              day: `
                h-10 w-10 rounded-xl
                hover:bg-emerald-500/20
                transition-all
              `,
              day_today:
                theme === "dark"
                  ? "border border-emerald-500"
                  : "border border-teal-600",
              day_outside: "opacity-30",
            }}
          />
        </div>
      </div>

      <div
        className={`
          mt-5
          p-4
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div>
          <label
            className={`block mb-2 text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available From
          </label>

          <div
            className={`
              flex items-center rounded-xl px-3
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
              className={`flex-1 bg-transparent py-3 outline-none ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="text-emerald-400 shrink-0" />
          </div>
        </div>

        <div>
          <label
            className={`block mb-2 text-sm font-medium ${
              theme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Available Until
          </label>

          <div
            className={`
              flex items-center rounded-xl px-3
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
              className={`flex-1 bg-transparent py-3 outline-none ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            />
            <Clock2 size={18} className="text-emerald-400 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
