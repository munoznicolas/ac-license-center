#!/usr/bin/env python3
"""
test_web_ui_theme.py
Unit tests verifying theme synchronization and the theme switch button
in the Actions drawer across Web UI assets.
"""

import os
import unittest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB_UI_DIR = os.path.join(REPO_ROOT, "tools", "web_ui")


class TestWebUITheme(unittest.TestCase):
    """Test suite for theme configuration and Actions drawer theme button."""

    def test_index_html_theme_configuration(self):
        """Verify index.html syncs theme with browser preference and declares color-scheme."""
        index_path = os.path.join(WEB_UI_DIR, "index.html")
        self.assertTrue(os.path.isfile(index_path), f"File missing: {index_path}")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn('<meta name="color-scheme" content="light dark"', content)
        self.assertIn("prefers-color-scheme", content)
        self.assertIn("data-theme", content)

    def test_drawer_menu_theme_toggle_elements(self):
        """Verify DrawerMenu.tsx renders the theme toggle button."""
        drawer_path = os.path.join(WEB_UI_DIR, "src", "components", "layout", "DrawerMenu.tsx")
        self.assertTrue(os.path.isfile(drawer_path), f"File missing: {drawer_path}")
        with open(drawer_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn('id="btn-theme-toggle"', content)
        self.assertIn("onToggleTheme", content)

    def test_app_theme_synchronization_logic(self):
        """Verify App.tsx supports browser preference detection and toggle."""
        app_path = os.path.join(WEB_UI_DIR, "src", "App.tsx")
        self.assertTrue(os.path.isfile(app_path), f"File missing: {app_path}")
        with open(app_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("prefers-color-scheme", content)
        self.assertIn("toggleTheme", content)
        self.assertIn("data-theme", content)

    def test_style_css_theme_definitions(self):
        """Verify style.css declares color-scheme and contains theme palettes."""
        style_path = os.path.join(WEB_UI_DIR, "src", "style.css")
        self.assertTrue(os.path.isfile(style_path), f"File missing: {style_path}")
        with open(style_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("color-scheme: dark;", content)
        self.assertIn("color-scheme: light;", content)
        self.assertIn(':root[data-theme="light"]', content)
        self.assertIn(":root {", content)

    def test_header_actions_theme_and_shadow_isolation(self):
        """Verify hamburger menu (header-actions drawer) adapts to theme and does not leak shadow when closed."""
        style_path = os.path.join(WEB_UI_DIR, "src", "style.css")
        self.assertTrue(os.path.isfile(style_path), f"File missing: {style_path}")
        with open(style_path, "r", encoding="utf-8") as f:
            css = f.read()

        self.assertNotIn("#12161f", css, "header-actions drawer must not have hardcoded dark background #12161f")
        self.assertIn("background-color: var(--bg-panel);", css)
        self.assertIn("box-shadow: none;", css)
        self.assertIn("visibility: hidden;", css)
        self.assertIn(".header-actions.open", css)
        self.assertIn(':root[data-theme="light"] .header-actions.open', css)


if __name__ == "__main__":
    unittest.main()
