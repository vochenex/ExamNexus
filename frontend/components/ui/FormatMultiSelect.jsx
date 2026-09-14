import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { selectChevronClass, selectClass } from "../../utils/themeInputs";

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 6;

/**
 * Multi-select dropdown styled like the shared Select control.
 */
export default function FormatMultiSelect({
  id,
  options = [],
  value = [],
  onChange,
  disabled = false,
  placeholder = "Select formats…",
  className = "",
}) {
  const { theme } = useTheme();
  const location = useLocation();
  const listId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const selected = Array.isArray(value) ? value : [];

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((item) => item.value === selected[0])?.label || selected[0]
        : `${selected.length} formats selected`;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove - MENU_GAP : spaceBelow - MENU_GAP;
    const maxHeight = Math.max(140, Math.min(MENU_MAX_HEIGHT, available));

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 9999,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return undefined;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition, selected.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const toggle = (optionValue) => {
    if (!onChange || disabled) return;
    const exists = selected.includes(optionValue);
    if (exists) {
      onChange(selected.filter((item) => item !== optionValue));
      return;
    }
    onChange([...selected, optionValue]);
  };

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-multiselectable="true"
            id={listId}
            aria-labelledby={id}
            style={menuStyle}
            className={`en-select-dropdown overflow-y-auto overscroll-contain rounded-xl border py-1 shadow-xl ${
              theme === "dark"
                ? "border-emerald-500/25 bg-[#0a1614]"
                : "border-emerald-200 bg-white"
            }`}
          >
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => {
                    if (!option.disabled) toggle(option.value);
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`${selectClass(theme, className)} en-select-trigger relative w-full text-left`}
      >
        <span
          className={`block truncate pr-1 ${
            selected.length === 0
              ? theme === "dark"
                ? "text-gray-500"
                : "text-gray-400"
              : ""
          }`}
        >
          {label}
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${
            open ? "rotate-180" : ""
          } ${selectChevronClass(theme)}`}
        />
      </button>
      {menu}
    </div>
  );
}
