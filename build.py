#!/usr/bin/env python3
"""Static site builder for geoffcanyon.com.

  python3 build.py            build the site into the repo root
  python3 build.py --drafts   include posts marked `draft: true`
  python3 build.py --strict   fail if any [bracketed placeholder] or needs_review remains
  python3 build.py --serve    build, then preview at http://localhost:8000

Needs only: pip install markdown
Posts live in content/posts/*.md (front matter between --- lines).
"""
import html, json, re, sys, shutil, datetime, email.utils, http.server, socketserver
from pathlib import Path
import markdown

ROOT = Path(__file__).parent
SITE = json.loads((ROOT / "site.json").read_text())
TOPICS = {t["slug"]: t for t in SITE["topics"]}
E = html.escape
GENERATED = []  # paths written, so cleanup / checks know them


# ---------- parsing ----------
def parse(path):
    text = path.read_text()
    meta, body = {}, text
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2)
    return meta, body


def load_posts(drafts=False):
    posts = []
    for p in sorted((ROOT / "content/posts").glob("*.md")):
        meta, body = parse(p)
        if meta.get("draft", "").lower() == "true" and not drafts:
            continue
        slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", p.stem)
        legacy = meta.get("legacy_url")
        post = dict(
            slug=slug, title=meta["title"], date=datetime.date.fromisoformat(meta["date"]),
            topic=meta["topic"], dek=meta.get("dek", ""), pinned=meta.get("pinned", "").lower() == "true",
            thumb=meta.get("thumb"), hero=meta.get("hero"), hero_caption=meta.get("hero_caption", ""),
            signoff=meta.get("signoff", ""), needs_review=meta.get("needs_review", ""),
            legacy=legacy, body=body, src=p.name,
        )
        assert post["topic"] in TOPICS, f"{p.name}: unknown topic {post['topic']}"
        post["url"] = legacy if legacy else f"/posts/{slug}/"
        post["external"] = bool(legacy and legacy.startswith("http"))
        words = len(re.findall(r"\w+", body))
        post["mins"] = max(1, round(words / 220))
        posts.append(post)
    posts.sort(key=lambda x: x["date"], reverse=True)
    return posts


# ---------- markdown ----------
def render_md(body):
    def play(m):
        name, line, url = [s.strip() for s in m.group(1).split("|")]
        return (f'<a class="play" href="{E(url)}" target="_blank" rel="noopener"><span><span class="k">Play it</span>'
                f'<span class="n">{E(name)}</span><span class="s">{E(line)}</span></span><span class="o">Open &rarr;</span></a>')
    body = re.sub(r"^:::play (.+)$", play, body, flags=re.M)

    def video(m):
        src, poster, cap = [x.strip() for x in m.group(1).split("|")]
        return (f'<figure class="video"><video src="{E(src)}" poster="{E(poster)}" autoplay loop muted playsinline controls preload="metadata"></video>'
                f'<figcaption>{E(cap)}</figcaption></figure>')
    body = re.sub(r"^:::video (.+)$", video, body, flags=re.M)
    out = markdown.markdown(body, extensions=["fenced_code", "tables", "sane_lists", "smarty"])
    # images -> figures
    def fig(m):
        tag = m.group(1)
        alt = re.search(r'alt="([^"]*)"', tag)
        src = re.search(r'src="([^"]*)"', tag)
        cap = re.search(r'title="([^"]*)"', tag)
        img = f'<img src="{src.group(1)}" alt="{alt.group(1) if alt else ""}" loading="lazy">'
        return f"<figure>{img}" + (f"<figcaption>{cap.group(1)}</figcaption>" if cap else "") + "</figure>"
    out = re.sub(r"<p>(<img [^>]*>)</p>", fig, out)
    # blockquotes -> pull quotes
    out = re.sub(r"<blockquote>\s*<p>(.*?)</p>\s*</blockquote>", r'<blockquote class="pull"><p>\1</p></blockquote>', out, flags=re.S)
    return out


# ---------- layout ----------
def inline(s):
    """Escape text, then turn [label](url) into links."""
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', E(s))


def fmt_date(d):
    return d.strftime("%b %-d, %Y")


def head(title, desc, path, extra=""):
    full_title = SITE["name"] if path == "/" else f"{title} — {SITE['name']}"
    canon = SITE["domain"] + path
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(full_title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}"><meta property="og:url" content="{canon}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="/assets/site.css">
{extra}</head>
<body>
<div class="wrap">
"""


def masthead(active=""):
    items = [(t["nav"], f"/{t['slug']}/", t["slug"]) for t in SITE["topics"]] + [("Archive", "/archive/", "archive")]
    nav = '<span class="sep">·</span>'.join(
        f'<a href="{u}"{" class=on" if s == active else ""}>{E(n)}</a>' for n, u, s in items)
    return f'<div class="mast"><a class="logo" href="/">{E(SITE["name"])}</a><nav>{nav}</nav></div>\n'


def footer():
    return (f'<div class="foot"><span>geoffcanyon.com</span><span><a href="/about/">About</a> · '
            f'<a href="mailto:{SITE["email"]}">Email</a> · <a href="{SITE["linkedin"]}">LinkedIn</a>'
            f'</span></div>\n</div>\n<script src="/assets/site.js"></script>\n</body>\n</html>\n')


def meta_line(p, pin=False):
    t = TOPICS[p["topic"]]
    bits = []
    if pin and p["pinned"]:
        bits += ['<span>Pinned</span>', '<span class="sep">·</span>']
    bits += [f'<span>{E(t["nav"] if t["slug"] != "games" else "Games")}</span>', '<span class="sep">·</span>',
             f'<span class="d">{fmt_date(p["date"])}</span>']
    return '<div class="meta">' + "".join(bits) + "</div>"


def row(p, lead=False, pin=False):
    cls = "row lead" if lead else "row"
    thumb = f'<img class="thumb" src="{p["thumb"]}" alt="">' if p["thumb"] else ""
    ext = ' target="_blank" rel="noopener"' if p["external"] else ""
    extcls = ' class="ext"' if p["external"] else ""
    h = f'<h4><span{extcls}>{E(p["title"])}</span></h4>' if p["external"] else f'<h4>{E(p["title"])}</h4>'
    return (f'<a class="{cls}" href="{E(p["url"])}"{ext} data-topic="{p["topic"]}">{thumb}<div class="body">'
            f'{meta_line(p, pin)}{h}<p>{E(p["dek"])}</p></div></a>\n')


def write(path, content):
    out = ROOT / path.lstrip("/")
    if out.suffix != ".html" and not out.suffix:
        out = out / "index.html"
    if path.endswith("/"):
        out = ROOT / path.strip("/") / "index.html" if path != "/" else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content)
    GENERATED.append(out)


def sort_home(posts):
    return sorted(posts, key=lambda p: (not p["pinned"],))  # stable: pinned first, then date order


def grouped_list(posts, with_topic_filter=False):
    pinned = [p for p in posts if p["pinned"]]
    rest = [p for p in posts if not p["pinned"]]
    out = '<div class="list" id="list">\n'
    if pinned:
        out += '<div class="group pinned">' + "".join(row(p, pin=True) for p in pinned) + "</div>\n"
    year = None
    group_open = False
    for p in rest:
        if p["date"].year != year:
            if group_open:
                out += "</div>\n"
            year = p["date"].year
            out += f'<div class="group"><div class="yr">{year}</div>\n'
            group_open = True
        out += row(p)
    if group_open:
        out += "</div>\n"
    out += "</div>\n"
    return out


# ---------- pages ----------
def build_home(posts):
    s = sort_home(posts)[: SITE["home_max"]]
    h = head(SITE["name"], SITE["tagline"], "/")
    h += masthead()
    h += (f'<div class="intro"><div class="text"><p>{E(SITE["bio"])}</p></div>'
          f'<img class="shot" src="{SITE["headshot"]}" alt="Geoff Canyon"></div>\n'
          f'<p class="status" style="margin:24px 0 0">{E(SITE["status"])} <a href="/about/">More about me &rarr;</a></p>\n')
    if s:
        h += '<div class="label">Latest</div>\n' + row(s[0], lead=True, pin=True)
    h += '<div class="label" id="explore">Explore by topic</div>\n<div class="topics">\n'
    for t in SITE["topics"]:
        h += (f'<a href="/{t["slug"]}/"><div class="hd"><h3>{E(t["name"])}</h3><span class="go">&rarr;</span></div>'
              f'<p>{E(t["description"])}</p></a>\n')
    h += "</div>\n"
    if len(s) > 1:
        h += '<div class="label">More recent</div>\n' + "".join(row(p) for p in s[1:])
    write("/", h + footer())


def build_topic(t, posts):
    mine = [p for p in posts if p["topic"] == t["slug"]]
    h = head(t["name"], t["description"], f"/{t['slug']}/") + masthead(t["slug"])
    h += (f'<div class="head"><div class="kicker">Topic</div><h1>{E(t["name"])}</h1>'
          f'<p class="desc">{E(t["description"])}</p></div>\n')
    h += grouped_list(mine) if mine else '<p class="empty">Nothing here yet.</p>\n'
    others = "".join(f'<a href="/{o["slug"]}/">{E(o["name"])}</a>' for o in SITE["topics"] if o["slug"] != t["slug"])
    h += f'<div class="others"><div class="label">Other topics</div><div class="l">{others}</div></div>\n'
    write(f"/{t['slug']}/", h + footer())


def build_archive(posts):
    h = head("All posts", "Everything I've published, newest first.", "/archive/") + masthead("archive")
    h += '<div class="head"><div class="kicker">Archive</div><h1>All posts</h1></div>\n'
    chips = '<button class="on" data-f="all">All</button>' + "".join(
        f'<button data-f="{t["slug"]}">{E(t["nav"])}</button>' for t in SITE["topics"])
    h += f'<div class="chips" data-chips>{chips}</div>\n'
    h += grouped_list(posts)
    write("/archive/", h + footer())


def build_post(p, posts):
    t = TOPICS[p["topic"]]
    h = head(p["title"], p["dek"], p["url"]) + masthead(p["topic"])
    h += (f'<div class="head"><div class="meta" style="font-size:12px"><a href="/{t["slug"]}/">{E(t["name"])}</a>'
          f'<span class="sep">·</span><span class="d">{fmt_date(p["date"])}</span><span class="sep">·</span>'
          f'<span class="d">{p["mins"]} min read</span></div><h1>{E(p["title"])}</h1>'
          f'<p class="dek">{E(p["dek"])}</p></div>\n')
    if p["hero"]:
        cap = f'<figcaption>{E(p["hero_caption"])}</figcaption>' if p["hero_caption"] else ""
        h += f'<figure class="hero"><img src="{p["hero"]}" alt="">{cap}</figure>\n'
    h += f'<div class="prose">\n{render_md(p["body"])}\n</div>\n'
    if p["signoff"]:
        h += f'<div class="signoff"><p>{p["signoff"]}</p></div>\n'
    own = [q for q in posts if not q["legacy"]]
    i = own.index(p)
    prev = own[i + 1] if i + 1 < len(own) else None  # older
    nxt = own[i - 1] if i > 0 else None  # newer
    pn = ""
    if prev:
        pn += f'<a href="{prev["url"]}"><div class="k">&larr; Previous</div><div class="t">{E(prev["title"])}</div></a>'
    if nxt:
        pn += f'<a class="r" href="{nxt["url"]}"><div class="k">Next &rarr;</div><div class="t">{E(nxt["title"])}</div></a>'
    if pn:
        h += f'<div class="pn">{pn}</div>\n'
    write(p["url"], h + footer())


def build_about():
    meta, body = parse(ROOT / "content/pages/about.md")
    jobs = '<div class="label" style="margin-top:56px">Where I\'ve worked</div>\n' + "".join(
        f'<div class="job"><h3>{E(j["company"])}</h3><div class="role">{E(j["about"])}</div><p>{inline(j["line"])}</p></div>\n' for j in SITE["jobs"])
    sections = re.split(r"^## (.+)$", body, flags=re.M)
    intro, rest = sections[0], sections[1:]
    h = head("About", "About Geoff Canyon", "/about/") + masthead()
    h += (f'<div class="head"><div class="kicker">About</div><h1>{E(meta["title"])}</h1></div>\n'
          f'<div class="intro" style="margin-top:28px"><div class="text">'
          f'<div class="intro-p" style="font-size:19px;line-height:1.65">{render_md(intro)}</div></div>'
          f'<img class="shot big" src="{SITE["headshot"]}" alt="Geoff Canyon"></div>\n')
    h += f'<p class="intro status" style="margin:28px 0 0">{E(SITE["status"])}</p>\n'
    for i in range(0, len(rest), 2):
        name, text = rest[i], rest[i + 1]
        if name == "Off the clock" and "<!-- jobs -->" not in body:
            pass
        h += f'<div class="label" style="margin-top:56px">{E(name)}</div><div class="about-body">{render_md(text)}</div>\n'
        if name == "What I do":
            h += jobs
    links = [("Email", SITE["email"], f'mailto:{SITE["email"]}'), ("LinkedIn", "linkedin.com/in/geoffcanyon", SITE["linkedin"]),
             ("GitHub", "github.com/gcanyon", SITE["github"])]
    h += '<div class="label" style="margin-top:44px">Elsewhere</div>\n' + "".join(
        f'<a class="elsewhere" href="{u}"><b>{E(n)}</b><span>{E(hint)}</span></a>\n' for n, hint, u in links)
    write("/about/", h + footer())


def build_404():
    h = head("Not found", "Page not found", "/404.html") + masthead()
    h += '<div class="head"><div class="kicker">404</div><h1>Nothing here.</h1><p class="desc">That page moved or never existed. <a href="/" style="color:var(--accent);text-decoration:underline">Back to the front page</a> or the <a href="/archive/" style="color:var(--accent);text-decoration:underline">archive</a>.</p></div>\n'
    (ROOT / "404.html").write_text(h + footer())
    GENERATED.append(ROOT / "404.html")


def build_feed(posts):
    d = SITE["domain"]
    items = ""
    for p in posts[:30]:
        url = p["url"] if p["external"] else d + p["url"]
        pub = email.utils.format_datetime(datetime.datetime.combine(p["date"], datetime.time(12), datetime.timezone.utc))
        items += (f"<item><title>{E(p['title'])}</title><link>{E(url)}</link><guid>{E(url)}</guid>"
                  f"<pubDate>{pub}</pubDate><category>{E(TOPICS[p['topic']]['name'])}</category>"
                  f"<description>{E(p['dek'])}</description></item>\n")
    feed = (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>{E(SITE["name"])}</title>'
            f'<link>{d}/</link><description>{E(SITE["tagline"])}</description>\n{items}</channel></rss>\n')
    (ROOT / "feed.xml").write_text(feed)
    GENERATED.append(ROOT / "feed.xml")


def build_sitemap(posts):
    urls = ["/", "/about/", "/archive/"] + [f"/{t['slug']}/" for t in SITE["topics"]] + [p["url"] for p in posts if not p["legacy"]]
    body = "".join(f"<url><loc>{SITE['domain']}{u}</loc></url>" for u in urls)
    (ROOT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n')
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE['domain']}/sitemap.xml\n")


# ---------- checks ----------
def check(posts):
    problems = []
    for f in GENERATED:
        if f.suffix != ".html":
            continue
        t = f.read_text()
        t = re.sub(r"<(pre|script|style)\b.*?</\1>", "", t, flags=re.S)
        t = re.sub(r"<[^>]+>", " ", t)
        found = re.findall(r"\[[A-Za-z][^\]]{0,300}\]", t)
        for ph in found:
            problems.append(f"{f.relative_to(ROOT)}: {ph}")
    for p in posts:
        if p["needs_review"]:
            problems.append(f"{p['src']}: needs_review — {p['needs_review']}")
    return problems


def main():
    args = sys.argv[1:]
    posts = load_posts(drafts="--drafts" in args)
    build_home(posts)
    for t in SITE["topics"]:
        build_topic(t, posts)
    build_archive(posts)
    build_about()
    for p in posts:
        if not p["legacy"]:
            build_post(p, posts)
    build_404()
    build_sitemap(posts)
    probs = check(posts)
    print(f"Built {len(GENERATED)} files from {len(posts)} posts.")
    if probs:
        print(f"{len(probs)} item(s) to resolve before this goes live:")
        for x in probs:
            print("  -", x)
        if "--strict" in args:
            sys.exit(1)
    if "--serve" in args:
        with socketserver.TCPServer(("", 8000), http.server.SimpleHTTPRequestHandler) as s:
            print("Preview: http://localhost:8000")
            s.serve_forever()


if __name__ == "__main__":
    main()
