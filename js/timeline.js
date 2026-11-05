// Year slider, play button, milestone captions and headline numbers.

export const MILESTONES = {
  2006: "Construction starts on the Dubai Metro and the Palm Monorail.",
  2007: "Dubai Metro viaducts rise along Sheikh Zayed Road.",
  2008: "Work begins on the Dubai Tram in Al Sufouh.",
  2009: "The Palm Monorail opens in April. The Dubai Metro Red Line opens on 9 September, the first metro on the Arabian Peninsula.",
  2010: "Red Line stations open one after another: 26 of the original 29 are in service by year end.",
  2011: "The Green Line opens and the Red Line reaches Jebel Ali. Contracts are signed for Etihad Rail stage 1.",
  2012: "The Dubai Metro carries 109 million journeys.",
  2013: "Energy station completes the original Red Line.",
  2014: "The Dubai Tram opens through Dubai Marina, and the Green Line reaches Creek.",
  2015: "The Dubai Metro carries 178 million journeys.",
  2016: "Etihad Rail's first freight trains carry sulphur from Shah and Habshan to Ruwais. Route 2020 works begin.",
  2017: "The Dubai Metro passes 200 million journeys a year. Al Ittihad Park station opens on the monorail.",
  2018: "The Dubai Metro carries 204 million journeys.",
  2019: "Palm Jumeirah Mall station opens on the monorail.",
  2020: "Route 2020 is inaugurated, while COVID-19 cuts metro journeys by 44%.",
  2021: "Route 2020 opens to Expo 2020 Dubai. Etihad Rail stage 2 track laying is well under way.",
  2022: "The UAE and Oman agree to build the Abu Dhabi to Sohar railway, later named Hafeet Rail.",
  2023: "Etihad Rail's 900 km network is complete from Ghuwaifat to Fujairah. The Blue Line is announced.",
  2024: "A 350 km/h Abu Dhabi to Dubai line is announced, the Blue Line contract is awarded, and Hafeet Rail moves into construction.",
  2025: "The Blue Line's foundation stone is laid. The Dubai Metro carries a record 294.7 million journeys.",
  2026: "Etihad Rail passenger trains link Abu Dhabi, Dubai and Fujairah, with Al Dhafra stations from 30 November. The Gold Line is approved.",
  2027: "Sharjah's Etihad Rail station is due in March. Hafeet Rail trial operations are expected late in the year.",
  2028: "Blue Line construction continues towards a September 2029 opening.",
  2029: "The Blue Line is due on 9 September 2029, the metro's 20th anniversary.",
  2030: "The Abu Dhabi to Dubai high-speed line and the Abu Dhabi Tram are expected.",
  2031: "The Gold Line is due the following year.",
  2032: "The Gold Line is due on 9 September 2032: 42 km underground from Al Ghubaiba to Jumeirah Golf Estates.",
};
// years with an opening, marked on the track
const OPENINGS = [2009, 2010, 2011, 2014, 2016, 2021, 2023, 2026, 2027, 2029, 2030, 2032];

export class Timeline {
  constructor({ min, max, today, onChange }) {
    this.min = min;
    this.max = max;
    this.today = today;
    this.onChange = onChange;
    this.input = document.getElementById("year");
    this.playBtn = document.getElementById("play");
    this.label = document.getElementById("year-label");
    this.tag = document.getElementById("year-tag");
    this.caption = document.getElementById("milestone");
    this.stats = { km: document.getElementById("stat-km"), stations: document.getElementById("stat-stations"), building: document.getElementById("stat-building") };
    this.shown = { km: 0, stations: 0, building: 0 };
    this.timer = null;
    this.input.min = min;
    this.input.max = max;
    this.input.value = today;
    this.drawTicks();
    this.input.addEventListener("input", () => this.set(+this.input.value, true));
    this.playBtn.addEventListener("click", () => (this.timer ? this.pause() : this.play()));
  }

  drawTicks() {
    const host = document.getElementById("tl-ticks");
    const pct = (y) => `${((y - this.min) / (this.max - this.min)) * 100}%`;
    host.innerHTML = "";
    const add = (cls, y, text) => {
      const el = document.createElement("div");
      el.className = cls;
      el.style.left = pct(y);
      if (text) el.textContent = text;
      host.appendChild(el);
      return el;
    };
    add("rail", this.min);
    this.past = add("past", this.min);
    this.past.style.left = "0";
    for (const y of OPENINGS) add("m", y);
    add("today", this.today);
    for (let y = this.min; y <= this.max; y += 1) {
      // every 4th year; on narrow screens only every 8th (see CSS)
      if ((y - 2006) % 4 === 0) add((y - 2006) % 8 === 0 ? "t major" : "t", y, String(y));
      else if (y === this.max) add("t end", y, String(y));
    }
  }

  set(year, fromUser = false) {
    this.year = year;
    this.input.value = year;
    this.input.setAttribute("aria-valuetext", year === this.today ? `${year}, today` : String(year));
    this.label.textContent = year;
    this.tag.textContent = year === this.today ? "Today" : year < this.today ? "History" : "Planned";
    this.caption.textContent = MILESTONES[year] || "";
    this.past.style.width = `${((year - this.min) / (this.max - this.min)) * 100}%`;
    if (fromUser) this.pause();
    this.onChange(year);
  }

  setStats({ km, stations, building }) {
    const fmt = (n) => Math.round(n).toLocaleString("en-US");
    const target = { km, stations, building };
    const from = { ...this.shown };
    const start = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(this.statsRaf);
    const step = (t) => {
      const f = reduce ? 1 : Math.min(1, (t - start) / 450);
      const e = 1 - (1 - f) ** 3;
      for (const k of Object.keys(target)) this.shown[k] = from[k] + (target[k] - from[k]) * e;
      this.stats.km.textContent = `${fmt(this.shown.km)} km`;
      this.stats.stations.textContent = fmt(this.shown.stations);
      this.stats.building.textContent = `${fmt(this.shown.building)} km`;
      if (f < 1) this.statsRaf = requestAnimationFrame(step);
    };
    this.statsRaf = requestAnimationFrame(step);
  }

  play() {
    // from the default "today" view (or the end), play the whole story from the start
    if (this.year >= this.max || (this.year === this.today && !this.played)) this.set(this.min);
    this.played = true;
    this.playBtn.classList.add("playing");
    this.playBtn.setAttribute("aria-label", "Pause");
    const tick = () => {
      if (this.year >= this.max) return this.pause();
      this.set(this.year + 1);
      // linger on today and on the final year
      this.timer = setTimeout(tick, this.year === this.today ? 2200 : 1100);
    };
    this.timer = setTimeout(tick, 500);
  }

  pause() {
    clearTimeout(this.timer);
    this.timer = null;
    this.playBtn.classList.remove("playing");
    this.playBtn.setAttribute("aria-label", "Play the network's growth from 2006 to 2032");
  }
}
