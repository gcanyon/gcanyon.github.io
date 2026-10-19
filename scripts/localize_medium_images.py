#!/usr/bin/env python3
"""Download Medium-hosted images referenced in content/posts/*.md into img/medium/
and rewrite the links to local paths. Safe to re-run. Failed downloads keep their URL."""
import re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "img" / "medium"
PAT = re.compile(r"https://cdn-images-1\.medium\.com/max/(\d+)/([^\s)\"']+)")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for md in sorted((ROOT / "content" / "posts").glob("*.md")):
        text = md.read_text()
        def repl(m):
            width, name = m.group(1), m.group(2)
            safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)
            dest = OUT / f"{width}-{safe}"
            if not dest.exists():
                try:
                    req = urllib.request.Request(m.group(0), headers={"User-Agent": "Mozilla/5.0"})
                    dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
                    print("downloaded", dest.name)
                except Exception as e:
                    print("FAILED", m.group(0), e, file=sys.stderr)
                    return m.group(0)
            return f"/img/medium/{dest.name}"
        new = PAT.sub(repl, text)
        if new != text:
            md.write_text(new)
            print("updated", md.name)

if __name__ == "__main__":
    main()
