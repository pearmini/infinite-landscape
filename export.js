import * as d3 from "d3";
import {render} from "./render.js";
import namesData from "./names.json";
import JSZip from "jszip";

// Convert SVG to PNG using canvas with high DPI support
function svgToPng(svgElement, width, height) {
  return new Promise((resolve, reject) => {
    try {
      // Use 2x scale for high quality output (equivalent to 300 DPI for print)
      // This ensures crisp images even when zoomed or printed
      const scale = 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true);

      // Get the viewBox - it defines what part of the SVG to show
      const viewBox = clonedSvg.getAttribute("viewBox");

      // Set SVG dimensions at the scaled size
      // The viewBox stays the same, so the content will render at 2x resolution
      clonedSvg.setAttribute("width", scaledWidth);
      clonedSvg.setAttribute("height", scaledHeight);
      // Keep the viewBox unchanged - it defines the coordinate space
      if (viewBox) {
        clonedSvg.setAttribute("viewBox", viewBox);
      }

      // Serialize the SVG
      const svgData = new XMLSerializer().serializeToString(clonedSvg);

      // Create canvas at scaled size for high resolution
      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext("2d");

      // Enable high-quality image smoothing for smooth curves
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Create image from SVG data URL
      const img = new Image();
      const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          // Fill white background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, scaledWidth, scaledHeight);

          // Draw the SVG image at the scaled size
          // The SVG will render its viewBox content at 2x resolution
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

          URL.revokeObjectURL(url);

          // Convert to blob with maximum quality
          // The canvas is at 2x resolution, so the output PNG will be high quality
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

// Calculate pages with 17:11 aspect ratio
function calculatePages(landscapeWidth, landscapeHeight, aspectRatio = 17 / 11) {
  const pageHeight = landscapeHeight;
  const pageWidth = pageHeight * aspectRatio;
  const numPages = Math.ceil(landscapeWidth / pageWidth);

  return {
    pageWidth,
    pageHeight,
    numPages,
    aspectRatio,
  };
}

// Export landscape to PNG pages and create zip
export async function exportLandscapeToZip({seed = 10000, height = 600} = {}) {
  try {
    // Show loading indicator
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
    loadingDiv.innerHTML = "<div>Generating landscape...</div>";
    document.body.appendChild(loadingDiv);

    // Get all unique names
    const allNames = namesData.map((item) => item.name);
    const totalNames = allNames.length;

    // Calculate required width to fit all names
    // Each tree needs about 350px spacing, but we want some buffer
    const spacing = 350;
    const treesNeeded = totalNames;
    // Use a larger initial estimate to ensure we have room
    let estimatedWidth = treesNeeded * spacing * 1.5; // 50% buffer

    loadingDiv.innerHTML = `<div>Generating landscape with ${totalNames} names...</div>`;

    // Create a hidden container for rendering
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: absolute;
      left: -9999px;
      width: ${estimatedWidth * 2}px;
      height: ${height}px;
      overflow: hidden;
    `;
    document.body.appendChild(tempContainer);

    // Render the full landscape with all names in queue (REVERSED ORDER)
    const nameQueue = [...allNames].reverse(); // Reverse the array
    const fullSvg = render({
      width: estimatedWidth,
      height: height,
      currentX: 0,
      startX: -estimatedWidth * 0.5, // Extend start to allow trees to go negative
      endX: estimatedWidth * 1.5, // Extend end to allow trees beyond initial width
      translateX: 0,
      scaleX: 1,
      seed: seed,
      nameQueue: nameQueue,
    });

    tempContainer.appendChild(fullSvg);

    // Wait a bit for rendering to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Find all tree positions and their bounds
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

        // Sort tree positions by center X
        treePositions.sort((a, b) => a.centerX - b.centerX);
      }
    }

    // Calculate pages with 17:11 aspect ratio
    const pageHeight = height;
    const pageWidth = pageHeight * (11 / 8);

    // Find the second tree position for the first page start
    let firstPageStartX = minX;
    if (treePositions.length >= 2) {
      // Start from the left edge of the second tree (ensuring first tree is complete before page 1)
      firstPageStartX = treePositions[1].left;
    } else if (treePositions.length === 1) {
      // If only one tree, start from its left edge
      firstPageStartX = treePositions[0].left;
    } else if (treePositions.length === 0) {
      // No trees found, use default
      firstPageStartX = 0;
    }

    // Find the last tree's right edge to determine where to stop
    let lastTreeEndX = maxX;
    if (treePositions.length > 0) {
      // Use the right edge of the last tree (sorted by centerX, so last one is the rightmost)
      const lastTree = treePositions[treePositions.length - 1];
      lastTreeEndX = lastTree.right;
    }

    // Calculate the actual content width (from first page start to last tree end)
    const paddingAfterLastTree = pageWidth * 0.3; // 30% of page width as padding
    const contentEndX = lastTreeEndX + paddingAfterLastTree;
    const actualContentWidth = contentEndX - firstPageStartX;

    // Target: exactly 60 pages, all containing trees
    const targetNumPages = 60;

    // Calculate viewBox width per page to fit all content in exactly 60 pages
    // This ensures all 60 pages will have trees
    const viewBoxWidthPerPage = actualContentWidth / targetNumPages;

    // Leave blank space at the bottom - use 80% of page height for landscape
    const landscapeHeight = pageHeight * 0.8;

    // Calculate the aspect ratio: how much width per unit of height
    const widthToHeightRatio = actualContentWidth / height;

    // Calculate viewBox height to maintain aspect ratio with the new width per page
    const viewBoxHeightPerPage = viewBoxWidthPerPage / widthToHeightRatio;

    // Scale to fit the height in the available landscape height (80% of page)
    // If the calculated height is larger than landscapeHeight, scale it down
    const heightScale = Math.min(1, landscapeHeight / viewBoxHeightPerPage);
    const finalViewBoxHeightPerPage = viewBoxHeightPerPage * heightScale;
    const finalViewBoxWidthPerPage = viewBoxWidthPerPage * heightScale;

    loadingDiv.innerHTML = `<div>Exporting ${targetNumPages} pages (scaled to fit)...</div>`;

    // Create zip file
    const zip = new JSZip();

    // Export each page (all same size, exactly 60 pages)
    for (let i = 0; i < targetNumPages; i++) {
      loadingDiv.innerHTML = `<div>Exporting page ${i + 1} of ${targetNumPages}...</div>`;

      // Calculate the viewBox in the original coordinate space
      const viewBoxStartX = firstPageStartX + i * finalViewBoxWidthPerPage;
      const viewBoxWidth = finalViewBoxWidthPerPage;
      const viewBoxHeightToUse = Math.max(finalViewBoxHeightPerPage, height); // Ensure full height is covered

      // Create a new SVG for this page by cloning and adjusting viewBox
      const pageSvg = fullSvg.cloneNode(true);
      const pageSvgElement = d3.select(pageSvg);

      // Set viewBox to show the scaled portion of the landscape
      // The viewBox shows more content per page (zoomed out), and height is scaled to leave blank at bottom
      // preserveAspectRatio="xMidYMin slice" ensures content aligns to the top
      pageSvgElement
        .attr("viewBox", `${viewBoxStartX} 0 ${viewBoxWidth} ${viewBoxHeightToUse}`)
        .attr("width", pageWidth)
        .attr("height", pageHeight)
        .attr("preserveAspectRatio", "xMidYMin meet");

      // Wait a moment for viewBox to apply
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Convert to PNG (this will handle 2x scaling for high DPI)
      // The page will have blank space at the bottom automatically since viewBox height < pageHeight
      const pngBlob = await svgToPng(pageSvg, pageWidth, pageHeight);

      // Add to zip
      zip.file(`page-${String(i + 1).padStart(3, "0")}.png`, pngBlob);
    }

    // Generate zip file
    loadingDiv.innerHTML = "<div>Creating zip file...</div>";
    const zipBlob = await zip.generateAsync({type: "blob"});

    // Download zip file
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landscape-${new Date().toISOString().split("T")[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Cleanup
    document.body.removeChild(tempContainer);
    loadingDiv.innerHTML = "<div>Done! Download started.</div>";
    setTimeout(() => {
      if (document.body.contains(loadingDiv)) {
        document.body.removeChild(loadingDiv);
      }
    }, 2000);

    return {success: true, numPages: targetNumPages};
  } catch (error) {
    console.error("Export error:", error);
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
