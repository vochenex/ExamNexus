import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import { useTheme } from "../../layouts/ThemeContext";
import ProfileAvatar from "../ProfileAvatar";
import { ProgressNavLink } from "../ProgressLink";
import {
  getMobileNav,
  STUDENT_FLEX_SLOT_STORAGE_KEY,
} from "./mobileNav";
import { forceUnlockBodyScroll } from "../ui/ModalPortal";

function isPathActive(pathname, to, end) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function readStoredFlexibleTo(defaultTo, flexibleItems) {
  try {
    const stored = localStorage.getItem(STUDENT_FLEX_SLOT_STORAGE_KEY);
    if (stored && flexibleItems.some((item) => item.to === stored)) {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return defaultTo;
}

function TabButton({ item, active, theme, onClick, badge = false }) {
  const Icon = item.icon;
  return (
    <ProgressNavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className="en-tabbar-item"
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`relative en-tabbar-icon ${
          active
            ? theme === "dark"
              ? "en-tabbar-icon--active-dark"
              : "en-tabbar-icon--active-light"
            : ""
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
        {badge ? (
          <span
            className="absolute right-0 top-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white/90"
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span className={`en-tabbar-label ${active ? "en-tabbar-label--active" : ""}`}>
        {item.label}
      </span>
    </ProgressNavLink>
  );
}

export default function MobileTabBar({ role, user, displayName, onLogout, pendingBadges = {} }) {
  const { theme } = useTheme();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const nav = getMobileNav(role);
  const flexibleItems = useMemo(
    () => (Array.isArray(nav.flexible) ? nav.flexible : []),
    [nav.flexible]
  );
  const usesFlexibleSlot = flexibleItems.length > 0;

  const [flexibleTo, setFlexibleTo] = useState(() =>
    usesFlexibleSlot
      ? readStoredFlexibleTo(nav.defaultFlexibleTo, flexibleItems)
      : null
  );

  useEffect(() => {
    if (!usesFlexibleSlot) return;
    setFlexibleTo(readStoredFlexibleTo(nav.defaultFlexibleTo, flexibleItems));
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when role changes

  useEffect(() => {
    setSheetOpen(false);
    forceUnlockBodyScroll();
  }, [location.pathname]);

  // If the student opens a flexible destination, promote it into the bar slot.
  useEffect(() => {
    if (!usesFlexibleSlot) return;
    const match = flexibleItems.find((item) =>
      isPathActive(location.pathname, item.to, item.end)
    );
    if (match && match.to !== flexibleTo) {
      setFlexibleTo(match.to);
      try {
        localStorage.setItem(STUDENT_FLEX_SLOT_STORAGE_KEY, match.to);
      } catch {
        // ignore
      }
    }
  }, [location.pathname, usesFlexibleSlot, flexibleItems, flexibleTo]);

  const pinFlexibleItem = (to) => {
    if (!usesFlexibleSlot) return;
    if (!flexibleItems.some((item) => item.to === to)) return;
    setFlexibleTo(to);
    try {
      localStorage.setItem(STUDENT_FLEX_SLOT_STORAGE_KEY, to);
    } catch {
      // ignore storage errors
    }
  };

  const { primary, more } = useMemo(() => {
    if (!usesFlexibleSlot) {
      return {
        primary: nav.primary || [],
        more: nav.more || [],
      };
    }

    const activeFlex =
      flexibleItems.find((item) => item.to === flexibleTo) ||
      flexibleItems.find((item) => item.to === nav.defaultFlexibleTo) ||
      flexibleItems[0];

    return {
      primary: [...(nav.primary || []), activeFlex].filter(Boolean),
      more: flexibleItems.filter((item) => item.to !== activeFlex?.to),
    };
  }, [nav, usesFlexibleSlot, flexibleItems, flexibleTo]);

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
              badge={Boolean(pendingBadges[item.to])}
            />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => setSheetOpen((open) => !open)}
              className="en-tabbar-item relative"
              aria-expanded={sheetOpen}
              aria-label="More menu"
            >
              {Object.keys(pendingBadges).some((path) =>
                more.some((item) => item.to === path && pendingBadges[path])
              ) ? (
                <span
                  className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-red-500"
                  aria-hidden="true"
                />
              ) : null}
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
                  <ProgressNavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => {
                      if (usesFlexibleSlot) {
                        pinFlexibleItem(item.to);
                      }
                      setSheetOpen(false);
                    }}
                    className={`en-sheet-tile relative ${active ? "en-sheet-tile--active" : ""}`}
                  >
                    {pendingBadges[item.to] ? (
                      <span
                        className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon size={22} strokeWidth={2.1} />
                    <span>{item.label}</span>
                  </ProgressNavLink>
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
