import React from "react";
import { ChevronRight } from "lucide-react";

/**
 * AdminPageHeader — standard top of every admin page.
 *
 * Layout:
 *   - Breadcrumb row (top, small, muted)
 *   - Title + optional secondary text on the left
 *   - Action buttons docked right (search input, primary CTA, refresh, etc.)
 *
 * Density follows the admin scale: h1 24px, meta 12px. Spacing kept tight
 * so the header doesn't push the table below the fold on a 13" laptop.
 */
export function AdminPageHeader({ section, breadcrumbs = [], title, subtitle, count, lastUpdated, actions }) {
  return (
    <header className="mb-4 md:mb-5 space-y-2" data-testid="admin-page-header">
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-[hsl(var(--muted-foreground))]">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
              {b.href ? (
                <a href={b.href} className="hover:text-[hsl(var(--foreground))] transition-colors">{b.label}</a>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? "text-[hsl(var(--foreground))] font-medium" : ""}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] md:text-[24px] font-semibold tracking-[-0.01em] leading-tight" data-testid="admin-page-title">
            {title}
            {typeof count === "number" && (
              <span className="ml-2 text-[14px] font-normal text-[hsl(var(--muted-foreground))] tabular-nums" data-testid="admin-page-count">
                {count.toLocaleString("de-DE")}
              </span>
            )}
          </h1>
          {(subtitle || lastUpdated) && (
            <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              {subtitle}
              {lastUpdated && <span className="font-mono">· aktualisiert {lastUpdated}</span>}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
