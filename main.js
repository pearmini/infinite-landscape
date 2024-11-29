import {render} from "./render.js";

const node = render({
  width: window.innerWidth,
  seed: process.env.NODE_ENV === "development" ? 10000 : Date.now(),
});

document.querySelector("#container").appendChild(node);
