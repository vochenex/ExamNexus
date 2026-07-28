import { Navigate } from "react-router-dom";
import { isNativeApp } from "../utils/platform";
import { getNativeEntryPath } from "../utils/nativeRoutes";

export default function WebOnlyHomeRoute({ children }) {
  if (isNativeApp()) {
    return <Navigate to={getNativeEntryPath()} replace />;
  }
  return children;
}
