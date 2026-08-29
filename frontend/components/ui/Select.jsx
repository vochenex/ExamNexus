import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { selectChevronClass, selectClass } from "../../utils/themeInputs";

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
 * Themed inline dropdown (visible in light/dark) — no full-screen popup modal.
 */
export default function Select({
  id,
  name,
  value,
  onChange,
  disabled,
  invalid = false,
  className = "",
  children,
  ...props
}) {
  const { theme } = useTheme();
  const location = useLocation();
  const listId = useId();
  const rootRef = useRef(null);
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
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
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
    <div ref={rootRef} className="relative w-full min-w-0">
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
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-invalid={invalid || undefined}
        className={`${selectClass(
          theme,
          invalid
            ? `!border-red-500 !ring-2 !ring-red-400 focus:!border-red-500 focus:!ring-red-400 ${className}`
            : className
        )} en-select-trigger relative w-full text-left`}
        {...props}
      >
        <span className="block truncate pr-1">{label}</span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${
            open ? "rotate-180" : ""
          } ${selectChevronClass(theme)}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          id={listId}
          aria-labelledby={id}
          className={`en-select-dropdown absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[80] max-h-60 overflow-y-auto rounded-xl border py-1 shadow-xl ${
            theme === "dark"
              ? "border-emerald-500/25 bg-[#0a1614]"
              : "border-emerald-200 bg-white"
          }`}
        >
          {options.map((option) => {
            const isSelected = option.value === String(value ?? "");
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) pick(option.value);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                  option.disabled
                    ? "cursor-not-allowed opacity-40"
                    : isSelected
                      ? theme === "dark"
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-emerald-50 text-teal-800"
                      : theme === "dark"
                        ? "text-gray-200 hover:bg-white/10"
                        : "text-gray-800 hover:bg-emerald-50"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? <Check size={16} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
