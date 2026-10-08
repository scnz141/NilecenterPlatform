import type { SVGProps } from "react";

/**
 * Staff app glyphs. Drawn for this product: 20px grid, 1.5px stroke,
 * square caps, mitred joins. Only functional controls use glyphs.
 * Navigation and actions use words.
 */
type GlyphProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number | string;
};

function Glyph({
  size = "1em",
  children,
  ...props
}: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      focusable={false}
      className="ui-glyph"
      {...props}
    >
      {children}
    </svg>
  );
}

export const GlyphClose = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Glyph>
);

export const GlyphChevronDown = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M6 8l4 4 4-4" />
  </Glyph>
);

export const GlyphChevronUp = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M6 12l4-4 4 4" />
  </Glyph>
);

export const GlyphChevronLeft = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M12 6l-4 4 4 4" />
  </Glyph>
);

export const GlyphChevronRight = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M8 6l4 4-4 4" />
  </Glyph>
);

export const GlyphSearch = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M8.5 14a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM12.5 12.5L17 17" />
  </Glyph>
);

export const GlyphMenu = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M3 6h14M3 10h14M3 14h14" />
  </Glyph>
);

export const GlyphCheck = (props: GlyphProps) => (
  <Glyph {...props}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Glyph>
);

export const GlyphMore = (props: GlyphProps) => (
  <Glyph {...props} strokeWidth={2.25}>
    <path d="M4.5 10h.01M10 10h.01M15.5 10h.01" />
  </Glyph>
);
