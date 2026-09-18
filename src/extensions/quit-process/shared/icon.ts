const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ff6b62"/><stop offset="1" stop-color="#d9322b"/>
</linearGradient></defs>
<rect width="64" height="64" rx="14" fill="url(#g)"/>
<path d="M32 14v18" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M21.4 23a16 16 0 1 0 21.2 0" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;

/** The "Quit Processes" command's icon: a white power glyph on red. Inlined as
 *  a `data:` URI because the launcher's CSP is `img-src 'self' data:`. */
export const QUIT_PROCESS_ICON = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
