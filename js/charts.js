// Insights panel: KPI tiles and four charts (D3). Every chart has hover details and a table view.
import { SERIES, CHART_INK, LINE_COLORS } from "./palette.js";
import { h } from "./ui.js";

const fmt = (n) => Math.round(n).toLocaleString("en-US");

export class Insights {
  constructor({ net, data, ui, getYear, getTheme, onClose, onYear }) {
    Object.assign(this, { net, data, ui, getYear, getTheme, onClose, onYear });
    this.el = document.getElementById("insights");
    this.tables = new Set();
    this.growth = this.computeGrowth();
    this.ro = new ResizeObserver(() => this.visible && this.renderCharts());
  }

  computeGrowth() {
    const years = d3.range(2006, 2033);
    return years.map((y) => ({ year: y, ...this.net.kmByGroup(this.net.dateFor(y)) }));
  }

  // a step chart needs one extra point so the final year has width
  growthForDrawing() {
    const last = this.growth[this.growth.length - 1];
    return [...this.growth, { ...last, year: last.year + 1 }];
  }

  show() {
    this.visible = true;
    this.el.hidden = false;
    this.render();
    this.ro.observe(this.el);
  }

  hide() {
    this.visible = false;
    this.el.hidden = true;
    this.ro.disconnect();
  }

  render() {
    if (!this.visible) return;
    const net = this.net;
    const today = net.stats(net.asOf);
    const future = net.stats("2032-12-31");
    const rid = this.data.ridership.values;
    const [y1, v1] = rid[rid.length - 1], [, v0] = rid[rid.length - 2];
    this.el.replaceChildren(
      this.ui.closeButton(() => this.onClose()),
      h("p", { class: "eyebrow" }, "Insights"),
      h("h2", { id: "insights-title" }, "A country on rails"),
      h("p", { class: "lede" }, "In 2009 the UAE had one metro line. By 2032 almost every major city is due to be on the rail network, with Oman a train ride away."),
      h("div", { class: "kpis" },
        h("div", { class: "kpi" }, h("div", { class: "label" }, "Passenger rail in service"), h("div", { class: "value" }, `${fmt(today.km)} km`),
          h("div", { class: "delta" }, `${fmt(future.km)} km planned by 2032`)),
        h("div", { class: "kpi" }, h("div", { class: "label" }, "Stations open"), h("div", { class: "value" }, fmt(today.stations)),
          h("div", { class: "delta" }, `${fmt(future.stations)} by 2032 (mapped)`)),
        h("div", { class: "kpi" }, h("div", { class: "label" }, `Dubai Metro journeys, ${y1}`), h("div", { class: "value" }, `${v1.toFixed(1)}M`),
          h("div", { class: "delta" }, `+${(((v1 - v0) / v0) * 100).toFixed(0)}% on ${y1 - 1}`))),
      this.figure("growth", "How the network grows", "Passenger route km in service at the end of each year. Two scales: city rail is a tenth the size of intercity rail.", this.growthLegend()),
      this.figure("projects", this.data.projects.title, "Each project from announcement to opening.", this.projectsLegend(), this.data.projects.note),
      h("div", { class: "two-up" },
        this.figure("ridership", this.data.ridership.title, "Million journeys a year.", null, this.data.ridership.note, this.data.ridership.source),
        this.figure("journeys", this.data.journeys.title, "Minutes, station to station.", this.journeysLegend(), this.data.journeys.note)),
    );
    this.renderCharts();
  }

  figure(id, title, sub, legend, foot, source) {
    const pressed = this.tables.has(id);
    return h("figure", { class: "chart", id: `fig-${id}` },
      h("figcaption", {},
        h("div", {}, h("h3", {}, title), h("p", { class: "sub" }, sub)),
        h("button", { class: "table-toggle", "aria-pressed": String(pressed), onclick: () => {
          pressed ? this.tables.delete(id) : this.tables.add(id);
          this.render();
        } }, pressed ? "Chart" : "Table")),
      legend,
      h("div", { class: "svg-wrap", id: `chart-${id}` }),
      foot || source ? h("p", { class: "foot" }, foot || "", source ? [" Source: ", h("a", { href: source.url, target: "_blank", rel: "noopener" }, source.label), "."] : null) : null);
  }

  renderCharts() {
    const theme = this.getTheme();
    const draw = { growth: () => this.drawGrowth(theme), projects: () => this.drawProjects(theme), ridership: () => this.drawRidership(theme), journeys: () => this.drawJourneys(theme) };
    for (const [id, fn] of Object.entries(draw)) {
      const host = document.getElementById(`chart-${id}`);
      if (!host) continue;
      host.replaceChildren();
      if (this.tables.has(id)) host.append(this.table(id));
      else fn();
    }
  }

  // ------------------------------------------------------------ legends
  growthLegend() {
    const s = SERIES[this.getTheme()];
    const items = [["Dubai Metro", s[0]], ["Trams and monorail", s[1]], ["Conventional intercity", s[2]], ["High-speed", s[3]]];
    return h("ul", { class: "chart-legend" }, items.map(([n, c]) => h("li", {}, h("span", { class: "k", style: `background:${c}` }), n)));
  }

  projectsLegend() {
    const ink = CHART_INK[this.getTheme()];
    return h("ul", { class: "chart-legend" },
      h("li", {}, h("span", { class: "k dash", style: `border-color:${ink.muted}` }), "Announced, in planning"),
      h("li", {}, h("span", { class: "k", style: `background:${ink.accent};height:8px` }), "Under construction"),
      h("li", {}, h("span", { class: "k dot", style: `background:${ink.accent}` }), "Opened"),
      h("li", {}, h("span", { class: "k dot", style: `border:2px solid ${ink.accent};background:transparent` }), "Due to open"));
  }

  journeysLegend() {
    const ink = CHART_INK[this.getTheme()];
    return h("ul", { class: "chart-legend" },
      h("li", {}, h("span", { class: "k dot", style: `background:${ink.accent}` }), "By rail"),
      h("li", {}, h("span", { class: "k dot", style: `background:${ink.muted}` }), "By road, free-flow"));
  }

  // ---------------------------------------------------------------- tooltips
  tip(event, children) {
    this.ui.showTooltip({ x: event.clientX, y: event.clientY }, children);
  }

  hideTip() {
    this.ui.hideTooltip();
  }

  // ------------------------------------------------------------ 1. growth
  drawGrowth(theme) {
    const host = document.getElementById("chart-growth");
    const W = host.clientWidth;
    const wrap = h("div", { class: "two-up" });
    host.append(wrap);
    const s = SERIES[theme];
    const panels = [
      { title: "City rail", keys: ["metro", "light"], colors: [s[0], s[1]], names: ["Dubai Metro", "Trams and monorail"] },
      { title: "Intercity rail", keys: ["intercity", "hsr"], colors: [s[2], s[3]], names: ["Conventional intercity", "High-speed"] },
    ];
    for (const p of panels) {
      const cell = h("div", {});
      wrap.append(cell);
      this.stackedStep(cell, p, W > 560 ? (W - 18) / 2 : W, theme);
    }
  }

  stackedStep(cell, panel, width, theme) {
    const ink = CHART_INK[theme];
    const data = this.growthForDrawing();
    const height = 190, m = { t: 22, r: 40, b: 22, l: 40 };
    const x = d3.scaleLinear().domain([2006, 2033]).range([m.l, width - m.r]);
    const stack = d3.stack().keys(panel.keys)(data);
    const maxY = d3.max(stack[stack.length - 1], (d) => d[1]) || 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice(4).range([height - m.b, m.t]);
    const svg = d3.select(cell).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
      .attr("aria-label", `${panel.title}: km in service by year. Use the table view for values.`);
    svg.append("text").attr("x", m.l).attr("y", 12).attr("class", "label-strong").text(panel.title);
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.l - m.r)).tickFormat(""))
      .call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${height - m.b})`).call(d3.axisBottom(x).tickValues([2010, 2015, 2020, 2025, 2030]).tickFormat(d3.format("d")).tickSizeOuter(0));
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((d) => `${fmt(d)}`).tickSize(0))
      .call((g) => g.select(".domain").remove()).call((g) => g.selectAll("text").attr("dx", -4));
    // future wash
    const today = this.net.asOfYear;
    svg.append("rect").attr("x", x(today)).attr("y", m.t).attr("width", x(2033) - x(today)).attr("height", height - m.b - m.t)
      .attr("fill", ink.text).attr("opacity", 0.05);
    svg.append("text").attr("x", x(today) + 4).attr("y", m.t + 10).text("Planned");

    const area = d3.area().curve(d3.curveStepAfter).x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1]));
    stack.forEach((layer, i) => {
      svg.append("path").attr("d", area(layer)).attr("fill", panel.colors[i]).attr("opacity", 0.9)
        .attr("stroke", ink.surface).attr("stroke-width", 1);
    });
    // end labels for the totals
    const last = data[data.length - 1];
    const total = panel.keys.reduce((s, k) => s + last[k], 0);
    svg.append("text").attr("x", width - m.r + 4).attr("y", y(total) + 4).attr("class", "label-strong").text(fmt(total));
    // selected year marker + crosshair hover
    const year = this.getYear();
    svg.append("line").attr("x1", x(year)).attr("x2", x(year)).attr("y1", m.t).attr("y2", height - m.b).attr("stroke", ink.text).attr("stroke-width", 1.5);
    const cross = svg.append("line").attr("y1", m.t).attr("y2", height - m.b).attr("stroke", ink.text).attr("stroke-width", 1).attr("opacity", 0);
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", width - m.l - m.r).attr("height", height - m.t - m.b).attr("fill", "transparent")
      .on("pointermove", (ev) => {
        const [px] = d3.pointer(ev);
        const yr = Math.max(2006, Math.min(2032, Math.floor(x.invert(px))));
        const d = data.find((r) => r.year === yr);
        cross.attr("x1", x(yr)).attr("x2", x(yr)).attr("opacity", 0.5);
        this.tip(ev, [h("strong", {}, String(yr)),
          ...panel.keys.map((k, i) => h("div", { class: "tt-row" }, h("span", { class: "key", style: `border-color:${panel.colors[i]}` }), `${fmt(d[k])} km ${panel.names[i]}`))]);
      })
      .on("pointerleave", () => { cross.attr("opacity", 0); this.hideTip(); })
      .on("click", (ev) => {
        const [px] = d3.pointer(ev);
        this.onYear(Math.max(2006, Math.min(2032, Math.floor(x.invert(px)))));
      });
  }

  // ---------------------------------------------------------- 2. projects
  drawProjects(theme) {
    const host = document.getElementById("chart-projects");
    const ink = CHART_INK[theme];
    const rows = this.data.projects.rows;
    const width = host.clientWidth;
    const labelW = Math.min(170, width * 0.34);
    const rowH = 26, m = { t: 8, r: 64, b: 24, l: labelW };
    const height = m.t + rows.length * rowH + m.b;
    const x = d3.scaleLinear().domain([2005, 2033]).range([m.l, width - m.r]);
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
      .attr("aria-label", "Rail projects from announcement to opening. Use the table view for dates.");
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.b})`)
      .call(d3.axisBottom(x).tickValues(d3.range(2005, 2034, 5)).tickSize(-(height - m.t - m.b)).tickFormat(""))
      .call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${height - m.b})`).call(d3.axisBottom(x).tickValues(d3.range(2005, 2034, 5)).tickFormat(d3.format("d")).tickSizeOuter(0));
    const today = this.net.asOfYear + (+this.net.asOf.slice(5, 7) - 0.5) / 12;
    svg.append("line").attr("x1", x(today)).attr("x2", x(today)).attr("y1", m.t - 4).attr("y2", height - m.b).attr("stroke", ink.accent).attr("stroke-width", 1.5);
    svg.append("text").attr("x", x(today) + 4).attr("y", height - m.b - 4).text("Today");
    const year = this.getYear();
    if (year !== this.net.asOfYear) {
      svg.append("line").attr("x1", x(year + 0.99)).attr("x2", x(year + 0.99)).attr("y1", m.t - 4).attr("y2", height - m.b).attr("stroke", ink.text).attr("stroke-width", 1).attr("stroke-dasharray", "2 3");
    }
    const lc = LINE_COLORS[theme];
    rows.forEach((r, i) => {
      const cy = m.t + i * rowH + rowH / 2;
      const g = svg.append("g").attr("tabindex", 0).attr("role", "listitem")
        .attr("aria-label", `${r.name}: announced ${Math.floor(r.announced)}${r.construction ? `, construction from ${Math.floor(r.construction)}` : ""}, ${r.opened <= today ? "opened" : "due"} ${r.openedLabel || Math.floor(r.opened)}`);
      g.append("line").attr("x1", 4).attr("x2", 16).attr("y1", cy).attr("y2", cy).attr("stroke", lc[r.line]).attr("stroke-width", 4).attr("stroke-linecap", "round");
      g.append("text").attr("x", 22).attr("y", cy + 4).text(r.name);
      const planEnd = r.construction ?? r.opened;
      g.append("line").attr("x1", x(r.announced)).attr("x2", x(planEnd)).attr("y1", cy).attr("y2", cy)
        .attr("stroke", ink.muted).attr("stroke-width", 2).attr("stroke-dasharray", "1 4").attr("stroke-linecap", "round");
      if (r.construction) {
        const end = Math.min(r.opened, Math.max(r.construction, today));
        g.append("rect").attr("x", x(r.construction)).attr("y", cy - 4).attr("width", Math.max(2, x(r.opened) - x(r.construction))).attr("height", 8)
          .attr("rx", 4).attr("fill", ink.accent).attr("opacity", 0.35);
        g.append("rect").attr("x", x(r.construction)).attr("y", cy - 4).attr("width", Math.max(2, x(end) - x(r.construction))).attr("height", 8)
          .attr("rx", 4).attr("fill", ink.accent);
      }
      const done = r.opened <= today;
      g.append("circle").attr("cx", x(r.opened)).attr("cy", cy).attr("r", 5)
        .attr("fill", done ? ink.accent : ink.surface).attr("stroke", done ? ink.surface : ink.accent).attr("stroke-width", 2);
      g.append("text").attr("x", x(r.opened) + 9).attr("y", cy + 4).text(r.openedLabel && !done ? r.openedLabel : String(Math.floor(r.opened)));
      g.append("rect").attr("x", 0).attr("y", cy - rowH / 2).attr("width", width).attr("height", rowH).attr("fill", "transparent")
        .on("pointermove", (ev) => this.tip(ev, [h("strong", {}, r.name),
          h("div", {}, `Announced ${Math.floor(r.announced)}`),
          r.construction ? h("div", {}, `Construction from ${Math.floor(r.construction)}`) : h("div", {}, "Construction start not confirmed"),
          h("div", {}, `${done ? "Opened" : "Due"} ${r.openedLabel || Math.floor(r.opened)}`)]))
        .on("pointerleave", () => this.hideTip());
    });
  }

  // --------------------------------------------------------- 3. ridership
  drawRidership(theme) {
    const host = document.getElementById("chart-ridership");
    const ink = CHART_INK[theme];
    const data = this.data.ridership.values.map(([year, v]) => ({ year, v }));
    const width = host.clientWidth, height = 210, m = { t: 22, r: 8, b: 22, l: 34 };
    const x = d3.scaleBand().domain(data.map((d) => d.year)).range([m.l, width - m.r]).padding(0.25);
    const y = d3.scaleLinear().domain([0, 320]).range([height - m.b, m.t]);
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
      .attr("aria-label", "Dubai Metro journeys per year, 2009 to 2025. Use the table view for values.");
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues([100, 200, 300]).tickSize(-(width - m.l - m.r)).tickFormat("")).call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues([0, 100, 200, 300]).tickSize(0))
      .call((g) => g.select(".domain").remove()).call((g) => g.selectAll("text").attr("dx", -4));
    svg.append("g").attr("transform", `translate(0,${height - m.b})`)
      .call(d3.axisBottom(x).tickValues(data.map((d) => d.year).filter((yv) => yv % 4 === 1)).tickSizeOuter(0));
    const bw = Math.min(24, x.bandwidth());
    const r = Math.min(4, bw / 2);
    // 4px rounded data end, square at the baseline
    const bar = (d) => {
      const x0 = x(d.year) + (x.bandwidth() - bw) / 2, y0 = y(d.v), y1 = y(0);
      return `M${x0},${y1}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y1}Z`;
    };
    svg.selectAll("path.bar").data(data).join("path").attr("class", "bar").attr("d", bar).attr("fill", ink.accent)
      .attr("tabindex", 0).attr("aria-label", (d) => `${d.year}: ${d.v} million`)
      .on("pointermove", (ev, d) => { d3.select(ev.currentTarget).attr("opacity", 0.8); this.tip(ev, [h("span", { class: "big" }, `${d.v.toFixed(1)}M`), h("div", {}, `journeys in ${d.year}`)]); })
      .on("pointerleave", (ev) => { d3.select(ev.currentTarget).attr("opacity", 1); this.hideTip(); });
    const last = data[data.length - 1];
    svg.append("text").attr("x", x(last.year) + x.bandwidth() / 2).attr("y", y(last.v) - 6).attr("text-anchor", "end").attr("class", "label-strong").text(`${last.v.toFixed(1)}M`);
    // annotate the 2020 dip above its taller neighbours, with a short leader to the bar
    const covid = data.find((d) => d.year === 2020);
    const cx = x(2020) + x.bandwidth() / 2;
    const ly = y(Math.max(...data.filter((d) => Math.abs(d.year - 2020) <= 1).map((d) => d.v))) - 12;
    svg.append("line").attr("x1", cx).attr("x2", cx).attr("y1", ly + 3).attr("y2", y(covid.v) - 3).attr("stroke", ink.text).attr("stroke-width", 1);
    svg.append("text").attr("x", cx).attr("y", ly).attr("text-anchor", "middle").text("COVID-19");
  }

  // ---------------------------------------------------------- 4. journeys
  drawJourneys(theme) {
    const host = document.getElementById("chart-journeys");
    const ink = CHART_INK[theme];
    const rows = this.data.journeys.rows;
    const width = host.clientWidth, rowH = 40, m = { t: 6, r: 30, b: 22, l: 8 };
    const height = m.t + rows.length * rowH + m.b;
    const x = d3.scaleLinear().domain([0, 180]).range([m.l, width - m.r]);
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("role", "img")
      .attr("aria-label", "Journey times by rail and by road. Use the table view for values.");
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - m.b})`)
      .call(d3.axisBottom(x).tickValues([0, 60, 120, 180]).tickSize(-(height - m.t - m.b)).tickFormat("")).call((g) => g.select(".domain").remove());
    svg.append("g").attr("transform", `translate(0,${height - m.b})`)
      .call(d3.axisBottom(x).tickValues([0, 60, 120, 180]).tickFormat((d) => (d ? `${d / 60} h` : "0")).tickSizeOuter(0));
    const lc = LINE_COLORS[theme];
    rows.forEach((r, i) => {
      const top = m.t + i * rowH;
      const cy = top + 26;
      const status = this.net.lineState(r.line, this.net.asOf);
      const g = svg.append("g").attr("tabindex", 0)
        .attr("aria-label", `${r.pair} via ${r.via}: ${r.rail} minutes by rail, ${r.car} by road`);
      g.append("line").attr("x1", m.l).attr("x2", m.l + 10).attr("y1", top + 9).attr("y2", top + 9).attr("stroke", lc[r.line]).attr("stroke-width", 3.5).attr("stroke-linecap", "round");
      const label = g.append("text").attr("x", m.l + 16).attr("y", top + 13);
      label.append("tspan").attr("class", "label-strong").text(r.pair);
      label.append("tspan").attr("dx", 8)
        .text(`${r.via}${status === "operational" ? "" : status === "construction" ? " (being built)" : " (planned)"}`);
      g.append("line").attr("x1", x(r.rail)).attr("x2", x(r.car)).attr("y1", cy).attr("y2", cy).attr("stroke", ink.muted).attr("stroke-width", 2);
      g.append("circle").attr("cx", x(r.car)).attr("cy", cy).attr("r", 5).attr("fill", ink.muted).attr("stroke", ink.surface).attr("stroke-width", 2);
      g.append("circle").attr("cx", x(r.rail)).attr("cy", cy).attr("r", 5).attr("fill", ink.accent).attr("stroke", ink.surface).attr("stroke-width", 2);
      g.append("text").attr("x", x(r.rail) - 9).attr("y", cy + 4).attr("text-anchor", "end").attr("class", "label-strong").text(`${r.rail}`);
      g.append("text").attr("x", x(r.car) + 9).attr("y", cy + 4).text(`${r.car}`);
      g.append("rect").attr("x", 0).attr("y", top).attr("width", width).attr("height", rowH).attr("fill", "transparent")
        .on("pointermove", (ev) => this.tip(ev, [h("strong", {}, `${r.pair} via ${r.via}`),
          h("div", { class: "tt-row" }, h("span", { class: "key", style: `border-color:${ink.accent}` }), `${r.rail} min by rail`),
          h("div", { class: "tt-row" }, h("span", { class: "key", style: `border-color:${ink.muted}` }), `${r.car} min by road`),
          h("div", {}, `${r.car - r.rail} min faster by rail. ${r.points}.`)]))
        .on("pointerleave", () => this.hideTip());
    });
  }

  // --------------------------------------------------------------- tables
  table(id) {
    const T = (heads, rows) => h("table", { class: "chart-table" },
      h("thead", {}, h("tr", {}, heads.map((x, i) => h("th", { scope: "col", class: i ? "num" : null }, x)))),
      h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c, i) => h("td", { class: i ? "num" : null }, c))))));
    if (id === "growth") return T(["Year", "Dubai Metro", "Trams, monorail", "Intercity", "High-speed"],
      this.growth.map((d) => [d.year, fmt(d.metro), fmt(d.light), fmt(d.intercity), fmt(d.hsr)]));
    if (id === "projects") return T(["Project", "Announced", "Construction", "Opening"],
      this.data.projects.rows.map((r) => [r.name, Math.floor(r.announced), r.construction ? Math.floor(r.construction) : "not confirmed", r.openedLabel || Math.floor(r.opened)]));
    if (id === "ridership") return T(["Year", "Journeys (million)"], this.data.ridership.values.map(([y, v]) => [y, v.toFixed(1)]));
    if (id === "journeys") return T(["Journey", "Rail (min)", "Road (min)"],
      this.data.journeys.rows.map((r) => [`${r.pair} via ${r.via}`, r.rail, r.car]));
    return h("p", {}, "");
  }
}

