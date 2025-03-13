import {drag as d3Drag} from "d3-drag";
import {select} from "d3-selection";

function noop() {}

export function drag(node, {onDragStart = noop, onDrag = noop, onDragEnd = noop}) {
  if (!node.__drag__) {
    const apply = d3Drag()
      .on("start", (...params) => node.__drag__.onDragStart(...params))
      .on("drag", (...params) => node.__drag__.onDrag(...params))
      .on("end", (...params) => node.__drag__.onDragEnd(...params));
    select(node).call(apply);
  }
  node.__drag__ = {onDragStart, onDrag, onDragEnd};
}
