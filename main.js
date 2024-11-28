import {svg} from "htl";
import {randomNoise} from "./noise.js";
import {randomUniform} from "d3-random";

const data = {};

function mountains({width, height, count}) {
  const noiseH = randomNoise(0, (height / 4) * 3, {octaves: 4, seed: 100000, falloff: 0.5});
  const noiseW = randomNoise(width / 8, width / 3, {octaves: 8, seed: 100000, falloff: 0.5});
  const noiseY = randomNoise(-height / 8, height / 8, {octaves: 4, seed: 100000, falloff: 0.5});
  let px = 0;
  const mountains = Array.from({length: count}, (_, i) => {
    const gap = randomUniform()();
    const addGap = gap < 0.1;
    const w = noiseW(i);
    const x = px - randomUniform(0, w)() + addGap * 200;
    const y = (height / 4) * 3 + noiseY(x);
    const h = noiseH(x + w / 2);
    px = x + w;
    return {x, y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y};
  });
  return mountains;
}

function render(data, {width = 1000, height = 600} = {}) {
  const svgElement = svg`<svg width=${width} height=${height}>
    <rect width=${width} height=${height} fill="#eee"></rect>
    ${mountains({width, height, count: 20}).map(
      ({x, y, x1, y1, x2, y2}) =>
        svg`<path d=${`M${x},${y}L${x1},${y1}L${x2},${y2}Z`} fill="#ccc" fill-opacity="0.8"></path>`
    )}
  </svg>`;

  const container = document.querySelector("#container");
  container.appendChild(svgElement);
}

render(data);
