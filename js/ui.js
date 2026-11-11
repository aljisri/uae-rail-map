// Legend, line and station cards, station search and the map tooltip.
import { stateAt, formatOpening, formatWhen, nameIndexAt } from "./network.js";
import { LINE_COLORS } from "./palette.js";

// tiny DOM helper: text always goes in as text nodes
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const SVG = "http://www.w3.org/2000/svg";
export function swatch(color, state, cls = "swatch") {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("viewBox", "0 0 30 10");
  svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(SVG, "line");
  line.setAttribute("x1", "3"); line.setAttribute("x2", "27"); line.setAttribute("y1", "5"); line.setAttribute("y2", "5");
  if (color) line.setAttribute("stroke", color);
  if (state === "construction") line.setAttribute("stroke-dasharray", "6 4"), line.setAttribute("stroke-linecap", "butt");
  if (state === "planned") line.setAttribute("stroke-dasharray", "0.1 6.5");
  svg.appendChild(line);
  return svg;
}

export const STATE_TEXT = { operational: "In service", construction: "Under construction", planned: "Planned" };
const GROUPS = [
  { title: "Dubai Metro", ids: ["red", "green", "blue", "gold"] },
  { title: "Trams and monorail", ids: ["tram", "monorail", "adtram"] },
  { title: "National and cross-border", ids: ["etihad", "hsr", "hafeet", "freight"] },
];
const X_ICON = () => {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG, "path");
  p.setAttribute("d", "M4 4l8 8M12 4l-8 8");
  svg.appendChild(p);
  return svg;
};

export function lineWhen(line, state) {
  const opened = String(line.opened);
  const y = opened.slice(0, 4);
  if (state === "operational") return `Since ${y}`;
  if (line.opened_label) return line.opened_label.replace("Trial operations expected ", "Trials ");
  return `Due ${opened.length === 4 ? y : formatOpening(line.opened).replace(/^\d+ /, "")}`;
}

// "Wikipedia: Equiti (Dubai Metro)" or "thenationalnews.com"
export function sourceLabel(u) {
  const url = new URL(u);
  if (url.hostname.endsWith("wikipedia.org")) {
    return `Wikipedia: ${decodeURIComponent(url.pathname.split("/").pop()).replace(/_/g, " ")}`;
  }
  return url.hostname.replace("www.", "");
}

export class UI {
  constructor({ net, onSelectLine, onSelectStation, onExploreFrom, onToggleLine, onHoverLine, onSetYear, onShowRenamed }) {
    this.net = net;
    this.theme = "dark";
    this.cb = { onSelectLine, onSelectStation, onExploreFrom, onToggleLine, onHoverLine, onSetYear, onShowRenamed };
    this.legendEl = document.getElementById("legend");
    this.details = document.getElementById("details");
    this.tooltip = document.getElementById("tooltip");
    this.hidden = new Set();
    this.selectedLine = null;
    this.setupSearch();
    this.setupLegendToggle();
  }

  // ------------------------------------------------------------ legend
  renderLegend(date, theme) {
    const colors = LINE_COLORS[theme];
    const root = this.legendEl;
    root.replaceChildren();
    for (const g of GROUPS) {
      const box = h("div", { class: "lg-group" }, h("h2", {}, g.title));
      for (const id of g.ids) {
        const line = this.net.line[id];
        const state = this.net.lineState(id, date);
        const off = this.hidden.has(id);
        const sub = state ? STATE_TEXT[state] : "Not yet announced";
        // status in words as well as line style: "Since 2009", "Building · 2029", "Planned · 2032"
        const when = !state ? "Not announced" : state === "operational" ? lineWhen(line, state)
          : `${state === "construction" ? "Building" : "Planned"} · ${lineWhen(line, state).replace(/^Due /, "")}`;
        const row = h("button", {
          class: `lg-line${off ? " off" : ""}${this.selectedLine === id ? " active" : ""}`,
          "aria-label": `${line.name}: ${sub}, ${when}. Show details`,
          onclick: () => this.cb.onSelectLine(id),
          onmouseenter: () => this.cb.onHoverLine(id),
          onmouseleave: () => this.cb.onHoverLine(null),
          onfocus: () => this.cb.onHoverLine(id),
          onblur: () => this.cb.onHoverLine(null),
        },
        swatch(colors[id], state || "planned"),
        h("span", { class: "nm" }, line.name),
        h("span", { class: "when" }, when));
        if (!state) row.classList.add("off");
        box.append(row);
      }
      root.append(box);
    }
    const events = this.net.renameEvents();
    if (events.length) {
      const count = new Set(events.map((e) => e.st.id)).size;
      root.append(h("div", { class: "lg-group" }, h("h2", {}, "Station names"),
        h("button", { class: "lg-line", onclick: () => this.cb.onShowRenamed(),
          "aria-label": `Renamed stations: ${count} stations, ${events.length} name changes. Browse them` },
        h("span", { class: "lg-ic", "aria-hidden": "true" }, "Aa"),
        h("span", { class: "nm" }, "Renamed stations"),
        h("span", { class: "when" }, `${count} · ${events.length} changes`))));
    }
    const key = h("div", { class: "lg-key", role: "list", "aria-label": "Line styles" },
      h("div", { role: "listitem" }, swatch(null, "operational"), "In service"),
      h("div", { role: "listitem" }, swatch(null, "construction"), "Under construction"),
      h("div", { role: "listitem" }, swatch(null, "planned"), "Planned or approved"));
    root.append(key,
      h("p", { class: "lg-note" },
        "Unbuilt lines without published alignments (Gold Line, high-speed rail, Abu Dhabi Tram, Hafeet Rail in Oman) are drawn as indicative corridors. ",
        "Status as of ", formatOpening(this.net.asOf), "."));
  }

  setupLegendToggle() {
    const btn = document.getElementById("btn-legend");
    btn.addEventListener("click", () => {
      const open = !this.legendEl.classList.contains("open");
      this.legendEl.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  // ---------------------------------------------------------- details
  closeButton(onClose) {
    return h("button", { class: "close", "aria-label": "Close", onclick: onClose }, X_ICON());
  }

  showLine(id, date, theme, onClose) {
    const line = this.net.line[id];
    const colors = LINE_COLORS[theme];
    const state = this.net.lineState(id, date) || "planned";
    this.selectedLine = id;
    const stops = this.net.stopsByLine[id] || [];
    const svc = this.net.services.filter((s) => s.line === id);
    const longest = svc.reduce((m, s) => Math.max(m, s.stop_t[s.stop_t.length - 1]), 0);
    const opened = formatOpening(line.opened);
    const openedText = line.opened_label || (state === "operational" ? `Opened ${opened}` : `Due ${opened}`);

    const kv = h("dl", { class: "kv" },
      line.length_km ? h("div", {}, h("dt", {}, "Length"), h("dd", {}, `${line.length_km} km`)) : null,
      line.stations_total ? h("div", {}, h("dt", {}, "Stations"), h("dd", {}, String(line.stations_total))) : null,
      longest ? h("div", {}, h("dt", {}, "End to end"), h("dd", {}, `${Math.round(longest)} min`)) : null);

    const list = h("ul", { class: "stops", "aria-label": `${line.name} stations` },
      stops.map((sid) => {
        const st = this.net.station[sid];
        const lines = st.lines.filter((l) => l.id !== "freight");
        const ic = lines.length > 1;
        const own = st.lines.find((l) => l.id === id);
        const openY = own && own.opened ? String(own.opened).slice(0, 4) : "";
        return h("li", {}, h("button", { onclick: () => this.cb.onSelectStation(sid) },
          h("span", { class: `dot${ic ? " ic" : ""}`, style: `--c:${colors[id]}` }),
          h("span", {}, this.net.nameAt(st, date)),
          h("span", { class: "meta" }, ic ? `${lines.length} lines` : openY)));
      }));

    const body = [
      this.closeButton(onClose),
      h("p", { class: "eyebrow" }, line.system),
      h("h2", { id: "details-title" }, line.name),
      h("p", { class: "ar", lang: "ar", dir: "rtl" }, line.name_ar),
      h("div", { class: "row" },
        h("span", { class: "chip" }, swatch(colors[id], state), STATE_TEXT[state]),
        h("span", { class: "chip" }, openedText),
        line.alignment && line.alignment !== "osm" ? h("span", { class: "chip" }, line.alignment === "indicative" ? "Indicative route" : "Partly indicative") : null),
      h("p", { class: "summary" }, line.summary),
      kv,
      h("ul", { class: "facts" }, (line.facts || []).map((f) => h("li", {}, f))),
      stops.length ? list : null,
      h("p", { class: "sources" }, "Sources: ", ...(line.sources || []).flatMap((u, i) => [i ? ", " : "", h("a", { href: u, target: "_blank", rel: "noopener" }, new URL(u).hostname.replace("www.", ""))])),
    ];
    this.open(body);
  }

  showStation(id, date, theme, onClose) {
    const st = this.net.station[id];
    const colors = LINE_COLORS[theme];
    const served = st.lines.map((l) => {
      const line = this.net.line[l.id];
      const s = stateAt(l, date);
      const when = s === "operational" ? `Since ${String(l.opened).slice(0, 4)}`
        : l.opened ? `${s ? STATE_TEXT[s] + ", due" : "Due"} ${formatOpening(l.opened)}` : "Date to be announced";
      return h("li", {}, swatch(colors[l.id], s || "planned"), h("span", {}, line.name), h("span", { class: "when" }, when));
    });
    const isOpen = this.net.stationState(st, date) === "operational";
    const systems = [...new Set(st.lines.map((l) => this.net.line[l.id].system))].join(" · ");
    const then = this.net.nameAt(st, date);
    const renamed = then !== st.name;   // the name on this date is not today's name
    const history = this.nameHistory(st, date);
    const body = [
      this.closeButton(onClose),
      h("p", { class: "eyebrow" }, `${systems} station`),
      h("h2", { id: "details-title" }, then),
      // the Arabic name belongs to today's name, so it is only shown with it
      st.name_ar && !renamed ? h("p", { class: "ar", lang: "ar", dir: "rtl" }, st.name_ar) : null,
      renamed ? h("div", { class: "row" }, h("span", { class: "chip" }, `Called ${st.name} today`)) : null,
      h("ul", { class: "served", "aria-label": "Lines" }, served),
      st.note ? h("p", { class: "note" }, st.note) : null,
      st.approx ? h("p", { class: "note" }, "Location is approximate: the exact site has not been published or mapped yet.") : null,
      // a station with a name history leads with it, so it is not pushed below the fold on a phone
      st.names ? history : null,
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => this.cb.onExploreFrom(id), disabled: !isOpen || null,
          title: isOpen ? null : "Pick a later year to travel from this station" },
          "Travel times from here")),
      !isOpen ? h("p", { class: "hint" }, "This station is not open in the selected year. Move the timeline forward to plan journeys from it.") : null,
      st.names ? null : history,
    ];
    this.open(body);
  }

  // The station's names in order, the one in effect on the selected date marked. Each row
  // jumps the timeline to a year when that name was in use.
  nameHistory(st, date) {
    const year = date.slice(0, 4);
    if (!st.names) {
      // researched: Dubai Metro, Palm Monorail, Dubai Tram and Etihad Rail
      const covered = st.lines.some((l) => ["red", "green", "monorail", "tram", "etihad"].includes(l.id));
      return covered ? h("p", { class: "hint" }, "No name changes are recorded for this station.") : null;
    }
    const names = st.names;
    const cur = nameIndexAt(st, date);
    const last = names.length - 1;
    const isNow = +year === this.net.asOfYear;
    const opened = String(st.lines.map((l) => l.opened).filter(Boolean).sort()[0] || "");
    const rows = names.map((e, i) => {
      const next = names[i + 1];
      const from = e.from ? formatWhen(e.from) : e.pre_opening ? "Planning name" : `Opened ${formatWhen(opened.slice(0, 7))}`;
      const to = next ? formatWhen(next.from) : "today";
      const y = this.net.yearForName(st, i);
      const tags = [];
      if (i === cur) tags.push(isNow ? "Today" : `In ${year}`);
      if (i === last && !(i === cur && isNow)) tags.push("Today");
      return h("li", { class: i === cur ? "on" : null, "aria-current": i === cur ? "true" : null },
        h("button", { disabled: y == null || null, onclick: () => this.cb.onSetYear(y),
          title: y == null ? "Not shown at the end of any year on the timeline" : `Show the map as in ${y}` },
        h("span", { class: "nd" }),
        h("span", { class: "nt" },
          h("strong", {}, e.n),
          h("span", { class: "np" }, `${from} to ${to}`),
          e.note ? h("small", {}, e.note) : null),
        tags.length ? h("span", { class: "tags" }, tags.map((t) => h("span", { class: "tag" }, t))) : null));
    });
    return h("section", { class: "names", "aria-label": "Name history" },
      h("h3", {}, `Name history · ${names.length - 1} change${names.length > 2 ? "s" : ""}`),
      h("ol", {}, rows),
      h("p", { class: "hint" }, "Dates are shown to the precision the sources agree on. Select a name to see the map as it was then."),
      st.name_src && st.name_src.length ? h("p", { class: "sources" }, "Sources: ",
        ...st.name_src.flatMap((u, i) => [i ? ", " : "", h("a", { href: u, target: "_blank", rel: "noopener" }, sourceLabel(u))])) : null);
  }

  // Every renamed station, newest rename first.
  showRenamed(date, onClose) {
    const year = date.slice(0, 4);
    const events = this.net.renameEvents();
    const byStation = new Map();
    for (const e of events) if (!byStation.has(e.st.id)) byStation.set(e.st.id, e);   // newest per station
    const inYear = events.filter((e) => e.from.slice(0, 4) === year);
    const rows = [...byStation.values()].map((latest) => {
      const st = latest.st;
      const chain = st.names.map((e) => e.n).join(" \u2192 ");
      const here = inYear.filter((e) => e.st.id === st.id).length;
      return h("li", {}, h("button", { onclick: () => this.cb.onSelectStation(st.id, { fly: true }) },
        h("span", { class: "nt" }, h("strong", {}, st.name), h("small", {}, chain)),
        h("span", { class: "meta" }, here ? h("span", { class: "tag" }, `Renamed in ${year}`) : formatWhen(latest.from))));
    });
    this.open([
      this.closeButton(onClose),
      h("p", { class: "eyebrow" }, "Station names"),
      h("h2", { id: "details-title" }, "Renamed stations"),
      h("p", { class: "summary" }, `${byStation.size} stations have changed name ${events.length} times since 2009.`
        + (inYear.length ? ` ${inYear.length} of those changes were in ${year}.` : "")),
      h("ul", { class: "renamed", "aria-label": "Renamed stations" }, rows),
      h("p", { class: "hint" }, "Covers Dubai Metro, Palm Monorail and Etihad Rail stations; no renames were found for the Dubai Tram. Names and dates come from Wikipedia, Gulf News and RTA announcements."),
    ]);
  }

  open(children) {
    this.details.replaceChildren(...children.filter(Boolean));
    this.details.hidden = false;
    this.details.setAttribute("aria-labelledby", "details-title");
    this.details.scrollTop = 0;
  }

  close() {
    this.details.hidden = true;
    this.selectedLine = null;
  }

  // ----------------------------------------------------------- search
  setupSearch() {
    const input = document.getElementById("search");
    const list = document.getElementById("search-results");
    let items = [];
    let active = -1;
    const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ'’]/g, "");
    const render = () => {
      const q = norm(input.value.trim());
      list.replaceChildren();
      if (!q) {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        return;
      }
      const qa = input.value.trim(); // Arabic is matched as typed
      items = this.net.stations
        .map((s) => {
          const n = norm(s.name), sh = norm(s.short), ar = s.name_ar || "";
          let score = n === q || sh === q || ar === qa ? 0
            : n.startsWith(q) || sh.startsWith(q) || ar.startsWith(qa) ? 1
            : n.includes(q) || sh.includes(q) || ar.includes(qa) ? 2 : -1;
          // a name the station used to have also finds it ("Noor Bank" finds Garmin)
          let former = null;
          if (score < 0) {
            former = (s.names || []).find((e) => norm(e.n).includes(q)) || null;
            if (former) score = 3;
          }
          return { s, score, former };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name))
        .slice(0, 8);
      active = items.length ? 0 : -1;
      if (!items.length) list.append(h("li", { class: "empty", role: "option", "aria-disabled": "true" }, "No station matches"));
      items.forEach(({ s, former }, i) => {
        const systems = [...new Set(s.lines.map((l) => this.net.line[l.id].name))].join(", ");
        list.append(h("li", { id: `opt-${i}`, role: "option", "aria-selected": String(i === active),
          onmousedown: (e) => { e.preventDefault(); choose(i); } },
          swatch(LINE_COLORS[this.theme][s.lines[0].id], "operational"),
          h("span", { class: "name" }, s.name, h("small", {}, former ? `Formerly ${former.n} \u00b7 ${systems}` : systems))));
      });
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      input.setAttribute("aria-activedescendant", active >= 0 ? `opt-${active}` : "");
    };
    const choose = (i) => {
      const s = items[i] && items[i].s;
      if (!s) return;
      input.value = "";
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.blur();
      this.cb.onSelectStation(s.id, { fly: true });
    };
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length);
        [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
        input.setAttribute("aria-activedescendant", `opt-${active}`);
      } else if (e.key === "Enter") {
        e.preventDefault();
        choose(active);
      } else if (e.key === "Escape") {
        input.value = "";
        render();
      }
    });
    // close on blur, unless focus came straight back (e.g. a new search right after choosing)
    input.addEventListener("blur", () => setTimeout(() => {
      if (document.activeElement !== input) list.hidden = true;
    }, 120));
  }

  // ---------------------------------------------------------- tooltip
  showTooltip(point, children) {
    const tt = this.tooltip;
    tt.replaceChildren(...children.filter(Boolean));
    tt.hidden = false;
    const pad = 14;
    const { innerWidth: W, innerHeight: H } = window;
    const r = tt.getBoundingClientRect();
    let x = point.x + pad, y = point.y + pad;
    if (x + r.width > W - 8) x = point.x - r.width - pad;
    if (y + r.height > H - 8) y = point.y - r.height - pad;
    tt.style.left = `${Math.max(8, x)}px`;
    tt.style.top = `${Math.max(8, y)}px`;
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }
}
