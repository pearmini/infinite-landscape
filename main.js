import {render} from "./render.js";

// Check if URL param 'show' is true
const urlParams = new URLSearchParams(window.location.search);
const showFullscreenButton = urlParams.get("show") === "true";

let currentNode = null;
let currentSeed = process.env.NODE_ENV === "development" ? 10000 : Date.now();

function createAndRender() {
  const container = document.querySelector("#container");
  if (currentNode) {
    container.removeChild(currentNode);
  }

  currentNode = render({
    width: window.innerWidth,
    seed: currentSeed,
  });

  container.appendChild(currentNode);
}

// Initial render
createAndRender();

// Convert links to plain text in show mode
if (showFullscreenButton) {
  const contentDiv = document.querySelector(".content");
  const links = contentDiv.querySelectorAll("a");
  links.forEach((link) => {
    const text = link.textContent;
    link.replaceWith(document.createTextNode(text));
  });
}

// Create fullscreen button if show param is true
if (showFullscreenButton) {
  const fullscreenButton = document.createElement("button");
  fullscreenButton.textContent = "⛶ Fullscreen";
  fullscreenButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  `;
  fullscreenButton.addEventListener("mouseenter", () => {
    fullscreenButton.style.background = "rgba(0, 0, 0, 0.9)";
  });
  fullscreenButton.addEventListener("mouseleave", () => {
    fullscreenButton.style.background = "rgba(0, 0, 0, 0.7)";
  });

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  });

  document.body.appendChild(fullscreenButton);

  // Function to update button visibility based on fullscreen state
  function updateButtonVisibility() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    fullscreenButton.style.display = isFullscreen ? "none" : "block";
  }

  // Listen for fullscreen changes to hide/show button
  document.addEventListener("fullscreenchange", updateButtonVisibility);
  document.addEventListener("webkitfullscreenchange", updateButtonVisibility);
  document.addEventListener("mozfullscreenchange", updateButtonVisibility);
  document.addEventListener("MSFullscreenChange", updateButtonVisibility);
}

// Handle fullscreen changes and resize
function handleResize() {
  createAndRender();
}

// Listen for fullscreen changes
document.addEventListener("fullscreenchange", handleResize);
document.addEventListener("webkitfullscreenchange", handleResize);
document.addEventListener("mozfullscreenchange", handleResize);
document.addEventListener("MSFullscreenChange", handleResize);

// Listen for window resize
window.addEventListener("resize", handleResize);
