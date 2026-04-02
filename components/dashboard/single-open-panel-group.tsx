"use client";

import { useEffect, useRef, type ReactNode } from "react";

type SingleOpenPanelGroupProps = {
  children: ReactNode;
};

export function SingleOpenPanelGroup({ children }: SingleOpenPanelGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const getPanels = () =>
      Array.from(container.querySelectorAll<HTMLDetailsElement>("details[data-single-open-panel]"));

    const normalizeOpenPanels = (activePanel?: HTMLDetailsElement) => {
      const openPanels = getPanels().filter((panel) => panel.open);
      const panelToKeepOpen = activePanel && activePanel.open ? activePanel : openPanels[0];

      openPanels.forEach((panel) => {
        if (panel !== panelToKeepOpen) {
          panel.open = false;
        }
      });
    };

    const handleToggle = (event: Event) => {
      const panel = event.target;

      if (!(panel instanceof HTMLDetailsElement) || !container.contains(panel)) {
        return;
      }

      if (!panel.matches("details[data-single-open-panel]")) {
        return;
      }

      if (panel.open) {
        normalizeOpenPanels(panel);
      }
    };

    normalizeOpenPanels();
    container.addEventListener("toggle", handleToggle, true);

    return () => {
      container.removeEventListener("toggle", handleToggle, true);
    };
  }, []);

  return <div ref={containerRef}>{children}</div>;
}
