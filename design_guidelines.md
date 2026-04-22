{
  "brand": {
    "name": "Eros",
    "attributes": [
      "schlicht",
      "modern",
      "innovativ",
      "vertrauenswürdig",
      "inklusive (18+, LGBTQ+)",
      "ruhig/premium statt gimmicky"
    ],
    "north_star": "Eine kohärente, systemweite UI (Light+Dark gleichwertig) mit warmem Apricot-Akzent, posterartigen Profilkarten und sehr subtiler Motion."
  },
  "inspiration_refs": {
    "notes": "Nicht 1:1 kopieren; als Inception für Layout/Motion nutzen.",
    "links": [
      {
        "title": "60fps.design – Bottom Sheet interactions",
        "url": "https://60fps.design/shots/filter/bottom-sheet",
        "takeaways": [
          "Sheets/Drawer: Drag-to-close, weiche Federung, klare Griffleiste",
          "In-Context Filter statt Fullscreen-Navigation",
          "Motion: kurze, präzise Übergänge (Opacity/Translate/Scale)"
        ]
      },
      {
        "title": "shadcn-admin (Admin patterns)",
        "url": "https://github.com/satnaing/shadcn-admin",
        "takeaways": [
          "Tab/Sidebar + DataTable-first",
          "Command palette (Cmd+K) für Admin",
          "Dichte Layouts, aber gleiche Tokens"
        ]
      }
    ]
  },
  "design_tokens": {
    "implementation": {
      "rule": "Alle Farben als CSS Variablen in :root und .dark; in Tailwind via hsl(var(--token)). Keine Hexwerte in Komponenten.",
      "files": [
        "/app/frontend/src/index.css (base tokens)",
        "/app/frontend/src/App.css (noise overlay vorhanden)"
      ]
    },
    "fonts": {
      "display": {
        "family": "Playfair Display",
        "fallback": "ui-serif, Georgia, serif",
        "usage": "Brand/hero headings, Profilname, Legal H1/H2 sparsam",
        "notes": "Editorial warmth ohne kitschig zu wirken; unterstützt Umlaute/ß."
      },
      "body": {
        "family": "Figtree",
        "fallback": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        "usage": "UI copy, Formulare, Chat, Admin",
        "notes": "Sehr gut für lange deutsche Wörter; hohe Lesbarkeit."
      },
      "mono": {
        "family": "IBM Plex Mono",
        "usage": "Admin Audit Log, IDs, technische Werte"
      },
      "tailwind_usage_examples": [
        "className=\"font-display\"",
        "className=\"font-sans\" (maps to body via global font-family)",
        "className=\"font-mono\""
      ]
    },
    "type_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-display tracking-tight",
      "h2": "text-base md:text-lg text-muted-foreground",
      "section_title": "text-lg font-semibold",
      "body": "text-sm md:text-base leading-6",
      "small": "text-xs text-muted-foreground"
    },
    "radius_scale": {
      "xs": "10px",
      "sm": "14px",
      "md": "18px",
      "lg": "24px",
      "usage_rules": [
        "Cards: radius-md (18px)",
        "Poster profile cards: radius-lg (24px)",
        "Chips/Pills: rounded-full",
        "Inputs: radius-sm (14px)"
      ]
    },
    "shadow_scale": {
      "principles": [
        "Sehr subtil, Y-offset only, niedrige Alpha",
        "Keine harten Drop Shadows; lieber weiche Ambient + 1px highlight"
      ],
      "tokens": {
        "shadow-sm": "0 1px 0 hsla(0,0%,100%,0.04), 0 10px 30px hsla(220,30%,2%,0.35)",
        "shadow-md": "0 1px 0 hsla(0,0%,100%,0.05), 0 18px 50px hsla(220,30%,2%,0.45)"
      }
    },
    "motion": {
      "durations": {
        "fast": "120ms",
        "base": "180ms",
        "slow": "260ms"
      },
      "easing": {
        "out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in": "cubic-bezier(0.7, 0, 0.84, 0)"
      },
      "allowed": [
        "opacity",
        "transform: translateY/translateX/scale (klein)",
        "box-shadow (nur auf Cards/Buttons)"
      ],
      "forbidden": [
        "transition: all",
        "große Rotationen",
        "dauerhafte pulsierende Animationen außer Online-Dot"
      ],
      "reduced_motion": {
        "rule": "@media (prefers-reduced-motion: reduce) => durations auf 0ms, keine parallax/scale",
        "example": "motion-safe:... / motion-reduce:transition-none"
      }
    },
    "color_system": {
      "goal": "Neutral + warmes Apricot als Akzent (nicht pink/coral), in Light und Dark konsistent.",
      "semantic_tokens": {
        "light": {
          "background": "30 33% 98%",
          "foreground": "220 18% 12%",
          "card": "0 0% 100%",
          "card-foreground": "220 18% 12%",
          "popover": "0 0% 100%",
          "popover-foreground": "220 18% 12%",
          "primary": "220 18% 12%",
          "primary-foreground": "30 33% 98%",
          "secondary": "30 18% 94%",
          "secondary-foreground": "220 18% 12%",
          "muted": "30 18% 94%",
          "muted-foreground": "220 10% 40%",
          "accent": "24 78% 62%",
          "accent-foreground": "220 18% 12%",
          "border": "220 10% 86%",
          "input": "220 10% 86%",
          "ring": "24 78% 62%",
          "destructive": "6 72% 46%",
          "destructive-foreground": "0 0% 98%",
          "success": "156 52% 40%",
          "warning": "32 92% 56%",
          "info": "200 72% 46%",
          "nsfw": "28 70% 55%",
          "verified": "210 70% 45%",
          "online": "156 52% 40%",
          "offline": "220 8% 55%",
          "overlay": "220 18% 12% / 0.55"
        },
        "dark": {
          "background": "220 18% 6%",
          "foreground": "30 20% 96%",
          "card": "220 16% 9%",
          "card-foreground": "30 20% 96%",
          "popover": "220 16% 9%",
          "popover-foreground": "30 20% 96%",
          "primary": "30 20% 96%",
          "primary-foreground": "220 18% 8%",
          "secondary": "220 14% 14%",
          "secondary-foreground": "30 20% 96%",
          "muted": "220 12% 16%",
          "muted-foreground": "30 8% 72%",
          "accent": "24 78% 58%",
          "accent-foreground": "220 18% 8%",
          "border": "220 12% 18%",
          "input": "220 12% 18%",
          "ring": "24 78% 58%",
          "destructive": "6 72% 52%",
          "destructive-foreground": "0 0% 98%",
          "success": "156 52% 40%",
          "warning": "32 92% 56%",
          "info": "200 72% 46%",
          "nsfw": "28 70% 55%",
          "verified": "210 70% 55%",
          "online": "156 52% 40%",
          "offline": "220 8% 55%",
          "overlay": "220 30% 2% / 0.55"
        }
      },
      "accent_notes": [
        "Apricot/Peach: warm, entsättigt, nicht coral-rot.",
        "Accent wird für Like/Primary CTA, aktive Chips, Fokus-Ring genutzt.",
        "Verified ist bewusst blau (Trust), nicht Accent."
      ],
      "gradient_policy": {
        "allowed": [
          "Nur als Section background (Hero) oder dekorative Radials",
          "Max 20% viewport",
          "Sehr mild: niedrige Alpha"
        ],
        "forbidden": [
          "purple/pink combos",
          "Gradients auf text-heavy areas",
          "Gradients auf kleinen Elementen <100px"
        ],
        "recommended_background_radials": {
          "light": "radial-gradient(900px circle at 20% 10%, hsla(24,78%,62%,0.10), transparent 55%), radial-gradient(700px circle at 80% 0%, hsla(210,70%,55%,0.08), transparent 60%)",
          "dark": "radial-gradient(900px circle at 20% 10%, hsla(24,78%,58%,0.14), transparent 55%), radial-gradient(700px circle at 80% 0%, hsla(210,70%,55%,0.10), transparent 60%)"
        }
      }
    },
    "spacing": {
      "base": "4px",
      "scale": {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px"
      },
      "layout_rules": [
        "Mobile-first: großzügige Innenabstände (p-4 bis p-6)",
        "Zwischen Sektionen: gap-6 bis gap-10",
        "Textblöcke max-w-prose für Legal/longform"
      ]
    }
  },
  "component_system": {
    "primary_library": "shadcn/ui (vorhanden in /app/frontend/src/components/ui/*.jsx)",
    "component_path": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "toggle_group": "/app/frontend/src/components/ui/toggle-group.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "sonner": "/app/frontend/src/components/ui/sonner.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx",
      "avatar": "/app/frontend/src/components/ui/avatar.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "command": "/app/frontend/src/components/ui/command.jsx",
      "pagination": "/app/frontend/src/components/ui/pagination.jsx"
    },
    "buttons": {
      "style": "Luxury/Elegant (slim, tall, rounded 10–12px, subtle shadow)",
      "variants": {
        "primary": {
          "tailwind": "bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "motion": "transition-colors duration-[var(--dur-2)]"
        },
        "secondary": {
          "tailwind": "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          "motion": "transition-colors duration-[var(--dur-2)]"
        },
        "ghost": {
          "tailwind": "bg-transparent hover:bg-muted text-foreground",
          "motion": "transition-colors duration-[var(--dur-2)]"
        },
        "destructive": {
          "tailwind": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          "motion": "transition-colors duration-[var(--dur-2)]"
        }
      },
      "sizes": {
        "sm": "h-9 px-3 text-sm",
        "md": "h-10 px-4 text-sm",
        "lg": "h-11 px-5 text-base"
      },
      "press_interaction": {
        "rule": "Nur transform/opacity",
        "tailwind": "active:scale-[0.98]"
      }
    },
    "chips": {
      "use": "toggle-group + badge",
      "states": {
        "default": "bg-muted text-muted-foreground border border-border",
        "hover": "hover:bg-muted/70",
        "selected": "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:border-transparent",
        "focus": "focus-visible:ring-2 focus-visible:ring-ring"
      },
      "layout": "horizontal scroll strip: flex gap-2 overflow-x-auto no-scrollbar py-2"
    },
    "inputs": {
      "base": "bg-background text-foreground placeholder:text-muted-foreground",
      "focus": "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "invalid": "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
      "disabled": "disabled:opacity-50 disabled:cursor-not-allowed"
    },
    "badges": {
      "verified": "Badge variant outline + icon; color via text-[hsl(var(--verified))] border-[hsl(var(--verified))]",
      "online": "online-dot + sr-only label",
      "visited": "eye icon in muted foreground",
      "id_verified": "shield-check icon + tooltip"
    }
  },
  "page_archetypes": {
    "global_shell": {
      "nav": {
        "pattern": "Sticky top nav (mobile) + optional left rail (desktop)",
        "classes": "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b",
        "content": [
          "Brand wordmark 'Eros' (font-display)",
          "Search/Command (admin), Notifications, Theme toggle",
          "Primary actions contextual (Filter, Profil bearbeiten, etc.)"
        ]
      },
      "background": {
        "rule": "Sehr milde Radials + Noise overlay (bereits vorhanden).",
        "classes": "app-shell-bg dark:app-shell-bg"
      }
    },
    "discover_grid": {
      "layout": {
        "grid": "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4",
        "card_aspect": "aspect-[3/4] (poster)",
        "scroll": "infinite/pagination; skeleton placeholders"
      },
      "quick_filters": {
        "pattern": "Sticky chip strip unter Nav; horizontal scroll",
        "component": "ToggleGroup",
        "advanced": "Sheet/Drawer von rechts oder bottom (mobile)"
      },
      "profile_card": {
        "treatment": [
          "Poster-Foto full-bleed",
          "Bottom gradient scrim (nur für Lesbarkeit, sehr mild)",
          "Overlay: Name, Alter, Distanz, 2–3 Facts",
          "Badges: Verified, Online, Visited"
        ],
        "classes": {
          "root": "group relative overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] bg-card",
          "image": "h-full w-full object-cover transition-opacity duration-[var(--dur-3)]",
          "scrim": "absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent",
          "hover": "hover:shadow-[var(--shadow-md)] transition-shadow duration-[var(--dur-2)]"
        },
        "actions": {
          "like": "Button primary icon-only (heart)",
          "pass": "Button secondary icon-only (x)",
          "save": "ghost (bookmark)"
        },
        "testids": {
          "card": "discover-profile-card",
          "like": "discover-like-button",
          "pass": "discover-pass-button",
          "open": "discover-open-profile-link"
        }
      }
    },
    "profile_view": {
      "hero": {
        "pattern": "Editorial hero photo (aspect ratio 16/10 mobile, 21/9 desktop) + thumbnail row",
        "scrim": "vertical gradient overlay for legibility (no loud gradients)",
        "classes": {
          "hero": "relative overflow-hidden rounded-[var(--radius-lg)]",
          "scrim": "absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
        }
      },
      "content": {
        "sections": [
          "Bio (max-w-prose)",
          "Attribute chips",
          "Kinks/Preferences (collapsible)",
          "Safety actions (report/block)"
        ],
        "actions_footer": "Sticky action bar on mobile (Like/Match/Chat/Report)"
      }
    },
    "my_profile_editor": {
      "pattern": "Form-heavy, sectioned cards",
      "photo_manager": {
        "pattern": "DnD grid max 5, primary photo larger tile",
        "components": ["Card", "AspectRatio", "Dialog", "Button"],
        "states": ["uploading", "error", "limit reached"]
      },
      "conditional_fields": "Gender-conditional fields: use Collapsible + helper text"
    },
    "onboarding": {
      "pattern": "Progressive form with Progress component + stepper",
      "layout": "single column, max-w-md, left-aligned",
      "consents": "Checkbox list with clear legal links"
    },
    "matches_list": {
      "pattern": "List of match cards with avatar + last message + unread badge",
      "classes": "divide-y border rounded-[var(--radius-md)] overflow-hidden"
    },
    "chat": {
      "layout": {
        "header": "sticky top nav with profile mini + safety menu",
        "stream": "ScrollArea; day separators",
        "composer": "sticky bottom input + attachments"
      },
      "bubbles": {
        "mine": "bg-accent text-accent-foreground rounded-2xl rounded-br-md",
        "theirs": "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md",
        "meta": "text-xs text-muted-foreground"
      },
      "nsfw_blur": {
        "pattern": "Blur overlay with consent CTA",
        "classes": "relative overflow-hidden rounded-[var(--radius-md)]",
        "overlay": "absolute inset-0 backdrop-blur-md bg-black/35 grid place-items-center",
        "cta": "Button primary: 'Ansehen' + Switch 'Immer anzeigen'"
      },
      "self_destruct": "Message chip with timer icon; subtle warning color"
    },
    "account_settings": {
      "pattern": "Security-first cards: Email verifizieren, MFA, ID Upload, Payments",
      "payments": "Use Tabs for providers; keep same tokens",
      "id_verification": "Upload dropzone + status badge + helper copy"
    },
    "settings": {
      "pattern": "Preference list with Switches; language Select; theme toggle",
      "theme": "System preference aware + explicit toggle"
    },
    "admin": {
      "layout": {
        "desktop": "Left sidebar + top bar + content",
        "mobile": "Tabs/Sheet navigation"
      },
      "components": ["Tabs", "Table", "Pagination", "Command", "Dialog", "Sheet"],
      "table_rules": [
        "Sticky header",
        "Row hover bg-muted/40",
        "Bulk actions bar appears when rows selected"
      ],
      "audit_log": "Use font-mono for IDs/timestamps"
    },
    "legal_markdown": {
      "typography": {
        "container": "prose prose-neutral dark:prose-invert max-w-prose",
        "headings": "font-display tracking-tight",
        "links": "underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
      },
      "nav": "Chip-style page switcher (ToggleGroup)"
    },
    "footer": {
      "pattern": "Minimal, legal links, muted text",
      "classes": "border-t py-8 text-sm text-muted-foreground"
    }
  },
  "micro_interactions": {
    "hover": [
      "Cards: shadow-sm -> shadow-md (transition-shadow)",
      "Buttons: color shift only + active scale",
      "Chips: background tint"
    ],
    "scroll": [
      "Sticky chip strip with subtle border",
      "Discover grid: skeleton shimmer (Skeleton component)"
    ],
    "feedback": [
      "Use Sonner toasts for success/error",
      "Inline validation messages under inputs"
    ]
  },
  "accessibility": {
    "contrast": [
      "Body text must meet WCAG AA on background/card",
      "Accent foreground must be readable (avoid white-on-peach if too low contrast)"
    ],
    "focus": "Always visible focus ring: ring-2 ring-ring ring-offset-2",
    "touch": "Min tap target 44px; icon buttons use h-10 w-10",
    "language": "German long words: avoid fixed widths; allow wrapping; use hyphenation in legal prose if needed"
  },
  "data_testid_policy": {
    "rule": "Alle interaktiven und daten-kritischen Elemente müssen data-testid behalten/erhalten. Neue Elemente: kebab-case, rollenbasiert.",
    "examples": [
      "data-testid=\"theme-toggle-button\"",
      "data-testid=\"discover-advanced-filter-open-button\"",
      "data-testid=\"chat-message-send-button\"",
      "data-testid=\"admin-reports-table\""
    ]
  },
  "image_urls": {
    "note": "Für Dating-Profile keine Stock-Faces hardcoden; nutze User-Uploads. Für Marketing/empty states nur abstrakte/neutral imagery.",
    "categories": [
      {
        "category": "empty_state_abstract",
        "description": "Abstrakte, ruhige Shapes/Textures für leere Zustände (Matches leer, Events leer)",
        "urls": []
      },
      {
        "category": "legal_page_header",
        "description": "Sehr dezente Textur/Pattern (kein Gradient-Overkill) für Legal Header",
        "urls": []
      }
    ]
  },
  "libraries": {
    "recommended": [
      {
        "name": "framer-motion",
        "why": "Feine micro-animations (sheet entrance, card hover) ohne CSS hacks",
        "install": "npm i framer-motion",
        "usage_notes": [
          "Nur opacity/translate/scale",
          "Respect prefers-reduced-motion"
        ]
      }
    ],
    "avoid": [
      "Heavy 3D/particles (Trust/Safety Kontext; Performance auf Mobile)",
      "Over-animated gradients"
    ]
  },
  "instructions_to_main_agent": [
    "Update /app/frontend/src/index.css tokens: replace current --accent (teal) with apricot values above; keep other neutrals.",
    "Ensure Tailwind config uses hsl(var(--...)) mapping (already convention).",
    "Do not remove existing data-testid attributes; add new ones for any new interactive element.",
    "Use shadcn/ui components from /components/ui/*.jsx; do not introduce raw HTML dropdown/calendar/toast.",
    "Discover: implement poster grid cards with overlay scrim + badges; avoid swipe stack.",
    "Profile view: hero photo with subtle scrim; sticky action bar on mobile.",
    "Admin: table-first with Tabs + Command; same tokens, denser spacing.",
    "Legal: Markdown rendered with prose classes; accent underline links."
  ],
  "general_ui_ux_design_guidelines": [
    "You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms",
    "You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text",
    "NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json",
    "GRADIENT RESTRICTION RULE",
    "NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc",
    "NEVER use dark gradients for logo, testimonial, footer etc",
    "NEVER let gradients cover more than 20% of the viewport.",
    "NEVER apply gradients to text-heavy content or reading areas.",
    "NEVER use gradients on small UI elements (<100px width).",
    "NEVER stack multiple gradient layers in the same viewport.",
    "ENFORCEMENT RULE:",
    "    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors",
    "How and where to use:",
    "   • Section backgrounds (not content backgrounds)",
    "   • Hero section header content. Eg: dark to light to dark color",
    "   • Decorative overlays and accent elements only",
    "   • Hero section with 2-3 mild color",
    "   • Gradients creation can be done for any angle say horizontal, vertical or diagonal",
    "- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**",
    "- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead.",
    "- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.",
    "- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.",
    "- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly",
    "Component Reuse:",
    "\t- Prioritize using pre-existing components from src/components/ui when applicable",
    "\t- Create new components that match the style and conventions of existing components when needed",
    "\t- Examine existing components to understand the project's component patterns before creating new ones",
    "IMPORTANT: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component",
    "Best Practices:",
    "\t- Use Shadcn/UI as the primary component library for consistency and accessibility",
    "\t- Import path: ./components/[component-name]",
    "Export Conventions:",
    "\t- Components MUST use named exports (export const ComponentName = ...)",
    "\t- Pages MUST use default exports (export default function PageName() {...})",
    "Toasts:",
    "  - Use `sonner` for toasts",
    "  - Sonner component are located in `/app/src/components/ui/sonner.tsx`",
    "Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
  ]
}
