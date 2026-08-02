# TAMID Group at NYU — Brand & Style Guide

> Source of truth: extracted from the national TAMID Group site (https://tamidgroup.org) on 2026-08-02.
> These are the canonical brand values to apply across TAMID_site (frontend), TAMID_site_backend, and TAMID_site_internal (admin), replacing the placeholder SJBA assets.

## Identity

- **Name:** TAMID Group at NYU
- **Parent org:** TAMID Group (national) — https://tamidgroup.org
- **Tagline:** "Where tomorrow's leaders connect with Israel's innovators"
- **Positioning:** A nonprofit, **apolitical and areligious** student organization that develops undergraduates' professional skills through hands-on work with the Israeli economy.
- **Programs (four pillars):** Education · Consulting · Investment Fund · Israel Fellowship

## Color Palette

### Primary

| Token    | Hex       | Usage                                                                        |
| -------- | --------- | ---------------------------------------------------------------------------- |
| Navy     | `#18274B` | Primary brand color — headers, nav, footers, headings, primary text on light |
| Sky Blue | `#41B5E8` | Primary accent — CTAs, links, highlights, the logo mark                      |

### Secondary / Blues

| Token     | Hex       | Usage                                      |
| --------- | --------- | ------------------------------------------ |
| Blue Mid  | `#219CD3` | Hover states, gradients, secondary accents |
| Blue Deep | `#0F94CF` | Active/pressed states, gradient stops      |
| Blue Tint | `#F5FBFE` | Very light blue section backgrounds        |

### Neutrals

| Token    | Hex       | Usage                         |
| -------- | --------- | ----------------------------- |
| Gray 100 | `#F5F5F5` | Page/section backgrounds      |
| Gray 200 | `#F2F2F2` | Card backgrounds              |
| Gray 300 | `#EBEAEA` | Borders, dividers             |
| Gray 400 | `#E1E1E1` | Disabled borders              |
| Gray 600 | `#808080` | Muted/secondary text          |
| White    | `#FFFFFF` | Base background, text on navy |

> Note: SJBA's brand was Stern **purple**. TAMID's is **navy + sky blue**. Any purple accent from the SJBA template must be replaced with the tokens above. (This resolves the "TODO: choose TAMID accent color" flagged in the admin panel's `design-qa.md`.)

## Typography

Loaded from Google Fonts.

- **Primary (headings + UI):** `Roboto` — weights 200, 300, 400, 600, 800
- **Body / secondary:** `Open Sans` — 300/400/600/700
- **Accent (optional display/serif):** `Roboto Slab`

```css
--font-heading: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-accent: 'Roboto Slab', Georgia, serif;
```

Google Fonts import:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;600;800&family=Open+Sans:wght@300;400;600;700&family=Roboto+Slab:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

## Logos

Stored in `brand/logos/` (pulled from the national site — confirm usage rights with the national org before public launch):

| File                   | Description                          | Use on                                        |
| ---------------------- | ------------------------------------ | --------------------------------------------- |
| `tamid-logo-dark.png`  | Wordmark + mark, dark text (465×59)  | Light backgrounds — header, light sections    |
| `tamid-logo-white.png` | White wordmark (transparent, 464×58) | Navy/dark backgrounds — footer, hero overlays |

Logo mark color: sky blue `#41B5E8`. Maintain clear space ≥ the height of the "T" around the logo; never recolor the mark outside the palette.

## Design tokens (CSS custom properties)

```css
:root {
  --color-navy: #18274b;
  --color-sky: #41b5e8;
  --color-blue-mid: #219cd3;
  --color-blue-deep: #0f94cf;
  --color-blue-tint: #f5fbfe;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #f2f2f2;
  --color-gray-300: #ebeaea;
  --color-gray-400: #e1e1e1;
  --color-gray-600: #808080;
  --color-white: #ffffff;

  --color-primary: var(--color-navy);
  --color-accent: var(--color-sky);
  --color-link: var(--color-blue-deep);
  --color-bg: var(--color-white);
  --color-text: var(--color-navy);
  --color-text-muted: var(--color-gray-600);
}
```

## Voice

- Professional, ambitious, forward-looking.
- Apolitical and areligious — describe the org's work through the lens of business, professional development, and the Israeli innovation economy. Do **not** frame TAMID as a religious or political organization.

---

_Placeholders still needed from the chapter: official NYU-chapter logo lockup (if different from national), chapter contact email, real domain, and social handles._
