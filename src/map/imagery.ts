/**
 * The imagery sources (D18). `tileUrl` is the ONE place a source's URL is built: the map and the
 * offline prefetch (D19) both call it, so a prefetched tile is the one the map asks for.
 */

import type { ImageryId } from "../doc/catalogue";

export type Imagery = {
  id: ImageryId;
  /** MapLibre tile template. */
  url: string;
  tileSize: 256 | 512;
  /** The deepest tile zoom the source is asked for; MapLibre overzooms past it. */
  maxzoom: number;
  attribution: string;
};

const dgtWms = (base: string, layer: string) =>
  `${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:3857` +
  `&BBOX={bbox-epsg-3857}&WIDTH=512&HEIGHT=512&FORMAT=image/jpeg`;

export const IMAGERY: Readonly<Partial<Record<ImageryId, Imagery>>> = {
  ortosat2023: {
    id: "ortosat2023",
    url: dgtWms("https://ortos.dgterritorio.gov.pt/wms/ortosat2023", "ortoSat2023-CorVerdadeira"),
    tileSize: 512,
    maxzoom: 17,
    attribution: "© DGT — OrtoSat 2023",
  },
  ortos2021: {
    id: "ortos2021",
    url: dgtWms("https://cartografia.dgterritorio.gov.pt/wms/ortos2021", "Ortos2021-RGB"),
    tileSize: 512,
    maxzoom: 17,
    attribution: "© DGT — Ortofotos 2021",
  },
};

/** The sources this build can show, in the order the picker lists them. */
export const AVAILABLE_IMAGERY: readonly Imagery[] = Object.values(IMAGERY).filter(
  (i): i is Imagery => i !== undefined,
);

/** The hosts tiles come from, for the CSP. */
export const IMAGERY_ORIGINS = [...new Set(AVAILABLE_IMAGERY.map((i) => new URL(i.url.split("?")[0]).origin))];

export const imageryOf = (id: ImageryId | undefined): Imagery =>
  (id && IMAGERY[id]) || (IMAGERY.ortosat2023 as Imagery);
