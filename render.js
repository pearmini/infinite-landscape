import {randomLcg} from "d3-random";
import {cm} from "./namspaces.js";

function random(seed) {
  return randomLcg(seed)();
}

function calculateGradientPoints(angle) {
  const rad = (angle * Math.PI) / 180;
  const cx = 0.5;
  const cy = 0.5;
  const dx = Math.cos(rad) * 0.5;
  const dy = Math.sin(rad) * 0.5;

  const x1 = (cx - dx) * 100;
  const y1 = (cy - dy) * 100;
  const x2 = (cx + dx) * 100;
  const y2 = (cy + dy) * 100;

  return {x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%`};
}

function generate({height, startX, endX, seed, minWidth = 1 / 8, maxWidth = 1 / 2, offsetY = 1, paddingX = 3 / 4}) {
  const w = (height / 6) * 10;
  const seedHeight = seed;
  const seedDy = random(seedHeight) * 1500;
  const seedWidth = random(seedDy) * 100;
  const noiseH = cm.randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = cm.randomNoise(w * minWidth, w * maxWidth, {seed: seedWidth});
  const noiseDy = cm.randomNoise(-height / 5, height / 5, {seed: seedDy});
  const noiseAngle = cm.randomNoise(0, 180, {seed: seedDy});
  const noiseStop1 = cm.randomNoise(10, 30, {seed: seedDy});
  const noiseStop2 = cm.randomNoise(80, 90, {seed: seedDy});

  const primitives = [];

  let px = 0;
  while (px < endX) {
    const gap = random(px);
    const addGap = gap < 0.18;
    const w = noiseW(px);
    const angle = noiseAngle(px);
    const x = px - random(px) * w * paddingX + addGap * 200;
    const y = Math.max(height / 2 + 10, (height / 8) * 5 + noiseDy(x) * offsetY);
    const h = noiseH(x + w / 2);
    const stop1 = noiseStop1(px);
    const stop2 = noiseStop2(px);
    px = x + w;
    primitives.push({x, y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y, angle, stop1, stop2});
  }

  px = 0;
  while (startX < px) {
    const gap = random(px);
    const addGap = gap < 0.18;
    const w = noiseW(px);
    const angle = noiseAngle(px);
    const x = px - w + random(px) * w * paddingX - addGap * 200;
    const y = Math.max(height / 2 + 10, (height / 8) * 5 + noiseDy(x) * offsetY);
    const h = noiseH(x + w / 2);
    const stop1 = noiseStop1(px);
    const stop2 = noiseStop2(px);
    px = x;
    primitives.push({x, y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y, angle, stop1, stop2});
  }

  return primitives.sort((a, b) => Math.max(a.y, a.y2) - Math.max(b.y, b.y2));
}

function gradientPath(data, {transform = "", key}) {
  return [
    cm.svg("defs", {
      children: [
        cm.svg("linearGradient", data, {
          id: (_, i) => `${key}-gradient-${i}`,
          attrs: (d) => calculateGradientPoints(d.angle),
          children: [
            () => cm.svg("stop", {offset: "0%", stopColor: "#34619E"}),
            (d) => cm.svg("stop", {offset: `${d.stop1}%`, stopColor: "#34619E"}),
            (d) => cm.svg("stop", {offset: `${d.stop2}%`, stopColor: "#8DC181"}),
            () => cm.svg("stop", {offset: "100%", stopColor: "#ECCC75"}),
          ],
        }),
      ],
    }),
    cm.svg("g", {
      transform,
      children: [
        cm.svg("path", data, {
          d: ({x, y, x1, y1, x2, y2}) => `M${x},${y}L${x1},${y1}L${x2},${y2}Z`,
          fill: (_, i) => `url(#${key}-gradient-${i})`,
          stroke: "#000",
        }),
      ],
    }),
  ];
}

export function render({
  width = 1000,
  height = 600,
  currentX = 0,
  startX = currentX - width,
  endX = currentX + width * 2,
  translateX = 0,
  scaleX = 1,
  seed = 10000,
} = {}) {
  const state = cm.state({startX, endX, translateX, scaleX, currentX, offsetX: 0, x0: 0});
  const rectRef = cm.ref();

  const drag = {
    type: cm.drag,
    onDragStart: ({x}) => ((state.x0 = x), maybeLoad()),
    onDrag: ({x}) => (state.offsetX = state.x0 - x),
    onDragEnd: ({x}) => ((state.offsetX = 0), (state.currentX += state.x0 - x)),
  };

  const zoom = {
    type: cm.zoom,
    scaleExtent: [0.15, 1],
    onZoom: ({transform}) => {
      const {x, k} = transform;
      state.scaleX = k;
      state.translateX = x;
      maybeLoad();
    },
  };

  function maybeLoad() {
    const rect = rectRef.current.nodes()[0];
    const {x: rx, width: rw} = rect.getBoundingClientRect();
    if (-width < rx) state.startX -= width / state.scaleX;
    if (rx + rw < width * 2) state.endX += width / state.scaleX;
  }

  function draw() {
    const {startX, endX, currentX, translateX, offsetX, scaleX} = state;
    const common = {height, startX, endX, seed};
    const mountains = generate(common);
    const plains = generate({...common, offsetY: 0, minWidth: 1 / 2, maxWidth: 1.5, height: height / 2});
    const scaledHeight = height * scaleX;
    return cm.svg("svg", {
      width,
      height: scaledHeight,
      viewBox: [currentX + offsetX, 0, width, scaledHeight],
      cursor: "grab",
      decorators: [drag, zoom],
      children: [
        cm.svg("g", {
          transform: `translate(${translateX}, 0) scale(${scaleX})`,
          children: [
            cm.svg("linearGradient", {
              id: "background",
              x1: "50%",
              y1: "0%",
              x2: "50%",
              y2: "100%",
              children: [
                cm.svg("stop", {offset: "0%", stopColor: "#F6D87B"}),
                cm.svg("stop", {offset: "100%", stopColor: "#ECCC75"}),
              ],
            }),
            cm.svg("rect", {
              ref: rectRef,
              x: startX,
              width: endX - startX,
              height,
              fill: "url(#background)",
            }),
            gradientPath(mountains, {key: "mountains"}),
            gradientPath(plains, {key: "plains", transform: `translate(0, ${height - height / 4})`}),
          ],
        }),
      ],
    });
  }

  return cm.app({draw}).render();
}
