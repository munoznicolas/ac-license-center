import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { isStaticHost } from "../api/client";

export function startOnboardingTour(): void {
  const staticHost = isStaticHost();
  const tourDriver = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.75,
    stagePadding: 8,
    stageRadius: 6,
    allowClose: true,
    doneBtnText: "Finish Tour",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    steps: [
      {
        element: "#app",
        popover: {
          title: "Welcome to AC License Center",
          description: "Design, calibrate, and export Gran Turismo-style driving school license tests for Assetto Corsa.",
        },
      },
      {
        element: ".license-nav",
        popover: {
          title: "License Tiers & GT Reference",
          description: "Switch between National B, National A, International B, International A, Super License, and GT reference benchmarks.",
        },
      },
      {
        element: "#sidebar",
        popover: {
          title: "Test Catalog",
          description: "Select, reorder, or create license tests within the active tier.",
        },
      },
      {
        element: ".editor-pane",
        popover: {
          title: "Test Editor & Track Spline",
          description: "Configure track, car, start mode, gate positions, and medal targets.",
        },
      },
      {
        element: "#btn-header-menu",
        popover: {
          title: staticHost ? "Save & Export" : "Save, Test Drive & Sync",
          description: staticHost
            ? "Open the Actions menu to export a Content Manager .zip package, import/export curriculum.json, or submit a telemetry Pull Request."
            : "Open the Actions menu to export a Content Manager .zip package, sync directly to Assetto Corsa, or batch-record missing telemetry.",
        },
      },
    ],
  });

  tourDriver.drive();
}
