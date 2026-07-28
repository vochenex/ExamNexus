import { useEffect } from "react";
import { applyPageMeta } from "../utils/pageMeta";

/**
 * Apply document title / SEO meta tags for the current page. Wraps
 * applyPageMeta so pages can declaratively set their metadata.
 */
export default function usePageMeta(options = {}) {
  const { title, description, canonical, ogImage, noIndex } = options;

  useEffect(() => {
    applyPageMeta({ title, description, canonical, ogImage, noIndex });
  }, [title, description, canonical, ogImage, noIndex]);
}
