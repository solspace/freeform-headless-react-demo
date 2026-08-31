import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "@solspace/freeform-theme-default/styles.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "@solspace/freeform-theme-bootstrap/styles.css";
import "./tailwind.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
