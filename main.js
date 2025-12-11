import {render} from "./render.js";
import {exportLandscapeToZip} from "./export.js";
import {exportRisoLayers, exportRisoLayers4} from "./riso-export.js";

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

// Add riso export button handler
const risoExportBtn = document.querySelector("#riso-export-btn");
if (risoExportBtn) {
  risoExportBtn.addEventListener("click", async () => {
    risoExportBtn.disabled = true;
    risoExportBtn.textContent = "Generating...";
    try {
      await exportRisoLayers({
        seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
        height: 600,
        debug: false,
      });
    } catch (error) {
      console.error("Riso export failed:", error);
      alert("Riso export failed: " + error.message);
    } finally {
      risoExportBtn.disabled = false;
      risoExportBtn.textContent = "Export Riso Layers";
    }
  });
}

// Add riso debug button handler
const risoDebugBtn = document.querySelector("#riso-debug-btn");
if (risoDebugBtn) {
  risoDebugBtn.addEventListener("click", async () => {
    risoDebugBtn.disabled = true;
    risoDebugBtn.textContent = "Generating...";
    try {
      await exportRisoLayers({
        seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
        height: 600,
        debug: true,
      });
    } catch (error) {
      console.error("Riso debug failed:", error);
      alert("Riso debug failed: " + error.message);
    } finally {
      risoDebugBtn.disabled = false;
      risoDebugBtn.textContent = "Debug Riso (Page 1)";
    }
  });
}

// Add riso export 4 layers button handler
const risoExport4Btn = document.querySelector("#riso-export-4-btn");
if (risoExport4Btn) {
  risoExport4Btn.addEventListener("click", async () => {
    risoExport4Btn.disabled = true;
    risoExport4Btn.textContent = "Generating...";
    try {
      await exportRisoLayers4({
        seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
        height: 600,
        debug: false,
      });
    } catch (error) {
      console.error("Riso export 4 failed:", error);
      alert("Riso export 4 failed: " + error.message);
    } finally {
      risoExport4Btn.disabled = false;
      risoExport4Btn.textContent = "Export Riso Layers (4)";
    }
  });
}

// Add riso debug 4 layers button handler
const risoDebug4Btn = document.querySelector("#riso-debug-4-btn");
if (risoDebug4Btn) {
  risoDebug4Btn.addEventListener("click", async () => {
    risoDebug4Btn.disabled = true;
    risoDebug4Btn.textContent = "Generating...";
    try {
      await exportRisoLayers4({
        seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
        height: 600,
        debug: true,
      });
    } catch (error) {
      console.error("Riso debug 4 failed:", error);
      alert("Riso debug 4 failed: " + error.message);
    } finally {
      risoDebug4Btn.disabled = false;
      risoDebug4Btn.textContent = "Debug Riso 4 (Page 1)";
    }
  });
}
