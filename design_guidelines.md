{
  "admin_redesign_scope": {
    "scope": "ONLY /admin area. Do not touch consumer-facing pages (Discover/Chat/Profile/Premium/etc.).",
    "goal": "Make /admin feel like a serious internal console (Linear/Stripe/Vercel/Sentry/Notion Settings): dense, calm under pressure, keyboard-friendly, with clear information architecture and detailed states.",
    "routing_recommendation": {
      "approach": "Use query params under the existing /admin route (no new router tree).",
      "example": "/admin?section=moderation.reports",
      "why": "Keeps lazy-loading intact, avoids nested router complexity, enables deep-linking + back/forward + shareable URLs for specific queues and filtered views.",
      "state": {
        "section": "string",
        "filters": "serialize key filters into query params (q, status, assignee, dateRange, sort, page)",
        "drawer": "optional query param like drawer=report:123 for deep-linkable detail views"
      }
    }
  },

  "visual_personality": {
    "brand_attributes": [
      "Trustworthy under pressure",
      "Operational clarity",
      "High-density, low-noise",
      "Fast scanning (status-first)",
      "Engineer-friendly (IDs, timestamps, audit trails)"
    ],
    "style_fusion": {
      "layout_principle": "Linear-style compact lists + Stripe-style structured settings forms",
      "surface_language": "Notion-like neutral surfaces with subtle borders + Vercel-like crisp typography",
      "motion": "Sentry-like pragmatic micro-interactions (no flashy transitions)"
    },
    "do_not_do": [
      "No playful gradients or consumer-app hero styling in admin",
      "No oversized whitespace; prioritize density",
      "No custom HTML dropdowns/dialogs/tables—compose shadcn/ui primitives"
    ]
  },

  "information_architecture": {
    "sidebar_groups": [
      {
        "group": "Overview",
        "items": [
          { "key": "overview", "label": "Overview", "icon": "LayoutDashboard" }
        ]
      },
      {
        "group": "Moderation",
        "items": [
          { "key": "moderation.reports", "label": "Reports queue", "icon": "Flag", "badge": "openReports" },
          { "key": "moderation.photos", "label": "Photo moderation", "icon": "Image", "badge": "pendingPhotos" },
          { "key": "moderation.verifications", "label": "ID verifications", "icon": "BadgeCheck", "badge": "pendingIDs" },
          { "key": "moderation.honeypots", "label": "Honeypots & shadow-bans", "icon": "ShieldAlert", "badge": "shadowBans" }
        ]
      },
      {
        "group": "People",
        "items": [
          { "key": "people.users", "label": "Users", "icon": "Users" },
          { "key": "people.sparks", "label": "Sparks", "icon": "Sparkles" },
          { "key": "people.subscriptions", "label": "Subscriptions", "icon": "Crown" }
        ]
      },
      {
        "group": "Content",
        "items": [
          { "key": "content.blog", "label": "Blog", "icon": "FileText", "note": "Already polished — do not touch UI beyond shell embedding." },
          { "key": "content.legal", "label": "Legal pages", "icon": "Scale" },
          { "key": "content.broadcasts", "label": "Broadcasts", "icon": "Megaphone" },
          { "key": "content.promos", "label": "Promos & config", "icon": "Ticket" }
        ]
      },
      {
        "group": "Operations",
        "items": [
          { "key": "ops.payments", "label": "Payments", "icon": "CreditCard", "badge": "stalePayments" },
          { "key": "ops.ai", "label": "AI moderation config", "icon": "SlidersHorizontal" },
          { "key": "ops.audit", "label": "Audit log", "icon": "ScrollText" },
          { "key": "ops.team", "label": "Team channels", "icon": "MessagesSquare" }
        ]
      }
    ],
    "topbar": {
      "left": ["Sidebar collapse toggle", "Breadcrumb"],
      "center": ["Global search (Command palette style)"] ,
      "right": ["Environment pill (DEV/PROD)", "Support shortcut", "Current admin user menu"]
    }
  },

  "typography": {
    "fonts": {
      "keep_existing": "Use existing project fonts from index.css: Figtree for admin UI; IBM Plex Mono for IDs/timestamps.",
      "admin_heading": "Figtree (font-display class is also Figtree here; keep consumer serif untouched elsewhere).",
      "mono_usage": "Use .font-mono for IDs, transaction refs, session IDs, timestamps, API key last-4."
    },
    "scale_admin_dense": {
      "page_h1": "text-[24px] leading-[1.15] font-semibold tracking-[-0.01em]",
      "section_h2": "text-[18px] leading-[1.2] font-semibold",
      "body": "text-[13px] md:text-[14px] leading-[1.45]",
      "meta": "text-[12px] leading-[1.35] text-muted-foreground",
      "table_header": "text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground",
      "code": "text-[12px] font-mono"
    },
    "density_rules": {
      "row_height": {
        "compact": "h-10 (40px)",
        "default": "h-11 (44px)",
        "relaxed": "h-12 (48px)"
      },
      "spacing": {
        "page_padding": "p-4 md:p-6",
        "card_padding": "p-4",
        "toolbar_gap": "gap-2",
        "table_cell_padding": "py-2 px-3 (compact)"
      }
    }
  },

  "color_system_admin": {
    "principle": "Reuse existing CSS variables; add admin-specific semantic tokens as aliases (do not break consumer theme).",
    "admin_tokens_to_add": {
      "note": "Implement as CSS variables scoped under .admin-root (wrapper div) so consumer app remains unchanged.",
      "css_variables": {
        "--admin-surface": "hsl(var(--card))",
        "--admin-surface-2": "hsl(var(--secondary))",
        "--admin-elevated": "hsl(var(--popover))",
        "--admin-border": "hsl(var(--border))",
        "--admin-text": "hsl(var(--foreground))",
        "--admin-text-muted": "hsl(var(--muted-foreground))",
        "--admin-focus": "hsl(var(--ring))"
      }
    },
    "status_colors": {
      "open": { "bg": "hsl(var(--warning) / 0.16)", "fg": "hsl(var(--warning))", "border": "hsl(var(--warning) / 0.35)" },
      "pending": { "bg": "hsl(var(--info) / 0.14)", "fg": "hsl(var(--info))", "border": "hsl(var(--info) / 0.30)" },
      "resolved": { "bg": "hsl(var(--success) / 0.14)", "fg": "hsl(var(--success))", "border": "hsl(var(--success) / 0.30)" },
      "banned": { "bg": "hsl(var(--destructive) / 0.12)", "fg": "hsl(var(--destructive))", "border": "hsl(var(--destructive) / 0.28)" },
      "neutral": { "bg": "hsl(var(--muted))", "fg": "hsl(var(--muted-foreground))", "border": "hsl(var(--border))" }
    },
    "sidebar_active_state": {
      "bg": "hsl(var(--accent) / 0.14)",
      "fg": "hsl(var(--foreground))",
      "left_indicator": "2px solid hsl(var(--accent))"
    },
    "hover_states": {
      "row_hover": "bg-muted/60",
      "nav_hover": "bg-muted/50",
      "icon_button_hover": "bg-muted"
    }
  },

  "layout_blueprint": {
    "admin_shell": {
      "structure": "Sidebar (collapsible) + Topbar + Content",
      "dimensions": {
        "sidebar_width": "w-[264px]",
        "sidebar_collapsed": "w-[72px]",
        "topbar_height": "h-14",
        "content_max_width": "max-w-[1600px] (centered within content area only, not whole app)",
        "content_padding": "px-4 md:px-6 py-4"
      },
      "surfaces": {
        "sidebar": "bg-card border-r",
        "topbar": "glass-surface sticky top-0 z-30",
        "content": "bg-background"
      },
      "key_elements": {
        "skip_link": "Add a visually-hidden skip-to-content link that appears on focus.",
        "breadcrumb": "Use shadcn Breadcrumb component.",
        "page_header": "Title left; actions right; optional subtext line for counts/last refresh.",
        "command_palette": "Use shadcn Command inside Dialog for global search + navigation."
      }
    }
  },

  "component_specs": {
    "kpi_card": {
      "use": "Overview KPIs (open reports, pending photos, pending IDs, stale payments, DAU, premium conversion, sparks circulation)",
      "shadcn": ["card.jsx", "badge.jsx", "tooltip.jsx", "skeleton.jsx"],
      "optional_lib": {
        "name": "recharts",
        "install": "npm i recharts",
        "use": "Mini sparkline in KPI card footer (height 28–36px)."
      },
      "layout": {
        "container": "Card with p-4, hover elevation",
        "top_row": "Label + status dot or info tooltip",
        "value": "text-[22px] font-semibold tabular-nums",
        "delta": "Badge-like chip with +/-% and arrow icon",
        "sparkline": "Muted stroke, no fill, no grid"
      },
      "tailwind": {
        "card": "rounded-[var(--radius-sm)] border bg-card shadow-sm",
        "hover": "transition-shadow duration-200 hover:shadow-md",
        "value": "text-[22px] font-semibold tracking-[-0.01em]",
        "label": "text-[12px] text-muted-foreground",
        "delta_positive": "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20",
        "delta_negative": "text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/20"
      },
      "data_testids": {
        "card": "overview-kpi-card",
        "value": "overview-kpi-value",
        "sparkline": "overview-kpi-sparkline"
      }
    },

    "data_table": {
      "use": "All list views: reports, users, payments, audit log, promos, broadcasts",
      "shadcn": ["table.jsx", "checkbox.jsx", "button.jsx", "badge.jsx", "dropdown-menu.jsx", "tooltip.jsx", "scroll-area.jsx", "skeleton.jsx"],
      "behavior": {
        "sticky_header": "Header sticks within scroll container; add subtle shadow when scrolled.",
        "zebra": "Every other row uses bg-muted/30 for scanability.",
        "row_hover": "bg-muted/60",
        "row_click": "Opens RowDrawer (Sheet) with details; keep checkbox click from triggering drawer.",
        "selection": "Checkbox column + select-all with indeterminate state.",
        "bulk_actions": "BulkActionBar appears when selection count > 0.",
        "density_toggle": "Optional: compact/default/relaxed stored in localStorage."
      },
      "tailwind": {
        "container": "rounded-[var(--radius-sm)] border bg-card overflow-hidden",
        "scroll": "max-h-[calc(100vh-220px)] overflow-auto",
        "thead": "sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b",
        "th": "h-10 px-3 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground",
        "td": "px-3 py-2 text-[13px]",
        "row": "h-10 hover:bg-muted/60 data-[state=selected]:bg-muted",
        "zebra": "odd:bg-muted/20"
      },
      "data_testids": {
        "table": "admin-data-table",
        "row": "admin-data-table-row",
        "select_all": "admin-data-table-select-all",
        "row_checkbox": "admin-data-table-row-checkbox",
        "sort_button": "admin-data-table-sort-button"
      }
    },

    "filter_bar": {
      "use": "Top-of-page filters for queues and management pages",
      "shadcn": ["input.jsx", "select.jsx", "button.jsx", "popover.jsx", "calendar.jsx", "badge.jsx", "separator.jsx"],
      "layout": "Single row on desktop; wraps on mobile. Left: search + key filters. Right: view toggles + export + refresh.",
      "patterns": {
        "global_search": "Search input with leading icon; supports Cmd/Ctrl+K to focus.",
        "active_filters": "Show active filters as removable chips (Badge variant).",
        "advanced_filters": "Open in Sheet/Drawer for complex filters (date range, multi-select)."
      },
      "tailwind": {
        "wrap": "flex flex-col gap-2 md:flex-row md:items-center md:justify-between",
        "left": "flex flex-1 flex-wrap items-center gap-2",
        "right": "flex items-center gap-2",
        "search": "w-full md:w-[360px]",
        "chip": "rounded-full px-2 py-0.5 text-[12px]"
      },
      "data_testids": {
        "search": "admin-filter-search-input",
        "status": "admin-filter-status-select",
        "date": "admin-filter-date-range",
        "clear": "admin-filter-clear-button"
      }
    },

    "row_drawer": {
      "use": "Detail view for report/user/payment/audit entry without leaving list context",
      "shadcn": ["sheet.jsx", "tabs.jsx", "separator.jsx", "button.jsx", "badge.jsx", "scroll-area.jsx", "dialog.jsx"],
      "behavior": {
        "open": "Row click opens Sheet from right (desktop) or Drawer (mobile).",
        "esc_close": "ESC closes drawer; focus returns to triggering row.",
        "deep_link": "Optional query param drawer=type:id",
        "danger_actions": "Approve/Reject/Delete require AlertDialog confirmation."
      },
      "dimensions": {
        "desktop": "w-[520px] lg:w-[640px]",
        "mobile": "Drawer bottom with max-h-[85vh]"
      },
      "tailwind": {
        "header": "px-4 py-3 border-b flex items-start justify-between gap-3",
        "title": "text-[16px] font-semibold",
        "body": "p-4",
        "meta_grid": "grid grid-cols-2 gap-3 text-[12px]",
        "actions": "flex items-center gap-2"
      },
      "data_testids": {
        "sheet": "admin-row-drawer",
        "close": "admin-row-drawer-close",
        "primary_action": "admin-row-drawer-primary-action"
      }
    },

    "bulk_action_bar": {
      "use": "Appears when rows selected (reports/photos/users/payments)",
      "shadcn": ["button.jsx", "badge.jsx", "separator.jsx"],
      "behavior": {
        "position": "Sticky at bottom of viewport within content area (not global).",
        "animation": "Fade + slide up 6px (Framer Motion optional).",
        "actions": "Contextual: resolve/assign/ban/export/approve/reject"
      },
      "tailwind": {
        "wrap": "fixed bottom-4 left-[calc(var(--sidebar-w)+16px)] right-4 z-40",
        "bar": "glass-surface rounded-[var(--radius-sm)] border shadow-md px-3 py-2 flex items-center justify-between",
        "count": "text-[12px] text-muted-foreground",
        "btn": "h-8 px-2.5"
      },
      "data_testids": {
        "bar": "admin-bulk-action-bar",
        "count": "admin-bulk-action-count",
        "action": "admin-bulk-action-button"
      }
    },

    "status_pill": {
      "use": "Status indicators across tables and drawers",
      "shadcn": ["badge.jsx"],
      "variants": ["open", "pending", "resolved", "banned", "neutral"],
      "tailwind": {
        "base": "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium",
        "dot": "h-1.5 w-1.5 rounded-full"
      },
      "data_testids": {
        "pill": "admin-status-pill"
      }
    },

    "empty_state": {
      "use": "Every list/grid view",
      "shadcn": ["card.jsx", "button.jsx"],
      "content": "Title, 1-line explanation, primary action (adjust filters / refresh / create), optional secondary link.",
      "tailwind": {
        "wrap": "rounded-[var(--radius-sm)] border bg-card p-8 text-center",
        "title": "text-[14px] font-semibold",
        "desc": "mt-1 text-[13px] text-muted-foreground",
        "actions": "mt-4 flex items-center justify-center gap-2"
      },
      "data_testids": {
        "state": "admin-empty-state",
        "primary": "admin-empty-state-primary-action"
      }
    },

    "loading_skeleton": {
      "use": "Tables, KPI cards, drawers",
      "shadcn": ["skeleton.jsx"],
      "patterns": {
        "table": "Render 8–12 skeleton rows with consistent cell widths",
        "kpi": "Skeleton label + value + sparkline block",
        "drawer": "Skeleton header + sections"
      },
      "data_testids": {
        "skeleton": "admin-loading-skeleton"
      }
    }
  },

  "page_templates": {
    "overview": {
      "layout": "Header + KPI grid + two-column area (Queues + Trends) + recent audit stream",
      "grid": {
        "kpis": "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3",
        "lower": "grid grid-cols-1 xl:grid-cols-3 gap-4",
        "queues": "xl:col-span-2",
        "audit": "xl:col-span-1"
      },
      "widgets": [
        "KPI cards with sparklines",
        "Queue cards: Open Reports, Pending Photos, Pending IDs (each shows top 5 + 'View all')",
        "Stale payments callout with Sweep button (danger confirm)",
        "Mini chart: DAU + Premium conversion (Recharts line)"
      ],
      "data_testids": {
        "page": "admin-overview-page",
        "kpi_grid": "admin-overview-kpi-grid"
      }
    },

    "reports_queue": {
      "layout": "FilterBar + DataTable + RowDrawer",
      "columns": [
        "Checkbox",
        "StatusPill",
        "Reported entity (user/message/photo)",
        "Reason",
        "Reporter",
        "Assignee",
        "Created",
        "SLA/age"
      ],
      "bulk_actions": ["Assign", "Resolve", "Escalate", "Ban user"],
      "row_drawer_tabs": ["Summary", "Evidence", "User", "History"],
      "micro_interactions": [
        "Row hover reveals quick actions (Assign/Resolve) as ghost buttons",
        "Press 'e' to open evidence tab when drawer open",
        "Press ESC to close drawer"
      ],
      "data_testids": {
        "page": "admin-reports-page",
        "resolve": "admin-reports-resolve-button",
        "assign": "admin-reports-assign-button"
      }
    },

    "photo_moderation": {
      "layout": "FilterBar + Masonry-like grid (but implemented as responsive CSS grid) + right-side drawer",
      "grid": "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3",
      "card": {
        "surface": "Card with image, user meta, status pill",
        "actions": "Approve/Reject as icon buttons; keyboard: A approve, R reject when focused",
        "safety": "Reject requires reason (Select + optional note)"
      },
      "data_testids": {
        "page": "admin-photos-page",
        "approve": "admin-photo-approve-button",
        "reject": "admin-photo-reject-button"
      }
    },

    "user_detail_drawer": {
      "layout": "Sheet with header actions + tabs",
      "tabs": ["Profile", "Sessions", "Moderation", "Payments", "Sparks"],
      "header_actions": ["Ban/Unban", "Shadow-ban", "Reset sessions", "Copy user ID"],
      "sections": [
        "Identity block (ID, email/phone, roles)",
        "Risk signals (reports count, verification status)",
        "Recent activity (audit excerpts)",
        "Sparks balance + adjust form (with confirmation)"
      ],
      "data_testids": {
        "drawer": "admin-user-drawer",
        "ban": "admin-user-ban-button",
        "copy_id": "admin-user-copy-id-button"
      }
    },

    "ai_moderation_config": {
      "layout": "Settings-style form with sections and inline help",
      "sections": [
        "Provider (Gemini/OpenAI/Anthropic)",
        "API keys (masked input + reveal toggle)",
        "Thresholds (Slider + numeric input)",
        "Dry-run mode toggle",
        "Test prompt runner (Command-like input + result panel)"
      ],
      "shadcn": ["form.jsx", "select.jsx", "input.jsx", "slider.jsx", "switch.jsx", "textarea.jsx", "alert.jsx", "alert-dialog.jsx"],
      "danger_zone": "Hard-delete behavior for ID verification decisions must be explicit with AlertDialog confirmation.",
      "data_testids": {
        "page": "admin-ai-config-page",
        "provider": "admin-ai-provider-select",
        "save": "admin-ai-config-save-button",
        "test": "admin-ai-config-test-button"
      }
    }
  },

  "micro_interactions_and_motion": {
    "principles": [
      "Motion communicates state change (selection, open drawer, saved) — never decorative",
      "Fast durations (120–180ms) with existing --ease-out",
      "No transition: all"
    ],
    "recommended": {
      "nav_active": "Active item slides in a 2px left indicator",
      "row_hover": "Background fade only (no transform)",
      "drawer_open": "Sheet slides in; overlay fades",
      "bulk_bar": "Fade + translateY(6px)"
    },
    "keyboard_shortcuts": {
      "minimum": ["ESC closes drawer/dialog", "? opens shortcuts help"],
      "recommended": ["g then r => Reports", "g then p => Photos", "g then u => Users", "Cmd/Ctrl+K => global search"]
    }
  },

  "accessibility": {
    "requirements": [
      "Full keyboard navigation (Tab order, focus-visible rings)",
      "Skip-to-content link",
      "All icon-only buttons must have aria-label",
      "Tables: sortable headers must be buttons with aria-sort",
      "Color is never the only status indicator (use text + dot/icon)",
      "Respect prefers-reduced-motion"
    ],
    "focus": {
      "ring": "Use ring-2 ring-ring ring-offset-2 ring-offset-background on focus-visible",
      "drawer_focus": "Trap focus inside Sheet/Drawer; return focus to triggering row on close"
    }
  },

  "recommended_folder_structure": {
    "note": "JS files (not TSX). Keep existing lazy-load entry.",
    "tree": [
      "src/admin/AdminEntry.jsx (existing lazy entry stays)",
      "src/admin/shell/AdminShell.jsx",
      "src/admin/shell/AdminSidebar.jsx",
      "src/admin/shell/AdminTopbar.jsx",
      "src/admin/shell/AdminBreadcrumbs.jsx",
      "src/admin/components/AdminKpiCard.jsx",
      "src/admin/components/AdminDataTable.jsx",
      "src/admin/components/AdminFilterBar.jsx",
      "src/admin/components/AdminRowDrawer.jsx",
      "src/admin/components/AdminStatusPill.jsx",
      "src/admin/components/AdminEmptyState.jsx",
      "src/admin/components/AdminLoadingSkeleton.jsx",
      "src/admin/pages/OverviewPage.jsx",
      "src/admin/pages/ReportsPage.jsx",
      "src/admin/pages/PhotosPage.jsx",
      "src/admin/pages/VerificationsPage.jsx",
      "src/admin/pages/UsersPage.jsx",
      "src/admin/pages/PaymentsPage.jsx",
      "src/admin/pages/AiConfigPage.jsx",
      "src/admin/pages/LegalEditorPage.jsx",
      "src/admin/pages/BroadcastsPage.jsx",
      "src/admin/pages/PromosPage.jsx",
      "src/admin/pages/AuditLogPage.jsx",
      "src/admin/pages/TeamChannelsPage.jsx",
      "src/admin/pages/SparksPage.jsx",
      "src/admin/pages/HoneypotsPage.jsx"
    ]
  },

  "handoff_notes_to_implementing_agent": {
    "keep": [
      "Consumer app pages and styling",
      "Existing theme tokens in index.css",
      "Lazy-loading of admin bundle",
      "AdminBlogTab UI (embed inside new shell without redesign)",
      "AdminPromosTab and AdminHoneypotsTab logic (wrap with new templates)"
    ],
    "refactor_or_replace": [
      "Replace current AdminNav with new AdminSidebar (collapsible, grouped, badges)",
      "Introduce AdminShell wrapper to standardize topbar/breadcrumb/header/content",
      "Standardize list views to AdminDataTable + FilterBar + RowDrawer patterns",
      "Ensure every interactive element has data-testid"
    ],
    "testing": {
      "data_testid_rule": "All interactive and key informational elements MUST include data-testid in kebab-case describing role.",
      "examples": [
        "data-testid=\"admin-sidebar-nav-item-reports\"",
        "data-testid=\"admin-topbar-global-search\"",
        "data-testid=\"admin-reports-bulk-resolve-button\"",
        "data-testid=\"admin-user-drawer-ban-button\""
      ]
    }
  },

  "image_urls": {
    "note": "Admin console does not require decorative photography. Use icons + typography. No external images needed.",
    "categories": [
      {
        "category": "empty_states",
        "description": "Prefer icon-based empty states (lucide-react) instead of illustrations for a serious console.",
        "urls": []
      }
    ]
  },

  "component_path": {
    "shadcn_ui": "/app/frontend/src/components/ui/",
    "primary_components": [
      "button.jsx",
      "badge.jsx",
      "card.jsx",
      "table.jsx",
      "checkbox.jsx",
      "input.jsx",
      "select.jsx",
      "sheet.jsx",
      "drawer.jsx",
      "dialog.jsx",
      "alert-dialog.jsx",
      "tabs.jsx",
      "breadcrumb.jsx",
      "command.jsx",
      "scroll-area.jsx",
      "separator.jsx",
      "skeleton.jsx",
      "tooltip.jsx",
      "sonner.jsx"
    ]
  },

  "instructions_to_main_agent": [
    "Implement AdminShell first (sidebar + topbar + content slot).",
    "Add .admin-root wrapper around admin area and scope any admin-only CSS variables/classes there.",
    "Use query-param routing under /admin (section=...).",
    "Standardize each section page to: PageHeader -> FilterBar -> Content (Table/Grid) -> RowDrawer.",
    "Use shadcn Sheet for desktop drawers; Drawer for mobile.",
    "Add robust states: loading skeleton, empty state, error state with retry.",
    "Ensure density: table rows h-10, header h-10, body text 13–14px.",
    "Never use transition: all; only transition background-color, box-shadow, opacity where needed.",
    "Add keyboard shortcuts: ESC closes, ? opens help, Cmd/Ctrl+K global search.",
    "Every interactive element and key info must include data-testid (kebab-case)."
  ],

  "general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
