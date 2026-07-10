import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { selectChevronClass, selectClass } from "../../utils/themeInputs";
import ModalPortal from "./ModalPortal";
import { motion } from "../../utils/motion";

function optionLabelFromChildren(children) {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(optionLabelFromChildren).join("");
  }
  if (typeof children === "object" && children.props) {
    return optionLabelFromChildren(children.props.children);
  }
  return "";
}

function readOptions(children) {
  const options = [];

  const walk = (nodes) => {
    if (nodes == null || typeof nodes === "boolean") return;
    if (Array.isArray(nodes)) {
      nodes.forEach(walk);
      return;
    }
    if (typeof nodes !== "object" || !nodes.props) return;

    if (nodes.type === "option" || nodes.type === "optgroup") {
      if (nodes.type === "optgroup") {
        walk(nodes.props.children);
        return;
      }
      options.push({
        value: String(nodes.props.value ?? ""),
        label: optionLabelFromChildren(nodes.props.children) || String(nodes.props.value ?? ""),
        disabled: Boolean(nodes.props.disabled),
      });
      return;
    }

    walk(nodes.props.children);
  };

  walk(children);
  return options;
}

/**
 * Themed select that opens a custom dark/light sheet instead of the
 * system-white Android/iOS picker.
 */
export default function Select({
  id,
  name,
  value,
  onChange,
  disabled,
  className = "",
  children,
  ...props
}) {
  const { theme } = useTheme();
  const location = useLocation();
  const listId = useId();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const options = useMemo(() => readOptions(children), [children]);
  const selected = options.find((option) => option.value === String(value ?? ""));
  const label = selected?.label || "Select…";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const emitChange = (nextValue) => {
    if (!onChange) return;
    onChange({
      target: { value: nextValue, name: name || "", id: id || "" },
      currentTarget: { value: nextValue, name: name || "", id: id || "" },
    });
  };

  const pick = (nextValue) => {
    emitChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={`${selectClass(theme, className)} en-select-trigger relative w-full text-left`}
        {...props}
      >
        <span className="block truncate pr-1">{label}</span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${selectChevronClass(theme)}`}
        />
      </button>
      {open && (
        <ModalPortal>
          <div className={`fixed inset-0 z-[130] flex items-end justify-center sm:items-center p-3 sm:p-4 ${motion.overlay}`}>
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Close options"
              onClick={() => setOpen(false)}
            />
            <div
              role="listbox"
              id={listId}
              aria-labelledby={id}
              className={`${motion.scaleIn} en-select-sheet relative z-10 flex max-h-[min(70vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl ${
                theme === "dark"
                  ? "border-emerald-500/25 bg-[#0a1614]"
                  : "border-emerald-200/90 bg-white"
              }`}
            >
              <div
                className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
                  theme === "dark" ? "border-white/10" : "border-emerald-100"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    theme === "dark" ? "text-emerald-300" : "text-teal-800"
                  }`}
                >
                  Choose an option
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`rounded-lg p-1.5 ${
                    theme === "dark"
                      ? "text-gray-400 hover:bg-white/10 hover:text-white"
                      : "text-gray-500 hover:bg-emerald-50 hover:text-teal-800"
                  }`}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="en-select-sheet-list en-scroll-region flex-1 overflow-y-auto p-2">
                {options.map((option) => {
                  const active = option.value === String(value ?? "");
                  return (
                    <button
                      key={`${option.value}-${option.label}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      disabled={option.disabled}
                      onClick={() => pick(option.value)}
                      className={`mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition ${
                        active
                          ? theme === "dark"
                            ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                            : "bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-900 ring-1 ring-teal-300/70"
                          : theme === "dark"
                            ? "text-gray-100 hover:bg-white/8"
                            : "text-gray-800 hover:bg-emerald-50/80"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {active && (
                        <Check
                          size={18}
                          className={theme === "dark" ? "text-emerald-300" : "text-teal-700"}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
