#!/usr/bin/env python3
"""
validate_web_ui.py
Gran Turismo License Mod - Web UI HTML & Structural DOM Validator.

Validates:
1. Strict tag balance & closure (flags stray/unmatched closing tags and unclosed tags).
2. Global HTML element ID uniqueness (prevents duplicate ID collisions).
3. Critical layout containment rules (e.g. .ref-charts-grid inside #reference-view).
"""

import argparse
from html.parser import HTMLParser
import os
import sys
from typing import Dict, List, Optional, Set, Tuple

# HTML5 void elements that do not require or permit closing tags
VOID_TAGS: Set[str] = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
}

# Elements that can contain raw text/scripts where HTML tags shouldn't be parsed inside
RAW_TEXT_TAGS: Set[str] = {"script", "style"}


class DOMNode:
    """Represents an element node in the parsed DOM tree."""

    def __init__(self, tag: str, attrs: Dict[str, str], line: int, col: int, parent: Optional["DOMNode"] = None):
        self.tag = tag.lower()
        self.attrs = attrs
        self.line = line
        self.col = col
        self.parent = parent
        self.children: List["DOMNode"] = []
        self.id = attrs.get("id")
        self.classes = set(attrs.get("class", "").split())

    def find_by_id(self, elem_id: str) -> Optional["DOMNode"]:
        if self.id == elem_id:
            return self
        for child in self.children:
            found = child.find_by_id(elem_id)
            if found:
                return found
        return None

    def find_by_class(self, class_name: str) -> List["DOMNode"]:
        results = []
        if class_name in self.classes:
            results.append(self)
        for child in self.children:
            results.extend(child.find_by_class(class_name))
        return results

    def is_ancestor_of(self, node: "DOMNode") -> bool:
        curr = node.parent
        while curr:
            if curr is self:
                return True
            curr = curr.parent
        return False


class StrictHTMLValidator(HTMLParser):
    """HTML parser that verifies strict tag balance and constructs a light DOM tree."""

    def __init__(self):
        super().__init__()
        self.stack: List[Tuple[str, int, int, DOMNode]] = []
        self.errors: List[str] = []
        self.root_nodes: List[DOMNode] = []
        self.ids_seen: Dict[str, int] = {}
        self.current_node: Optional[DOMNode] = None

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        tag = tag.lower()
        line, col = self.getpos()
        attr_dict = {k: v or "" for k, v in attrs}

        # Check unique IDs
        elem_id = attr_dict.get("id")
        if elem_id:
            if elem_id in self.ids_seen:
                self.errors.append(
                    f"Duplicate element ID '{elem_id}' at line {line}, col {col} (first defined at line {self.ids_seen[elem_id]})"
                )
            else:
                self.ids_seen[elem_id] = line

        node = DOMNode(tag, attr_dict, line, col, parent=self.current_node)
        if self.current_node:
            self.current_node.children.append(node)
        else:
            self.root_nodes.append(node)

        if tag not in VOID_TAGS:
            self.stack.append((tag, line, col, node))
            self.current_node = node

    def handle_startendtag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]):
        """Handle self-closing tags like <meta ... />, <input ... />, <br />."""
        tag = tag.lower()
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        line, col = self.getpos()

        if tag in VOID_TAGS:
            self.errors.append(f"Forbidden closing tag </{tag}> for void element at line {line}, col {col}")
            return

        if not self.stack:
            self.errors.append(f"Unmatched closing tag </{tag}> at line {line}, col {col} (stack is empty)")
            return

        top_tag, top_line, top_col, top_node = self.stack[-1]
        if top_tag == tag:
            self.stack.pop()
            self.current_node = top_node.parent
        else:
            # Look backwards to identify if an open tag was left unclosed or an extra closing tag appeared
            open_tags = [item[0] for item in self.stack]
            if tag in open_tags:
                unclosed = []
                while self.stack and self.stack[-1][0] != tag:
                    u_tag, u_line, u_col, _ = self.stack.pop()
                    unclosed.append(f"<{u_tag}> (line {u_line})")
                self.stack.pop()
                self.current_node = self.stack[-1][3] if self.stack else None
                self.errors.append(
                    f"Mismatched </{tag}> at line {line}, col {col}; prematurely closed unclosed tags: {', '.join(unclosed)}"
                )
            else:
                self.errors.append(
                    f"Unmatched closing tag </{tag}> at line {line}, col {col}; expected </{top_tag}> (opened at line {top_line})"
                )

    def close(self):
        super().close()
        while self.stack:
            tag, line, col, _ = self.stack.pop()
            self.errors.append(f"Unclosed tag <{tag}> opened at line {line}, col {col}")


def validate_html_file(file_path: str) -> Tuple[List[str], List[DOMNode]]:
    """Parses an HTML file and returns validation errors and the root DOM nodes."""
    if not os.path.isfile(file_path):
        return [f"File not found: {file_path}"], []

    validator = StrictHTMLValidator()
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    validator.feed(content)
    validator.close()
    return validator.errors, validator.root_nodes


def validate_web_ui_structure(index_path: str) -> List[str]:
    """Validates HTML tag balance and key containment hierarchies in index.html."""
    errors, roots = validate_html_file(index_path)
    if errors:
        return errors

    # Helper to find node anywhere in tree
    def find_node_by_id(elem_id: str) -> Optional[DOMNode]:
        for root in roots:
            node = root.find_by_id(elem_id)
            if node:
                return node
        return None

    def find_nodes_by_class(class_name: str) -> List[DOMNode]:
        res = []
        for root in roots:
            res.extend(root.find_by_class(class_name))
        return res

    # Structural Integrity Rule 1: #reference-view must exist
    ref_view = find_node_by_id("reference-view")
    if not ref_view:
        errors.append("Critical layout element '#reference-view' missing from index.html")
    else:
        # Check that .ref-charts-grid is a descendant of #reference-view
        chart_grids = find_nodes_by_class("ref-charts-grid")
        if not chart_grids:
            errors.append("Critical element '.ref-charts-grid' missing from index.html")
        else:
            for grid in chart_grids:
                if not ref_view.is_ancestor_of(grid):
                    errors.append(
                        f"Hierarchy violation: '.ref-charts-grid' at line {grid.line} is NOT inside '#reference-view' (line {ref_view.line})!"
                    )

        # Check that .table-card is a descendant of #reference-view
        table_cards = find_nodes_by_class("table-card")
        for table in table_cards:
            if not ref_view.is_ancestor_of(table):
                errors.append(
                    f"Hierarchy violation: '.table-card' at line {table.line} is NOT inside '#reference-view'!"
                )

    # Structural Integrity Rule 2: #sidebar and #main-editor must be inside .workspace
    workspace_nodes = find_nodes_by_class("workspace")
    if not workspace_nodes:
        errors.append("Critical layout element '.workspace' missing from index.html")
    else:
        workspace = workspace_nodes[0]
        sidebar = find_node_by_id("sidebar")
        if sidebar and not workspace.is_ancestor_of(sidebar):
            errors.append(f"Hierarchy violation: '#sidebar' is NOT inside '.workspace'!")
        editor = find_node_by_id("main-editor")
        if editor and not workspace.is_ancestor_of(editor):
            errors.append(f"Hierarchy violation: '#main-editor' is NOT inside '.workspace'!")

    # Structural Integrity Rule 3: Key charts canvases must exist
    required_canvases = ["chart-power-pw", "chart-gold", "chart-gold-dist", "chart-drivetrain"]
    for c_id in required_canvases:
        if not find_node_by_id(c_id):
            errors.append(f"Required chart canvas '#{c_id}' missing from index.html")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Web UI HTML tag balance and structural containment.")
    parser.add_argument(
        "--path",
        default=os.path.join(os.path.dirname(__file__), "web_ui", "static", "index.html"),
        help="Path to index.html to validate",
    )
    args = parser.parse_args()

    print(f"[*] Validating Web UI structural integrity: {args.path}")
    errors = validate_web_ui_structure(args.path)

    if errors:
        print(f"[FAIL] Found {len(errors)} Web UI structural issue(s):")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("[SUCCESS] Web UI structural validation passed: tags balanced and containment intact.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
