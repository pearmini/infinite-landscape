import * as d3 from "d3";
import {randomNoise} from "./noise.js";
import {applyGradient} from "./gradient.js";
import {tree} from "./tree.js";
import namesData from "./names.json";
import {THEME} from "./theme.js";

const COLORS = {
  background: (d) => ({
    angle: 90,
    stops: [
      {offset: "0%", color: THEME.sky},
      {offset: "30%", color: THEME.background},
      {offset: "100%", color: THEME.background},
    ],
  }),
  mountains: (d) => ({
    angle: d.angle,
    stops: [
      {offset: "0%", color: THEME.mountain1},
      {offset: `${d.stop1}%`, color: THEME.mountain2},
      {offset: `${d.stop2}%`, color: THEME.mountain3},
      {offset: "100%", color: THEME.background},
    ],
  }),
};

function random(seed) {
  return d3.randomLcg(seed)();
}

function interpolate(a, b, t) {
  return a + (b - a) * t;
}

function subdivideMountain(points, depth, maxDepth, roughness, noiseDis, noiseMid) {
  if (depth >= maxDepth) return points;
  const newPoints = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const t = noiseMid((p1.x + p2.x) / 2);
    const midX = interpolate(p1.x, p2.x, t);
    const midY = interpolate(p1.y, p2.y, t);
    const displacement = roughness * noiseDis(midX) * Math.pow(0.6, depth);
    const newY = midY - displacement;
    newPoints.push({x: midX, y: newY});
    newPoints.push(p2);
  }
  return subdivideMountain(newPoints, depth + 1, maxDepth, roughness, noiseDis, noiseMid);
}

function generateMountains({
  height,
  startX,
  endX,
  seed,
  baselineY = 0,
  width = height * 10,
  minWidth = 1 / 8,
  maxWidth = 1 / 2,
  offsetY = 1,
  paddingX = 3 / 4,
}) {
  const seedHeight = seed;
  const seedDy = random(seedHeight) * 1500;
  const seedWidth = random(seedDy) * 100;
  const seedDetail = random(seedWidth) * 200;
  const noiseH = randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = randomNoise(width * minWidth, width * maxWidth, {seed: seedWidth});
  const noiseDy = randomNoise(-height, height, {seed: seedDy});
  const noiseStop1 = randomNoise(10, 30, {seed: seedDy});
  const noiseStop2 = randomNoise(70, 90, {seed: seedDy});
  const noiseDetail = randomNoise(0, height / 6, {seed: seedDetail, octaves: 6, falloff: 0.4});
  const noiseRoughness = randomNoise(0.2, 0.3, {seed: seedDetail, octaves: 6, falloff: 0.4});
  const noiseMidPoint = randomNoise(0, 1, {seed: seedDetail, octaves: 6, falloff: 0.4});
  const noiseGap = randomNoise(0, 1, {seed: seedDetail * 100, octaves: 6, falloff: 0.4});

  const primitives = [];

  function mountain(px, direction) {
    const addGap = 0.5 < noiseGap(px);
    const w = noiseW(px);
    const x = px - random(px) * w * paddingX * direction + direction * addGap * 200 + w * Math.min(0, direction);
    const y = Math.max(0, height * 0.5 + noiseDy(x) * offsetY) + baselineY;
    const h = noiseH(x + w / 2);
    const stop1 = noiseStop1(px);
    const stop2 = noiseStop2(px);
    const t = noiseMidPoint(x + w / 2);
    const basePoints = [
      {x, y},
      {x: x + w * t, y: y - h},
      {x: x + w, y},
    ];
    const depthFromWidth = Math.floor(Math.log2(Math.max(w / 15, 1)));
    const depthFromHeight = h > height / 10 ? 1 : 0;
    const maxDepth = Math.max(2, Math.min(3, depthFromWidth + depthFromHeight));
    const roughness = h * noiseRoughness(px);
    const points = subdivideMountain(basePoints, 0, maxDepth, roughness, noiseDetail, noiseMidPoint);
    return {
      points,
      stop1,
      stop2,
      x,
      y,
      x2: x + w,
      y2: y,
    };
  }

  let px = 0;
  while (px < endX) {
    const m = mountain(px, 1);
    primitives.push(m);
    px = m.x2;
  }

  px = 0;
  while (startX < px) {
    const m = mountain(px, -1);
    primitives.push(m);
    px = m.x;
  }

  return primitives.sort((a, b) => Math.max(a.y, a.y2) - Math.max(b.y, b.y2));
}

function findYOnMountain(x, mountains) {
  // Find the mountain that contains this X coordinate.
  for (const mountain of mountains) {
    const minX = Math.min(mountain.x, mountain.x2);
    const maxX = Math.max(mountain.x, mountain.x2);

    if (x >= minX && x <= maxX) {
      // Find the two points that bracket this X coordinate.
      const points = mountain.points;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        const minPX = Math.min(p1.x, p2.x);
        const maxPX = Math.max(p1.x, p2.x);

        if (x >= minPX && x <= maxPX && Math.abs(p2.x - p1.x) > 0.001) {
          // Linear interpolation between the two points.
          const t = (x - p1.x) / (p2.x - p1.x);
          const y = interpolate(p1.y, p2.y, t);
          // Ensure Y is valid (not negative or NaN)
          if (y >= 0 && !isNaN(y) && isFinite(y)) {
            return y;
          }
        }
      }
      // If x is exactly at the edge, return the Y at that edge.
      if (Math.abs(x - mountain.x) < 0.001) {
        const y = mountain.y;
        if (y >= 0 && !isNaN(y) && isFinite(y)) return y;
      }
      if (Math.abs(x - mountain.x2) < 0.001) {
        const y = mountain.y2;
        if (y >= 0 && !isNaN(y) && isFinite(y)) return y;
      }
    }
  }
  return null;
}

function generateTrees({startX, endX, seed, height, mountains}) {
  const spacing = 350;
  const trees = [];
  const randomName = (x) => random(x * 1000) * namesData.length;
  const noiseSpacing = randomNoise(0, 1.2, {seed, octaves: 1, falloff: 0.5});

  const dy = 40;

  // Fixed Y range for trees for consistent y position.
  const minY = 420;
  const maxY = 640;
  const scaleWidth = d3.scaleSqrt().domain([minY, maxY]).range([200, 400]);

  function addTree(x) {
    const px = x + spacing * noiseSpacing(x);
    const y = findYOnMountain(px, mountains);
    if (y !== null && y >= 0) {
      const nameIndex = Math.floor(randomName(x));
      const name = namesData[nameIndex].name;
      const py = Math.min(height - 20, y + dy);
      const treeWidth = scaleWidth(py);
      trees.push({x: px, y: py, width: treeWidth, name, id: `tree-${Math.floor(px / 100)}-${nameIndex}`});
    }
  }

  let px;
  for (px = 0; px < endX; px += spacing) addTree(px);
  for (px = -spacing; px > startX; px -= spacing) addTree(px);

  return trees;
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

  const line = d3
    .line()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveBundle);

  const svg = d3
    .create("svg:svg")
    .attr("id", "landscape-svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `${currentX} 0 ${width} ${height}`)
    .style("cursor", "grab");

  svg.append("defs").attr("id", "gradient-defs");

  const transformGroup = svg.append("g").attr("class", "transform-group");

  // This is for get the actual width of the background rect.
  const bgRect = transformGroup
    .append("rect")
    .attr("id", "bg-rect")
    .attr("x", startX)
    .attr("width", endX - startX)
    .attr("height", height)
    .each(function () {
      applyGradient(this, COLORS.background(), svg.node());
    });

  const mountainsGroup = transformGroup.append("g").attr("class", "mountains-group");

  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.15, 1])
    .on("zoom", (event) => {
      const {x, k} = event.transform;
      state.scaleX = k;
      state.translateX = x;
      maybeLoad();
      update();
    });

  svg.call(zoomBehavior);

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

  const treesGroup = transformGroup.append("g").attr("class", "trees-group");

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
    const farMountains = generateMountains({
      startX,
      endX,
      seed,
      height: height / 4,
      baselineY: height * 0.5,
    });

    const closeMountains = generateMountains({
      startX,
      endX,
      seed: seed * 1000,
      offsetY: 0,
      minWidth: 1 / 2,
      maxWidth: 1.5,
      height: height / 5,
      baselineY: height - height / 10,
    });

    const mountains = [...farMountains, ...closeMountains];

    const trees = generateTrees({startX, endX, seed, height, mountains: closeMountains});

    const scaledHeight = height * scaleX;

    svg.attr("viewBox", `${currentX + offsetX} 0 ${width} ${scaledHeight}`).attr("height", scaledHeight);

    transformGroup.attr("transform", `translate(${translateX}, 0) scale(${scaleX})`);

    bgRect
      .attr("x", startX)
      .attr("width", endX - startX)
      .attr("height", height);

    const mountainsPaths = mountainsGroup
      .selectAll("path")
      .data(mountains, (d, i) => `${d.x}-${d.y}-${d.points.length}-${i}`);

    mountainsPaths
      .enter()
      .append("path")
      .merge(mountainsPaths)
      .attr("d", (d) => line(d.points))
      .attr("stroke", "#000")
      .each(function (d) {
        applyGradient(this, COLORS.mountains(d), svg.node());
      });

    mountainsPaths.exit().remove();

    // Update trees
    const treeGroups = treesGroup.selectAll("g.tree-group").data(trees, (d) => d.id);

    treeGroups
      .enter()
      .append("g")
      .attr("class", "tree-group")
      .each(function (d) {
        const treeSvg = tree(d.name, {
          padding: 0,
          number: false,
          line: false,
          end: false,
          width: d.width,
          strokeWidth: 1,
        }).render();
        d3.select(this).append(() => treeSvg);
      })
      .merge(treeGroups)
      .attr("transform", (d) => {
        // Tree baseline is at height * 0.618 + initLen within the SVG
        // initLen = (140/480) * width, and height = width
        // So baseline offset = width * 0.618 + width * 0.292 = width * 0.91
        const offset = d.width * 0.91;
        return `translate(${d.x - d.width / 2}, ${d.y - offset})`;
      });

    treeGroups.exit().remove();
  }

  return svg.node();
}
