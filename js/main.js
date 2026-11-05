// UAE Rail Map: wires the map, timeline, panels and modes together.
import { Network } from "./network.js";
import { baseStyle, applyBasemapTheme, enableFallback } from "./basemap.js";
import { RailLayers, INTERACTIVE, STATION_LAYERS } from "./layers.js";
import { Trains } from "./trains.js";
import { Timeline } from "./timeline.js";
import { UI, h, STATE_TEXT, lineWhen } from "./ui.js";
import { Explorer } from "./explorer.js";
import { Insights } from "./charts.js";
import { LINE_COLORS } from "./palette.js";

const UAE_BOUNDS = [[51.55, 22.9], [56.7, 25.95]];
const THEME_KEY = "uae-rail-map:theme";

// ------------------------------------------------------------------ theme
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const systemTheme = () => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
let explicitTheme = store.get(THEME_KEY);
let theme = explicitTheme || systemTheme();
if (explicitTheme) document.documentElement.dataset.theme = explicitTheme;

// --------------------------------------------------------------- url state
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { year: +p.get("year") || null, mode: p.get("view"), station: p.get("station"), line: p.get("line") };
}

// keep fitted views clear of the floating panels
function padding(withPanel = false) {
  const w = innerWidth;
  const tl = w <= 720 ? 132 : 104;
  const legend = document.body.dataset.mode === "map" || !document.body.dataset.mode;
  if (w <= 720) return { top: 120, bottom: tl + 70 + (withPanel ? Math.min(innerHeight * 0.3, 260) : 0), left: 24, right: 24 };
  const left = legend ? 380 : 40;
  const right = withPanel ? 410 : 60;
  if (w <= 980) return { top: 90, bottom: tl + 80, left, right };
  return { top: 70, bottom: tl + 40, left, right };
}

async function main() {
  const [data, insightsData] = await Promise.all([
    fetch("data/network.json").then((r) => r.json()),
    fetch("data/insights.json").then((r) => r.json()),
  ]);
  const net = new Network(data);
  const initial = readHash();
  let year = initial.year && initial.year >= 2006 && initial.year <= 2032 ? initial.year : net.asOfYear;
  let date = net.dateFor(year);
  let mode = "map";
  document.body.dataset.mode = mode;
  let selected = null; // { type: "line" | "station", id }
  let trainsOn = !matchMedia("(prefers-reduced-motion: reduce)").matches;

  const map = new maplibregl.Map({
    container: "map",
    style: baseStyle(theme),
    bounds: UAE_BOUNDS,
    fitBoundsOptions: { padding: padding() },
    maxBounds: [[48.5, 20.5], [59.5, 28.5]],
    minZoom: 4.5,
    maxZoom: 16.5,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 90 }), "bottom-left");

  const layers = new RailLayers(map, theme);
  const trains = new Trains(map, net);

  const ui = new UI({
    net,
    onSelectLine: (id) => selectLine(id),
    onSelectStation: (id, opts = {}) => (mode === "explore" ? explorer.setOrigin(id) : selectStation(id, opts)),
    onExploreFrom: (id) => setMode("explore", id),
    onHoverLine: (id) => layers.highlight(id || (selected && selected.type === "line" ? selected.id : null)),
  });
  ui.theme = theme;

  const explorer = new Explorer({
    net, layers, ui,
    getDate: () => date,
    getTheme: () => theme,
    onClose: () => setMode("map"),
    fit: (coords) => {
      if (!coords.length) return;
      const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(b, { padding: padding(true), maxZoom: 12.5, duration: 900 });
    },
  });

  const insights = new Insights({
    net, data: insightsData, ui,
    getYear: () => year,
    getTheme: () => theme,
    onClose: () => setMode("map"),
    onYear: (y) => timeline.set(y, true),
  });

  const timeline = new Timeline({
    min: 2006, max: 2032, today: net.asOfYear,
    onChange: (y) => {
      year = y;
      refresh();
    },
  });

  // ---------------------------------------------------------- rendering
  function refresh() {
    date = net.dateFor(year);
    if (map.getSource("rail")) {
      layers.setNetwork(net.segmentFeatures(date, theme), net.stationFeatures(date, theme));
      trains.setDate(date);
    }
    timeline.setStats(net.stats(date));
    ui.renderLegend(date, theme);
    if (mode === "explore") explorer.update();
    else if (mode === "map" && selected) reopenSelection();
    if (mode === "insights") insights.render();
    writeHash();
  }

  function reopenSelection() {
    if (!selected) return;
    if (selected.type === "line") ui.showLine(selected.id, date, theme, clearSelection);
    else ui.showStation(selected.id, date, theme, clearSelection);
  }

  function selectLine(id) {
    if (mode !== "map") setMode("map");
    selected = { type: "line", id };
    layers.highlight(id);
    ui.showLine(id, date, theme, clearSelection);
    ui.renderLegend(date, theme);
    writeHash();
  }

  function selectStation(id, { fly = false } = {}) {
    if (mode !== "map") setMode("map");
    selected = { type: "station", id };
    layers.highlight(null);
    ui.selectedLine = null;
    ui.showStation(id, date, theme, clearSelection);
    ui.renderLegend(date, theme);
    if (fly) {
      const st = net.station[id];
      const urban = st.lines.some((l) => net.line[l.id].urban);
      map.flyTo({ center: st.coord, zoom: Math.max(map.getZoom(), urban ? 13 : 9.5), padding: padding(true), essential: true });
    }
    writeHash();
  }

  function clearSelection() {
    selected = null;
    layers.highlight(null);
    ui.close();
    ui.renderLegend(date, theme);
    writeHash();
  }

  function setMode(next, origin) {
    if (next === mode && !origin) return;
    if (mode === "explore" && next !== "explore") explorer.exit();
    if (mode === "insights" && next !== "insights") insights.hide();
    mode = next;
    document.body.dataset.mode = mode;
    for (const tab of document.querySelectorAll(".modes [role=tab]")) tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
    ui.hideTooltip();
    if (mode === "explore") {
      ui.close();
      layers.highlight(null);
      const from = origin || (selected && selected.type === "station" ? selected.id : explorer.origin);
      selected = null;
      explorer.enter(from);
      layers.setTrainsVisible(false);
    } else if (mode === "insights") {
      ui.close();
      insights.show();
      layers.setTrainsVisible(trainsOn);
    } else {
      layers.setTrainsVisible(trainsOn);
      if (selected) reopenSelection(); else ui.close();
    }
    ui.renderLegend(date, theme);
    writeHash();
  }

  function writeHash() {
    const p = new URLSearchParams();
    if (year !== net.asOfYear) p.set("year", year);
    if (mode !== "map") p.set("view", mode);
    if (mode === "explore" && explorer.origin) p.set("station", explorer.origin);
    else if (selected) p.set(selected.type, selected.id);
    const hash = p.toString();
    history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
  }

  // -------------------------------------------------------------- map events
  const hitBox = (pt, r = 6) => [[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]];

  map.on("mousemove", (e) => {
    if (!map.getSource("rail")) return;
    if (mode === "explore") {
      const f = map.queryRenderedFeatures(hitBox(e.point, 8), { layers: ["explore-stations"] })[0];
      map.getCanvas().style.cursor = f ? "pointer" : "";
      if (f) {
        const content = explorer.tooltipFor(f.properties.id);
        if (content) ui.showTooltip(e.point, content);
      } else {
        ui.hideTooltip();
        layers.setRoute(null);
      }
      return;
    }
    const st = map.queryRenderedFeatures(hitBox(e.point, 7), { layers: STATION_LAYERS })[0];
    if (st) {
      map.getCanvas().style.cursor = "pointer";
      const s = net.station[st.properties.id];
      const lines = net.stationLinesAt(s, date);
      ui.showTooltip(e.point, [
        h("strong", {}, s.name),
        ...lines.map((l) => h("div", { class: "tt-row" }, h("span", { class: "key", style: `border-color:${LINE_COLORS[theme][l.id]}` }),
          `${net.line[l.id].name}${l.state === "operational" ? "" : `, ${STATE_TEXT[l.state].toLowerCase()}`}`)),
        s.approx ? h("div", {}, "Approximate location") : null,
      ]);
      return;
    }
    const ln = map.queryRenderedFeatures(hitBox(e.point, 5), { layers: INTERACTIVE })[0];
    if (ln) {
      map.getCanvas().style.cursor = "pointer";
      const line = net.line[ln.properties.line];
      const state = ln.properties.state;
      layers.highlight(line.id);
      ui.showTooltip(e.point, [
        h("strong", {}, line.name),
        h("div", { class: "tt-row" }, h("span", { class: "key", style: `border-color:${LINE_COLORS[theme][line.id]}` }),
          `${STATE_TEXT[state]} · ${lineWhen(line, state)}`),
        ln.properties.indicative ? h("div", {}, "Indicative route") : null,
      ]);
      return;
    }
    map.getCanvas().style.cursor = "";
    ui.hideTooltip();
    layers.highlight(selected && selected.type === "line" ? selected.id : null);
  });

  map.on("mouseout", () => {
    ui.hideTooltip();
    if (mode === "explore") layers.setRoute(null);
  });

  map.on("click", (e) => {
    if (!map.getSource("rail")) return;
    if (mode === "explore") {
      const f = map.queryRenderedFeatures(hitBox(e.point, 9), { layers: ["explore-stations", ...STATION_LAYERS] })[0];
      const any = f || map.queryRenderedFeatures(hitBox(e.point, 9)).find((x) => x.layer.id === "explore-stations");
      if (any) explorer.setOrigin(any.properties.id);
      else {
        // pick the nearest open station in a wider box (stations are hidden in explore mode)
        const near = nearestStation(e.lngLat, 12);
        if (near) explorer.setOrigin(near);
      }
      return;
    }
    const st = map.queryRenderedFeatures(hitBox(e.point, 8), { layers: STATION_LAYERS })[0];
    if (st) return selectStation(st.properties.id);
    const ln = map.queryRenderedFeatures(hitBox(e.point, 6), { layers: INTERACTIVE })[0];
    if (ln) return selectLine(ln.properties.line);
    if (mode === "map") clearSelection();
  });

  function nearestStation(lngLat, px) {
    const p = map.project(lngLat);
    let best = null, bd = px * px;
    for (const s of net.stations) {
      if (net.stationState(s, date) !== "operational") continue;
      const q = map.project(s.coord);
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bd) { bd = d; best = s.id; }
    }
    return best;
  }

  // ------------------------------------------------------------- controls
  for (const tab of document.querySelectorAll(".modes [role=tab]")) {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tabs = [...document.querySelectorAll(".modes [role=tab]")];
      const i = (tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[i].focus();
      setMode(tabs[i].dataset.mode);
    });
  }

  const trainsBtn = document.getElementById("btn-trains");
  const syncTrains = () => {
    trainsBtn.setAttribute("aria-pressed", String(trainsOn));
    if (trainsOn) trains.start(); else trains.stop();
    if (map.getSource("trains")) layers.setTrainsVisible(trainsOn && mode !== "explore");
  };
  trainsBtn.addEventListener("click", () => { trainsOn = !trainsOn; syncTrains(); });

  const applyTheme = (next) => {
    theme = next;
    ui.theme = next;
    applyBasemapTheme(map, theme);
    layers.setTheme(theme);
    trains.setTheme(theme);
    refresh();
    if (mode === "explore") explorer.update();
  };
  document.getElementById("btn-theme").addEventListener("click", () => {
    explicitTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = explicitTheme;
    store.set(THEME_KEY, explicitTheme);
    applyTheme(explicitTheme);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!explicitTheme) applyTheme(systemTheme());
  });

  const PLACES = {
    uae: UAE_BOUNDS,
    dubai: [[55.07, 24.95], [55.45, 25.29]],
    abudhabi: [[54.3, 24.32], [54.72, 24.56]],
  };
  for (const btn of document.querySelectorAll("[data-place]")) {
    btn.addEventListener("click", () => map.fitBounds(PLACES[btn.dataset.place], { padding: padding(), duration: 1200 }));
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.target.matches("input")) return;
    if (mode !== "map") setMode("map");
    else if (selected) clearSelection();
  });

  // ------------------------------------------------------------------ go
  // style.load (not load): the rail layers must not wait for basemap tiles
  // restore a shared view: #year=2030&view=explore&station=dm-business-bay
  function applyState(s) {
    const y = s.year && s.year >= 2006 && s.year <= 2032 ? s.year : net.asOfYear;
    if (y !== year) timeline.set(y);
    if (s.mode === "insights") setMode("insights");
    else if (s.mode === "explore") setMode("explore", net.station[s.station] ? s.station : undefined);
    else {
      if (mode !== "map") setMode("map");
      if (net.station[s.station]) selectStation(s.station);
      else if (net.line[s.line]) selectLine(s.line);
    }
  }

  map.once("style.load", () => {
    layers.add();
    layers.setTheme(theme);
    timeline.set(year);
    syncTrains();
    applyState(initial);
    document.getElementById("loading").hidden = true;
    // a link pasted into an open tab only changes the hash
    addEventListener("hashchange", () => applyState(readHash()));
  });
  map.on("error", (e) => {
    const err = e && e.error;
    const msg = `${(err && (err.message || err.url)) || ""}`;
    if (e.sourceId === "ofm" || /openfreemap/i.test(msg)) {
      enableFallback(map, theme).catch(() => {});
      return;
    }
    console.warn("map:", msg || e);
  });
  // handy from the browser console: uaeRail.map, uaeRail.net
  window.uaeRail = { map, net, setYear: (y) => timeline.set(y, true), setMode, selectStation, selectLine };
  // render the panels even before tiles arrive
  timeline.set(year);
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById("loading");
  el.hidden = false;
  el.textContent = location.protocol === "file:"
    ? "Open this page through a web server (for example: python3 -m http.server), not as a file."
    : "The map data could not be loaded. Please reload the page.";
});

