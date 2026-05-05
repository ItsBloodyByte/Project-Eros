/**
 * Screenshot deterrents — disabled by product decision (2026-04).
 *
 * Previous behaviour intercepted right-click, drag, Ctrl/Cmd+P,
 * PrintScreen, focus loss and tab-visibility changes to blur the app.
 * That has been removed because the friction it added far outweighed
 * the (largely illusory) protection it offered: an OS-level screenshot
 * tool always wins, and legitimate users were affected (browser
 * password managers, accessibility tools, screen readers).
 *
 * The export is preserved as a no-op so existing call sites keep working
 * without further refactoring.
 */
export function installScreenshotDeterrents() {
  /* intentionally empty */
}
