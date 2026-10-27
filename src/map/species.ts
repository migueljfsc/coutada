/**
 * Silhouettes of the game and the dog, side on and facing left, on a 32-unit square: filled
 * shapes, with legs, antlers and beaks as round-capped strokes. One SVG string per subject, for
 * the map's badges and the sheet alike.
 */

import type { Species } from "../doc/catalogue";

const line = (d: string, w = 2.2) => `<path d="${d}" fill="none" stroke-width="${w}"/>`;
const legs = (w: number, ...xs: [number, number, number, number][]) => xs.map(([x1, y1, x2, y2]) => line(`M${x1} ${y1}L${x2} ${y2}`, w)).join("");

/** A deer's body, neck and head, and its legs; antlers go on top. */
const deer = (scale = 1) =>
  `<g transform="translate(${16 - 16 * scale} ${30 - 30 * scale}) scale(${scale})">` +
  `<ellipse cx="19" cy="16.5" rx="8.5" ry="4.6"/>` +
  `<path d="M12.5 14.5 L7.5 8.6 L10.2 7.4 L15 12.6 Z"/>` +
  `<path d="M10.4 7.2 L4.2 8.6 L4.4 10.2 L9.8 10.4 Z"/>` +
  `<path d="M9.6 7.4 L11.4 5.4 L11.2 7.8 Z"/>` +
  legs(1.9, [13.2, 19.5, 12.6, 28.5], [15.8, 20.2, 15.6, 28.5], [23, 20, 23.6, 28.5], [25.6, 19.2, 26.6, 28.5]) +
  `</g>`;

const SHAPES: Record<Species | "dog", string> = {
  // Birds
  partridge:
    `<ellipse cx="17.5" cy="17.5" rx="9.5" ry="7"/>` +
    `<circle cx="8.6" cy="10.8" r="3.6"/>` +
    `<path d="M7.6 12 L11 17 L14 13 Z"/>` +
    `<path d="M5.4 10.2 L2.6 11.4 L5.4 12.4 Z"/>` +
    `<path d="M25.5 15 L30 13 L28.8 18 Z"/>` +
    legs(1.6, [15, 24, 14.6, 28.5], [19.5, 24, 19.8, 28.5]),
  quail:
    `<ellipse cx="17.5" cy="18.5" rx="8.5" ry="6.5"/>` +
    `<circle cx="10" cy="13.4" r="3.4"/>` +
    `<path d="M7 12.8 L4.2 14 L7 14.8 Z"/>` +
    legs(1.5, [15.5, 24.5, 15, 28.5], [19.5, 24.5, 19.8, 28.5]),
  pheasant:
    `<ellipse cx="14" cy="17" rx="7.5" ry="5" transform="rotate(-12 14 17)"/>` +
    `<path d="M8 15.6 L5.2 7.8 L9.2 7 L12 14.4 Z"/>` +
    `<circle cx="7.2" cy="7.2" r="2.7"/>` +
    `<path d="M5 6.6 L2.6 7.6 L5 8.4 Z"/>` +
    `<path d="M19 14.5 L31 8.6 L31 10.8 L20.6 18.8 Z"/>` +
    legs(1.5, [12, 21.5, 11.4, 28], [15.6, 21.6, 16, 28]),
  pigeon:
    `<ellipse cx="16.5" cy="17.5" rx="8.8" ry="5.6" transform="rotate(-10 16.5 17.5)"/>` +
    `<circle cx="8.8" cy="11.6" r="3"/>` +
    `<path d="M7.6 12.6 L10.4 17.6 L13 14 Z"/>` +
    `<path d="M6 11 L3.4 12.2 L6 12.8 Z"/>` +
    `<path d="M23.5 15.6 L30.5 17.6 L30 20.4 L23 19.8 Z"/>` +
    legs(1.5, [15, 23, 14.6, 27], [18.5, 22.8, 18.8, 27]),
  turtle_dove:
    `<ellipse cx="15.5" cy="17" rx="7.6" ry="4.4" transform="rotate(-6 15.5 17)"/>` +
    `<circle cx="8.6" cy="12.6" r="2.5"/>` +
    `<path d="M7.6 13.4 L10 17.4 L12.4 14.6 Z"/>` +
    `<path d="M6.4 12.2 L4 13.2 L6.4 13.8 Z"/>` +
    `<path d="M21.5 15.4 L31.4 16.8 L31.4 19.6 L21.5 19 Z"/>` +
    legs(1.4, [14, 21, 13.6, 25.5], [17, 21, 17.4, 25.5]),
  thrush:
    `<ellipse cx="15.5" cy="17" rx="5.8" ry="8" transform="rotate(-38 15.5 17)"/>` +
    `<circle cx="9.4" cy="8.4" r="3.3"/>` +
    `<path d="M6.6 7.6 L3 8.6 L6.6 9.6 Z"/>` +
    `<path d="M18.5 21 L26 27.6 L23.4 29 L17 23.4 Z"/>` +
    legs(1.4, [13.6, 23, 12.6, 28.5], [16, 23.6, 16.4, 28.5]),
  woodcock:
    `<ellipse cx="19" cy="17.5" rx="8.6" ry="6.4"/>` +
    `<circle cx="10.8" cy="12.4" r="3.6"/>` +
    `<path d="M9.6 13.6 L12.6 18.6 L15 14.6 Z"/>` +
    line("M7.6 13.4 L1.2 16.6", 1.6) +
    `<path d="M26.5 15.4 L30 15.4 L28.6 18.6 Z"/>` +
    legs(1.5, [17.5, 23.5, 17.2, 27.5], [21, 23.6, 21.4, 27.5]),
  duck:
    `<path d="M4.8 18.2 Q6 24.4 15 24.4 L24.6 24.2 Q29.6 23.4 30.4 16.6 L25.6 18.2 Q20 15.4 12.8 16.8 Z"/>` +
    `<path d="M10 17.2 L7.2 11.6 L10.4 10.6 L13.2 16.4 Z"/>` +
    `<circle cx="8.6" cy="10.2" r="3.4"/>` +
    `<path d="M5.6 9.6 L1.4 11.2 L1.8 12.4 L5.8 12 Z"/>`,

  // Small game
  rabbit:
    `<path d="M12 21.4 Q11 13.6 18.6 13 Q27 12.6 27.4 20 Q27.6 25.4 21 25.4 L14 25.4 Q12 24.4 12 21.4 Z"/>` +
    `<ellipse cx="10.2" cy="15" rx="4.4" ry="3.6" transform="rotate(-18 10.2 15)"/>` +
    `<path d="M10.8 12.2 Q9.6 3.8 12.6 3.6 Q14.2 7.4 13.2 12.4 Z"/>` +
    `<path d="M12.8 12.4 Q14.6 4.6 17.4 5.4 Q17.4 9.2 14.8 13.4 Z"/>` +
    `<circle cx="27.4" cy="17.6" r="2.2"/>` +
    legs(1.9, [12.4, 19, 11.6, 25.4]) +
    `<ellipse cx="20.4" cy="25.6" rx="5" ry="1.5"/>`,
  hare:
    `<ellipse cx="18.4" cy="17.6" rx="8.6" ry="4.6" transform="rotate(-8 18.4 17.6)"/>` +
    `<ellipse cx="8.8" cy="13.6" rx="3.8" ry="2.9"/>` +
    `<path d="M9.6 11.4 Q9.8 2.4 13.2 2.6 Q13.6 7.4 11.8 11.8 Z"/>` +
    `<path d="M25 13.6 L27.6 12.6 L27.4 15.6 Z"/>` +
    legs(1.9, [23.4, 20, 26.6, 26.6], [26.6, 26.6, 29.6, 27]) +
    legs(1.7, [12.4, 19.6, 11, 27], [11, 27, 9.2, 27.2]),
  fox:
    `<ellipse cx="16" cy="17" rx="7.8" ry="3.8"/>` +
    `<path d="M10 14.6 L2.4 15.6 L3.2 16.8 L10.2 19 Z"/>` +
    `<path d="M7.6 14.6 L8 10 L10.6 13.8 Z"/>` +
    `<path d="M22.6 15.2 Q30 12.6 31.4 19.2 Q27.4 18.4 22.8 19 Z"/>` +
    legs(1.7, [11, 19.6, 10.6, 26.6], [13.6, 20.2, 13.4, 26.6], [19.6, 20.2, 20, 26.6], [22.4, 19.6, 23.2, 26.6]),
  mongoose:
    `<ellipse cx="14.4" cy="19.2" rx="9.4" ry="3.2"/>` +
    `<path d="M6.6 17.4 L1 19.8 L6.6 21.4 Z"/>` +
    `<circle cx="7.6" cy="17" r="1.4"/>` +
    `<path d="M22.4 17.4 Q29.4 15.2 31.6 22.6 Q28 19.8 22.6 21 Z"/>` +
    legs(1.6, [8.6, 21.6, 8, 24.8], [11, 21.8, 10.8, 24.8], [18.4, 21.8, 18.6, 24.8], [20.8, 21.4, 21.4, 24.8]),

  // Big game
  boar:
    `<path d="M4.4 15.6 L9 10.8 Q14 8 21 9.2 Q28.2 10.4 28.6 15.2 Q29 20.4 24 21.6 L10 21.6 Q6 21 4.4 18.8 Z"/>` +
    `<path d="M4.8 15.4 L1.4 17 L1.8 19.6 L5 19.4 Z"/>` +
    `<path d="M9.4 11.6 L10.6 7 L13 10.4 Z"/>` +
    line("M3.4 18.6 Q2.8 16.4 4 15.2", 1.1) +
    line("M28.4 12.8 Q30.6 13.6 30.2 16.6", 1.3) +
    legs(2.5, [9.4, 21, 9.2, 27], [13, 21.2, 12.8, 27], [21, 21.2, 21.2, 27], [24.6, 20.6, 25, 27]),
  red_deer:
    deer() +
    line("M8.4 6.4 L11.6 0.8", 1.5) +
    line("M9.4 4.6 L7.4 2.4", 1.3) +
    line("M10.6 2.6 L13.4 1.8", 1.3) +
    line("M7.4 6.6 L4.2 1.4", 1.5) +
    line("M6.2 4.6 L3.2 4", 1.3),
  fallow_deer:
    deer() +
    line("M8.4 6.4 L9.4 3.2", 1.5) +
    `<path d="M9 3.6 Q9.6 0.6 13.4 0.8 L12.8 2.4 L14.2 2.6 L12.4 4.4 Q10.6 4.4 9.8 5 Z"/>` +
    line("M7.4 6.6 L6.4 3.6", 1.5) +
    `<path d="M6.8 4 Q5.6 1.2 2.4 1.6 L3.4 3 L2.2 3.4 L4.4 4.8 Q5.8 4.6 6.4 5.2 Z"/>` +
    line("M27.2 14 L28.6 18.2", 1.6),
  roe_deer:
    deer(0.86) +
    line("M8.8 9 L9.2 4.6", 1.4) +
    line("M9 6.6 L10.4 5.8", 1.2) +
    line("M7.8 9.2 L7.2 5", 1.4),
  mouflon:
    `<ellipse cx="18.6" cy="16.6" rx="9" ry="5.4"/>` +
    `<path d="M12 13.6 L7.4 10 L5.8 13.4 L10.8 17.8 Z"/>` +
    `<path d="M9.4 10.2 Q6.4 9.6 4.8 11.8 L2.2 14.6 L3.4 16.2 L8.6 15.4 Z"/>` +
    line("M8.2 10.8 C 10.4 6.4, 15.2 8.2, 13.8 12 C 13 14, 10.4 13.6, 10.6 12", 2.2) +
    legs(2, [13.2, 20.6, 12.8, 28], [16, 21.4, 15.8, 28], [22.6, 21.4, 23, 28], [25.4, 20.4, 26.2, 28]) +
    line("M27.4 14 L28.8 17.4", 1.6),

  dog:
    `<ellipse cx="18" cy="15.6" rx="8" ry="4"/>` +
    `<path d="M11.6 14.2 L8.6 9.8 L11.4 8.6 L14 13 Z"/>` +
    `<path d="M11.2 8.4 Q8 7.8 6.4 9.6 L2.6 11 L3 12.8 L10.2 13.2 Z"/>` +
    `<path d="M10 8.6 Q13.2 8.2 13 13.2 L11.2 13.6 Z"/>` +
    line("M25.4 13.4 Q28.6 11.6 29.6 7.6", 1.8) +
    legs(2, [13, 18.6, 12.4, 27], [15.6, 19.2, 15.4, 27], [21.6, 19.2, 22, 27], [24.4, 18.4, 25.6, 27]),
};

/** The subject's silhouette in `colour`, as a whole SVG document `size` px square. */
export function speciesSvg(subject: Species | "dog", colour: string, size = 24): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" ` +
    `fill="${colour}" stroke="${colour}" stroke-linecap="round" stroke-linejoin="round">${SHAPES[subject]}</svg>`
  );
}
