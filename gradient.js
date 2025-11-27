import * as d3 from "d3";

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
  const {stops = []} = options;

  const defs = d3.select(svgRoot).select("defs#gradient-defs");
  if (defs.empty()) {
    d3.select(svgRoot).append("defs").attr("id", "gradient-defs");
  }

  const radialGradient = d3
    .select(svgRoot)
    .select("defs#gradient-defs")
    .append("radialGradient")
    .attr("id", id)
    .attr("cx", "50%")
    .attr("cy", "0%")
    .attr("r", "100%")
    .attr("fx", "50%")
    .attr("fy", "0%");

  stops.forEach(({offset, color}) => {
    radialGradient.append("stop").attr("offset", offset).attr("stop-color", color);
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
