import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeDay(a, b) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isBetweenDay(day, from, to) {
  const value = startOfDay(day).getTime();
  return value > startOfDay(from).getTime() && value < startOfDay(to).getTime();
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      outside: date.getMonth() !== month,
    };
  });
}

export default function AssessmentCalendar({ selected, onSelect, theme = "dark" }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initialMonth = selected?.from || selected?.to || today;
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  useEffect(() => {
    const anchor = selected?.from || selected?.to;
    if (!anchor) return;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
  }, [selected?.from, selected?.to]);

  const days = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const isDark = theme === "dark";
  const rangeFrom = selected?.from ? startOfDay(selected.from) : null;
  const rangeTo = selected?.to ? startOfDay(selected.to) : null;

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleDayClick = (day) => {
    const picked = startOfDay(day);

    if (!rangeFrom || (rangeFrom && rangeTo)) {
      onSelect?.({ from: picked, to: undefined });
      return;
    }

    if (isSameDay(picked, rangeFrom)) {
      onSelect?.({ from: picked, to: picked });
      return;
    }

    if (isBeforeDay(picked, rangeFrom)) {
      onSelect?.({ from: picked, to: rangeFrom });
      return;
    }

    onSelect?.({ from: rangeFrom, to: picked });
  };

  const navButtonClass = `
    inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all
    ${
      isDark
        ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        : "bg-emerald-50 text-teal-700 hover:bg-emerald-100"
    }
  `;

  return (
    <div className={`en-assessment-calendar ${isDark ? "en-assessment-calendar--dark" : "en-assessment-calendar--light"}`}>
      <div className="en-cal-header">
        <button
          type="button"
          className={navButtonClass}
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>

        <p className="en-cal-title">
          {MONTHS[viewMonth]} {viewYear}
        </p>

        <button
          type="button"
          className={navButtonClass}
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="en-cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label} className="en-cal-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="en-cal-grid" role="grid" aria-label="Assessment date range">
        {days.map(({ date, outside }) => {
          const isToday = isSameDay(date, today);
          const isStart = rangeFrom && isSameDay(date, rangeFrom);
          const isEnd = rangeTo && isSameDay(date, rangeTo);
          const inRange =
            rangeFrom &&
            rangeTo &&
            (isBetweenDay(date, rangeFrom, rangeTo) || isStart || isEnd);
          const isSingleDay = isStart && isEnd;

          let cellState = "";
          if (inRange) {
            if (isSingleDay) cellState = "is-single";
            else if (isStart) cellState = "is-start";
            else if (isEnd) cellState = "is-end";
            else cellState = "is-middle";
          }

          return (
            <div
              key={date.toISOString()}
              className={`en-cal-cell ${outside ? "is-outside" : ""} ${cellState}`.trim()}
              role="gridcell"
            >
              <button
                type="button"
                onClick={() => handleDayClick(date)}
                className={`en-cal-day ${isToday ? "is-today" : ""} ${
                  isStart || isEnd ? "is-selected" : ""
                }`.trim()}
                aria-label={date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                aria-pressed={Boolean(isStart || isEnd || (inRange && !outside))}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
