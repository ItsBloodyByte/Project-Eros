import React from "react";
import { Inbox } from "lucide-react";

/**
 * AdminEmptyState — calm, neutral empty state for queues/tables that
 * resolved to zero rows (and are NOT in an error state).
 *
 * The point: an empty queue is *good news* for moderators — we say so.
 */
export function AdminEmptyState({ icon: Icon = Inbox, title = "Alles sauber", body, action, testid = "admin-empty" }) {
  return (
    <div data-testid={testid} className="py-14 px-6 text-center text-[hsl(var(--muted-foreground))]">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--muted))]/40 ring-1 ring-[hsl(var(--border))]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[14px] font-medium text-[hsl(var(--foreground))]">{title}</div>
      {body && <p className="mt-1 text-[12px] max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
