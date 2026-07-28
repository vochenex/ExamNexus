/** Shared motion class names — keep animations consistent app-wide */
export const motion = {
  page: "en-page-enter",
  pageRoute: "en-page-route",
  fadeIn: "en-fade-in",
  fadeInUp: "en-fade-in-up",
  fadeInDown: "en-fade-in-down",
  scaleIn: "en-scale-in",
  popIn: "en-pop-in",
  slideInLeft: "en-slide-in-left",
  slideInRight: "en-slide-in-right",
  staggerGrid: "en-stagger-grid",
  staggerList: "en-stagger-list",
  interactiveCard: "en-interactive-card",
  navItem: "en-nav-item",
  dropdown: "en-dropdown-enter",
  overlay: "en-overlay-enter",
};

export function withMotion(baseClass, motionClass) {
  return `${baseClass} ${motionClass}`.trim();
}
