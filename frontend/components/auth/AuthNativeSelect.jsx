import { ChevronDown } from "lucide-react";
import { selectChevronClass, selectClass } from "../../utils/themeInputs";

/**
 * Native browser select for auth forms — opens a system dropdown instead of a centered modal.
 */
export default function AuthNativeSelect({
  id,
  name,
  value,
  onChange,
  disabled = false,
  theme,
  className = "",
  children,
}) {
  return (
    <div className="relative w-full min-w-0">
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`en-auth-native-select ${selectClass(theme, `examnexus-auth-input px-4 py-3 ${className}`)}`}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${selectChevronClass(theme)}`}
      />
    </div>
  );
}
