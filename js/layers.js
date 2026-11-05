// Rail layers on top of the basemap.
// Status is encoded by line style as well as colour: solid = in service,
// moving dashes = under construction, dots = planned.
import { MAP_COLORS, LINE_COLORS } from "./palette.js";

const EMPTY = { type: "FeatureCollection", features: [] };
const zoomed = (stops) => ["interpolate", ["linear"], ["zoom"], ...stops.flat()];

// width per line group at each zoom stop: [zoom, urban, intercity, freight]
const WIDTHS = [[5, 0.9, 1.7, 1.1], [8, 1.5, 2.4, 1.5], [10, 2.4, 3, 1.7], [12, 3.6, 3.8, 2], [14, 5.2, 5, 2.4], [16, 7.5, 6.5, 3]];
const width = (scale = 1, add = 0) =>
  zoomed(WIDTHS.map(([zm, u, i, f]) => [zm, ["match", ["get", "group"], "urban", u * scale + add, "freight", f * scale + add, i * scale + add]]));

const STATIC_DASH = [2, 1.4];
const DOTS = [0.01, 1.9];

export const INTERACTIVE = ["rail-open", "rail-building", "rail-planned", "rail-freight", "rail-freight-building"];
export const STATION_LAYERS = ["stations-urban", "stations-intercity"];

export class RailLayers {
  constructor(map, theme) {
    this.map = map;
    this.theme = theme;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dashTimer = null;
    this.hoverLine = null;
    this.exploring = false;
  }

  add() {
    const map = this.map;
    for (const id of ["rail", "stations", "trains", "explore-edges", "explore-stations", "route"]) {
      map.addSource(id, { type: "geojson", data: EMPTY, ...(id === "stations" ? { promoteId: "id" } : {}) });
    }
    const c = MAP_COLORS[this.theme];
    const notFreight = ["!=", ["get", "group"], "freight"];
    const isState = (s) => ["==", ["get", "state"], s];
    const round = { "line-cap": "round", "line-join": "round" };

    map.addLayer({ id: "rail-freight-planned", type: "line", source: "rail", filter: ["all", ["==", ["get", "group"], "freight"], isState("planned")],
      layout: round, paint: { "line-color": ["get", "color"], "line-width": width(), "line-dasharray": DOTS, "line-opacity": 0.7 } });
    map.addLayer({ id: "rail-freight-building", type: "line", source: "rail", filter: ["all", ["==", ["get", "group"], "freight"], isState("construction")],
      paint: { "line-color": ["get", "color"], "line-width": width(), "line-dasharray": STATIC_DASH } });
    map.addLayer({ id: "rail-freight", type: "line", source: "rail", filter: ["all", ["==", ["get", "group"], "freight"], isState("operational")],
      layout: round, paint: { "line-color": ["get", "color"], "line-width": width() } });

    map.addLayer({ id: "rail-glow", type: "line", source: "rail", filter: ["all", notFreight, isState("operational")],
      layout: round, paint: { "line-color": ["get", "color"], "line-width": width(3.2), "line-blur": width(2.4), "line-opacity": c.glow } });
    map.addLayer({ id: "rail-casing", type: "line", source: "rail", filter: notFreight,
      layout: round, paint: { "line-color": c.land, "line-width": width(1, 2.6), "line-opacity": 0.9 } });
    map.addLayer({ id: "rail-planned", type: "line", source: "rail", filter: ["all", notFreight, isState("planned")],
      layout: round, paint: { "line-color": ["get", "color"], "line-width": width(1.15), "line-dasharray": DOTS } });
    map.addLayer({ id: "rail-building", type: "line", source: "rail", filter: ["all", notFreight, isState("construction")],
      paint: { "line-color": ["get", "color"], "line-width": width(), "line-dasharray": STATIC_DASH } });
    map.addLayer({ id: "rail-open", type: "line", source: "rail", filter: ["all", notFreight, isState("operational")],
      layout: round, paint: { "line-color": ["get", "color"], "line-width": width() } });

    // line names ride along the lines: identity never rests on colour alone
    map.addLayer({ id: "line-labels", type: "symbol", source: "rail", minzoom: 10.5, filter: notFreight,
      layout: {
        "symbol-placement": "line", "symbol-spacing": 420, "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"],
        "text-size": 10.5, "text-letter-spacing": 0.04, "text-max-angle": 28, "text-offset": [0, -1.05], "text-padding": 6,
      },
      paint: { "text-color": c.labelStrong, "text-halo-color": c.halo, "text-halo-width": 1.6, "text-opacity": 0.9 } });

    // travel-time explorer
    map.addLayer({ id: "explore-edges", type: "line", source: "explore-edges", layout: { ...round, visibility: "none" },
      paint: { "line-color": ["get", "color"], "line-width": width(1.35) } });
    map.addLayer({ id: "route-casing", type: "line", source: "route", layout: round,
      paint: { "line-color": c.land, "line-width": width(1, 7) } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: round,
      paint: { "line-color": c.ink, "line-width": width(1, 3) } });

    // trains: ink beads ringed in the line colour, so they stand out on their own line
    const trainStops = [[5, 1.6], [9, 2.4], [12, 3.4], [15, 5.2]];
    map.addLayer({ id: "trains-glow", type: "circle", source: "trains",
      paint: { "circle-color": ["get", "color"], "circle-radius": zoomed(trainStops.map(([zm, r]) => [zm, r * 3])), "circle-blur": 1, "circle-opacity": c.glow * 0.9 } });
    map.addLayer({ id: "trains", type: "circle", source: "trains",
      paint: {
        "circle-color": c.ink, "circle-radius": zoomed(trainStops),
        "circle-stroke-color": ["get", "color"], "circle-stroke-width": zoomed([[5, 1.2], [12, 2], [15, 2.6]]),
      } });

    // stations (zoom must stay the top-level input, so the size switch sits inside each stop)
    const is = (prop) => ["==", ["get", prop], true];
    const radius = (prop) => zoomed([[4, 2.6, 1.5], [8, 3.4, 2.2], [11, 4.6, 3.4], [13, 6, 4.6], [16, 8.5, 6.5]]
      .map(([zm, big, small]) => [zm, ["case", is(prop), big, small]]));
    const stationPaint = () => ({
      "circle-radius": radius("interchange"),
      "circle-color": c.station,
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": zoomed([[5, 1.5], [12, 2.2], [16, 3]]),
      "circle-opacity": ["match", ["get", "state"], "planned", 0.85, 1],
      "circle-stroke-opacity": ["match", ["get", "state"], "planned", 0.8, 1],
    });
    const urbanOnly = ["==", ["get", "intercity"], false];
    const intercityOnly = ["==", ["get", "intercity"], true];
    map.addLayer({ id: "stations-urban", type: "circle", source: "stations", minzoom: 9.5, filter: urbanOnly, paint: stationPaint() });
    map.addLayer({ id: "stations-intercity", type: "circle", source: "stations", filter: intercityOnly, paint: stationPaint() });
    map.addLayer({ id: "explore-stations", type: "circle", source: "explore-stations", layout: { visibility: "none" },
      paint: {
        "circle-radius": radius("origin"),
        "circle-color": ["get", "color"], "circle-stroke-color": c.station, "circle-stroke-width": 1.6,
      } });

    const labelLayout = (minzoom) => ({
      "text-field": ["get", "label"],
      "text-font": ["case", is("interchange"), ["literal", ["Noto Sans Bold"]], ["literal", ["Noto Sans Regular"]]],
      "text-size": zoomed([[5, 11], [10, 11.5], [13, 12.5], [16, 14]]),
      "text-variable-anchor": ["left", "right", "top", "bottom", "top-left", "bottom-left"],
      "text-radial-offset": 0.85, "text-justify": "auto", "text-padding": 2, "text-max-width": 9,
      "symbol-sort-key": ["get", "rank"],
    });
    const labelPaint = () => ({
      "text-color": ["match", ["get", "state"], "operational", c.labelStrong, c.label],
      "text-halo-color": c.halo, "text-halo-width": 1.6,
    });
    map.addLayer({ id: "labels-urban", type: "symbol", source: "stations", minzoom: 11.3, filter: urbanOnly,
      layout: labelLayout(), paint: labelPaint() });
    map.addLayer({ id: "labels-intercity", type: "symbol", source: "stations", minzoom: 5.4, filter: intercityOnly,
      layout: labelLayout(), paint: labelPaint() });
    map.addLayer({ id: "labels-explore", type: "symbol", source: "explore-stations", minzoom: 7,
      layout: { ...labelLayout(), "text-field": ["get", "text"], visibility: "none" }, paint: labelPaint() });

    this.startDashes();
  }

  setNetwork(rail, stations) {
    this.map.getSource("rail").setData(rail);
    this.map.getSource("stations").setData(stations);
  }

  setTheme(theme) {
    this.theme = theme;
    const c = MAP_COLORS[theme];
    const m = this.map;
    m.setPaintProperty("rail-glow", "line-opacity", this.exploring ? 0 : c.glow);
    m.setPaintProperty("rail-casing", "line-color", c.land);
    m.setPaintProperty("trains-glow", "circle-opacity", c.glow * 0.9);
    m.setPaintProperty("trains", "circle-color", c.ink);
    m.setPaintProperty("route-casing", "line-color", c.land);
    m.setPaintProperty("route-line", "line-color", c.ink);
    for (const id of ["stations-urban", "stations-intercity"]) m.setPaintProperty(id, "circle-color", c.station);
    m.setPaintProperty("explore-stations", "circle-stroke-color", c.station);
    for (const id of ["labels-urban", "labels-intercity", "labels-explore"]) {
      m.setPaintProperty(id, "text-color", ["match", ["get", "state"], "operational", c.labelStrong, c.label]);
      m.setPaintProperty(id, "text-halo-color", c.halo);
    }
    m.setPaintProperty("line-labels", "text-color", c.labelStrong);
    m.setPaintProperty("line-labels", "text-halo-color", c.halo);
    this.applyEmphasis();
  }

  // Dim everything but one line (hover / selection).
  highlight(lineId) {
    this.hoverLine = lineId;
    this.applyEmphasis();
  }

  applyEmphasis() {
    const m = this.map;
    const base = this.exploring ? 0.22 : 1;
    const op = this.hoverLine && !this.exploring
      ? ["case", ["==", ["get", "line"], this.hoverLine], 1, 0.18]
      : base;
    for (const id of ["rail-open", "rail-building", "rail-planned", "rail-freight", "rail-freight-building", "rail-freight-planned"]) {
      m.setPaintProperty(id, "line-opacity", op);
    }
    const glow = this.exploring ? 0 : MAP_COLORS[this.theme].glow;
    m.setPaintProperty("rail-glow", "line-opacity", this.hoverLine
      ? ["case", ["==", ["get", "line"], this.hoverLine], glow, 0] : glow);
    m.setPaintProperty("line-labels", "text-opacity", this.hoverLine
      ? ["case", ["==", ["get", "line"], this.hoverLine], 1, 0.15] : this.exploring ? 0 : 0.9);
  }

  setExploring(on) {
    this.exploring = on;
    const vis = (id, v) => this.map.setLayoutProperty(id, "visibility", v ? "visible" : "none");
    for (const id of ["explore-edges", "explore-stations", "labels-explore"]) vis(id, on);
    for (const id of ["stations-urban", "stations-intercity", "labels-urban", "labels-intercity", "trains", "trains-glow"]) vis(id, !on);
    this.applyEmphasis();
  }

  setExplore(edges, stations) {
    this.map.getSource("explore-edges").setData(edges || EMPTY);
    this.map.getSource("explore-stations").setData(stations || EMPTY);
  }

  setRoute(fc) {
    this.map.getSource("route").setData(fc || EMPTY);
  }

  setTrainsVisible(on) {
    for (const id of ["trains", "trains-glow"]) this.map.setLayoutProperty(id, "visibility", on && !this.exploring ? "visible" : "none");
  }

  // "Marching" dashes on lines under construction.
  startDashes() {
    if (this.reducedMotion) return;
    const D = 2, G = 1.4, P = D + G, N = 18;
    const seq = [];
    for (let k = 0; k < N; k++) {
      const s = P - (k / N) * P;
      seq.push(s < D ? [D - s, G, s] : [0, P - s, D, s - D]);
    }
    let i = 0;
    this.dashTimer = setInterval(() => {
      if (document.hidden) return;
      i = (i + 1) % N;
      this.map.setPaintProperty("rail-building", "line-dasharray", seq[i]);
      this.map.setPaintProperty("rail-freight-building", "line-dasharray", seq[i]);
    }, 70);
  }
}

export function lineColor(theme, lineId) {
  return LINE_COLORS[theme][lineId];
}
