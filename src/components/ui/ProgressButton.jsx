import { Loader2 } from "lucide-react";

/**
 * Button that shows a spinner and blocks repeat clicks while `loading` is true.
 */
export default function ProgressButton({
  loading = false,
  loadingLabel = "Please wait…",
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={className}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin shrink-0" size={16} aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
