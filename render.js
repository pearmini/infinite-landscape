import {randomLcg} from "d3-random";
import {cm} from "./namspaces.js";

function random(seed) {
  return randomLcg(seed)();
}

function generate({height, startX, endX, seed, minWidth = 1 / 8, maxWidth = 1 / 2, offsetY = 1, paddingX = 3 / 4}) {
  const w = (height / 6) * 10;
  const seedHeight = seed;
  const seedDy = random(seedHeight) * 1500;
  const seedWidth = random(seedDy) * 100;
  const noiseH = cm.randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = cm.randomNoise(w * minWidth, w * maxWidth, {seed: seedWidth});
  const noiseDy = cm.randomNoise(-height / 5, height / 5, {seed: seedDy});

  const primitives = [];

  let px = 0;
  while (px < endX) {
    const gap = random(px);
    const addGap = gap < 0.18;
    const w = noiseW(px);
    const x = px - random(px) * w * paddingX + addGap * 200;
    const y = Math.max(height / 2 + 10, (height / 8) * 5 + noiseDy(x) * offsetY);
    const h = noiseH(x + w / 2);
    px = x + w;
    primitives.push({x: x, y: y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y});
  }

  px = 0;
  while (startX < px) {
    const gap = random(px);
    const addGap = gap < 0.18;
    const w = noiseW(px);
    const x = px - w + random(px) * w * paddingX - addGap * 200;
    const y = Math.max(height / 2 + 10, (height / 8) * 5 + noiseDy(x) * offsetY);
    const h = noiseH(x + w / 2);
    px = x;
    primitives.push({x: x, y: y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y});
  }

  return primitives.sort((a, b) => Math.max(a.y, a.y2) - Math.max(b.y, b.y2));
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
            cm.svg("rect", {
              ref: rectRef,
              x: startX,
              width: endX - startX,
              height,
              fill: "#eee",
            }),
            cm.svg("line", {
              x1: startX,
              y1: height / 2,
              x2: endX,
              y2: height / 2,
              stroke: "#000",
            }),
            cm.svg("path", mountains, {
              d: ({x, y, x1, y1, x2, y2}) => `M${x},${y}L${x1},${y1}L${x2},${y2}Z`,
              fill: "#ccc",
              stroke: "#000",
            }),
            cm.svg("g", {
              transform: `translate(0, ${height - height / 4})`,
              children: [
                cm.svg("path", plains, {
                  d: ({x, y, x1, y1, x2, y2}) => `M${x},${y}L${x1},${y1}L${x2},${y2}Z`,
                  fill: "#ccc",
                  stroke: "#000",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  return cm.app({draw}).render();
}
