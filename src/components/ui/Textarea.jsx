import { useTheme } from "../../layouts/ThemeContext";
import { textareaClass } from "../../utils/themeInputs";

export default function Textarea({ className = "", ...props }) {
  const { theme } = useTheme();
  return <textarea className={textareaClass(theme, className)} {...props} />;
}
