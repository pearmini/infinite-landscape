import * as d3 from "d3";
import * as apack from "apackjs";
import {cm} from "./cm.js";

const BACKGROUND_COLOR = "#FEFAF1";

const TREE_COLOR = "#EED586";

function reduceDenominator(numerator, denominator) {
  const rec = (a, b) => (b ? rec(b, a % b) : a);
  return denominator / rec(numerator, denominator);
}

function rose(r, n, d, options = {}) {
  const k = n / d;
  const m = reduceDenominator(n, d);
  const points = [];
  for (let a = 0; a < Math.PI * 2 * m + 0.02; a += 0.02) {
    const r1 = r * Math.cos(k * a);
    const x = r1 * Math.cos(a);
    const y = r1 * Math.sin(a);
    points.push([x, y]);
  }
  return cm.svg("path", {
    d: d3.line().curve(d3.curveCatmullRom)(points),
    ...options,
  });
}

function ellipsis(text, maxLength) {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return chars.slice(0, maxLength).join("") + "...";
}

function circlePath(r) {
  const path = d3.path();
  path.arc(0, 0, r, 0, Math.PI * 2);
  return path.toString();
}

function toTree(codes) {
  const data = {
    children: [],
  };

  const visited = [data];
  let currentIndex = 0;

  while (currentIndex < codes.length && visited.length > 0) {
    const code = +codes[currentIndex];
    const current = visited.shift();
    const children = d3.range(code).map((i) => ({children: []}));
    current.children = children;
    visited.push(...children);
    currentIndex++;
  }

  return data;
}

// example: 101103111 -> [['10', '1', '10'], '3111']
// example: 2030 -> ['20', '30']
// example: 1103045 -> ['1', '10', '30', '45']
function trimDegenerateSegments(code) {
  const codes = [];
  let current = null;
  let i = 0;

  const isValid = (current) => {
    const isStartWith1 = current.startsWith("1");
    const enoughZeros = +current[0] <= current.slice(1).length;
    return isStartWith1 || enoughZeros;
  };

  for (i = 0; i < code.length; i++) {
    const digit = +code[i];
    const next = +code[i + 1];

    // A degenerate segment is a segment starting with 1 or
    // with trailing 0 which 0 count is getter than or equal to the first digit.
    const isDegenerateSegment = digit === 1 || next === 0;

    if (!current && !isDegenerateSegment) break;
    else if (!current && isDegenerateSegment) current = "" + digit;
    else if (digit === 0) current += "" + digit;
    else {
      if (isValid(current)) {
        codes.push(current);
        current = isDegenerateSegment ? "" + digit : null;
        if (!current) break;
      } else {
        i = i - current.length;
        current = null;
        break;
      }
    }
  }

  if (current) {
    if (isValid(current)) codes.push(current);
    else i = i - current.length;
  }

  return [codes, code.slice(i)];
}

export function tree(
  text,
  {
    width = 480,
    height = width,
    stroke = "black",
    grid = false,
    padding = 20,
    number = true,
    stamp = true,
    count = false,
    line = true,
    end = true,
    strokeWidth = 1.5,
  } = {}
) {
  text = text.trim();

  const ascii = text
    .split("")
    .map((code) => code.charCodeAt(0))
    .join("");

  const randomLcg = d3.randomUniform.source(d3.randomLcg(+ascii))();

  function random(min, max) {
    return min + (max - min) * randomLcg();
  }

  function randomInt(min, max) {
    return Math.floor(random(min, max));
  }

  const [flowers, tree] = trimDegenerateSegments(ascii);

  const data = toTree(tree);
  const root = d3.hierarchy(data);

  const range = flowers.length * 10;
  const middle = tree ? width * 0.25 : width / 2;

  const flowerX = d3
    .scalePoint()
    .domain(flowers.map((_, i) => i))
    .range([middle - range, middle + range]);

  const roses = [];
  const paths = [];
  const circles = [];
  const numbers = [];
  const initLen = (140 / 480) * width;
  const baselineY = height * 0.618 + initLen;
  const context = cm.mat().translate(width / 2, baselineY);
  branch(root, initLen, 0, 80);

  function branch(node, len, rotation, angle, roseCount = 0) {
    context.push();
    context.rotate(rotation);
    paths.push({d: `M0,0L0,${-len}`, transform: context.transform()});

    if (node.children) {
      context.translate(0, -len);
      len *= 0.618;
      const children = node.children;

      const leaves = children.map((d) => d.leaves().length);
      const stacked = [];

      let sum = 0;
      for (const length of leaves) {
        sum += length;
        stacked.push(sum);
      }

      if (count) {
        numbers.push({
          count: node.children.length,
          transform: context.transform(),
        });
      }

      const scaleAngle = d3.scaleLinear().domain([0, sum]).range([-angle, angle]);
      const n = children.length;

      let mergeCount = -1;
      let startIndex = -1;
      let endIndex = -1;
      if (n > 2 && node.children.every((d) => !d.children) && !count) mergeCount = randomInt(3, Math.min(n, 10));

      if (mergeCount > 0) {
        startIndex = randomInt(0, n - mergeCount);
        endIndex = startIndex + mergeCount - 1;
      }

      for (let i = 0; i < n; i++) {
        if (i >= startIndex && i < endIndex) continue;
        const isMerge = i === endIndex;
        let prevIndex = isMerge ? startIndex : i - 1;
        const child = children[i];
        const childRotation = scaleAngle(stacked[i]);
        const prevRotation = stacked[prevIndex] ? scaleAngle(stacked[prevIndex]) : -angle;
        const diff = childRotation - prevRotation;
        branch(child, len, (childRotation + prevRotation) / 2, Math.min(80, diff), isMerge ? mergeCount : 0);
      }
    } else {
      // [n, d]
      const roseByCount = {
        3: [3, 1],
        4: [4, 2],
        5: [5, 3],
        6: [3, 2],
        7: [7, 3],
        8: [4, 2],
        9: [3, 2],
      };

      if (roseCount > 0) {
        const [n, d] = roseByCount[roseCount];
        const r = Math.sqrt(roseCount * len);
        context.translate(0, -len);
        roses.push({r, n, d, transform: context.transform()});
      } else {
        const r = len / 12;
        context.translate(0, -len - r);
        len *= 0.67;
        circles.push({
          cx: 0,
          cy: 0,
          r,
          transform: context.transform(),
        });
      }
    }

    context.pop();
  }

  let textNode = null;
  let longMessage = false;

  try {
    const wordLength = text.split(" ").length;
    if (wordLength > 4) {
      throw new Error("Too many words");
    }

    let cellSize = 50;
    const padding = 20;
    let totalLength = wordLength * cellSize + padding * 2;
    if (totalLength > width / 2) {
      cellSize = (width / 2 - padding * 2) / wordLength;
      totalLength = wordLength * cellSize + padding;
    } else {
      totalLength -= padding;
    }

    const start = end ? width - totalLength : width / 2 + padding;
    const sw = 1.5;
    textNode = cm.svg("g", {
      transform: `translate(${start}, ${baselineY - cellSize - 5})`,
      children: [
        apack.text(text, {
          cellSize,
          word: {strokeWidth: sw, stroke: "red"},
          background: {strokeWidth: sw * 2, stroke: "red"},
        }),
      ],
    });
  } catch (e) {
    longMessage = true;
    const fontSize = 12;
    const textPadding = 4;
    const textContent = ellipsis(text, 14);
    const textWidth = textContent.length * (fontSize * 0.6);
    const textHeight = fontSize;
    const dx = (-20 / 480) * width;
    const dy = (-55 / 480) * width;
    textNode = cm.svg("g", {
      children: [
        cm.svg("rect", {
          x: width + dx - textWidth - textPadding,
          y: height + dy - textHeight - textPadding,
          width: textWidth + textPadding * 2,
          height: textHeight + textPadding * 2,
          fill: "none",
          stroke: "red",
          strokeWidth: 1.5,
        }),
        cm.svg("text", {
          textContent: textContent,
          x: "100%",
          y: "100%",
          dx: dx,
          dy: dy,
          textAnchor: "end",
          fill: "red",
          fontSize: fontSize,
          fontFamily: "monospace",
        }),
      ],
    });
  }

  const svg = cm.svg("svg", {
    width,
    height,
    styleBackground: BACKGROUND_COLOR,
    children: [
      grid &&
        cm.svg("rect", {
          x: 0,
          y: 0,
          class: "tree-bg",
          width: width,
          height: height,
          stroke,
          strokeWidth,
          fill: "transparent",
        }),
      cm.svg("g", flowers, {
        transform: (d, i) => `translate(${flowerX(i)}, ${baselineY})`,
        children: (d, i) => [
          cm.svg("path", {
            d: `M0,0L0,${-initLen * 0.618}`,
            stroke: "black",
            strokeWidth,
          }),
          cm.svg("g", {
            strokeWidth,
            transform: `translate(0, ${-initLen * 0.618})`,
            children: [
              rose(12, 1, i + 2, {
                fill: BACKGROUND_COLOR,
                stroke: "black",
              }),
            ],
          }),
        ],
      }),
      tree &&
        cm.svg("g", {
          stroke: "black",
          strokeWidth,
          children: [
            cm.svg("path", paths, {
              d: (d) => d.d,
              transform: (d) => d.transform,
            }),
          ],
        }),
      tree &&
        cm.svg("g", circles, {
          transform: (d) => d.transform,
          children: (d) =>
            [
              cm.svg("path", {
                d: circlePath(d.r),
                fill: TREE_COLOR,
                stroke: "black",
              }),
            ].filter(Boolean),
        }),
      tree &&
        cm.svg("g", roses, {
          transform: (d) => d.transform,
          children: (d) => [
            rose(d.r, d.n, d.d, {
              fill: TREE_COLOR,
              stroke: "black",
            }),
          ],
        }),
      stamp && textNode,
      count &&
        cm.svg("g", numbers, {
          transform: (d) => d.transform,
          children: (d) => [
            cm.svg("circle", {
              cx: 0,
              cy: 0,
              r: 14,
              fill: "black",
            }),
            cm.svg("text", {
              textContent: d.count,
              fill: "white",
              fontSize: 20,
              textAnchor: "middle",
              dy: "0.4em",
            }),
          ],
        }),
      line &&
        cm.svg("path", {
          d: `M${padding},${baselineY}L${width - padding},${baselineY}`,
          stroke: "black",
          strokeWidth,
        }),
      number &&
        cm.svg("text", {
          id: "ascii",
          textContent: ellipsis(ascii, 58),
          x: "100%",
          y: "100%",
          dy: "-26",
          dx: "-20",
          textAnchor: "end",
          fill: "black",
          fontSize: 12,
          fontFamily: "monospace",
        }),
    ].filter(Boolean),
  });

  return svg;
}
