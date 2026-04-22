{
  "brand": {
    "name": "Inclusive Premium Dating (Grid Discovery)",
    "attributes": [
      "premium",
      "inclusive/LGBTQ+ first-class",
      "editorial",
      "warm-but-sophisticated",
      "privacy-forward",
      "calm (non-gamey)",
      "trustworthy"
    ],
    "anti_patterns": [
      "no swipe/game UI",
      "no cliché hearts",
      "no neon",
      "no loud gradients",
      "no purple for AI/moderation affordances"
    ]
  },
  "inspiration_refs": {
    "notes": "Use editorial dark UI + grid discovery + bottom-sheet filters. Keep surfaces solid; use subtle texture/noise and warm accents.",
    "links": [
      {
        "title": "Behance: Hume Dating App UI Kit (dark, premium)",
        "url": "https://www.behance.net/gallery/149804677/Hume-Dating-App-UI-Kit"
      },
      {
        "title": "Behance: Datify Dating App UI Kit (modern, filter-heavy)",
        "url": "https://www.behance.net/gallery/184565601/Datify-Dating-App-UI-Kit"
      },
      {
        "title": "Dribbble search: dating app UI (grid, filters)",
        "url": "https://dribbble.com/search/dating-app-ui"
      }
    ]
  },
  "typography": {
    "font_pairing": {
      "display": {
        "name": "EB Garamond",
        "use": "H1/H2, profile names, editorial section headings",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=EB+Garamond:opsz,wght@8..40,500;8..40,600;8..40,700&display=swap"
      },
      "body": {
        "name": "Figtree",
        "use": "UI labels, body copy, filters, chat",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap"
      },
      "mono_optional": {
        "name": "IBM Plex Mono",
        "use": "Admin moderation IDs, timestamps, audit logs",
        "google_fonts_import": "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      }
    },
    "text_size_hierarchy": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs"
    },
    "tracking": {
      "display": "tracking-[-0.01em]",
      "body": "tracking-[-0.005em]"
    },
    "line_height": {
      "display": "leading-[1.05]",
      "body": "leading-[1.45]"
    }
  },
  "color_system": {
    "strategy": "Dark-first, warm neutral base + ocean-teal accent + apricot highlight. No saturated gradients; keep gradients decorative and under 20% viewport.",
    "tokens_hsl": {
      "dark": {
        "--background": "220 18% 6%",
        "--foreground": "30 20% 96%",
        "--card": "220 16% 9%",
        "--card-foreground": "30 20% 96%",
        "--popover": "220 16% 9%",
        "--popover-foreground": "30 20% 96%",
        "--primary": "30 20% 96%",
        "--primary-foreground": "220 18% 8%",
        "--secondary": "220 14% 14%",
        "--secondary-foreground": "30 20% 96%",
        "--muted": "220 12% 16%",
        "--muted-foreground": "30 8% 72%",
        "--accent": "174 52% 42%",
        "--accent-foreground": "220 18% 8%",
        "--border": "220 12% 18%",
        "--input": "220 12% 18%",
        "--ring": "174 52% 42%",
        "--destructive": "6 72% 52%",
        "--destructive-foreground": "0 0% 98%"
      },
      "light": {
        "--background": "30 33% 98%",
        "--foreground": "220 18% 12%",
        "--card": "0 0% 100%",
        "--card-foreground": "220 18% 12%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "220 18% 12%",
        "--primary": "220 18% 12%",
        "--primary-foreground": "30 33% 98%",
        "--secondary": "30 18% 94%",
        "--secondary-foreground": "220 18% 12%",
        "--muted": "30 18% 94%",
        "--muted-foreground": "220 10% 40%",
        "--accent": "174 52% 34%",
        "--accent-foreground": "30 33% 98%",
        "--border": "220 10% 86%",
        "--input": "220 10% 86%",
        "--ring": "174 52% 34%",
        "--destructive": "6 72% 46%",
        "--destructive-foreground": "0 0% 98%"
      },
      "semantic_extras": {
        "--success": "156 52% 40%",
        "--warning": "32 92% 56%",
        "--info": "200 72% 46%",
        "--nsfw": "12 72% 52%",
        "--verified": "174 52% 42%",
        "--online": "156 52% 40%",
        "--offline": "220 8% 55%"
      }
    },
    "allowed_gradients": {
      "hero_decorative_only": {
        "css": "radial-gradient(900px circle at 20% 10%, hsla(174,52%,42%,0.18), transparent 55%), radial-gradient(700px circle at 80% 0%, hsla(32,92%,56%,0.12), transparent 60%)",
        "rule": "Use only as a background overlay on hero/top chrome; never behind long text; keep under 20% viewport."
      }
    },
    "texture": {
      "noise_overlay": {
        "css": "background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E')",
        "usage": "Apply to app shell background only (fixed, pointer-events-none), opacity 0.06–0.10."
      }
    }
  },
  "design_tokens_css": {
    "drop_in_index_css": "/* Add Google Fonts <link> tags in public/index.html or @import here. Prefer <link> for performance. */\n\n@layer base {\n  :root {\n    --font-display: 'EB Garamond', ui-serif, Georgia, serif;\n    --font-body: 'Figtree', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;\n    --font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;\n\n    /* Radius scale */\n    --radius-xs: 10px;\n    --radius-sm: 14px;\n    --radius-md: 18px;\n    --radius-lg: 24px;\n\n    /* Shadow scale (dark-first) */\n    --shadow-sm: 0 1px 0 hsla(0,0%,100%,0.04), 0 10px 30px hsla(220,30%,2%,0.35);\n    --shadow-md: 0 1px 0 hsla(0,0%,100%,0.05), 0 18px 50px hsla(220,30%,2%,0.45);\n\n    /* Motion */\n    --ease-out: cubic-bezier(0.16, 1, 0.3, 1);\n    --ease-in: cubic-bezier(0.7, 0, 0.84, 0);\n    --dur-1: 120ms;\n    --dur-2: 180ms;\n    --dur-3: 260ms;\n  }\n\n  body {\n    font-family: var(--font-body);\n  }\n\n  .font-display {\n    font-family: var(--font-display);\n  }\n\n  .font-mono {\n    font-family: var(--font-mono);\n  }\n}\n\n/* Replace shadcn tokens with our palette */\n@layer base {\n  :root {\n    --background: 30 33% 98%;\n    --foreground: 220 18% 12%;\n    --card: 0 0% 100%;\n    --card-foreground: 220 18% 12%;\n    --popover: 0 0% 100%;\n    --popover-foreground: 220 18% 12%;\n    --primary: 220 18% 12%;\n    --primary-foreground: 30 33% 98%;\n    --secondary: 30 18% 94%;\n    --secondary-foreground: 220 18% 12%;\n    --muted: 30 18% 94%;\n    --muted-foreground: 220 10% 40%;\n    --accent: 174 52% 34%;\n    --accent-foreground: 30 33% 98%;\n    --destructive: 6 72% 46%;\n    --destructive-foreground: 0 0% 98%;\n    --border: 220 10% 86%;\n    --input: 220 10% 86%;\n    --ring: 174 52% 34%;\n    --radius: 18px;\n\n    /* Extra semantic tokens */\n    --success: 156 52% 40%;\n    --warning: 32 92% 56%;\n    --info: 200 72% 46%;\n    --nsfw: 12 72% 52%;\n    --verified: 174 52% 34%;\n    --online: 156 52% 40%;\n    --offline: 220 8% 55%;\n  }\n\n  .dark {\n    --background: 220 18% 6%;\n    --foreground: 30 20% 96%;\n    --card: 220 16% 9%;\n    --card-foreground: 30 20% 96%;\n    --popover: 220 16% 9%;\n    --popover-foreground: 30 20% 96%;\n    --primary: 30 20% 96%;\n    --primary-foreground: 220 18% 8%;\n    --secondary: 220 14% 14%;\n    --secondary-foreground: 30 20% 96%;\n    --muted: 220 12% 16%;\n    --muted-foreground: 30 8% 72%;\n    --accent: 174 52% 42%;\n    --accent-foreground: 220 18% 8%;\n    --destructive: 6 72% 52%;\n    --destructive-foreground: 0 0% 98%;\n    --border: 220 12% 18%;\n    --input: 220 12% 18%;\n    --ring: 174 52% 42%;\n\n    --success: 156 52% 40%;\n    --warning: 32 92% 56%;\n    --info: 200 72% 46%;\n    --nsfw: 12 72% 52%;\n    --verified: 174 52% 42%;\n    --online: 156 52% 40%;\n    --offline: 220 8% 55%;\n  }\n}\n\n@layer utilities {\n  .app-shell-bg {\n    background-color: hsl(var(--background));\n    background-image: radial-gradient(900px circle at 20% 10%, hsla(174,52%,42%,0.18), transparent 55%), radial-gradient(700px circle at 80% 0%, hsla(32,92%,56%,0.12), transparent 60%);\n  }\n  .noise-overlay {\n    background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.08%22/%3E%3C/svg%3E');\n  }\n}\n"
  },
  "layout_grid": {
    "app_shell": {
      "max_width": "max-w-6xl",
      "padding": "px-4 sm:px-6",
      "top_chrome": "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border"
    },
    "gallery_grid": {
      "mobile": "grid-cols-2 gap-3",
      "sm": "sm:grid-cols-3 sm:gap-4",
      "lg": "lg:grid-cols-4 lg:gap-5",
      "card_aspect": "aspect-[3/4]"
    },
    "profile_detail": {
      "mobile": "single column; sticky action bar bottom",
      "lg": "two-column: media left (60%), details right (40%) with sticky panel"
    },
    "admin": {
      "layout": "sidebar + content; tables with sticky header"
    }
  },
  "component_patterns": {
    "component_path": {
      "shadcn": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/avatar.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/slider.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/checkbox.jsx",
        "/app/frontend/src/components/ui/toggle-group.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/alert-dialog.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/select.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "recommended_new_components": [
        "/app/frontend/src/components/ProfileCard.js",
        "/app/frontend/src/components/FilterDrawer.js",
        "/app/frontend/src/components/NsfwBlurOverlay.js",
        "/app/frontend/src/components/ChatBubble.js",
        "/app/frontend/src/components/MatchBanner.js",
        "/app/frontend/src/components/ConsentCheckboxGroup.js"
      ]
    },
    "ProfileCard": {
      "purpose": "Gallery discovery card with photo, name, pronouns, rounded distance, online dot, verified badge, quick actions.",
      "structure": [
        "Card (rounded-xl/--radius-md) with overflow-hidden",
        "AspectRatio 3/4 image (lazy) + gradient scrim at bottom (very subtle, not saturated)",
        "Top-left: Verified badge (if verified)",
        "Top-right: Online dot + tooltip",
        "Bottom: name (display font), pronouns, age, ~distance, relationship intent chips"
      ],
      "tailwind_classes": {
        "card": "group relative overflow-hidden rounded-[var(--radius-md)] border border-border bg-card shadow-[var(--shadow-sm)]",
        "image": "h-full w-full object-cover transition-[transform,filter] duration-300 ease-[var(--ease-out)] group-hover:scale-[1.02]",
        "scrim": "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent",
        "meta_wrap": "absolute inset-x-0 bottom-0 p-3",
        "name": "font-display text-lg text-white",
        "sub": "text-xs text-white/80",
        "chip": "bg-black/35 text-white border-white/10"
      },
      "states": {
        "hover": "Slight scale on image + border color shift to accent/30; show quick-action buttons (Like/Save/Hide) with opacity transition.",
        "seen": "Reduce saturation slightly (filter: saturate(0.9)) + add small 'Seen' badge.",
        "nsfw": "If NSFW score high: image blurred + overlay component; card shows 'Sensitive' badge."
      },
      "data_testids": {
        "card": "profile-card",
        "open_profile": "profile-card-open-button",
        "like": "profile-card-like-button",
        "hide": "profile-card-hide-button",
        "online": "profile-card-online-indicator",
        "distance": "profile-card-distance-text"
      }
    },
    "FilterDrawer": {
      "purpose": "Bottom drawer on mobile; right-side sheet on desktop. Handles many filters without overwhelm.",
      "pattern": "Use Drawer for mobile (bottom sheet) + Sheet for desktop (right). Inside: ScrollArea + Accordion sections.",
      "sections": [
        "Basics: age range (Slider), distance radius (Slider), online now (Switch), with photo only (Switch)",
        "Identity: gender(s) (ToggleGroup multi), orientation (Select), pronouns (Select)",
        "Relationship: type (ToggleGroup), seeking roles (ToggleGroup), open to (Checkbox group)",
        "Safety: only verified (Switch), only face photo (Switch), hide already seen (Switch)",
        "Kinks (NSFW flagged): collapsed by default with explicit consent gate"
      ],
      "ux_rules": [
        "Show active filter count badge on the Filter button.",
        "Each section has a short helper line (muted text) and a 'Reset section' ghost button.",
        "Sticky footer inside drawer: Reset all (ghost) + Apply (primary).",
        "Bidirectional matching explanation tooltip: 'We only show people whose preferences also match yours.'"
      ],
      "tailwind_classes": {
        "drawer_content": "rounded-t-[28px] border border-border bg-card shadow-[var(--shadow-md)]",
        "section_title": "font-display text-base",
        "helper": "text-xs text-muted-foreground",
        "sticky_footer": "sticky bottom-0 border-t border-border bg-card/95 backdrop-blur px-4 py-3"
      },
      "data_testids": {
        "open": "filters-open-button",
        "apply": "filters-apply-button",
        "reset": "filters-reset-button",
        "age": "filters-age-slider",
        "distance": "filters-distance-slider",
        "verified": "filters-only-verified-switch",
        "nsfw_section": "filters-nsfw-section"
      }
    },
    "NsfwBlurOverlay": {
      "purpose": "AI moderation blur overlay with explicit 18+ consent reveal.",
      "behavior": [
        "Default: blur(18px) + slight dim + 'Sensitive media' label",
        "CTA: 'Reveal (18+)' opens AlertDialog with consent copy + checkbox",
        "After consent: animate blur to 0 over 220ms; store per-session reveal state"
      ],
      "copy": {
        "title": "Sensitive media",
        "body": "This image may contain nudity or explicit content. Confirm you are 18+ and consent to view.",
        "checkbox": "I am 18+ and I consent to view sensitive media."
      },
      "tailwind_classes": {
        "overlay": "absolute inset-0 grid place-items-center bg-black/35",
        "blur_layer": "absolute inset-0 backdrop-blur-[18px]",
        "cta": "rounded-full bg-white/10 px-4 py-2 text-sm text-white border border-white/15 hover:bg-white/14 transition-[background-color,border-color] duration-180"
      },
      "data_testids": {
        "container": "nsfw-overlay",
        "reveal": "nsfw-reveal-button",
        "consent_checkbox": "nsfw-consent-checkbox",
        "confirm": "nsfw-consent-confirm-button"
      }
    },
    "ChatBubble": {
      "purpose": "Post-match chat bubbles with optional read receipts/typing indicators.",
      "layout": [
        "Left (them): muted surface bubble",
        "Right (me): accent-tinted bubble (solid, not gradient)",
        "Timestamp in mono, subtle"
      ],
      "tailwind_classes": {
        "wrap": "max-w-[78%] rounded-[20px] px-3 py-2",
        "me": "bg-accent text-accent-foreground",
        "them": "bg-secondary text-secondary-foreground",
        "meta": "mt-1 text-[11px] text-muted-foreground font-mono"
      },
      "data_testids": {
        "bubble": "chat-bubble",
        "message_text": "chat-message-text",
        "read_receipt": "chat-read-receipt"
      }
    },
    "MatchBanner": {
      "purpose": "Subtle new-match celebration + match state on profile.",
      "behavior": [
        "Use a thin banner with accent border + soft glow shadow",
        "Optional 1.5s shimmer line (opacity 0.12) across banner; no confetti",
        "CTA: 'Say hi' primary button"
      ],
      "tailwind_classes": {
        "banner": "rounded-[var(--radius-md)] border border-accent/30 bg-card shadow-[var(--shadow-sm)]",
        "title": "font-display text-lg",
        "sub": "text-sm text-muted-foreground"
      },
      "data_testids": {
        "banner": "match-banner",
        "cta": "match-banner-say-hi-button"
      }
    },
    "ConsentCheckboxGroup": {
      "purpose": "Onboarding consent gates for GDPR + sensitive data (orientation/kinks) + NSFW viewing.",
      "rules": [
        "No pre-checked boxes",
        "Explain why each consent is needed",
        "Block progression until required consents checked",
        "Provide 'Learn more' Dialog with plain-language summary"
      ],
      "tailwind_classes": {
        "item": "flex gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3",
        "title": "text-sm font-medium",
        "desc": "text-xs text-muted-foreground"
      },
      "data_testids": {
        "group": "consent-checkbox-group",
        "continue": "onboarding-continue-button"
      }
    }
  },
  "page_level_layout_sketches": {
    "gallery_discovery": {
      "hierarchy": [
        "Top sticky bar: Brand wordmark (display font) + Search (optional) + Filters button with active-count badge",
        "Sub-row: 'Your filters are mutual' tooltip + quick chips (Online, Verified, Distance) for fast toggles",
        "Main: Grid of ProfileCard (infinite scroll) with skeleton placeholders",
        "Bottom: subtle 'You’re all caught up' empty state with reset filters CTA"
      ],
      "performance": [
        "Use native loading='lazy' on images",
        "Use Skeleton component while loading",
        "Avoid heavy box-shadows on hundreds of cards; keep shadow subtle"
      ]
    },
    "profile_detail": {
      "hierarchy": [
        "Hero media: carousel of photos with NSFW overlay per image",
        "Identity block: Name (display), pronouns, orientation, badges (verified/online), rounded distance",
        "About: short bio + 'Looking for' chips",
        "Albums: locked/private sections with unlock request CTA",
        "Actions: Like / Pass / Report (Report is tertiary, but visible)"
      ],
      "match_states": [
        "Not matched: show Like button + 'Chat unlocks after mutual match' helper",
        "Matched: show MatchBanner + 'Open chat' primary"
      ]
    },
    "chat": {
      "hierarchy": [
        "Top bar: Avatar + name + online dot + overflow menu (privacy toggles)",
        "Message list: ScrollArea with date separators",
        "Composer: Textarea + send button + attach self-destruct media",
        "Optional: typing indicator line (muted)"
      ],
      "privacy": [
        "Self-destruct media: show countdown chip on bubble",
        "Read receipts toggle in chat settings"
      ]
    },
    "onboarding": {
      "pattern": "Multi-step wizard with progress indicator; each step is one primary task.",
      "steps": [
        "1) Consent (GDPR + sensitive data + NSFW viewing policy)",
        "2) Basics (name, age, pronouns, gender identity)",
        "3) Preferences (bidirectional age/gender + one-way filters)",
        "4) Photos (upload + AI moderation feedback + face photo suggestion)",
        "5) Finish (preview profile card)"
      ],
      "layout": [
        "Centered column on desktop but left-aligned content; max-w-md",
        "Sticky bottom CTA bar on mobile"
      ]
    }
  },
  "micro_interactions": {
    "ProfileCard_hover": {
      "motion": "Image scale 1.02 + quick actions fade/slide up 6px",
      "css": "transition-[opacity,transform,background-color,border-color] duration-180 ease-[var(--ease-out)]",
      "accessibility": "Respect prefers-reduced-motion; keep focus-visible ring"
    },
    "NSFW_reveal": {
      "motion": "Blur fades out + overlay opacity to 0",
      "duration": "220ms",
      "easing": "var(--ease-out)"
    },
    "new_match": {
      "motion": "Banner enters with y: 10px -> 0 and opacity 0 -> 1; optional shimmer line",
      "duration": "260ms",
      "library": "framer-motion (recommended)"
    },
    "online_dot": {
      "motion": "Soft pulse using box-shadow spread (not transform) to avoid layout jank",
      "css": "@keyframes onlinePulse { 0%{ box-shadow:0 0 0 0 hsla(156,52%,40%,0.35);} 70%{ box-shadow:0 0 0 8px hsla(156,52%,40%,0);} 100%{ box-shadow:0 0 0 0 hsla(156,52%,40%,0);} }"
    }
  },
  "libraries": {
    "recommended": [
      {
        "name": "framer-motion",
        "why": "Micro-interactions (drawer transitions, match banner entrance, subtle shimmer)",
        "install": "npm i framer-motion",
        "usage_note": "Use motion.div for entrance/exit; respect prefers-reduced-motion."
      },
      {
        "name": "react-intersection-observer",
        "why": "Infinite scroll + lazy reveal animations without scroll listeners",
        "install": "npm i react-intersection-observer",
        "usage_note": "Trigger next page fetch when sentinel enters view."
      }
    ]
  },
  "image_urls": {
    "profile_card_placeholders": [
      {
        "url": "https://images.pexels.com/photos/9349255/pexels-photo-9349255.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "description": "Premium editorial portrait placeholder for demo profiles",
        "category": "seed/demo"
      },
      {
        "url": "https://images.pexels.com/photos/31465343/pexels-photo-31465343.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "description": "Warm friendly portrait placeholder",
        "category": "seed/demo"
      }
    ],
    "marketing_hero_optional": [
      {
        "url": "https://images.unsplash.com/photo-1521033719794-41049d18b8d4?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85",
        "description": "Warm sunset silhouette for optional landing/empty states (keep subtle, not cliché)",
        "category": "hero/empty-state"
      }
    ]
  },
  "dark_first_guidance": {
    "default": "Set <html class='dark'> by default for production feel; provide toggle in Settings.",
    "mapping_rules": [
      "Cards are slightly lighter than background (card 9% vs bg 6%)",
      "Borders are visible but subtle (border 18%)",
      "Accent used for primary actions, verified, focus ring; never for large backgrounds",
      "Text on images uses scrim; avoid heavy gradients"
    ]
  },
  "accessibility": {
    "rules": [
      "WCAG AA contrast for text on surfaces",
      "Always show focus-visible ring: ring-2 ring-[hsl(var(--ring))] ring-offset-2 ring-offset-background",
      "Respect prefers-reduced-motion: disable pulses/shimmers and reduce durations",
      "NSFW reveal requires explicit consent checkbox; never auto-reveal"
    ]
  },
  "instructions_to_main_agent": [
    "Replace default CRA App.css centered header usage; do not center the whole app container.",
    "Update /app/frontend/src/index.css tokens with the provided HSL values and add font variables.",
    "Use shadcn components from /app/frontend/src/components/ui (Drawer/Sheet/ScrollArea/Slider/Switch/Checkbox/ToggleGroup/Dialog).",
    "Implement all new components as .js (not .tsx).",
    "Add data-testid to every interactive element and key info text (filters, like buttons, reveal consent, chat send, report submit, GDPR export/delete).",
    "NSFW: blur overlay must be per-image; reveal requires AlertDialog consent; store reveal state in memory/session only.",
    "Gallery: use CSS grid + skeletons + lazy images; avoid heavy shadows to prevent scroll jank.",
    "Chat: only accessible after mutual match; show helper copy otherwise.",
    "Admin: use Table + Tabs + filters; keep typography more utilitarian (body font + mono for IDs)."
  ],
  "General UI UX Design Guidelines": [
    "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms",
    "- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text",
    "- NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json",
    "\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**",
    "\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
  ]
}
