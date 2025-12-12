import * as d3 from "d3";
import {render} from "./render.js";
import namesData from "./names.json";
import JSZip from "jszip";

// Convert SVG to canvas for pixel analysis
function svgToCanvas(svgElement, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    try {
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      const clonedSvg = svgElement.cloneNode(true);
      const viewBox = clonedSvg.getAttribute("viewBox");

      clonedSvg.setAttribute("width", scaledWidth);
      clonedSvg.setAttribute("height", scaledHeight);
      if (viewBox) {
        clonedSvg.setAttribute("viewBox", viewBox);
      }

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const img = new Image();
      const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, scaledWidth, scaledHeight);
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG image"));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

// Convert canvas to PNG blob
function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      },
      "image/png",
      1.0
    );
  });
}

// Convert RGB to CMYK and extract Cyan channel
function extractCyanChannel(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Create canvas for Cyan channel
  const cyanCanvas = document.createElement("canvas");
  cyanCanvas.width = canvas.width;
  cyanCanvas.height = canvas.height;
  const cyanCtx = cyanCanvas.getContext("2d");
  const cyanImageData = cyanCtx.createImageData(canvas.width, canvas.height);
  const cyanData = cyanImageData.data;

  // Convert RGB to CMYK and extract Cyan
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent pixels
    if (a === 0) {
      cyanData[i + 3] = 0;
      continue;
    }

    // Convert RGB to CMYK
    // CMYK values are typically 0-1, but we'll work with 0-255 for consistency
    const k = 1 - Math.max(r / 255, g / 255, b / 255); // Black component
    const c = k === 1 ? 0 : (1 - r / 255 - k) / (1 - k); // Cyan component
    const m = k === 1 ? 0 : (1 - g / 255 - k) / (1 - k); // Magenta component
    const y = k === 1 ? 0 : (1 - b / 255 - k) / (1 - k); // Yellow component

    // Convert CMYK back to 0-255 range
    const cyanValue = Math.round(c * 255);

    // For riso printing, use black with alpha channel representing cyan intensity
    cyanData[i] = 0; // R
    cyanData[i + 1] = 0; // G
    cyanData[i + 2] = 0; // B
    cyanData[i + 3] = cyanValue; // Alpha represents cyan intensity
  }

  cyanCtx.putImageData(cyanImageData, 0, 0);
  return cyanCanvas;
}

// Extract layer 1: mountains with outlines (mountains + their strokes, no trees, no stamps)
function extractMountainsLayer(svgElement) {
  const cloned = svgElement.cloneNode(true);
  const clonedSvg = d3.select(cloned);

  // Remove background
  clonedSvg.select("#bg-rect").remove();

  // Remove trees completely
  clonedSvg.select(".trees-group").remove();

  // Keep mountains with both fills (gradients) and strokes
  // Mountains already have both, so we don't need to modify them

  return cloned;
}

// Extract close mountains only
function extractCloseMountainsLayer(svgElement) {
  const cloned = svgElement.cloneNode(true);
  const clonedSvg = d3.select(cloned);

  // Remove background
  clonedSvg.select("#bg-rect").remove();

  // Remove trees completely
  clonedSvg.select(".trees-group").remove();

  // Remove far mountains (keep only close mountains)
  clonedSvg.selectAll(".mountains-group path.far").remove();

  return cloned;
}

// Extract far mountains only
function extractFarMountainsLayer(svgElement) {
  const cloned = svgElement.cloneNode(true);
  const clonedSvg = d3.select(cloned);

  // Remove background
  clonedSvg.select("#bg-rect").remove();

  // Remove trees completely
  clonedSvg.select(".trees-group").remove();

  // Remove close mountains (keep only far mountains)
  clonedSvg.selectAll(".mountains-group path.close").remove();

  return cloned;
}

// Extract layer 2: trees (tree shapes with outlines, no mountains, no stamps)
function extractTreesLayer(svgElement) {
  const cloned = svgElement.cloneNode(true);
  const clonedSvg = d3.select(cloned);

  // Remove background
  clonedSvg.select("#bg-rect").remove();

  // Remove mountains
  clonedSvg.select(".mountains-group").remove();

  // Keep trees but remove stamps (text)
  clonedSvg.selectAll(".trees-group text").remove();
  clonedSvg.selectAll(".trees-group g").each(function () {
    const g = d3.select(this);
    g.selectAll(".stamp-group").remove();

    const paths = g.selectAll("path");
    paths.attr("fill", "transparent");
  });

  return cloned;
}

// Extract layer: stamps (text elements only, no trees)
function extractStampsLayer(svgElement) {
  const cloned = svgElement.cloneNode(true);
  const clonedSvg = d3.select(cloned);

  // Remove background and mountains
  clonedSvg.select("#bg-rect").remove();
  clonedSvg.select(".mountains-group").remove();

  // Keep only stamps (elements with class "stamp-group"), remove all tree visual elements
  clonedSvg.selectAll(".trees-group").each(function () {
    d3.select(this).selectAll(".branch-group").remove();
  });

  return cloned;
}

// Export riso layers
export async function exportRisoLayers({seed = 10000, height = 600, debug = false} = {}) {
  try {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "export-loading";
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
    `;
    loadingDiv.innerHTML = debug
      ? "<div>Generating debug layers (page 1 only)...</div>"
      : "<div>Generating riso layers...</div>";
    document.body.appendChild(loadingDiv);

    const allNames = namesData.map((item) => item.name);
    const totalNames = allNames.length;
    const spacing = 350;
    const treesNeeded = totalNames;
    let estimatedWidth = treesNeeded * spacing * 1.5;

    loadingDiv.innerHTML = `<div>Generating landscape with ${totalNames} names...</div>`;

    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      width: ${estimatedWidth * 2}px;
      height: ${height}px;
      overflow: hidden;
    `;
    document.body.appendChild(tempContainer);

    const nameQueue = [...allNames];
    const fullSvg = render({
      width: estimatedWidth,
      height: height,
      currentX: 0,
      startX: -estimatedWidth * 0.5,
      endX: estimatedWidth * 1.5,
      translateX: 0,
      scaleX: 1,
      seed: seed,
      nameQueue: nameQueue,
    });

    tempContainer.appendChild(fullSvg);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Find tree positions
    const treesGroup = fullSvg.querySelector(".trees-group");
    const treePositions = [];
    let minX = 0;
    let maxX = estimatedWidth;

    if (treesGroup) {
      const trees = treesGroup.querySelectorAll("g.tree-group");
      if (trees.length > 0) {
        trees.forEach((tree) => {
          const transform = tree.getAttribute("transform");
          if (transform) {
            const match = transform.match(/translate\(([^,]+),/);
            if (match) {
              const x = parseFloat(match[1]);
              const treeSvg = tree.querySelector("svg");
              const treeWidth = parseFloat(treeSvg?.getAttribute("width") || "200");
              const treeLeft = x - treeWidth / 2;
              const treeRight = x + treeWidth / 2;
              treePositions.push({
                centerX: x,
                left: treeLeft,
                right: treeRight,
                width: treeWidth,
              });
              minX = Math.min(minX, treeLeft);
              maxX = Math.max(maxX, treeRight);
            }
          }
        });
        treePositions.sort((a, b) => a.centerX - b.centerX);
      }
    }

    const pageHeight = height;
    const pageWidth = pageHeight * (10.5 / 8);

    let firstPageStartX = minX;
    if (treePositions.length >= 2) {
      firstPageStartX = treePositions[1].left;
    } else if (treePositions.length === 1) {
      firstPageStartX = treePositions[0].left;
    }

    let lastTreeEndX = maxX;
    if (treePositions.length > 0) {
      const lastTree = treePositions[treePositions.length - 1];
      lastTreeEndX = lastTree.right;
    }

    const paddingAfterLastTree = pageWidth * 0.3;
    const contentEndX = lastTreeEndX + paddingAfterLastTree;
    const actualContentWidth = contentEndX - firstPageStartX;

    const targetNumPages = 60;
    
    // Calculate viewBox width per page to fit all content in exactly 60 pages
    // This ensures all 60 pages will have trees
    const viewBoxWidthPerPage = actualContentWidth / targetNumPages;
    
    const landscapeHeight = pageHeight * 0.8;
    
    // Calculate the aspect ratio: how much width per unit of height
    const widthToHeightRatio = actualContentWidth / height;
    
    // Calculate viewBox height to maintain aspect ratio with the new width per page
    const viewBoxHeightPerPage = viewBoxWidthPerPage / widthToHeightRatio;
    
    // Scale to fit the height in the available landscape height (80% of page)
    const heightScale = Math.min(1, landscapeHeight / viewBoxHeightPerPage);
    const finalViewBoxHeightPerPage = viewBoxHeightPerPage * heightScale;
    const finalViewBoxWidthPerPage = viewBoxWidthPerPage * heightScale;

    const numPages = debug ? 1 : targetNumPages;

    loadingDiv.innerHTML = `<div>Exporting ${numPages} pages across 3 layers...</div>`;

    const zip = new JSZip();
    const mountainsFolder = zip.folder("mountains");
    const treesFolder = zip.folder("trees");
    const stampsFolder = zip.folder("stamps");

    // Export each page
    for (let i = 0; i < numPages; i++) {
      loadingDiv.innerHTML = `<div>Processing page ${i + 1} of ${numPages}...</div>`;

      const pageX = firstPageStartX + i * finalViewBoxWidthPerPage;
      const viewBoxWidth = finalViewBoxWidthPerPage;
      const viewBoxHeight = Math.max(finalViewBoxHeightPerPage, height); // Ensure full height is covered

      // 1. Extract mountains layer (mountains with outlines)
      const mountainsSvg = extractMountainsLayer(fullSvg);
      const mountainsSvgElement = d3.select(mountainsSvg);
      mountainsSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Render mountains to canvas, convert to CMYK, and extract Cyan channel
      const mountainsCanvas = await svgToCanvas(mountainsSvg, pageWidth, pageHeight);
      const cyanCanvas = extractCyanChannel(mountainsCanvas);
      const mountainsPng = await canvasToPng(cyanCanvas);
      mountainsFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, mountainsPng);

      // 2. Extract trees layer (trees with outlines, no stamps)
      const treesSvg = extractTreesLayer(fullSvg);
      const treesSvgElement = d3.select(treesSvg);
      treesSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const treesPng = await svgToPng(treesSvg, pageWidth, pageHeight);
      treesFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, treesPng);

      // 3. Extract stamps layer (text only, no trees, no mountains)
      const stampsSvg = extractStampsLayer(fullSvg);
      const stampsSvgElement = d3.select(stampsSvg);
      stampsSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stampsPng = await svgToPng(stampsSvg, pageWidth, pageHeight);
      stampsFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, stampsPng);
    }

    loadingDiv.innerHTML = "<div>Creating zip file...</div>";
    const zipBlob = await zip.generateAsync({type: "blob"});

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = debug
      ? `riso-layers-debug-${new Date().toISOString().split("T")[0]}.zip`
      : `riso-layers-${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.body.removeChild(tempContainer);
    loadingDiv.innerHTML = "<div>Done! Download started.</div>";
    setTimeout(() => {
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
    }, 2000);

    return {success: true, numPages};
  } catch (error) {
    console.error("Riso export error:", error);
    const errorDiv = document.querySelector("#export-loading");
    if (errorDiv) {
      errorDiv.innerHTML = `<div>Error: ${error.message}</div>`;
      errorDiv.style.background = "rgba(200, 0, 0, 0.8)";
      setTimeout(() => {
        if (document.body.contains(errorDiv)) {
          document.body.removeChild(errorDiv);
        }
      }, 5000);
    }
    return {success: false, error: error.message};
  }
}

// Export riso layers with 4 layers (mountains-close, mountains-far, trees, stamps)
export async function exportRisoLayers4({seed = 10000, height = 600, debug = false} = {}) {
  try {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "export-loading";
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      text-align: center;
    `;
    loadingDiv.innerHTML = debug
      ? "<div>Generating debug layers (page 1 only)...</div>"
      : "<div>Generating riso layers (4 layers)...</div>";
    document.body.appendChild(loadingDiv);

    const allNames = namesData.map((item) => item.name);
    const totalNames = allNames.length;
    const spacing = 350;
    const treesNeeded = totalNames;
    let estimatedWidth = treesNeeded * spacing * 1.5;

    loadingDiv.innerHTML = `<div>Generating landscape with ${totalNames} names...</div>`;

    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      width: ${estimatedWidth * 2}px;
      height: ${height}px;
      overflow: hidden;
    `;
    document.body.appendChild(tempContainer);

    const nameQueue = [...allNames];
    const fullSvg = render({
      width: estimatedWidth,
      height: height,
      currentX: 0,
      startX: -estimatedWidth * 0.5,
      endX: estimatedWidth * 1.5,
      translateX: 0,
      scaleX: 1,
      seed: seed,
      nameQueue: nameQueue,
    });

    tempContainer.appendChild(fullSvg);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Find tree positions (same logic as 3-layer export)
    const treesGroup = fullSvg.querySelector(".trees-group");
    const treePositions = [];
    let minX = 0;
    let maxX = estimatedWidth;

    if (treesGroup) {
      const trees = treesGroup.querySelectorAll("g.tree-group");
      if (trees.length > 0) {
        trees.forEach((tree) => {
          const transform = tree.getAttribute("transform");
          if (transform) {
            const match = transform.match(/translate\(([^,]+),/);
            if (match) {
              const x = parseFloat(match[1]);
              const treeSvg = tree.querySelector("svg");
              const treeWidth = parseFloat(treeSvg?.getAttribute("width") || "200");
              const treeLeft = x - treeWidth / 2;
              const treeRight = x + treeWidth / 2;
              treePositions.push({
                centerX: x,
                left: treeLeft,
                right: treeRight,
                width: treeWidth,
              });
              minX = Math.min(minX, treeLeft);
              maxX = Math.max(maxX, treeRight);
            }
          }
        });
        treePositions.sort((a, b) => a.centerX - b.centerX);
      }
    }

    const pageHeight = height;
    const pageWidth = pageHeight * (10.5 / 8);

    let firstPageStartX = minX;
    if (treePositions.length >= 2) {
      firstPageStartX = treePositions[1].left;
    } else if (treePositions.length === 1) {
      firstPageStartX = treePositions[0].left;
    }

    let lastTreeEndX = maxX;
    if (treePositions.length > 0) {
      const lastTree = treePositions[treePositions.length - 1];
      lastTreeEndX = lastTree.right;
    }

    const paddingAfterLastTree = pageWidth * 0.3;
    const contentEndX = lastTreeEndX + paddingAfterLastTree;
    const actualContentWidth = contentEndX - firstPageStartX;

    const targetNumPages = 60;
    
    // Calculate viewBox width per page to fit all content in exactly 60 pages
    // This ensures all 60 pages will have trees
    const viewBoxWidthPerPage = actualContentWidth / targetNumPages;
    
    const landscapeHeight = pageHeight * 0.8;
    
    // Calculate the aspect ratio: how much width per unit of height
    const widthToHeightRatio = actualContentWidth / height;
    
    // Calculate viewBox height to maintain aspect ratio with the new width per page
    const viewBoxHeightPerPage = viewBoxWidthPerPage / widthToHeightRatio;
    
    // Scale to fit the height in the available landscape height (80% of page)
    const heightScale = Math.min(1, landscapeHeight / viewBoxHeightPerPage);
    const finalViewBoxHeightPerPage = viewBoxHeightPerPage * heightScale;
    const finalViewBoxWidthPerPage = viewBoxWidthPerPage * heightScale;

    const numPages = debug ? 1 : targetNumPages;

    loadingDiv.innerHTML = `<div>Exporting ${numPages} pages across 4 layers...</div>`;

    const zip = new JSZip();
    const mountainsCloseFolder = zip.folder("mountains-close");
    const mountainsFarFolder = zip.folder("mountains-far");
    const treesFolder = zip.folder("trees");
    const stampsFolder = zip.folder("stamps");

    // Export each page
    for (let i = 0; i < numPages; i++) {
      loadingDiv.innerHTML = `<div>Processing page ${i + 1} of ${numPages}...</div>`;

      const pageX = firstPageStartX + i * finalViewBoxWidthPerPage;
      const viewBoxWidth = finalViewBoxWidthPerPage;
      const viewBoxHeight = Math.max(finalViewBoxHeightPerPage, height); // Ensure full height is covered

      // 1. Extract close mountains layer
      const closeMountainsSvg = extractCloseMountainsLayer(fullSvg);
      const closeMountainsSvgElement = d3.select(closeMountainsSvg);
      closeMountainsSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const closeMountainsCanvas = await svgToCanvas(closeMountainsSvg, pageWidth, pageHeight);
      const closeCyanCanvas = extractCyanChannel(closeMountainsCanvas);
      const closeMountainsPng = await canvasToPng(closeCyanCanvas);
      mountainsCloseFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, closeMountainsPng);

      // 2. Extract far mountains layer
      const farMountainsSvg = extractFarMountainsLayer(fullSvg);
      const farMountainsSvgElement = d3.select(farMountainsSvg);
      farMountainsSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const farMountainsCanvas = await svgToCanvas(farMountainsSvg, pageWidth, pageHeight);
      const farCyanCanvas = extractCyanChannel(farMountainsCanvas);
      const farMountainsPng = await canvasToPng(farCyanCanvas);
      mountainsFarFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, farMountainsPng);

      // 3. Extract trees layer
      const treesSvg = extractTreesLayer(fullSvg);
      const treesSvgElement = d3.select(treesSvg);
      treesSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const treesPng = await svgToPng(treesSvg, pageWidth, pageHeight);
      treesFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, treesPng);

      // 4. Extract stamps layer
      const stampsSvg = extractStampsLayer(fullSvg);
      const stampsSvgElement = d3.select(stampsSvg);
      stampsSvgElement
        .attr("viewBox", `${pageX} 0 ${viewBoxWidth} ${viewBoxHeight}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stampsPng = await svgToPng(stampsSvg, pageWidth, pageHeight);
      stampsFolder.file(`page-${String(i + 1).padStart(3, "0")}.png`, stampsPng);
    }

    loadingDiv.innerHTML = "<div>Creating zip file...</div>";
    const zipBlob = await zip.generateAsync({type: "blob"});

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = debug
      ? `riso-layers-4-debug-${new Date().toISOString().split("T")[0]}.zip`
      : `riso-layers-4-${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.body.removeChild(tempContainer);
    loadingDiv.innerHTML = "<div>Done! Download started.</div>";
    setTimeout(() => {
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
    }, 2000);

    return {success: true, numPages};
  } catch (error) {
    console.error("Riso export error:", error);
    const errorDiv = document.querySelector("#export-loading");
    if (errorDiv) {
      errorDiv.innerHTML = `<div>Error: ${error.message}</div>`;
      errorDiv.style.background = "rgba(200, 0, 0, 0.8)";
      setTimeout(() => {
        if (document.body.contains(errorDiv)) {
          document.body.removeChild(errorDiv);
        }
      }, 5000);
    }
    return {success: false, error: error.message};
  }
}

// Helper function to convert SVG to PNG (reused from export.js)
function svgToPng(svgElement, width, height) {
  return new Promise((resolve, reject) => {
    try {
      const scale = 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      const clonedSvg = svgElement.cloneNode(true);
      const viewBox = clonedSvg.getAttribute("viewBox");

      clonedSvg.setAttribute("width", scaledWidth);
      clonedSvg.setAttribute("height", scaledHeight);
      if (viewBox) {
        clonedSvg.setAttribute("viewBox", viewBox);
      }

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const img = new Image();
      const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, scaledWidth, scaledHeight);
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
          URL.revokeObjectURL(url);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to create blob from canvas"));
              }
            },
            "image/png",
            1.0
          );
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG image: " + error));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}
