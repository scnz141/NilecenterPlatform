import "@/styles/brand.css";
import type { CSSProperties } from "react";

/**
 * Nile Center's eight-petal rosette, redrawn as vectors from the official
 * logo (nilecenter.edu.eg) so it stays sharp from favicon to hero size.
 * Petals run clockwise from the top in the brand colours.
 */
const PETALS: Array<[string, string]> = [
  ["#406687", "50.00,29.10 58.90,20.20 58.90,4.10 50.00,0.00 41.10,4.10 41.10,20.20"],
  ["#71adab", "64.78,35.22 77.37,35.22 88.75,23.84 85.36,14.64 76.16,11.25 64.78,22.63"],
  ["#80b4d7", "70.90,50.00 79.80,58.90 95.90,58.90 100.00,50.00 95.90,41.10 79.80,41.10"],
  ["#c35d44", "64.78,64.78 64.78,77.37 76.16,88.75 85.36,85.36 88.75,76.16 77.37,64.78"],
  ["#41714c", "50.00,70.90 41.10,79.80 41.10,95.90 50.00,100.00 58.90,95.90 58.90,79.80"],
  ["#79689d", "35.22,64.78 22.63,64.78 11.25,76.16 14.64,85.36 23.84,88.75 35.22,77.37"],
  ["#75c1cc", "29.10,50.00 20.20,41.10 4.10,41.10 0.00,50.00 4.10,58.90 20.20,58.90"],
  ["#c35d44", "35.22,35.22 35.22,22.63 23.84,11.25 14.64,14.64 11.25,23.84 22.63,35.22"],
];
const WEDGES = [
  "41.30,28.40 45.70,32.80 41.30,35.10",
  "58.70,28.40 54.30,32.80 58.70,35.10",
  "71.60,41.30 67.20,45.70 64.90,41.30",
  "71.60,58.70 67.20,54.30 64.90,58.70",
  "58.70,71.60 54.30,67.20 58.70,64.90",
  "41.30,71.60 45.70,67.20 41.30,64.90",
  "28.40,58.70 32.80,54.30 35.10,58.70",
  "28.40,41.30 32.80,45.70 35.10,41.30",
];
const CENTER = "58.80,53.65 53.65,58.80 46.35,58.80 41.20,53.65 41.20,46.35 46.35,41.20 53.65,41.20 58.80,46.35";

export const BRAND = { navy: "#1d4a6c", orange: "#f68b43" } as const;

export function NileRosette({
  size = 32,
  bloom = false,
  className,
  title,
}: {
  size?: number | string;
  /** Petals open one by one on first paint (skipped under reduced motion). */
  bloom?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={["nile-rosette", className].filter(Boolean).join(" ")}
      data-bloom={bloom || undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {PETALS.map(([fill, points], index) => (
        <polygon
          key={points}
          className="nile-rosette-petal"
          fill={fill}
          points={points}
          style={{ "--i": index } as CSSProperties}
        />
      ))}
      {WEDGES.map(points => (
        <polygon key={points} className="nile-rosette-wedge" fill={BRAND.orange} points={points} />
      ))}
      <polygon className="nile-rosette-core" fill={BRAND.navy} points={CENTER} />
    </svg>
  );
}

/** Rosette plus the traced NILE CENTER wordmark, as on the official logo. */
export function NileLogo({ height = 36, className }: { height?: number; className?: string }) {
  return (
    <span className={["nile-logo", className].filter(Boolean).join(" ")}>
      <NileRosette size={height} />
      <img src="/brand/nile-wordmark.svg" alt="Nile Center" style={{ blockSize: height, inlineSize: "auto" }} />
    </span>
  );
}
