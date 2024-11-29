import {randomNoise} from "./noise.js";
import {create} from "d3-selection";
import {randomLcg} from "d3-random";
import {drag} from "d3-drag";

function random(seed) {
  return randomLcg(seed)();
}

function generate({height, startX, endX, seed, minWidth = 1 / 8, maxWidth = 1 / 2, offsetY = 1, paddingX = 3 / 4}) {
  const w = (height / 6) * 10;
  const seedHeight = seed;
  const seedDy = random(seedHeight) * 1500;
  const seedWidth = random(seedDy) * 100;
  const noiseH = randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = randomNoise(w * minWidth, w * maxWidth, {seed: seedWidth});
  const noiseDy = randomNoise(-height / 6, height / 6, {seed: seedDy});

  const primitives = [];

  let px = 0;
  while (px < endX) {
    const gap = random(px);
    const addGap = gap < 0.18;
    const w = noiseW(px);
    const x = px - random(px) * w * paddingX + addGap * 200;
    const y = (height / 8) * 5 + noiseDy(x) * offsetY;
    const h = noiseH(x + w / 2);
    px = x + w;
    primitives.push({x: x, y: y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y});
  }

  px = 0;
  while (startX < px) {
    const gap = random(px);
    const addGap = gap < 0.15;
    const w = noiseW(px);
    const x = px - w + random(px) * w * paddingX - addGap * 200;
    const y = (height / 8) * 5 + noiseDy(x) * offsetY;
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
  seed = 10000,
} = {}) {
  let mountains;
  let plains;

  update();

  const svg = create("svg").attr("width", width).attr("height", height).attr("cursor", "grab");
  const g = svg.append("g");
  svg.call(draw).call(createDragX());

  return svg.node();

  function update() {
    const common = {startX, endX, height, seed};
    mountains = generate(common);
    plains = generate({...common, offsetY: 0, minWidth: 1 / 2, maxWidth: 1.5, height: height / 2});
  }

  function setX(x) {
    svg.attr("viewBox", [x, 0, width, height]);
  }

  function draw() {
    g.html("");

    g.append("rect")
      .attr("x", startX)
      .attr("width", endX - startX)
      .attr("height", height)
      .attr("fill", "#eee");

    g.append("line")
      .attr("x1", startX)
      .attr("y1", height / 2)
      .attr("x2", endX)
      .attr("y2", height / 2)
      .attr("stroke", "#000");

    g.append("g")
      .selectAll("path")
      .data(mountains)
      .join("path")
      .attr("d", ({x, y, x1, y1, x2, y2}) => `M${x},${y}L${x1},${y1}L${x2},${y2}Z`)
      .attr("fill", "#ccc")
      .attr("stroke", "#000");

    g.append("g")
      .attr("transform", `translate(0, ${height - height / 4})`)
      .selectAll("path")
      .data(plains)
      .join("path")
      .attr("d", ({x, y, x1, y1, x2, y2}) => `M${x},${y}L${x1},${y1}L${x2},${y2}Z`)
      .attr("fill", "#ccc")
      .attr("stroke", "#000");
  }

  function redraw() {
    update();
    draw();
  }

  function createDragX() {
    let x0 = 0;
    return drag()
      .on("start", ({x}) => (x0 = x))
      .on("drag", ({x}) => setX(currentX + x0 - x))
      .on("end", ({x}) => {
        currentX += x0 - x;
        if (currentX - startX < width) {
          startX -= width;
          redraw();
        } else if (endX - currentX < width * 2) {
          endX += width;
          redraw();
        }
        setX(currentX);
      });
  }
}
