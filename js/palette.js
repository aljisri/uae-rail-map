// Colours for both themes.
//
// Line colours keep each line's familiar hue (Dubai Metro red, green, blue, gold) but their
// lightness and chroma were searched with the dataviz palette validator so that every pair of
// lines that meet on the map stays apart under protanopia and deuteranopia (CVD ΔE ≥ 8 for
// lines that share stations, ≥ 6 where line style also differs) and for normal vision
// (ΔE ≥ 15), with ≥ 3:1 contrast on the basemap. Both trams share one colour: they are 120 km
// apart and the shared colour reads as "tram".

export const LINE_COLORS = {
  dark: {
    red: "#d7272c", green: "#23ac6a", blue: "#218dfd", gold: "#b78a16",
    tram: "#29a895", adtram: "#29a895", monorail: "#966bff",
    etihad: "#ece8df", freight: "#78818e", hsr: "#cf5ad7", hafeet: "#e36927",
  },
  light: {
    red: "#c5002b", green: "#439767", blue: "#006eee", gold: "#b47b06",
    tram: "#049886", adtram: "#049886", monorail: "#512ec0",
    etihad: "#23272d", freight: "#8a8376", hsr: "#d24ec1", hafeet: "#cd5400",
  },
};

export const MAP_COLORS = {
  dark: {
    land: "#171c23", water: "#070a0e", urban: "#1c222a", park: "#18221e", sand: "#191d23",
    aeroway: "#1f252e", motorway: "#323a45", major: "#272e37", minor: "#20262e",
    boundary: "#566070", boundaryState: "#3a424e",
    label: "#8d96a3", labelStrong: "#d2d6dc", halo: "#171c23", waterLabel: "#3d5872",
    station: "#171c23", ink: "#f0efec", glow: 0.45, dim: "#3a414b",
  },
  light: {
    land: "#f3f1ec", water: "#c6d4e1", urban: "#ebe8e1", park: "#e2e8da", sand: "#efe9dc",
    aeroway: "#e6e3dc", motorway: "#ffffff", major: "#fbfaf6", minor: "#f8f6f1",
    boundary: "#a39b8e", boundaryState: "#c4bdb1",
    label: "#6f685c", labelStrong: "#2f2b25", halo: "#f3f1ec", waterLabel: "#5f7891",
    station: "#ffffff", ink: "#1a1a1a", glow: 0, dim: "#cbc6bc",
  },
};

// Travel-time buckets (minutes) and an ordinal one-hue ramp, nearest first.
// Nearest is the most prominent step in each theme: dark ink on light, bright on dark.
export const TIME_BUCKETS = [15, 30, 60, 120, Infinity];
export const TIME_LABELS = ["≤ 15 min", "≤ 30", "≤ 1 h", "≤ 2 h", "2 h +"];
// Validated with validate_palette.js --ordinal: monotone, ΔL ≥ 0.06 between steps,
// far end still ≥ 2:1 on the basemap.
export const TIME_RAMP = {
  light: ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec"],
  dark: ["#cde2fb", "#86b6ef", "#3987e5", "#256abf", "#184f95"],
};

// Chart series (reference categorical palette, slots 1-4, validated adjacent in both modes).
export const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500"],
};
export const CHART_INK = {
  light: { muted: "#b9b6ad", accent: "#2a78d6", text: "#52514e", surface: "#fcfcfb", onAccent: "#ffffff", onMuted: "#0b0b0b" },
  dark: { muted: "#5f5e58", accent: "#3987e5", text: "#c3c2b7", surface: "#161a20", onAccent: "#ffffff", onMuted: "#f0efec" },
};

export function bucketOf(minutes) {
  return TIME_BUCKETS.findIndex((b) => minutes <= b);
}
