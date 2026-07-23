import { Loader2 } from "lucide-react";

/**
 * Button that shows a spinner and blocks repeat clicks while `loading` is true.
 */
export default function ProgressButton({
  loading = false,
  loadingLabel = "Please wait…",
  iconOnly = false,
  children,
  className = "",
  disabled,
  type = "button",
  "aria-label": ariaLabel,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={iconOnly && loading ? loadingLabel : ariaLabel}
      className={className}
      {...rest}
    >
      {loading ? (
        iconOnly ? (
          <Loader2 className="animate-spin shrink-0" size={16} aria-hidden="true" />
        ) : (
          <>
            <Loader2 className="animate-spin shrink-0" size={16} aria-hidden="true" />
            <span>{loadingLabel}</span>
          </>
        )
      ) : (
        children
      )}
    </button>
  );
}
