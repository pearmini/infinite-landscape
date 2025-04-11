import {svg} from "charmingjs";

function calculateGradientPoints(angle) {
  const rad = (angle * Math.PI) / 180;
  const cx = 0.5;
  const cy = 0.5;
  const dx = Math.cos(rad) * 0.5;
  const dy = Math.sin(rad) * 0.5;

  const x1 = (cx - dx) * 100;
  const y1 = (cy - dy) * 100;
  const x2 = (cx + dx) * 100;
  const y2 = (cy + dy) * 100;

  return {x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%`};
}

function equal(a, b) {
  if (!a || !b) return false;
  if (a.angle !== b.angle) return false;
  const {stops: stopsA} = a;
  const {stops: stopsB} = b;
  if (stopsA.length !== stopsB.length) return false;
  for (let i = 0; i < stopsA.length; i++) {
    const stopA = stopsA[i];
    const stopB = stopsB[i];
    if (stopA.offset !== stopB.offset || stopA.color !== stopB.color) return false;
  }
  return true;
}

function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function createGradient(options) {
  const id = uid();
  const {angle = 0, stops = []} = options;
  return [
    id,
    svg("linearGradient", {
      id,
      ...calculateGradientPoints(angle),
      children: stops.map(({offset, color}) => svg("stop", {offset, "stop-color": color})),
    }).node(),
  ];
}

export function gradient(node, options, context) {
  const container = context.root();
  const root = container.querySelector("svg");
  if (!root) return;
  if (node.__gradient__) {
    const {options: oldO, node: oldN} = node.__gradient__;
    if (equal(oldO, options)) return;
    const [id, linerGradient] = createGradient(options);
    node.setAttribute("fill", `url(#${id})`);
    oldN.replaceWith(linerGradient);
    node.__gradient__ = {node: linerGradient, options};
  } else {
    let defs = root.querySelector("#cm-gradient-defs");
    if (!defs) root.appendChild((defs = svg("defs", {id: "cm-gradient-defs"}).node()));
    const [id, linerGradient] = createGradient(options);
    defs.appendChild(linerGradient);
    node.setAttribute("fill", `url(#${id})`);
    node.__gradient__ = {node: linerGradient, options};
  }
}
