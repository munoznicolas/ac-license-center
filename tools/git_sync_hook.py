#!/usr/bin/env python3
"""
tools/git_sync_hook.py
Automated Git & Antigravity Hook to ensure branches stay synchronized with origin/main.
Can be executed as:
  1. Git post-checkout hook (.git/hooks/post-checkout) triggered by Git/Sourcetree.
  2. Antigravity SessionStart hook (.agents/hooks.json).
"""

import json
import subprocess
import sys


def run_git(args):
    """Run a git command and return its trimmed stdout."""
    res = subprocess.run(
        ["git"] + args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return res.returncode, res.stdout.strip(), res.stderr.strip()


def sync_with_main():
    code, current_branch, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if code != 0 or not current_branch or current_branch == "HEAD":
        return

    # Fetch latest origin/main
    print(f"[git-sync-hook] Checking origin/main for branch '{current_branch}'...", file=sys.stderr)
    fetch_code, _, _ = run_git(["fetch", "origin", "main"])
    if fetch_code != 0:
        run_git(["fetch", "origin"])

    # Count commits behind origin/main
    code, behind_str, _ = run_git(["rev-list", "--count", "HEAD..origin/main"])
    behind_count = int(behind_str) if code == 0 and behind_str.isdigit() else 0

    if behind_count == 0:
        print(f"[git-sync-hook] Branch '{current_branch}' is up-to-date with origin/main.", file=sys.stderr)
        return

    print(f"[git-sync-hook] Branch '{current_branch}' is behind origin/main by {behind_count} commit(s).", file=sys.stderr)

    # Check if working tree is clean
    _, status_out, _ = run_git(["status", "--porcelain"])
    is_clean = len(status_out.strip()) == 0

    if not is_clean:
        print("[git-sync-hook] Working tree has uncommitted changes. Skipping auto-merge.", file=sys.stderr)
        return

    # If working tree is clean, safely merge origin/main
    print(f"[git-sync-hook] Auto-merging latest origin/main into '{current_branch}'...", file=sys.stderr)
    merge_code, merge_out, merge_err = run_git(["merge", "origin/main", "--no-edit"])
    if merge_code == 0:
        print("[git-sync-hook] Successfully synchronized with origin/main!", file=sys.stderr)
    else:
        print(f"[git-sync-hook] Merge warning: {merge_err or merge_out}", file=sys.stderr)


def main():
    # If called as Antigravity hook, stdin may contain JSON payload
    is_antigravity_hook = False
    if not sys.stdin.isatty():
        try:
            # Check if there is data on stdin
            import select
            # On Windows select doesn't work on stdin, so read with timeout or peek
        except ImportError:
            pass

    try:
        sync_with_main()
    except Exception as e:
        print(f"[git-sync-hook] Error: {e}", file=sys.stderr)

    # When called as an Antigravity hook, stdout must be JSON object {}
    # Output empty JSON to stdout if needed
    if len(sys.argv) > 1 and sys.argv[1] == "--antigravity":
        print("{}")


if __name__ == "__main__":
    main()
