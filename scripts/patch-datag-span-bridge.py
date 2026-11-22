#!/usr/bin/env python3
"""
Surgical patch for a live TaskSite checkout whose bridge already has
readSpanSheet / applyGapAnswer (production) but only understands data-a.

Revision-style worksheets use data-g on .slot / .opt / .inp — without this
patch those answers never get collected.

Usage on the VPS:
  python3 scripts/patch-datag-span-bridge.py /opt/tasksite/src/lib/bridge-script.ts
  cd /opt/tasksite && npm run build && systemctl restart tasksite
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MARKER = "/* tasksite:data-g-span-support */"

HELPERS = r'''
  /* tasksite:data-g-span-support */
  function spanSheetId(el) {
    var g = el.getAttribute("data-g");
    if (g != null && g !== "") return { id: String(g), key: "g:" + g };
    var a = el.getAttribute("data-a");
    if (a != null && a !== "") return { id: String(a), key: "a:" + a };
    return null;
  }
'''


def patch(src: str) -> str:
    if "tasksite:data-g-span-support" in src and "spanSheetId" in src:
        return src

    # Insert helpers before readSpanSheet if present, else before collectAnswers
    if "function readSpanSheet" in src and "function spanSheetId" not in src:
        src = src.replace(
            "function readSpanSheet",
            HELPERS + "\n  function readSpanSheet",
            1,
        )

    # Broaden slot id reads: data-a → data-g || data-a
    replacements = [
        (
            r'var id = slots\[i\]\.getAttribute\("data-a"\);',
            'var _sid = spanSheetId(slots[i]); if (!_sid) continue; var id = _sid.id; var _skey = _sid.key;',
        ),
        (
            r'out\[spanAnswerKey\(id\)\] = cleanSlotText\(slots\[i\]\.textContent\);',
            "out[_skey || spanAnswerKey(id)] = cleanSlotText(slots[i].textContent);",
        ),
        (
            r'slots\[i\]\.getAttribute\("data-a"\) === String\(id\)',
            '(slots[i].getAttribute("data-g") === String(id) || slots[i].getAttribute("data-a") === String(id))',
        ),
        (
            r'copts\[i\]\.getAttribute\("data-a"\) === String\(id\)',
            '(copts[i].getAttribute("data-g") === String(id) || copts[i].getAttribute("data-a") === String(id))',
        ),
        (
            r'opts\[j\]\.getAttribute\("data-a"\) !== String\(id\)',
            '(opts[j].getAttribute("data-g") !== String(id) && opts[j].getAttribute("data-a") !== String(id))',
        ),
        (
            r'opts\[i\]\.getAttribute\("data-a"\) !== String\(id\)',
            '(opts[i].getAttribute("data-g") !== String(id) && opts[i].getAttribute("data-a") !== String(id))',
        ),
    ]

    for pat, repl in replacements:
        src = re.sub(pat, repl, src)

    # Also collect plain .opt.on with data-g (Revision choice items)
    if "function collectSpanSheet" in src and "data-g span opt" not in src:
        inject = """
    // data-g span opt (Revision worksheets)
    var gOpts = sheetElements(".opt.on");
    for (var gi = 0; gi < gOpts.length; gi++) {
      var gInfo = spanSheetId(gOpts[gi]);
      if (!gInfo) continue;
      if (!answers[gInfo.key]) answers[gInfo.key] = cleanSlotText(gOpts[gi].textContent);
    }
"""
        src = src.replace(
            "function collectSpanSheet(answers) {",
            "function collectSpanSheet(answers) {" + inject,
            1,
        )

    # Apply g: keys in applySpanSheet
    if "key.indexOf(\"a:\")" in src and 'key.indexOf("g:")' not in src:
        src = src.replace(
            'if (key.indexOf("a:") !== 0) return;\n      var id = key.slice(2);',
            'if (key.indexOf("a:") !== 0 && key.indexOf("g:") !== 0) return;\n'
            '      var id = key.indexOf("g:") === 0 ? key.slice(2) : key.slice(2);',
            1,
        )

    # Prefer clicking .opt[data-g] in applyChoiceAnswer fallback path
    if "function applyChoiceAnswer" in src and ".opt[data-g" not in src:
        src = src.replace(
            "var copts = sheetElements(\".copt\");",
            'var copts = sheetElements(".copt, .opt[data-g]");',
            1,
        )

    if MARKER not in src:
        src = src.replace(
            "/* tasksite:data-g-span-support */",
            MARKER,
            1,
        ) if "/* tasksite:data-g-span-support */" in src else src

    return src


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    original = path.read_text(encoding="utf-8")
    updated = patch(original)
    if updated == original:
        print(f"No changes needed (or patterns not found): {path}")
        return 0
    backup = path.with_suffix(path.suffix + ".bak")
    backup.write_text(original, encoding="utf-8")
    path.write_text(updated, encoding="utf-8")
    print(f"Patched {path} (backup: {backup})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
