import {render} from "./render.js";
import {exportLandscapeToZip} from "./export.js";

const node = render({
  width: window.innerWidth,
  seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
});

document.querySelector("#container").appendChild(node);

// Add download button handler
const downloadBtn = document.querySelector("#download-btn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Generating...";
    try {
      await exportLandscapeToZip({
        seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
        height: 600,
      });
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed: " + error.message);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Landscape";
    }
  });
}
