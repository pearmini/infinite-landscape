import { svg } from "htl";

const data = {};

function render(data) {
  console.log("render", data);
  const container = document.querySelector("#container");
  const svgElement = svg`<svg width="100" height="100">
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
  </svg>`;
  container.appendChild(svgElement);
}

render(data);
