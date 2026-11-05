// Travel-time explorer: how far can you get by rail from one station, in the selected year?
import { TIME_RAMP, TIME_LABELS, bucketOf, LINE_COLORS } from "./palette.js";
import { formatOpening } from "./network.js";
import { h } from "./ui.js";

const fmtMin = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}`);

export class Explorer {
  constructor({ net, layers, ui, getDate, getTheme, onClose, fit }) {
    Object.assign(this, { net, layers, ui, getDate, getTheme, onClose, fit });
    this.active = false;
    this.origin = null;
    this.result = null;
  }

  enter(originId = this.origin) {
    this.active = true;
    this.layers.setExploring(true);
    this.setOrigin(originId);
  }

  // frame everything reachable from the origin
  fitResult() {
    if (!this.result || !this.fit) return;
    this.fit([...this.result.best.keys()].map((id) => this.net.station[id].coord));
  }

  exit() {
    this.active = false;
    this.layers.setExploring(false);
    this.layers.setExplore(null, null);
    this.layers.setRoute(null);
  }

  setOrigin(id) {
    this.origin = id;
    this.update();
    this.fitResult();
  }

  update() {
    if (!this.active) return;
    const date = this.getDate();
    const theme = this.getTheme();
    const st = this.origin && this.net.station[this.origin];
    if (!st || this.net.stationState(st, date) !== "operational") {
      this.result = null;
      this.layers.setExplore(null, null);
      this.layers.setRoute(null);
      this.renderPanel(st ? "closed" : "pick");
      return;
    }
    const res = this.net.route(this.origin, date);
    this.result = res;
    const ramp = TIME_RAMP[theme];

    // stations
    const stFeatures = [];
    for (const [id, { min }] of res.best) {
      const s = this.net.station[id];
      const origin = id === this.origin;
      stFeatures.push({
        type: "Feature",
        properties: {
          id, origin, color: ramp[bucketOf(min)], state: "operational", interchange: origin,
          intercity: s.lines.some((l) => !this.net.line[l.id].urban),
          text: origin ? s.short || s.name : `${s.short || s.name} · ${fmtMin(min)}`,
          rank: Math.round(min),
        },
        geometry: { type: "Point", coordinates: s.coord },
      });
    }
    // shortest-path tree, each piece coloured by the arrival time at its far end
    const used = new Map();
    for (const id of res.best.keys()) {
      let k = res.best.get(id).key;
      while (res.prev.has(k)) {
        const p = res.prev.get(k);
        const arrive = this.arrivalOf(k);
        const g = p.via.edge ? p.via.edge.coords : [this.net.station[p.via.walk.a].coord, this.net.station[p.via.walk.b].coord];
        const gid = p.via.edge ? `${p.via.edge.line}|${p.via.edge.a}|${p.via.edge.b}` : `walk|${p.via.walk.a}|${p.via.walk.b}`;
        if (!used.has(gid) || used.get(gid).t > arrive) used.set(gid, { t: arrive, g, walk: !p.via.edge });
        k = p.from;
      }
    }
    const edgeFeatures = [...used.values()].map(({ t, g }) => ({
      type: "Feature", properties: { color: ramp[bucketOf(t)], group: "intercity" }, geometry: { type: "LineString", coordinates: g },
    }));
    this.layers.setExplore({ type: "FeatureCollection", features: edgeFeatures }, { type: "FeatureCollection", features: stFeatures });
    this.layers.setRoute(null);
    this.renderPanel("ready");
  }

  arrivalOf(key) {
    return this.result.dist.get(key) ?? 0;
  }

  // route line + summary for hovering a destination
  routeTo(id) {
    if (!this.result || id === this.origin) {
      this.layers.setRoute(null);
      return null;
    }
    const path = this.net.pathTo(this.result, id);
    if (!path) return null;
    const features = path.steps.map((s) => ({
      type: "Feature", properties: { group: "intercity" },
      geometry: { type: "LineString", coordinates: s.edge ? s.edge.coords : [this.net.station[s.walk.a].coord, this.net.station[s.walk.b].coord] },
    }));
    this.layers.setRoute({ type: "FeatureCollection", features });
    return path;
  }

  describe(path) {
    const theme = this.getTheme();
    return path.legs.map((leg) => {
      const name = leg.line === "walk" ? "Walk" : this.net.line[leg.line].name;
      const to = this.net.station[leg.to];
      return h("div", { class: "tt-row" },
        leg.line === "walk" ? h("span", { class: "key", style: "border-top-style:dotted;border-color:currentColor" })
          : h("span", { class: "key", style: `border-color:${LINE_COLORS[theme][leg.line]}` }),
        // a walk names the exact building; a ride can use the short city name
        `${name}${to ? ` to ${leg.line === "walk" ? to.name : to.short || to.name}` : ""}, ${fmtMin(leg.min)}`);
    });
  }

  tooltipFor(id) {
    const st = this.net.station[id];
    const best = this.result && this.result.best.get(id);
    if (!st || !best) return null;
    if (id === this.origin) return [h("strong", {}, st.name), h("div", {}, "Starting point")];
    const path = this.routeTo(id);
    return [
      h("strong", {}, st.name),
      h("span", { class: "big" }, fmtMin(best.min)),
      h("div", {}, path.changes === 0 ? "No changes" : `${path.changes} change${path.changes > 1 ? "s" : ""}`),
      ...this.describe(path),
    ];
  }

  renderPanel(mode) {
    const date = this.getDate();
    const year = date.slice(0, 4);
    const theme = this.getTheme();
    const ramp = TIME_RAMP[theme];
    const st = this.origin && this.net.station[this.origin];
    const head = [
      this.ui.closeButton(() => this.onClose()),
      h("p", { class: "eyebrow" }, `Travel times · ${year}`),
    ];
    if (mode === "pick") {
      this.ui.open([...head,
        h("h2", { id: "details-title" }, "Pick a starting station"),
        h("p", {}, "Click any station on the map, or search for one, to colour the network by how long it takes to get there by rail."),
        h("p", { class: "hint" }, "Then drag the timeline: watch Abu Dhabi, Fujairah and Sohar come within reach as new lines open."),
        h("div", { class: "row" }, ...["Union", "Dubai (Al Yalayis)", "Abu Dhabi (Mohamed bin Zayed City)"].map((n) => {
          const s = this.net.stations.find((x) => x.name === n);
          return s ? h("button", { class: "btn ghost", onclick: () => this.setOrigin(s.id) }, s.short || s.name) : null;
        }))]);
      return;
    }
    if (mode === "closed") {
      const opens = st.lines.map((l) => l.opened).filter(Boolean).sort()[0];
      this.ui.open([...head,
        h("h2", { id: "details-title" }, st.name),
        h("p", {}, `This station is not open in ${year}.`,
          opens ? ` It is due ${String(opens).length === 4 ? "in " : "on "}${formatOpening(opens)}.` : " Its opening date has not been announced."),
        h("p", { class: "hint" }, "Move the timeline forward, or pick another station.")]);
      return;
    }
    const res = this.result;
    const rows = [...res.best.entries()].filter(([id]) => id !== this.origin).sort((a, b) => a[1].min - b[1].min);
    const within = (m) => rows.filter(([, v]) => v.min <= m).length;
    const table = h("table", { class: "times" },
      h("caption", { class: "hint", style: "text-align:left;caption-side:top;padding-bottom:4px" }, `${rows.length} stations reachable by rail`),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Station"), h("th", { scope: "col", class: "num" }, "Changes"), h("th", { scope: "col", class: "num" }, "Time"))),
      h("tbody", {}, rows.map(([id, v]) => {
        const s = this.net.station[id];
        const path = this.net.pathTo(res, id);
        return h("tr", {
          tabindex: "0",
          onmouseenter: () => this.routeTo(id),
          onfocus: () => this.routeTo(id),
          onmouseleave: () => this.layers.setRoute(null),
          onclick: () => this.setOrigin(id),
          onkeydown: (e) => { if (e.key === "Enter") this.setOrigin(id); },
        },
        h("td", {}, h("span", { class: "sw", style: `background:${ramp[bucketOf(v.min)]}` }), s.name),
        h("td", { class: "num" }, String(path ? path.changes : 0)),
        h("td", { class: "num" }, fmtMin(v.min)));
      })));
    this.ui.open([...head,
      h("h2", { id: "details-title" }, `From ${st.name}`),
      h("div", { class: "ramp", role: "img", "aria-label": "Colour key: darker or brighter is closer" },
        ramp.map((c, i) => h("div", {}, h("span", { style: `background:${c}` }), h("small", {}, TIME_LABELS[i])))),
      h("dl", { class: "reach" },
        h("div", {}, h("dt", {}, "Within 30 min"), h("dd", {}, String(within(30)))),
        h("div", {}, h("dt", {}, "Within 1 hour"), h("dd", {}, String(within(60)))),
        h("div", {}, h("dt", {}, "Within 2 hours"), h("dd", {}, String(within(120))))),
      h("p", { class: "hint" }, "Hover a station to see the route. Click one to start from there."),
      table,
      h("p", { class: "hint" }, "Modelled times: in-vehicle time scaled to published end-to-end journey times, 4 minutes per change, and short walks between nearby stations. Waiting for the first train is not included. Unbuilt lines use announced journey times."),
    ]);
  }
}

