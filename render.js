import {cm, d3} from "./namespaces.js";

function random(seed) {
  return d3.randomLcg(seed)();
}

function throttle(callback, delay = 20) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return callback(...args);
  };
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

function Mountains({data, transform = "translate(0,0)"}) {
  return cm.svg("g", {
    transform,
    stroke: "#000",
    fill: "#ddd",
    children: [
      cm.svg("path", data, {
        d: (d) => `M${d.x},${d.y}L${d.x1},${d.y1}L${d.x2},${d.y2}Z`,
      }),
    ],
  });
}

function Background({x, width, height}) {
  return cm.svg("rect", {
    id: "bg-rect",
    x,
    width,
    height,
    fill: "#eee",
  });
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
  const state = cm.state({startX, endX, translateX, scaleX, currentX, width});
  const id = Math.random().toString(36).substring(2, 7);
  const zoom = d3.zoom();

  setInterval(update, 20);

  // throttle makes sure the bg-rect rerender before the next maybeLoad.
  const maybeLoad = throttle(() => {
    const rect = document.getElementById("bg-rect");
    const {width} = state;
    const {x: rx, width: rw} = rect.getBoundingClientRect();
    const scaledWidth = width / state.scaleX;
    if (-width < rx) state.startX -= scaledWidth;
    if (-width * 2 > rx) state.startX += scaledWidth;
    if (rx + rw < width * 2) state.endX += scaledWidth;
    if (rx + rw > width * 3) state.endX -= scaledWidth;
  });

  function update() {
    const scaleX = +(localStorage.getItem("scaleX") ?? state.scaleX);
    const translateX = +(localStorage.getItem("translateX") ?? state.translateX);
    const landscapes = JSON.parse(localStorage.getItem("landscapes") ?? "{}");

    for (const [key, value] of Object.entries(landscapes)) {
      const {lastTime} = value;
      if (lastTime < Date.now() - 200) delete landscapes[key];
    }

    const landscape = landscapes[id] ?? {};
    landscapes[id] = landscape;

    Object.assign(landscape, {
      lastTime: Date.now(),
      screenX: window.screenX,
      screenY: window.screenY,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    });

    const sorted = d3.sort(Object.values(landscapes), (d) => d.screenX);

    let cx = 0;
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      current.currentX = cx;
      if (next) cx += next.screenX - current.screenX;
    }

    if (zoom && scaleX !== state.scaleX && translateX !== state.translateX) {
      const svg = document.getElementById("landscape");
      d3.select(svg).call(zoom.transform, d3.zoomIdentity.translate(translateX, 0).scale(scaleX));
    }

    state.currentX = landscape.currentX;
    state.width = landscape.screenWidth;
    state.scaleX = scaleX;
    state.translateX = translateX;

    localStorage.setItem("landscapes", JSON.stringify(landscapes));

    maybeLoad();
  }

  function Landscape() {
    console.log("Rendering landscape");

    const {startX, endX, currentX, translateX, scaleX, width} = state;
    const scaledHeight = height * scaleX;
    const common = {height, startX, endX, seed};

    const background = {x: startX, width: endX - startX, height};
    const mountains = generate(common);
    const plains = generate({...common, offsetY: 0, minWidth: 1 / 2, maxWidth: 1.5, height: height / 2});

    return cm.svg("svg", {
      width,
      id: "landscape",
      height: scaledHeight,
      viewBox: [currentX, 0, width, scaledHeight],
      cursor: "grab",
      zoom: {
        instance: zoom,
        scaleExtent: [0.15, 1],
        onZoom: ({transform}) => {
          const {x, k} = transform;
          state.scaleX = k;
          state.translateX = x;
          localStorage.setItem("scaleX", k);
          localStorage.setItem("translateX", x);
          maybeLoad();
        },
      },
      children: [
        cm.svg("g", {
          transform: `translate(${translateX}, 0) scale(${scaleX})`,
          children: [
            Background(background),
            Mountains({data: mountains}),
            Mountains({data: plains, transform: `translate(0, ${height - height / 4})`}),
          ],
        }),
      ],
    });
  }

  const root = cm.html("div", {
    children: Landscape,
    use: {zoom: cm.zoom},
  });

  return root.render();
}
