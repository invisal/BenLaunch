/**
 * An action's `icon` is a plain string: an emoji, an image URL the CSP lets
 * through (`data:`), or a reference to a bundled asset (`brand:<id>`, see
 * `public/brand-icons/`). Everything that draws one goes through `iconSrc`,
 * so a new kind of icon only needs teaching to this file.
 */

const BRAND_PREFIX = "brand:";

/** The `icon` value that points at a bundled brand logo. */
export const brandIcon = (id: string): string => `${BRAND_PREFIX}${id}`;

/**
 * The `<img src>` for `icon`, or `undefined` when it's a glyph (emoji / text)
 * to render as text instead. Relative to the page like the rest of the
 * renderer's assets, so it resolves the same under the dev server and `file://`.
 */
export function iconSrc(icon: string | undefined): string | undefined {
  if (!icon) return undefined;
  if (icon.startsWith(BRAND_PREFIX)) {
    const id = encodeURIComponent(icon.slice(BRAND_PREFIX.length));
    return `${import.meta.env.BASE_URL}brand-icons/${id}.svg`;
  }
  return /^(https?:|data:|file:)/.test(icon) ? icon : undefined;
}
