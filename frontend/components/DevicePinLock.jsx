import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import ModalPortal from "./ui/ModalPortal";
import { DEVICE_PIN_LENGTH } from "../utils/savedAccounts";
import { motion } from "../utils/motion";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

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
  const [digits, setDigits] = useState("");
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setDigits("");
    setLocalError("");
    setShake(false);
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

  const pushDigit = async (value) => {
    if (busy) return;
    if (value === "del") {
      setDigits((prev) => prev.slice(0, -1));
      setLocalError("");
      return;
    }
    if (!/^\d$/.test(value)) return;
    if (digits.length >= DEVICE_PIN_LENGTH) return;

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
          className="absolute inset-0 bg-[#05080c]/72 backdrop-blur-2xl"
          aria-label="Close PIN"
          onClick={() => {
            if (!busy) onCancel?.();
          }}
        />

        <div
          className={`${motion.scaleIn} relative z-10 w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/25 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]`}
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0.04) 100%)",
            backdropFilter: "blur(36px) saturate(180%)",
            WebkitBackdropFilter: "blur(36px) saturate(180%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div
            className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full opacity-70"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-20 -right-8 h-44 w-44 rounded-full opacity-40"
            style={{
              background:
                "radial-gradient(circle, rgba(110,231,183,0.35) 0%, rgba(255,255,255,0) 70%)",
            }}
          />

          <div className="relative text-center text-white">
            <p
              id="en-device-pin-title"
              className="text-lg font-semibold tracking-tight drop-shadow-sm"
            >
              {heading}
            </p>
            <p className="mt-1.5 text-sm text-white/75">{support}</p>

            <div
              className={`mt-8 flex items-center justify-center gap-3 ${
                shake ? "en-pin-shake" : ""
              }`}
              aria-live="polite"
            >
              {Array.from({ length: DEVICE_PIN_LENGTH }).map((_, index) => {
                const filled = index < digits.length;
                return (
                  <span
                    key={index}
                    className={`h-3.5 w-3.5 rounded-full border transition-all duration-150 ${
                      filled
                        ? "scale-110 border-white bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]"
                        : "border-white/45 bg-white/10"
                    }`}
                  />
                );
              })}
            </div>

            {(localError || errorMessage) && (
              <p className="mt-4 text-sm font-medium text-rose-200">
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
                    <button
                      key="del"
                      type="button"
                      disabled={busy || digits.length === 0}
                      onClick={() => pushDigit("del")}
                      className="en-pin-key flex h-[4.25rem] w-[4.25rem] items-center justify-center justify-self-center rounded-full text-white transition active:scale-95 disabled:opacity-40"
                      aria-label="Delete"
                    >
                      <Delete size={22} strokeWidth={1.75} />
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => pushDigit(key)}
                    className="en-pin-key flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center justify-self-center rounded-full text-white transition active:scale-95 disabled:opacity-50"
                  >
                    <span className="text-[1.65rem] font-light leading-none tracking-wide">
                      {key}
                    </span>
                  </button>
                );
              })}
            </div>

            {onCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="mt-6 text-sm font-medium text-white/80 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .en-pin-key {
          background: linear-gradient(
            160deg,
            rgba(255, 255, 255, 0.34) 0%,
            rgba(255, 255, 255, 0.12) 48%,
            rgba(255, 255, 255, 0.08) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.55),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08),
            0 10px 24px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
        }
        .en-pin-key:active {
          background: linear-gradient(
            160deg,
            rgba(255, 255, 255, 0.48) 0%,
            rgba(255, 255, 255, 0.18) 100%
          );
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
