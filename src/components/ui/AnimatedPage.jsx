import { useLocation } from "react-router-dom";
import { motion } from "../../utils/motion";

export default function AnimatedPage({ children, className = "" }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className={`${motion.page} ${className}`.trim()}>
      {children}
    </div>
  );
}
