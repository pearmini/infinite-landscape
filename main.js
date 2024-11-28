import {svg} from "htl";
import {randomNoise} from "./noise.js";
import {randomUniform} from "d3-random";

const data = {};

function mountains({width, height, count, minY = 1 / 8, maxY = 1 / 2, addNoiseY = 1, paddingX = 3 / 4}) {
  const noiseH = randomNoise(0, (height / 8) * 5);
  const noiseW = randomNoise(width * minY, width * maxY);
  const noiseY = randomNoise(-height / 8, height / 8);
  let px = 0;
  const mountains = Array.from({length: count}, (_, i) => {
    const gap = randomUniform()();
    const addGap = gap < 0.1;
    const w = noiseW(i);
    const x = px - randomUniform(0, w * paddingX)() + addGap * 200;
    const y = (height / 8) * 5 + noiseY(x) * addNoiseY;
    const h = noiseH(x + w / 2);
    px = x + w;
    return {
      x: x,
      y: y,
      x1: x + w / 2,
      y1: y - h,
      x2: x + w,
      y2: y,
    };
  });
  return mountains.sort((a, b) => Math.max(a.y, a.y2) - Math.max(b.y, b.y2));
}

function render(data, {width = 1000, height = 600} = {}) {
  const svgElement = svg`<svg width=${width} height=${height}>
    <rect width=${width} height=${height} fill="#eee"></rect>
    <line x1="0" y1=${height / 2} x2=${width} y2=${height / 2} stroke="#000"></line>
    ${mountains({width, height, count: 20}).map(
      ({x, y, x1, y1, x2, y2}) =>
        svg`<path d=${`M${x},${y}L${x1},${y1}L${x2},${y2}Z`} fill="#ccc" stroke="#000"></path>`
    )}
    <g transform="translate(0, ${height - height / 4})">
    ${mountains({width, height: height / 2, count: 10, minY: 1 / 2, maxY: 3 / 4, addNoiseY: 0}).map(
      ({x, y, x1, y1, x2, y2}) =>
        svg`<path d=${`M${x},${y}L${x1},${y1}L${x2},${y2}Z`} fill="#ccc" stroke="#000"></path>`
    )}
    </g>
  </svg>`;
  const container = document.querySelector("#container");
  container.appendChild(svgElement);
}

render(data);
