import * as d3 from "d3";

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

export function createGradient(options, svgRoot) {
  const id = `gradient-${uid()}`;
  const {angle = 0, stops = []} = options;

  const defs = d3.select(svgRoot).select("defs#gradient-defs");
  if (defs.empty()) {
    d3.select(svgRoot).append("defs").attr("id", "gradient-defs");
  }

  const linearGradient = d3.select(svgRoot)
    .select("defs#gradient-defs")
    .append("linearGradient")
    .attr("id", id)
    .attr("x1", calculateGradientPoints(angle).x1)
    .attr("y1", calculateGradientPoints(angle).y1)
    .attr("x2", calculateGradientPoints(angle).x2)
    .attr("y2", calculateGradientPoints(angle).y2);

  stops.forEach(({offset, color}) => {
    linearGradient.append("stop").attr("offset", offset).attr("stop-color", color);
  });

  return id;
}

export function applyGradient(node, options, svgRoot) {
  if (!svgRoot) {
    svgRoot = node.closest("svg");
    if (!svgRoot) return;
  }

  if (node.__gradient__) {
    const {options: oldO, id: oldId} = node.__gradient__;
    if (equal(oldO, options)) return;

    // Remove old gradient
    d3.select(svgRoot).select(`#${oldId}`).remove();

    // Create new gradient
    const id = createGradient(options, svgRoot);
    d3.select(node).attr("fill", `url(#${id})`);
    node.__gradient__ = {id, options};
  } else {
    const id = createGradient(options, svgRoot);
    d3.select(node).attr("fill", `url(#${id})`);
    node.__gradient__ = {id, options};
  }
}
