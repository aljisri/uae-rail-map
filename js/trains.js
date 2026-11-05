// Animated trains on modelled timetables: one simulated minute per real second.
import { stateAt } from "./network.js";
import { LINE_COLORS } from "./palette.js";

// Minutes between trains on each service (per direction).
const HEADWAY = { red: 8, green: 5, blue: 8, gold: 4, tram: 8, monorail: 15, etihad: 90, hsr: 15, hafeet: 120, adtram: 8 };
const DWELL = { red: 0.4, green: 0.4, blue: 0.4, gold: 0.4, tram: 0.5, monorail: 0.6, etihad: 2, hsr: 2, hafeet: 2, adtram: 0.4 };
const SIM_MIN_PER_SEC = 1;

function haversine(a, b) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export class Trains {
  constructor(map, network) {
    this.map = map;
    this.net = network;
    this.runs = [];
    this.on = false;
    this.raf = null;
    this.theme = "dark";
    this.lastPush = 0;
    // pre-compute cumulative distances for every service
    this.prepared = network.services.map((svc) => {
      const cum = [0];
      for (let i = 1; i < svc.coords.length; i++) cum.push(cum[i - 1] + haversine(svc.coords[i - 1], svc.coords[i]));
      return { ...svc, cum, stopD: svc.stop_i.map((i) => cum[i]) };
    });
    // edge lookup to know which part of a service is open on a date
    this.edgeOf = new Map();
    for (const e of network.edges) {
      this.edgeOf.set(`${e.line}|${e.a}|${e.b}`, e);
      this.edgeOf.set(`${e.line}|${e.b}|${e.a}`, e);
    }
  }

  setDate(date, hidden = new Set()) {
    this.runs = [];
    for (const svc of this.prepared) {
      if (hidden.has(svc.line)) continue;
      // longest open prefix of the service
      let k = 0;
      while (k < svc.stops.length - 1) {
        const e = this.edgeOf.get(`${svc.line}|${svc.stops[k]}|${svc.stops[k + 1]}`);
        if (!e || stateAt(e, date) !== "operational") break;
        k++;
      }
      if (k === 0) continue;
      const T = svc.stop_t[k];
      const headway = HEADWAY[svc.line] || 10;
      const count = Math.max(1, Math.floor((2 * T) / headway));
      this.runs.push({ svc, last: k, T, count, dwell: DWELL[svc.line] || 0.5 });
    }
    this.render(performance.now());
  }

  setTheme(theme) {
    this.theme = theme;
    this.render(performance.now());
  }

  start() {
    if (this.on) return;
    this.on = true;
    const loop = (t) => {
      if (!this.on) return;
      // ~30 updates per second is plenty for smooth motion
      if (t - this.lastPush > 32) {
        this.render(t);
        this.lastPush = t;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.on = false;
    cancelAnimationFrame(this.raf);
  }

  render(now) {
    const sim = (now / 1000) * SIM_MIN_PER_SEC;
    const colors = LINE_COLORS[this.theme];
    const features = [];
    for (const run of this.runs) {
      const cycle = 2 * run.T;
      for (let i = 0; i < run.count; i++) {
        const phase = (sim + (i * cycle) / run.count) % cycle;
        const t = phase < run.T ? phase : cycle - phase;
        const p = this.position(run, t);
        if (p) features.push({ type: "Feature", properties: { color: colors[run.svc.line], line: run.svc.line }, geometry: { type: "Point", coordinates: p } });
      }
    }
    const src = this.map.getSource("trains");
    if (src) src.setData({ type: "FeatureCollection", features });
  }

  // time since leaving the first stop -> coordinate, with dwell and eased running between stops
  position(run, t) {
    const { svc, last, dwell } = run;
    const times = svc.stop_t, dists = svc.stopD;
    let k = 0;
    while (k < last - 1 && t >= times[k + 1]) k++;
    const t0 = times[k], t1 = times[k + 1];
    const isStop = (id) => !id.startsWith("jct-");
    const stay = isStop(svc.stops[k]) ? Math.min(dwell, (t1 - t0) * 0.4) : 0;
    let d;
    if (t - t0 <= stay) d = dists[k];
    else {
      let f = Math.min(1, (t - t0 - stay) / Math.max(1e-6, t1 - t0 - stay));
      const easeIn = isStop(svc.stops[k]), easeOut = isStop(svc.stops[k + 1]);
      if (easeIn && easeOut) f = f * f * (3 - 2 * f);
      else if (easeIn) f = f * f;
      else if (easeOut) f = 1 - (1 - f) * (1 - f);
      d = dists[k] + f * (dists[k + 1] - dists[k]);
    }
    return this.pointAt(svc, d);
  }

  pointAt(svc, d) {
    const cum = svc.cum;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo];
    const f = seg > 0 ? (d - cum[lo]) / seg : 0;
    const a = svc.coords[lo], b = svc.coords[hi];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
}
