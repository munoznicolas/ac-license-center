#!/usr/bin/env python3
"""
test_web_ui_structure.py
Unit tests verifying HTML tag balance, ID uniqueness, and DOM layout hierarchy.
"""

import os
import unittest

from tools.validate_web_ui import StrictHTMLValidator, validate_html_file, validate_web_ui_structure

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INDEX_HTML_PATH = os.path.join(REPO_ROOT, "tools", "web_ui", "static", "index.html")


class TestWebUIStructure(unittest.TestCase):
    """Test suite ensuring index.html structural integrity and tag balance."""

    def test_index_html_exists(self):
        """Verify index.html exists in tools/web_ui/static."""
        self.assertTrue(os.path.isfile(INDEX_HTML_PATH), f"Missing index.html at {INDEX_HTML_PATH}")

    def test_index_html_strict_validation(self):
        """Verify index.html passes all structural tag balance and containment checks."""
        errors = validate_web_ui_structure(INDEX_HTML_PATH)
        self.assertEqual(errors, [], f"Web UI structural validation failed with errors:\n" + "\n".join(f"  - {e}" for e in errors))

    def test_validator_catches_unmatched_closing_tag(self):
        """Verify validator flags stray unmatched closing tags (e.g. extra </div>)."""
        broken_html = """<!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
            <div id="container">
                <p>Hello World</p>
            </div>
            </div>
        </body>
        </html>"""
        validator = StrictHTMLValidator()
        validator.feed(broken_html)
        validator.close()
        self.assertTrue(any("Unmatched closing tag </div>" in err for err in validator.errors))

    def test_validator_catches_unclosed_tag(self):
        """Verify validator flags tags left unclosed at EOF."""
        broken_html = """<!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
            <div id="container">
                <p>Unclosed paragraph
            </div>
        </body>
        </html>"""
        validator = StrictHTMLValidator()
        validator.feed(broken_html)
        validator.close()
        self.assertTrue(any("<p>" in err for err in validator.errors))

    def test_validator_catches_duplicate_ids(self):
        """Verify validator flags duplicate element IDs."""
        broken_html = """<!DOCTYPE html>
        <html>
        <body>
            <div id="duplicate-id"></div>
            <span id="duplicate-id"></span>
        </body>
        </html>"""
        validator = StrictHTMLValidator()
        validator.feed(broken_html)
        validator.close()
        self.assertTrue(any("Duplicate element ID 'duplicate-id'" in err for err in validator.errors))

    def test_validator_catches_hierarchy_containment_violation(self):
        """Verify validator flags when .ref-charts-grid is outside #reference-view."""
        broken_html = """<!DOCTYPE html>
        <html>
        <body>
            <div class="app-container">
                <div class="workspace">
                    <div id="sidebar"></div>
                    <div id="main-editor"></div>
                </div>
                <div id="reference-view">
                    <div class="ref-header"></div>
                    <div class="ref-card ref-metrics-card"></div>
                </div>
                <!-- Orphaned charts grid placed outside #reference-view -->
                <div class="ref-charts-grid">
                    <canvas id="chart-power-pw"></canvas>
                    <canvas id="chart-gold"></canvas>
                    <canvas id="chart-gold-dist"></canvas>
                    <canvas id="chart-drivetrain"></canvas>
                </div>
            </div>
        </body>
        </html>"""
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as tf:
            tf.write(broken_html)
            temp_path = tf.name

        try:
            errors = validate_web_ui_structure(temp_path)
            self.assertTrue(any("Hierarchy violation" in err and ".ref-charts-grid" in err for err in errors))
        finally:
            os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
