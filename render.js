import {randomNoise} from "./noise.js";
import {create} from "d3-selection";
import {randomLcg} from "d3-random";
import {drag} from "d3-drag";

function random(seed) {
  return randomLcg(seed)();
}

function generate({
  height,
  startX,
  endX,
  seedHeight,
  seedDy,
  seedWidth,
  minWidth = 1 / 8,
  maxWidth = 1 / 2,
  offsetY = 1,
  paddingX = 3 / 4,
}) {
  const w = (height / 6) * 10;
  const noiseH = randomNoise(0, (height / 8) * 5, {seed: seedHeight});
  const noiseW = randomNoise(w * minWidth, w * maxWidth, {seed: seedWidth});
  const noiseDy = randomNoise(-height / 8, height / 8, {seed: seedDy});

  const primitives = [];

  let px = 0;
  while (px < endX) {
    const gap = random(px);
    const addGap = gap < 0.15;
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
  startX = -width,
  endX = width * 2,
  currentX = 0,
  seedHeight = 10000,
  seedWidth = 1500,
  seedDy = 100,
} = {}) {
  let g;
  let mountains;
  let plains;

  update();

  const svg = create("svg")
    .attr("width", width)
    .attr("height", height)
    .call(setX, currentX)
    .attr("cursor", "grab")
    .call(draw);

  svg.call(createDragX(svg));

  return svg.node();

  function update() {
    const common = {startX, endX, height, seedHeight, seedWidth, seedDy};
    mountains = generate(common);
    plains = generate({...common, offsetY: 0, minWidth: 1 / 2, maxWidth: 1.5, height: height / 2});
  }

  function setX(svg, x) {
    svg.attr("viewBox", [x, 0, width, height]);
  }

  function draw(svg) {
    if (g) g.remove();

    g = svg.append("g");

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

  function redraw(svg) {
    update();
    draw(svg);
  }

  function createDragX(svg) {
    let x0 = 0;
    return drag()
      .on("start", ({x}) => (x0 = x))
      .on("drag", ({x}) => setX(svg, currentX + x0 - x))
      .on("end", ({x}) => {
        currentX += x0 - x;
        if (currentX - startX < width) {
          startX -= width;
          redraw(svg);
        } else if (endX - currentX < width * 2) {
          endX += width;
          redraw(svg);
        }
        setX(svg, currentX);
      });
  }
}
