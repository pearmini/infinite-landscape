import {zoom as d3Zoom} from "d3-zoom";
import {select} from "d3-selection";

function noop() {}

export function zoom(node, {instance = d3Zoom(), onZoom = noop, scaleExtent}) {
  if (!node.__zoom__) {
    const apply = instance.scaleExtent(scaleExtent).on("zoom", (...params) => node.__zoom__.onZoom(...params));
    select(node).call(apply);
  }
  node.__zoom__ = {onZoom};
}
