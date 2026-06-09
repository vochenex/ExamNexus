import { ChevronDown } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import { selectChevronClass, selectClass } from "../../utils/themeInputs";

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

  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={selectClass(theme, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${selectChevronClass(theme)}`}
      />
    </div>
  );
}
