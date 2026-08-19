"use client";

import { useEffect, useState } from "react";

export default function PortalControls() {
  const [open, setOpen] = useState(true);
  useEffect(() => () => document.body.classList.remove("sidebar-collapsed"), []);
  function toggle() {
    const next = !open;
    setOpen(next);
    document.body.classList.toggle("sidebar-collapsed", !next);
  }
  return <button type="button" className={`portal-menu-toggle ${open ? "" : "open"}`} onClick={toggle} aria-expanded={open} aria-controls="operations-sidebar" aria-label={open ? "Close operations navigation" : "Open operations navigation"}><span aria-hidden="true"/></button>;
}
