# Replacement SVG Icon Set

This directory and guide documents the unified vector SVG icon set created to replace all emojis across the **Assetto Corsa GT-Like Licenses** project.

## Directory Locations
- **Source Assets**: `assets/icons/`
- **Web UI Static Distribution**: `tools/web_ui/static/icons/`
- **Interactive Visual Preview**: `tools/web_ui/static/icons/preview.html` (or `assets/icons/preview.html`)
- **Metadata Index**: `assets/icons/icons.json`
- **Unified SVG Sprite Sheet**: `assets/icons/icons.svg` / `tools/web_ui/static/icons/icons.svg`

---

## Icon Catalog & Emoji Replacements

| Category | Emoji Replaced | Icon ID & Filename | Title / Purpose | HTML Sprite Snippet |
| :--- | :---: | :--- | :--- | :--- |
| **Racing & Navigation** | `🏁` | `flag-checkered.svg` | Checkered Flag / Timing Gate | `<svg class="icon"><use href="icons/icons.svg#icon-flag-checkered"/></svg>` |
| **Racing & Navigation** | `🎯` | `target.svg` | Target / Project Objective | `<svg class="icon"><use href="icons/icons.svg#icon-target"/></svg>` |
| **Racing & Navigation** | `🗺️` | `map-route.svg` | Milestone Map / Road | `<svg class="icon"><use href="icons/icons.svg#icon-map-route"/></svg>` |
| **Racing & Navigation** | `🚗` | `car-sports.svg` | Sports Car / Spawn Point | `<svg class="icon"><use href="icons/icons.svg#icon-car-sports"/></svg>` |
| **Racing & Navigation** | `🏎️` | `racing-formula.svg` | Racecar / Circuit Summary | `<svg class="icon"><use href="icons/icons.svg#icon-racing-formula"/></svg>` |
| **Medals & Awards** | `🥇` | `medal-gold.svg` | Gold Medal Award | `<svg class="icon"><use href="icons/icons.svg#icon-medal-gold"/></svg>` |
| **Medals & Awards** | `🥈` | `medal-silver.svg` | Silver Medal Award | `<svg class="icon"><use href="icons/icons.svg#icon-medal-silver"/></svg>` |
| **Medals & Awards** | `🥉` | `medal-bronze.svg` | Bronze Medal Award | `<svg class="icon"><use href="icons/icons.svg#icon-medal-bronze"/></svg>` |
| **Medals & Awards** | `🏆` | `trophy.svg` | Career Championship Trophy | `<svg class="icon"><use href="icons/icons.svg#icon-trophy"/></svg>` |
| **Medals & Awards** | `★` | `star.svg` | Star Award / Lua HUD Badge | `<svg class="icon"><use href="icons/icons.svg#icon-star"/></svg>` |
| **Status & Feedback** | `⚠️` | `alert-triangle.svg` | Warning / Missing Telemetry | `<svg class="icon"><use href="icons/icons.svg#icon-alert-triangle"/></svg>` |
| **Status & Feedback** | `❌` | `cross-circle.svg` | Cross / Not Supported | `<svg class="icon"><use href="icons/icons.svg#icon-cross-circle"/></svg>` |
| **Status & Feedback** | `✅` | `check-circle.svg` | Check Circle / Supported | `<svg class="icon"><use href="icons/icons.svg#icon-check-circle"/></svg>` |
| **Status & Feedback** | `✓` | `check.svg` | Checkmark Symbol | `<svg class="icon"><use href="icons/icons.svg#icon-check"/></svg>` |
| **Status & Feedback** | `⏳` | `hourglass.svg` | Hourglass / Loading State | `<svg class="icon"><use href="icons/icons.svg#icon-hourglass"/></svg>` |
| **Status & Feedback** | `✨` | `sparkles.svg` | Sparkles / 100% AI Telemetry | `<svg class="icon"><use href="icons/icons.svg#icon-sparkles"/></svg>` |
| **Status & Feedback** | `🎉` | `party-popper.svg` | Celebration / PR Success | `<svg class="icon"><use href="icons/icons.svg#icon-party-popper"/></svg>` |
| **Telemetry & Hardware**| `📡` | `antenna-telemetry.svg`| Telemetry Radar / Dish | `<svg class="icon"><use href="icons/icons.svg#icon-antenna-telemetry"/></svg>` |
| **Telemetry & Hardware**| `⏱️` | `stopwatch.svg` | Stopwatch / Countdown | `<svg class="icon"><use href="icons/icons.svg#icon-stopwatch"/></svg>` |
| **Telemetry & Hardware**| `📊` | `chart-telemetry.svg` | Telemetry Histogram / Metrics | `<svg class="icon"><use href="icons/icons.svg#icon-chart-telemetry"/></svg>` |
| **Telemetry & Hardware**| `🤖` | `robot-bot.svg` | Automated Validator / Bot | `<svg class="icon"><use href="icons/icons.svg#icon-robot-bot"/></svg>` |
| **Telemetry & Hardware**| `🧪` | `flask-test.svg` | Automated Testing Flask | `<svg class="icon"><use href="icons/icons.svg#icon-flask-test"/></svg>` |
| **Actions & Utility** | `📥` | `download.svg` | Download Script / File | `<svg class="icon"><use href="icons/icons.svg#icon-download"/></svg>` |
| **Actions & Utility** | `⚡` | `lightning-bolt.svg` | Quick Deploy / Auto-Calculate | `<svg class="icon"><use href="icons/icons.svg#icon-lightning-bolt"/></svg>` |
| **Actions & Utility** | `🚀` | `rocket.svg` | Quick Start / Launch | `<svg class="icon"><use href="icons/icons.svg#icon-rocket"/></svg>` |
| **Actions & Utility** | `↔` | `arrow-left-right.svg` | Swipe Horizontally | `<svg class="icon"><use href="icons/icons.svg#icon-arrow-left-right"/></svg>` |
| **Actions & Utility** | `↗` | `external-link.svg` | External Link Out | `<svg class="icon"><use href="icons/icons.svg#icon-external-link"/></svg>` |
| **Files & Storage** | `📁` | `folder.svg` | Folder / Dropzone | `<svg class="icon"><use href="icons/icons.svg#icon-folder"/></svg>` |
| **Files & Storage** | `📦` | `package.svg` | Package / Installation | `<svg class="icon"><use href="icons/icons.svg#icon-package"/></svg>` |
| **Documentation** | `📚` | `book-open.svg` | Documentation Index | `<svg class="icon"><use href="icons/icons.svg#icon-book-open"/></svg>` |
| **Documentation** | `🏗️` | `architecture.svg` | Architecture / Blueprint | `<svg class="icon"><use href="icons/icons.svg#icon-architecture"/></svg>` |
| **Community & Social** | `👤` | `user-circle.svg` | Contributor Profile | `<svg class="icon"><use href="icons/icons.svg#icon-user-circle"/></svg>` |
| **Community & Social** | `🤝` | `handshake.svg` | Community / PR Gateway | `<svg class="icon"><use href="icons/icons.svg#icon-handshake"/></svg>` |

---

## Integration Guidelines

### 1. Web UI Sprite Sheet (`<use>`)
The cleanest, highest performance integration inside HTML pages:
```html
<svg class="icon" width="16" height="16" aria-hidden="true">
  <use href="icons/icons.svg#icon-flag-checkered"></use>
</svg>
```

### 2. Standalone `<img>` or CSS Mask
```html
<img src="icons/flag-checkered.svg" width="16" height="16" alt="Start Gate" class="icon" />
```
Or with CSS mask (allowing dynamic `currentColor` inheritance):
```css
.icon-flag {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-color: currentColor;
  mask: url("icons/flag-checkered.svg") no-repeat center / contain;
  -webkit-mask: url("icons/flag-checkered.svg") no-repeat center / contain;
}
```

### 3. Direct Inline SVG
Any file in `assets/icons/<name>.svg` can be directly embedded inline into HTML or SVG assets (such as `og-image.svg`).
