import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ProfileAvatar from "../ProfileAvatar";
import { getMobileNav } from "./mobileNav";
import { forceUnlockBodyScroll } from "../ui/ModalPortal";

function isPathActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function TabButton({ item, active, theme, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className="en-tabbar-item"
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`en-tabbar-icon ${
          active
            ? theme === "dark"
              ? "en-tabbar-icon--active-dark"
              : "en-tabbar-icon--active-light"
            : ""
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={`en-tabbar-label ${active ? "en-tabbar-label--active" : ""}`}>
        {item.label}
      </span>
    </NavLink>
  );
}

export default function MobileTabBar({ role, user, displayName, onLogout }) {
  const { theme } = useTheme();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { primary, more } = getMobileNav(role);

  useEffect(() => {
    setSheetOpen(false);
    forceUnlockBodyScroll();
  }, [location.pathname]);

  const hasMore = more.length > 0;
  const moreActive = more.some((item) =>
    isPathActive(location.pathname, item.to, item.end)
  );

  return (
    <>
      <nav
        className={`en-tabbar ${theme === "dark" ? "en-tabbar--dark" : "en-tabbar--light"}`}
        aria-label="Primary"
      >
        <div className="en-tabbar-inner">
          {primary.map((item) => (
            <TabButton
              key={item.to}
              item={item}
              active={isPathActive(location.pathname, item.to, item.end)}
              theme={theme}
              onClick={() => setSheetOpen(false)}
            />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setSheetOpen((open) => !open)}
              className="en-tabbar-item"
              aria-expanded={sheetOpen}
              aria-label="More menu"
            >
              <span
                className={`en-tabbar-icon ${
                  moreActive || sheetOpen
                    ? theme === "dark"
                      ? "en-tabbar-icon--active-dark"
                      : "en-tabbar-icon--active-light"
                    : ""
                }`}
              >
                <MoreHorizontal size={18} strokeWidth={moreActive || sheetOpen ? 2.4 : 2} />
              </span>
              <span
                className={`en-tabbar-label ${
                  moreActive || sheetOpen ? "en-tabbar-label--active" : ""
                }`}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {sheetOpen && (
        <div className="en-sheet-root" role="dialog" aria-modal="true" aria-label="More menu">
          <div
            className="en-sheet-overlay"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className={`en-sheet ${theme === "dark" ? "en-sheet--dark" : "en-sheet--light"}`}>
            <div className="en-sheet-handle" aria-hidden="true" />

            <div className="en-sheet-header">
              <div className="flex items-center gap-3">
                <ProfileAvatar src={user?.avatar_url} alt={displayName} size="sm" />
                <div className="min-w-0">
                  <p className="en-sheet-name">{displayName}</p>
                  <p className="en-sheet-role">{user?.role || "User"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="en-sheet-close"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="en-sheet-grid">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isPathActive(location.pathname, item.to, item.end);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSheetOpen(false)}
                    className={`en-sheet-tile ${active ? "en-sheet-tile--active" : ""}`}
                  >
                    <Icon size={22} strokeWidth={2.1} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {onLogout && (
              <button type="button" onClick={onLogout} className="en-sheet-logout">
                <LogOut size={18} />
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
