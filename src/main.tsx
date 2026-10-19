import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
/** Tailwind utilities only — default/bootstrap CSS load per skin via useThemeCss. */
import "./tailwind.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
