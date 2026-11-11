// Network model: what exists on a given date, map features, and journey times.
import { LINE_COLORS, MAP_COLORS } from "./palette.js";

export const STATES = ["operational", "construction", "planned"];
const RANK = { operational: 0, construction: 1, planned: 2 };
const URBAN = new Set(["red", "green", "blue", "gold", "tram", "monorail", "adtram"]);

// "2030" means "during 2030": treat a bare year as its last day.
export const asDate = (d) => (d == null ? null : String(d).length === 4 ? `${d}-12-31` : String(d));

export function stateAt(item, date) {
  const opened = asDate(item.opened);
  if (opened && opened <= date) return "operational";
  const year = +date.slice(0, 4);
  if (item.construction && year >= item.construction) return "construction";
  if (item.announced && year >= item.announced) return "planned";
  return null;
}

const better = (a, b) => (a == null ? b : b == null ? a : RANK[a] <= RANK[b] ? a : b);

export function formatOpening(d) {
  if (!d) return "Date to be announced";
  const s = String(d);
  if (s.length === 4) return s;
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ------------------------------------------------------------------ station names
// A name entry's `from` is "YYYY", "YYYY-MM" or "YYYY-MM-DD" (null = since the station opened).
// It takes effect at the start of that period, so a rename in 2020 shows at the end of 2020.
const startOf = (f) => (f.length === 4 ? `${f}-01-01` : f.length === 7 ? `${f}-01` : f);

// Index of the name in effect on a date (0 if the station has no history).
export function nameIndexAt(st, date) {
  let idx = 0;
  (st.names || []).forEach((e, i) => { if (e.from && startOf(e.from) <= date) idx = i; });
  return idx;
}

// "2012", "Nov 2020" or "14 Apr 2025", matching the precision the sources give.
export function formatWhen(f) {
  if (!f) return "";
  if (f.length === 4) return f;
  if (f.length === 7) {
    const [y, m] = f.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return formatOpening(f);
}

// Decimal year for charts: a bare year sits mid-year, a month sits just inside it.
export function decimalYear(f) {
  const y = +f.slice(0, 4);
  if (f.length === 4) return y + 0.5;
  const m = +f.slice(5, 7) - 1;
  if (f.length === 7) return y + m / 12 + 0.04;
  return y + (m + (+f.slice(8, 10) - 1) / 31) / 12;
}

export class Network {
  constructor(data) {
    this.data = data;
    this.asOf = data.as_of;
    this.asOfYear = +data.as_of.slice(0, 4);
    this.lines = data.lines;
    this.line = Object.fromEntries(data.lines.map((l) => [l.id, l]));
    this.stations = data.stations;
    this.station = Object.fromEntries(data.stations.map((s) => [s.id, s]));
    this.segments = data.segments;
    this.edges = data.edges;
    this.services = data.services;
    this.walks = data.walks;
    this.transferMin = data.transfer_min;
    for (const l of this.lines) l.urban = URBAN.has(l.id);
    // Western Etihad Rail trains (Al Dhafra) and eastern ones (Dubai, Fujairah) are separate
    // services that meet in Abu Dhabi: crossing between them is a change of train.
    const WEST = new Set(["jct-west", "er-mirfa", "er-dhannah", "er-sila", "er-mz", "er-mezairaa"]);
    for (const e of this.edges) e.svc = e.line === "etihad" && (WEST.has(e.a) || WEST.has(e.b)) ? "etihad-west" : e.line;
    // stations in route order per line, for line cards
    this.stopsByLine = {};
    for (const l of this.lines) {
      const seen = new Set();
      const list = [];
      for (const branch of l.branches || []) for (const id of branch) {
        if (!this.station[id] || seen.has(id)) continue;
        seen.add(id);
        list.push(id);
      }
      this.stopsByLine[l.id] = list;
    }
  }

  dateFor(year) {
    return year === this.asOfYear ? this.asOf : `${year}-12-31`;
  }

  // The name a station had on a date (its current name if no history is recorded).
  nameAt(st, date) {
    return st.names ? st.names[nameIndexAt(st, date)].n : st.name;
  }

  // Short name for labels and lists: Etihad Rail stations have a short city name.
  displayName(st, date) {
    return st.short || this.nameAt(st, date);
  }

  // The first year on the timeline in which name number `idx` is the one shown, or null.
  yearForName(st, idx) {
    for (let y = 2006; y <= 2032; y++) if (nameIndexAt(st, this.dateFor(y)) === idx) return y;
    return null;
  }

  // Every rename in the data, newest first: { st, from, prev, to, note }.
  renameEvents() {
    if (!this._renames) {
      const out = [];
      for (const st of this.stations) {
        (st.names || []).forEach((e, i) => {
          if (i > 0) out.push({ st, from: e.from, prev: st.names[i - 1].n, to: e.n, note: e.note });
        });
      }
      this._renames = out.sort((a, b) => (startOf(b.from) < startOf(a.from) ? -1 : 1));
    }
    return this._renames;
  }

  lineState(lineId, date) {
    let s = null;
    for (const seg of this.segments) if (seg.line === lineId) s = better(s, stateAt(seg, date));
    return s;
  }

  stationState(st, date) {
    let s = null;
    for (const l of st.lines) s = better(s, stateAt(l, date));
    return s;
  }

  stationLinesAt(st, date) {
    return st.lines.filter((l) => stateAt(l, date)).map((l) => ({ ...l, state: stateAt(l, date) }));
  }

  segmentFeatures(date, theme, hidden = new Set()) {
    const colors = LINE_COLORS[theme];
    const features = [];
    for (const seg of this.segments) {
      if (hidden.has(seg.line)) continue;
      const state = stateAt(seg, date);
      if (!state) continue;
      const line = this.line[seg.line];
      features.push({
        type: "Feature",
        properties: {
          line: seg.line, state, color: colors[seg.line], name: line.name,
          group: seg.line === "freight" ? "freight" : line.urban ? "urban" : "intercity",
          indicative: seg.alignment !== "osm",
        },
        geometry: { type: "LineString", coordinates: seg.coords },
      });
    }
    return { type: "FeatureCollection", features };
  }

  stationFeatures(date, theme, hidden = new Set()) {
    const colors = LINE_COLORS[theme];
    const ink = MAP_COLORS[theme].ink;
    const features = [];
    this.stations.forEach((st, index) => {
      const lines = this.stationLinesAt(st, date).filter((l) => !hidden.has(l.id));
      if (!lines.length) return;
      const state = lines.reduce((s, l) => better(s, l.state), null);
      const interchange = lines.length > 1;
      const intercity = lines.some((l) => !this.line[l.id].urban);
      // the name as it was on this date; in the year of a rename, add the old name underneath
      let label = this.displayName(st, date);
      if (st.names && !st.short) {
        const i = nameIndexAt(st, date);
        const e = st.names[i];
        if (i > 0 && e.from && e.from.slice(0, 4) === date.slice(0, 4)) label += `\n(was ${st.names[i - 1].n})`;
      }
      features.push({
        type: "Feature",
        id: index,
        properties: {
          id: st.id, label, state, interchange, intercity,
          color: interchange ? ink : colors[lines[0].id],
          rank: (interchange ? 0 : 10) + (intercity ? 0 : 5) + RANK[state],
          approx: !!st.approx,
        },
        geometry: { type: "Point", coordinates: st.coord },
      });
    });
    return { type: "FeatureCollection", features };
  }

  // Passenger network stats (freight excluded).
  stats(date) {
    let km = 0, building = 0;
    for (const seg of this.segments) {
      if (seg.line === "freight") continue;
      const s = stateAt(seg, date);
      if (s === "operational") km += seg.km;
      else if (s === "construction") building += seg.km;
    }
    for (const seg of this.segments) {
      if (seg.line === "freight" && stateAt(seg, date) === "construction") building += seg.km;
    }
    const stations = this.stations.filter((st) => this.stationState(st, date) === "operational").length;
    return { km, building, stations };
  }

  // Passenger km in service by group, for the growth chart.
  kmByGroup(date) {
    const out = { metro: 0, light: 0, intercity: 0, hsr: 0 };
    for (const seg of this.segments) {
      if (seg.line === "freight" || stateAt(seg, date) !== "operational") continue;
      const g = seg.line === "hsr" ? "hsr" : ["red", "green", "blue", "gold"].includes(seg.line) ? "metro"
        : ["tram", "monorail", "adtram"].includes(seg.line) ? "light" : "intercity";
      out[g] += seg.km;
    }
    return out;
  }

  // ---------------------------------------------------------------- routing
  // Dijkstra over (station, line) states so a change of line costs a transfer.
  route(originId, date) {
    const adj = new Map();
    const push = (a, item) => (adj.get(a) || adj.set(a, []).get(a)).push(item);
    for (const e of this.edges) {
      if (stateAt(e, date) !== "operational") continue;
      push(e.a, { to: e.b, line: e.line, svc: e.svc, min: e.min, edge: e });
      push(e.b, { to: e.a, line: e.line, svc: e.svc, min: e.min, edge: e });
    }
    for (const w of this.walks) {
      const sa = this.station[w.a], sb = this.station[w.b];
      if (this.stationState(sa, date) !== "operational" || this.stationState(sb, date) !== "operational") continue;
      push(w.a, { to: w.b, line: "walk", svc: "walk", min: w.min, walk: w });
      push(w.b, { to: w.a, line: "walk", svc: "walk", min: w.min, walk: w });
    }

    // state = (node, service you are on); a walk resets it, so no extra change penalty after walking
    const key = (node, svc) => `${node}|${svc}`;
    const dist = new Map([[key(originId, ""), 0]]);
    const prev = new Map();
    const heap = new MinHeap();
    heap.push(0, [originId, ""]);
    while (heap.size) {
      const [d, [node, svc]] = heap.pop();
      if (d > dist.get(key(node, svc))) continue;
      for (const nb of adj.get(node) || []) {
        const change = svc && svc !== "walk" && nb.svc !== "walk" && nb.svc !== svc ? this.transferMin : 0;
        const nd = d + nb.min + change;
        const k = key(nb.to, nb.svc);
        if (nd < (dist.get(k) ?? Infinity)) {
          dist.set(k, nd);
          prev.set(k, { from: key(node, svc), via: nb, change });
          heap.push(nd, [nb.to, nb.svc]);
        }
      }
    }
    // best arrival per station (only stations open on this date)
    const best = new Map();
    for (const [k, d] of dist) {
      const node = k.slice(0, k.lastIndexOf("|"));
      const st = this.station[node];
      if (!st || this.stationState(st, date) !== "operational") continue;
      if (d < (best.get(node)?.min ?? Infinity)) best.set(node, { min: d, key: k });
    }
    return { origin: originId, date, best, prev, dist };
  }

  pathTo(result, stationId) {
    const end = result.best.get(stationId);
    if (!end) return null;
    const steps = [];
    let k = end.key;
    while (result.prev.has(k)) {
      const p = result.prev.get(k);
      steps.push(p.via);
      k = p.from;
    }
    steps.reverse();
    // summarise legs (one per train ridden)
    const legs = [];
    for (const s of steps) {
      const last = legs[legs.length - 1];
      if (last && last.svc === s.svc) {
        last.min += s.min;
        last.to = s.to;
      } else legs.push({ line: s.line, svc: s.svc, min: s.min, to: s.to });
    }
    const changes = legs.filter((l) => l.line !== "walk").length - 1;
    return { min: end.min, steps, legs, changes: Math.max(0, changes) };
  }
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(p, v) {
    const a = this.a;
    a.push([p, v]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
