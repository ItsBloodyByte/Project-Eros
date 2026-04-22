/**
 * Screenshot deterrent helpers.
 * On the web, preventing screenshots is fundamentally impossible — the OS can
 * always capture. We layer several deterrents that raise the friction and,
 * where possible, blur sensitive content before the capture happens:
 *   1) disable right-click context menu on sensitive surfaces
 *   2) disable image drag & text selection
 *   3) block Ctrl/Cmd+P (print) and Ctrl/Cmd+Shift+S / PrintScreen (best effort)
 *   4) blur the whole app when the window loses focus or the tab goes to the
 *      background — this hides content before a stealth capture tool gets a
 *      sharp frame.
 * Best-effort only; enforce on the RN/iOS/Android app via expo-screen-capture.
 */

let installed = false;

export function installScreenshotDeterrents() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const onContextMenu = (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".no-capture")) {
      e.preventDefault();
    }
  };

  const onDragStart = (e) => {
    const t = e.target;
    if (t && t.closest && t.closest(".no-capture")) e.preventDefault();
  };

  const onKeyDown = (e) => {
    const key = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && key === "p") { e.preventDefault(); blur("print-blocked"); }
    if (mod && e.shiftKey && key === "s") { e.preventDefault(); blur("save-blocked"); }
    if (key === "printscreen") { blur("printscreen-blocked"); }
  };

  let blurTimer = null;
  const blur = (reason) => {
    try { document.body.classList.add("eros-blurred"); } catch {}
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      try { document.body.classList.remove("eros-blurred"); } catch {}
    }, 1200);
    try {
      navigator.sendBeacon && navigator.sendBeacon(
        (process.env.REACT_APP_BACKEND_URL || "") + "/api/client-event",
        JSON.stringify({ type: "screenshot_attempt", reason })
      );
    } catch {}
  };

  const onBlur = () => { try { document.body.classList.add("eros-blurred"); } catch {} };
  const onFocus = () => { try { document.body.classList.remove("eros-blurred"); } catch {} };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") onBlur();
    else onFocus();
  };

  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);
}
