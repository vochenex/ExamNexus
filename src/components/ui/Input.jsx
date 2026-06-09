import { useTheme } from "../../layouts/ThemeContext";
import { inputClass } from "../../utils/themeInputs";

export default function Input({ className = "", ...props }) {
  const { theme } = useTheme();
  return <input className={inputClass(theme, className)} {...props} />;
}
