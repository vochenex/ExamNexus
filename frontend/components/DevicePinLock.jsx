import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import ModalPortal from "./ui/ModalPortal";
import { DEVICE_PIN_LENGTH } from "../utils/savedAccounts";
import { motion } from "../utils/motion";
import { useTheme } from "../layouts/ThemeContext";
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

function PinKey({ label, disabled, pressed, onPress, isDark, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!disabled) onPress();
      }}
      className={`en-pin-key flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center justify-self-center rounded-full disabled:opacity-40 ${
        isDark ? "text-white" : "text-slate-900"
      } ${pressed ? "en-pin-key--pressed" : ""} ${
        isDark ? "en-pin-key--dark" : "en-pin-key--light"
      }`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

/**
 * iOS-style liquid-glass device PIN lock.
 * mode: "create" | "confirm" | "unlock"
 */
export default function DevicePinLock({
  open,
  mode = "unlock",
  title,
  subtitle,
  accountLabel = "",
  errorMessage = "",
  busy = false,
  onComplete,
  onCancel,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [digits, setDigits] = useState("");
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState("");
  const [pressedKey, setPressedKey] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setDigits("");
    setLocalError("");
    setShake(false);
    setPressedKey(null);
    return undefined;
  }, [open, mode]);

  useEffect(() => {
    if (!errorMessage) return;
    setLocalError(errorMessage);
    setShake(true);
    setDigits("");
    const timer = window.setTimeout(() => setShake(false), 450);
    return () => window.clearTimeout(timer);
  }, [errorMessage]);

  if (!open) return null;

  const heading =
    title ||
    (mode === "create"
      ? "Create device PIN"
      : mode === "confirm"
        ? "Confirm device PIN"
        : "Enter device PIN");

  const support =
    subtitle ||
    (mode === "create"
      ? "This PIN unlocks your saved account on this device."
      : mode === "confirm"
        ? "Enter the same PIN again to confirm."
        : accountLabel
          ? `Unlock ${accountLabel}`
          : "Verify it’s you to continue.");

  const flashKey = (key) => {
    setPressedKey(key);
    window.setTimeout(() => setPressedKey(null), 140);
  };

  const pushDigit = async (value) => {
    if (busy) return;
    if (value === "del") {
      flashKey("del");
      setDigits((prev) => prev.slice(0, -1));
      setLocalError("");
      return;
    }
    if (!/^\d$/.test(value)) return;
    if (digits.length >= DEVICE_PIN_LENGTH) return;

    flashKey(value);
    const next = `${digits}${value}`;
    setDigits(next);
    setLocalError("");

    if (next.length === DEVICE_PIN_LENGTH) {
      const result = await onComplete?.(next);
      if (result === false) {
        setShake(true);
        setDigits("");
        window.setTimeout(() => setShake(false), 450);
      }
    }
  };

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[10050] flex items-end justify-center sm:items-center p-4 ${motion.overlay}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="en-device-pin-title"
      >
        <button
          type="button"
          className={`absolute inset-0 backdrop-blur-xl ${
            isDark ? "bg-[#020a0c]/88" : "bg-slate-900/45"
          }`}
          aria-label="Close PIN"
          onClick={() => {
            if (!busy) onCancel?.();
          }}
        />

        <div
          className={`${motion.scaleIn} en-pin-panel relative z-10 w-full max-w-sm overflow-hidden rounded-[2rem] border p-6 ${
            isDark
              ? "border-emerald-500/25 en-pin-panel--dark"
              : "border-emerald-300/80 en-pin-panel--light shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
          }`}
        >
          <div
            className={`pointer-events-none absolute -left-12 -top-20 h-44 w-44 rounded-full blur-2xl ${
              isDark ? "bg-emerald-400/10" : "bg-emerald-300/25"
            }`}
          />
          <div
            className={`pointer-events-none absolute -bottom-24 -right-10 h-48 w-48 rounded-full blur-3xl ${
              isDark ? "bg-teal-500/10" : "bg-teal-200/35"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${
              isDark ? "via-emerald-300/35" : "via-emerald-500/35"
            }`}
          />

          <div
            className={`relative text-center ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            <p
              id="en-device-pin-title"
              className={`text-lg font-semibold tracking-tight ${
                isDark ? "text-emerald-50" : "text-slate-900"
              }`}
            >
              {heading}
            </p>
            <p
              className={`mt-1.5 text-sm ${
                isDark ? "text-emerald-100/70" : "text-slate-600"
              }`}
            >
              {support}
            </p>

            <div
              className={`mt-8 flex items-center justify-center gap-4 ${
                shake ? "en-pin-shake" : ""
              }`}
              aria-live="polite"
            >
              {Array.from({ length: DEVICE_PIN_LENGTH }).map((_, index) => {
                const filled = index < digits.length;
                const isLatest = filled && index === digits.length - 1;
                return (
                  <span
                    key={index}
                    className={`h-4 w-4 rounded-full border transition-all duration-200 ${
                      filled
                        ? `shadow-[0_0_14px_rgba(110,231,183,0.55)] ${
                            isDark
                              ? "border-emerald-200 bg-emerald-300"
                              : "border-emerald-600 bg-emerald-500"
                          } ${isLatest ? "en-pin-dot-pop scale-110" : "scale-100"}`
                        : isDark
                          ? "border-emerald-200/35 bg-emerald-950/40"
                          : "border-emerald-300 bg-emerald-50"
                    }`}
                  />
                );
              })}
            </div>

            {(localError || errorMessage) && (
              <p
                className={`mt-4 text-sm font-medium ${
                  isDark ? "text-rose-300" : "text-red-600"
                }`}
              >
                {localError || errorMessage}
              </p>
            )}

            <div className="mx-auto mt-8 grid max-w-[280px] grid-cols-3 gap-4">
              {KEYS.map((key, index) => {
                if (!key) {
                  return <span key={`spacer-${index}`} />;
                }

                if (key === "del") {
                  return (
                    <PinKey
                      key="del"
                      label="Delete"
                      isDark={isDark}
                      disabled={busy || digits.length === 0}
                      pressed={pressedKey === "del"}
                      onPress={() => pushDigit("del")}
                    >
                      <Delete size={22} strokeWidth={1.75} />
                    </PinKey>
                  );
                }

                return (
                  <PinKey
                    key={key}
                    label={key}
                    isDark={isDark}
                    disabled={busy}
                    pressed={pressedKey === key}
                    onPress={() => pushDigit(key)}
                  >
                    <span className="text-[1.65rem] font-light leading-none tracking-wide">
                      {key}
                    </span>
                  </PinKey>
                );
              })}
            </div>

            {onCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className={`mt-6 text-sm font-medium underline-offset-2 transition hover:underline disabled:opacity-50 ${
                  isDark
                    ? "text-emerald-100/75 hover:text-emerald-50"
                    : "text-teal-700 hover:text-teal-900"
                }`}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .en-pin-panel--dark {
          background: linear-gradient(
            165deg,
            rgba(8, 35, 32, 0.97) 0%,
            rgba(4, 18, 20, 0.98) 42%,
            rgba(2, 8, 10, 0.99) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(110, 231, 183, 0.18),
            inset 0 -1px 0 rgba(0, 0, 0, 0.45),
            0 28px 70px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(16, 185, 129, 0.08);
          backdrop-filter: blur(28px) saturate(140%);
          -webkit-backdrop-filter: blur(28px) saturate(140%);
        }
        .en-pin-panel--light {
          background: linear-gradient(
            165deg,
            rgba(236, 253, 245, 0.98) 0%,
            rgba(209, 250, 229, 0.96) 45%,
            rgba(240, 253, 250, 0.98) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(16, 185, 129, 0.12),
            0 24px 60px rgba(15, 23, 42, 0.18);
          backdrop-filter: blur(24px) saturate(130%);
          -webkit-backdrop-filter: blur(24px) saturate(130%);
        }
        .en-pin-key--dark {
          background: linear-gradient(
            160deg,
            rgba(16, 185, 129, 0.22) 0%,
            rgba(6, 78, 59, 0.28) 48%,
            rgba(2, 20, 18, 0.55) 100%
          );
          border: 1px solid rgba(110, 231, 183, 0.22);
          box-shadow:
            inset 0 1px 0 rgba(167, 243, 208, 0.2),
            inset 0 -1px 0 rgba(0, 0, 0, 0.35),
            0 10px 22px rgba(0, 0, 0, 0.28);
        }
        .en-pin-key--light {
          background: linear-gradient(
            160deg,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(209, 250, 229, 0.9) 55%,
            rgba(167, 243, 208, 0.75) 100%
          );
          border: 1px solid rgba(16, 185, 129, 0.35);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 -1px 0 rgba(16, 185, 129, 0.15),
            0 8px 18px rgba(15, 23, 42, 0.12);
        }
        .en-pin-key {
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          transform: scale(1);
          transition:
            transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1),
            background 140ms ease,
            box-shadow 140ms ease,
            border-color 140ms ease;
          touch-action: manipulation;
          user-select: none;
        }
        .en-pin-key--dark.en-pin-key--pressed {
          transform: scale(0.9);
          background: linear-gradient(
            160deg,
            rgba(52, 211, 153, 0.38) 0%,
            rgba(6, 95, 70, 0.42) 100%
          );
          border-color: rgba(167, 243, 208, 0.45);
          box-shadow:
            inset 0 2px 8px rgba(0, 0, 0, 0.35),
            0 4px 12px rgba(0, 0, 0, 0.22);
        }
        .en-pin-key--light.en-pin-key--pressed {
          transform: scale(0.9);
          background: linear-gradient(
            160deg,
            rgba(167, 243, 208, 0.95) 0%,
            rgba(52, 211, 153, 0.85) 100%
          );
          border-color: rgba(5, 150, 105, 0.55);
          box-shadow:
            inset 0 2px 6px rgba(15, 23, 42, 0.12),
            0 4px 10px rgba(15, 23, 42, 0.1);
        }
        @keyframes en-pin-dot-pop {
          0% { transform: scale(0.55); opacity: 0.5; }
          70% { transform: scale(1.18); }
          100% { transform: scale(1.1); opacity: 1; }
        }
        .en-pin-dot-pop {
          animation: en-pin-dot-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes en-pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .en-pin-shake {
          animation: en-pin-shake 0.42s ease-in-out;
        }
      `}</style>
    </ModalPortal>
  );
}
