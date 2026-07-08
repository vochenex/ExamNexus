function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export const DEFAULT_SITE_META = {
  title: "ExamNexus — Intelligent Online Assessment Platform",
  description:
    "ExamNexus helps students, faculty, and administrators create, take, and analyze secure online exams with AI-assisted question generation, integrity monitoring, and class analytics.",
  siteName: "ExamNexus",
  locale: "en_PH",
  themeColor: "#0d9488",
};

export function applyPageMeta({
  title = DEFAULT_SITE_META.title,
  description = DEFAULT_SITE_META.description,
  canonical,
  ogImage,
  noIndex = false,
} = {}) {
  document.title = title;

  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', {
    name: "robots",
    content: noIndex ? "noindex, nofollow" : "index, follow",
  });

  upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', {
    property: "og:description",
    content: description,
  });
  upsertMeta('meta[property="og:site_name"]', {
    property: "og:site_name",
    content: DEFAULT_SITE_META.siteName,
  });
  upsertMeta('meta[property="og:locale"]', {
    property: "og:locale",
    content: DEFAULT_SITE_META.locale,
  });

  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });

  upsertMeta('meta[name="theme-color"]', {
    name: "theme-color",
    content: DEFAULT_SITE_META.themeColor,
  });

  const resolvedCanonical = canonical || `${window.location.origin}${window.location.pathname}`;
  upsertLink("canonical", resolvedCanonical);
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: resolvedCanonical });

  if (ogImage) {
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: ogImage });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: ogImage });
  }
}
