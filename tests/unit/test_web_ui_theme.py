#!/usr/bin/env python3
"""
test_web_ui_theme.py
Unit tests verifying theme synchronization and the theme switch button
in the Actions drawer across Web UI assets.
"""

import os
import re
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATIC_DIR = os.path.join(REPO_ROOT, "tools", "web_ui", "static")


class TestWebUITheme(unittest.TestCase):
    """Test suite for theme configuration and Actions drawer theme button."""

    def test_index_html_theme_configuration(self):
        """Verify index.html includes theme button in actions drawer and syncs with browser preference."""
        index_path = os.path.join(STATIC_DIR, "index.html")
        self.assertTrue(os.path.isfile(index_path), f"File missing: {index_path}")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Theme toggle button exists inside actions drawer
        self.assertIn('id="btn-theme-toggle"', content)
        self.assertIn('id="theme-toggle-icon"', content)
        self.assertIn('id="theme-toggle-text"', content)

        # Meta color-scheme must declare support for light dark
        self.assertIn('<meta name="color-scheme" content="light dark"', content)

        # Inline head script must detect prefers-color-scheme or stored theme
        self.assertIn("prefers-color-scheme", content)
        self.assertIn("data-theme", content)

    def test_dom_js_theme_toggle_elements(self):
        """Verify dom.js binds theme toggle elements."""
        dom_path = os.path.join(STATIC_DIR, "js", "dom.js")
        self.assertTrue(os.path.isfile(dom_path), f"File missing: {dom_path}")
        with open(dom_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("btnThemeToggle", content)

    def test_theme_js_synchronization_logic(self):
        """Verify theme.js supports detection, toggle and themechange event."""
        theme_path = os.path.join(STATIC_DIR, "js", "theme.js")
        self.assertTrue(os.path.isfile(theme_path), f"File missing: {theme_path}")
        with open(theme_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Must support browser preference detection & toggle
        self.assertIn("getBrowserTheme", content)
        self.assertIn("setTheme", content)
        self.assertIn("toggleTheme", content)
        self.assertIn("updateThemeToggleUI", content)
        self.assertIn("themechange", content)

    def test_style_css_theme_definitions(self):
        """Verify style.css declares color-scheme and contains theme palettes."""
        style_path = os.path.join(STATIC_DIR, "style.css")
        self.assertTrue(os.path.isfile(style_path), f"File missing: {style_path}")
        with open(style_path, "r", encoding="utf-8") as f:
            content = f.read()

        css_dir = os.path.join(STATIC_DIR, "css")
        if os.path.isdir(css_dir):
            for fname in sorted(os.listdir(css_dir)):
                if fname.endswith(".css"):
                    with open(os.path.join(css_dir, fname), "r", encoding="utf-8") as mf:
                        content += "\n" + mf.read()

        # color-scheme declarations
        self.assertIn("color-scheme: light dark;", content)
        self.assertIn(':root[data-theme="light"]', content)
        self.assertIn(':root[data-theme="dark"]', content)
        self.assertIn(".theme-toggle-btn", content)

    def test_header_actions_theme_and_shadow_isolation(self):
        """Verify hamburger menu (header-actions drawer) adapts to theme and does not leak shadow when closed."""
        responsive_path = os.path.join(STATIC_DIR, "css", "responsive.css")
        self.assertTrue(os.path.isfile(responsive_path), f"File missing: {responsive_path}")
        with open(responsive_path, "r", encoding="utf-8") as f:
            css = f.read()

        # 1. No hardcoded black background (#12161f) for header-actions
        self.assertNotIn("#12161f", css, "header-actions drawer must not have hardcoded dark background #12161f")

        # 2. Must use theme variable (var(--bg-panel) or var(--bg-card))
        self.assertIn("background-color: var(--bg-panel);", css, "header-actions must use dynamic theme background var(--bg-panel)")

        # 3. Closed state must not have persistent shadow leaking to viewport
        self.assertIn("box-shadow: none;", css, "Closed header-actions must set box-shadow: none to prevent shadow leaking")
        self.assertIn("visibility: hidden;", css, "Closed header-actions must set visibility: hidden to prevent shadow leaking")

        # 4. Open state must apply shadow
        self.assertIn(".header-actions.open", css)
        self.assertIn(':root[data-theme="light"] .header-actions.open', css, "Light theme must have calibrated drawer shadow")


if __name__ == "__main__":
    unittest.main()
