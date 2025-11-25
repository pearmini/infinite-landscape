import * as d3 from "d3";
import {randomNoise} from "./noise.js";
import {applyGradient} from "./gradient.js";
import {tree} from "./tree.js";

function random(seed) {
  return d3.randomLcg(seed)();
}

function generate({height, startX, endX, seed, minWidth = 1 / 8, maxWidth = 1 / 2, offsetY = 1, paddingX = 3 / 4}) {
  const w = (height / 6) * 10;
  const seedHeight = seed;
  const seedDy = random(seedHeight) * 1500;
  const seedWidth = random(seedDy) * 100;
  const noiseH = randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = randomNoise(w * minWidth, w * maxWidth, {seed: seedWidth});
  const noiseDy = randomNoise(-height / 5, height / 5, {seed: seedDy});
  const noiseAngle = randomNoise(0, 180, {seed: seedDy});
  const noiseStop1 = randomNoise(10, 30, {seed: seedDy});
  const noiseStop2 = randomNoise(80, 90, {seed: seedDy});

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
  const state = {startX, endX, translateX, scaleX, currentX, offsetX: 0, x0: 0};

  const svg = d3
    .create("svg:svg")
    .attr("id", "landscape-svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `${currentX} 0 ${width} ${height}`)
    .style("cursor", "grab");

  // Create defs for gradients
  svg.append("defs").attr("id", "gradient-defs");

  // Create transform group
  const transformGroup = svg.append("g").attr("class", "transform-group");

  // Background rect
  const bgRect = transformGroup
    .append("rect")
    .attr("id", "bg-rect")
    .attr("x", startX)
    .attr("width", endX - startX)
    .attr("height", height)
    .each(function () {
      applyGradient(
        this,
        {
          angle: 90,
          stops: [
            {offset: "0%", color: "#F6D87B"},
            {offset: "100%", color: "#ECCC75"},
          ],
        },
        svg.node()
      );
    });

  // Mountains group
  transformGroup.append("g").attr("class", "mountains-group");

  // Plains group
  transformGroup.append("g").attr("class", "plains-group");

  // Setup zoom - apply to SVG, extract transform values and handle manually
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.15, 1])
    .on("zoom", (event) => {
      const {x, k} = event.transform;
      state.scaleX = k;
      state.translateX = x;
      maybeLoad();
      update();
      // Clear d3's transform since we handle it manually in update()
      svg.attr("transform", null);
    });

  svg.call(zoomBehavior);

  // Setup drag
  const dragBehavior = d3
    .drag()
    .on("start", (event) => {
      state.x0 = event.x;
      maybeLoad();
    })
    .on("drag", (event) => {
      state.offsetX = state.x0 - event.x;
      update();
    })
    .on("end", (event) => {
      state.offsetX = 0;
      state.currentX += state.x0 - event.x;
      update();
    });

  svg.call(dragBehavior);

  const treeSvg = tree("Bairui SU", {padding: 0, number: false, line: false, end: false}).render();

  transformGroup.append("g").append(() => treeSvg);

  // Initial render
  update();

  function maybeLoad() {
    const rect = bgRect.node();
    if (!rect) return;
    const {x: rx, width: rw} = rect.getBoundingClientRect();
    if (-width < rx) state.startX -= width / state.scaleX;
    if (rx + rw < width * 2) state.endX += width / state.scaleX;
  }

  function update() {
    const {startX, endX, currentX, translateX, offsetX, scaleX} = state;
    const common = {height, startX, endX, seed};
    const mountains = generate(common);
    const plains = generate({...common, offsetY: 0, minWidth: 1 / 2, maxWidth: 1.5, height: height / 2});
    const scaledHeight = height * scaleX;

    // Update viewBox
    svg.attr("viewBox", `${currentX + offsetX} 0 ${width} ${scaledHeight}`).attr("height", scaledHeight);

    // Update transform group
    const transformGroup = svg.select("g.transform-group");
    transformGroup.attr("transform", `translate(${translateX}, 0) scale(${scaleX})`);

    // Update background rect
    bgRect
      .attr("x", startX)
      .attr("width", endX - startX)
      .attr("height", height);

    // Update mountains
    const mountainsGroup = svg.select("g.mountains-group");
    const mountainsPaths = mountainsGroup.selectAll("path").data(mountains, (d, i) => `${d.x}-${d.y}-${i}`);

    mountainsPaths
      .enter()
      .append("path")
      .merge(mountainsPaths)
      .attr("d", (d) => `M${d.x},${d.y}L${d.x1},${d.y1}L${d.x2},${d.y2}Z`)
      .attr("stroke", "#000")
      .each(function (d) {
        applyGradient(
          this,
          {
            angle: d.angle,
            stops: [
              {offset: "0%", color: "#34619E"},
              {offset: `${d.stop1}%`, color: "#34619E"},
              {offset: `${d.stop2}%`, color: "#8DC181"},
              {offset: "100%", color: "#ECCC75"},
            ],
          },
          svg.node()
        );
      });

    mountainsPaths.exit().remove();

    // Update plains
    const plainsGroup = svg.select("g.plains-group");
    const plainsPaths = plainsGroup.selectAll("path").data(plains, (d, i) => `${d.x}-${d.y}-${i}`);

    plainsPaths
      .enter()
      .append("path")
      .merge(plainsPaths)
      .attr("d", (d) => `M${d.x},${d.y}L${d.x1},${d.y1}L${d.x2},${d.y2}Z`)
      .attr("stroke", "#000")
      .attr("transform", `translate(0, ${height - height / 4})`)
      .each(function (d) {
        applyGradient(
          this,
          {
            angle: d.angle,
            stops: [
              {offset: "0%", color: "#34619E"},
              {offset: `${d.stop1}%`, color: "#34619E"},
              {offset: `${d.stop2}%`, color: "#8DC181"},
              {offset: "100%", color: "#ECCC75"},
            ],
          },
          svg.node()
        );
      });

    plainsPaths.exit().remove();
  }

  return svg.node();
}
