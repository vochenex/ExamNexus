import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function usePageLoader(delay = 800) {
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    setLoading(true);

    const timer = setTimeout(() => {
      setLoading(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [location.pathname, delay]);

  return loading;
}