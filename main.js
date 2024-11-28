import {render} from "./render.js";

const container = document.querySelector("#container");

container.appendChild(render({width: window.innerWidth}));
