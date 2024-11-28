import {svg} from "htl";

const data = {};

function mountains({width, height, count}) {
  const mountains = Array.from({length: count}, (_, i) => {
    const w = width / count;
    const h = height / 4;
    const x = i * w;
    const y = height / 2;
    return {x, y, x1: x + w / 2, y1: y - h, x2: x + w, y2: y};
  });
  return mountains;
}

function render(data, {width = 1000, height = 600} = {}) {
  const svgElement = svg`<svg width=${width} height=${height}>
    <rect width=${width} height=${height} fill="#eee"></rect>
    ${mountains({width, height, count: 5}).map(
      ({x, y, x1, y1, x2, y2}) => svg`<path d=${`M${x},${y}L${x1},${y1}L${x2},${y2}Z`} fill="#ccc"></path>`
    )}
  </svg>`;

  const container = document.querySelector("#container");
  container.appendChild(svgElement);
}

render(data);
