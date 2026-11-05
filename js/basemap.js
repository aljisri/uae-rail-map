// A quiet custom basemap on OpenFreeMap vector tiles (OpenMapTiles schema, no API key).
// Layer ids are identical in both themes so a theme switch only updates paint properties.
import { MAP_COLORS } from "./palette.js";

export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> ' +
  'Data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

const z = (...stops) => ["interpolate", ["exponential", 1.4], ["zoom"], ...stops];
const name = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];

export function basemapLayers(theme) {
  const c = MAP_COLORS[theme];
  return [
    { id: "bg", type: "background", paint: { "background-color": c.land } },
    {
      id: "landcover-sand", type: "fill", source: "ofm", "source-layer": "landcover",
      filter: ["==", ["get", "class"], "sand"], paint: { "fill-color": c.sand },
    },
    {
      id: "landuse-urban", type: "fill", source: "ofm", "source-layer": "landuse",
      filter: ["match", ["get", "class"], ["residential", "commercial", "industrial", "retail", "suburb", "neighbourhood"], true, false],
      paint: { "fill-color": c.urban, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 11, 1] },
    },
    {
      id: "park", type: "fill", source: "ofm", "source-layer": "park",
      paint: { "fill-color": c.park, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 11, 1] },
    },
    { id: "water", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": c.water } },
    {
      id: "aeroway", type: "fill", source: "ofm", "source-layer": "aeroway", minzoom: 9,
      filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": c.aeroway },
    },
    {
      id: "runway", type: "line", source: "ofm", "source-layer": "aeroway", minzoom: 9,
      filter: ["match", ["get", "class"], ["runway", "taxiway"], true, false],
      paint: { "line-color": c.aeroway, "line-width": z(9, 1, 14, 24) },
    },
    {
      id: "road-minor", type: "line", source: "ofm", "source-layer": "transportation", minzoom: 12,
      filter: ["match", ["get", "class"], ["minor", "service", "tertiary"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.minor, "line-width": z(12, 0.5, 16, 6) },
    },
    {
      id: "road-major", type: "line", source: "ofm", "source-layer": "transportation", minzoom: 8,
      filter: ["match", ["get", "class"], ["primary", "secondary"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.major, "line-width": z(8, 0.4, 12, 1.6, 16, 9) },
    },
    {
      id: "road-motorway", type: "line", source: "ofm", "source-layer": "transportation", minzoom: 5,
      filter: ["match", ["get", "class"], ["motorway", "trunk"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": c.motorway, "line-width": z(5, 0.4, 9, 1.2, 12, 2.6, 16, 12) },
    },
    {
      id: "boundary-state", type: "line", source: "ofm", "source-layer": "boundary", minzoom: 6,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": c.boundaryState, "line-width": z(6, 0.6, 12, 1.4), "line-dasharray": [3, 2] },
    },
    {
      id: "boundary-country", type: "line", source: "ofm", "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": c.boundary, "line-width": z(4, 0.8, 12, 2) },
    },
    {
      id: "water-name", type: "symbol", source: "ofm", "source-layer": "water_name", minzoom: 5,
      filter: ["match", ["get", "class"], ["sea", "ocean", "bay", "gulf", "strait"], true, false],
      layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 12, "text-letter-spacing": 0.15, "text-max-width": 8 },
      paint: { "text-color": c.waterLabel },
    },
    {
      id: "place-minor", type: "symbol", source: "ofm", "source-layer": "place", minzoom: 11,
      filter: ["match", ["get", "class"], ["suburb", "neighbourhood", "quarter"], true, false],
      layout: {
        "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-transform": "uppercase",
        "text-letter-spacing": 0.08, "text-max-width": 7, "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": c.label, "text-halo-color": c.halo, "text-halo-width": 1.2, "text-opacity": 0.7 },
    },
    // Place names are set as quiet small capitals so they read as areas, not stations.
    {
      id: "place-town", type: "symbol", source: "ofm", "source-layer": "place", minzoom: 8,
      filter: ["match", ["get", "class"], ["town", "village"], true, false],
      layout: {
        "text-field": name, "text-font": ["Noto Sans Regular"], "text-size": z(8, 9.5, 12, 11.5), "text-max-width": 8,
        "text-transform": "uppercase", "text-letter-spacing": 0.08,
      },
      paint: { "text-color": c.label, "text-halo-color": c.halo, "text-halo-width": 1.4, "text-opacity": 0.75 },
    },
    {
      id: "place-city", type: "symbol", source: "ofm", "source-layer": "place", minzoom: 4,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": name, "text-font": ["Noto Sans Bold"], "text-size": z(4, 10, 10, 13),
        "text-max-width": 8, "symbol-sort-key": ["get", "rank"], "text-transform": "uppercase", "text-letter-spacing": 0.12,
      },
      paint: { "text-color": c.label, "text-halo-color": c.halo, "text-halo-width": 1.6, "text-opacity": 0.8 },
    },
    {
      id: "place-country", type: "symbol", source: "ofm", "source-layer": "place", maxzoom: 8,
      filter: ["==", ["get", "class"], "country"],
      layout: { "text-field": name, "text-font": ["Noto Sans Bold"], "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": 0.2 },
      paint: { "text-color": c.label, "text-halo-color": c.halo, "text-halo-width": 1.4 },
    },
  ];
}

export function baseStyle(theme) {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: { ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: ATTRIBUTION } },
    layers: basemapLayers(theme),
  };
}

// Re-skin the basemap in place (keeps the rail layers and their sources).
export function applyBasemapTheme(map, theme) {
  for (const layer of basemapLayers(theme)) {
    if (!map.getLayer(layer.id)) continue;
    for (const [prop, value] of Object.entries(layer.paint || {})) map.setPaintProperty(layer.id, prop, value);
  }
  if (fallbackOn) paintFallback(map, theme);
}

// If the tile server cannot be reached, draw a coarse Natural Earth coastline instead
// (only then: under real tiles it would hide reclaimed islands such as Palm Jumeirah).
let fallbackOn = false;
export async function enableFallback(map, theme) {
  if (fallbackOn) return;
  fallbackOn = true;
  const data = await fetch("data/fallback.json").then((r) => r.json());
  map.addSource("fallback-land", { type: "geojson", data: data.land });
  map.addSource("fallback-borders", { type: "geojson", data: data.borders });
  const before = map.getLayer("landcover-sand") ? "landcover-sand" : undefined;
  map.addLayer({ id: "fallback-land", type: "fill", source: "fallback-land", paint: {} }, before);
  map.addLayer({ id: "fallback-borders", type: "line", source: "fallback-borders", paint: { "line-width": 1 } }, before);
  paintFallback(map, theme);
}

function paintFallback(map, theme) {
  const c = MAP_COLORS[theme];
  map.setPaintProperty("bg", "background-color", c.water);
  if (map.getLayer("fallback-land")) map.setPaintProperty("fallback-land", "fill-color", c.land);
  if (map.getLayer("fallback-borders")) map.setPaintProperty("fallback-borders", "line-color", c.boundary);
}
