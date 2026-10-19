import { useEffect } from "react";
import defaultCss from "@solspace/freeform-theme-default/styles.css?inline";
import bootstrapCss from "bootstrap/dist/css/bootstrap.min.css?inline";
import bootstrapThemeCss from "@solspace/freeform-theme-bootstrap/styles.css?inline";
import type { StoredThemeSkin } from "./themePrefs";

const ATTR = "data-freeform-demo-theme-css";

/**
 * Inject only the active theme stylesheet(s).
 * Bootstrap reboot + default theme CSS are global and fight Tailwind if always loaded.
 */
export function useThemeCss(themeSkin: StoredThemeSkin) {
  useEffect(() => {
    document.querySelectorAll(`style[${ATTR}]`).forEach((el) => el.remove());

    const css =
      themeSkin === "default"
        ? defaultCss
        : themeSkin === "bootstrap"
          ? `${bootstrapCss}\n${bootstrapThemeCss}`
          : "";

    if (!css) {
      return;
    }

    const style = document.createElement("style");
    style.setAttribute(ATTR, themeSkin);
    style.textContent = css;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [themeSkin]);
}
