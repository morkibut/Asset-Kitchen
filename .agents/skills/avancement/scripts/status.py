#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
avancement / project-status engine.

Deterministic, stdlib-only. Scans a repo (BMAD, claude-mastery, generic markdown),
keeps an incremental state file, and renders a self-contained HTML dashboard.

Usage (from the project root):
  python3 status.py scan                  # detect + merge + render
  python3 status.py render                # rebuild HTML from state only
  python3 status.py info [--json]         # compact summary (cheap to read)
  python3 status.py set 1.2 --status done [--team QA] [--title "..."] [--progress .5] [--clear]
  python3 status.py note "texte" [--level risk|blocker|win|info|decision] [--scope 1.2]
  python3 status.py note --list | --remove n3
  python3 status.py add --type epic|story --title "..." [--parent 1] [--id X] [--status todo]
  python3 status.py milestone "MVP" --date 2026-09-15 [--status done] | --remove m1
  python3 status.py project --name "Mon projet"
Options: --root DIR (default .), --out DIR (default docs/status), --no-git
"""
import argparse, json, os, re, subprocess, sys, datetime, html

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCHEMA = 1
DEFAULT_OUT = "docs/status"

STATUS_ORDER = ["blocked", "todo", "ready", "in_progress", "review", "done"]
WEIGHT = {"done": 1.0, "review": 0.85, "in_progress": 0.5, "ready": 0.15, "todo": 0.0, "blocked": 0.25}
LABELS = {"done": "Terminé", "in_progress": "En cours", "review": "En revue",
          "ready": "Prêt", "todo": "À faire", "blocked": "Bloqué"}
STAGE_LABEL = {"todo": "Backlog · SM", "ready": "Prêt · Dev", "in_progress": "En cours · Dev",
               "review": "Revue · QA", "done": "Livré", "blocked": "Bloqué"}
STAGE_TEAM = {"todo": "SM", "ready": "Dev", "in_progress": "Dev", "review": "QA",
              "done": "—", "blocked": "PO"}
SOURCE_RANK = {"bmad": 0, "plan": 1, "generic": 2, "manual": 3, "auto": 4}
SOURCE_LABEL = {"bmad": "BMAD", "plan": "Plan", "generic": "Roadmap", "manual": "Manuel", "auto": ""}

STATUS_PATTERNS = [
    ("done", r"done|complete|completed|termin|fini|closed|clos(?:e|es)?|tenue?s?|merged|livr|shipped|✅|✔"),
    ("blocked", r"block|bloqu|on hold|en attente|waiting|stuck|⛔|🚫"),
    ("review", r"review|revue|relecture|qa|testing|recette|validation|en test"),
    ("in_progress", r"in.?progress|in.?dev|wip|en cours|d[ée]marr|started|doing|ongoing"),
    ("ready", r"approved|approuv|ready|pr[êe]t|validated|to.?do next|planned|planifi"),
    ("todo", r"draft|brouillon|backlog|todo|to.?do|[àa] faire|new|proposed|nouveau|pending"),
]


def norm_status(raw, default="todo"):
    if not raw:
        return default
    s = str(raw).strip().lower()
    for key, pat in STATUS_PATTERNS:
        if re.search(pat, s):
            return key
    return default


def now_str():
    return datetime.datetime.now().strftime("%d/%m/%Y %H:%M")


def today():
    return datetime.date.today().isoformat()


# ---------------------------------------------------------------- file helpers
def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""


def rel(root, path):
    try:
        return os.path.relpath(path, root).replace(os.sep, "/")
    except Exception:
        return path


def first_heading(text, level=1):
    m = re.search(r"^#{%d}\s+(.+)$" % level, text, re.M)
    return m.group(1).strip() if m else ""


def count_checks(text):
    done = len(re.findall(r"^\s*[-*]\s*\[[xX]\]", text, re.M))
    todo = len(re.findall(r"^\s*[-*]\s*\[\s\]", text, re.M))
    return {"done": done, "total": done + todo}


def find_files(root, patterns, max_depth=4):
    """patterns: list of glob-ish relative dirs/files."""
    out = []
    for p in patterns:
        full = os.path.join(root, p)
        if os.path.isfile(full):
            out.append(full)
    return out


def list_md(directory, recursive=True):
    res = []
    if not os.path.isdir(directory):
        return res
    for dirpath, dirnames, filenames in os.walk(directory):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for fn in sorted(filenames):
            if fn.lower().endswith(".md"):
                res.append(os.path.join(dirpath, fn))
        if not recursive:
            break
    return sorted(res)


# ------------------------------------------------------------------ mini yaml
def mini_yaml(text):
    """Very small `key: value` extractor (flat, ignores nesting depth)."""
    cfg = {}
    for m in re.finditer(r"^\s*([A-Za-z_][\w\-]*)\s*:\s*(.*)$", text, re.M):
        k, v = m.group(1), m.group(2).strip().strip('"').strip("'")
        if v and v not in ("|", ">", "") and k not in cfg:
            cfg[k] = v
    return cfg


# -------------------------------------------------------------------- sources
def detect_bmad(root):
    """Return (items, sources, notes) for a BMAD project, or ([], [], [])."""
    cfg_paths = [".bmad-core/core-config.yaml", "bmad-core/core-config.yaml",
                 ".bmad/core-config.yaml", "bmad/bmm/config.yaml", "bmad/core/config.yaml",
                 "bmad/_cfg/config.yaml"]
    cfg, cfg_path = {}, None
    for p in cfg_paths:
        full = os.path.join(root, p)
        if os.path.isfile(full):
            cfg = mini_yaml(read(full))
            cfg_path = p
            break
    marker_dirs = [d for d in (".bmad-core", "bmad-core", "bmad", ".bmad") if os.path.isdir(os.path.join(root, d))]

    story_dirs = []
    for key in ("devStoryLocation", "dev_story_location", "storyLocation", "story_dir"):
        if cfg.get(key):
            story_dirs.append(cfg[key])
    story_dirs += ["docs/stories", "docs/story", "stories", "docs/sm/stories"]
    stories = []
    seen_dirs = set()
    for d in story_dirs:
        full = os.path.join(root, d)
        if full in seen_dirs or not os.path.isdir(full):
            continue
        seen_dirs.add(full)
        stories += list_md(full)

    epic_files = []
    for d in ("docs/prd", "docs/epics", "docs/prd/epics", "docs/bmad/epics"):
        for f in list_md(os.path.join(root, d), recursive=False):
            if re.search(r"epic", os.path.basename(f), re.I):
                epic_files.append(f)

    if not stories and not epic_files and not marker_dirs:
        return [], [], []

    items, epics = [], {}

    def ensure_epic(eid, title=None, path=None, status=None):
        e = epics.get(eid)
        if not e:
            e = {"id": str(eid), "type": "epic", "parent": None,
                 "title": title or ("Epic %s" % eid), "status": status,
                 "status_raw": None, "team": None, "path": path,
                 "checks": {"done": 0, "total": 0}, "source": "bmad",
                 "order": len(epics)}
            epics[eid] = e
        else:
            if title and e["title"].startswith("Epic "):
                e["title"] = title
            if path and not e["path"]:
                e["path"] = path
            if status and not e["status"]:
                e["status"] = status
        return e

    # epics from sharded files
    for f in sorted(epic_files):
        txt = read(f)
        base = os.path.basename(f)
        m = re.search(r"(\d+)", base)
        eid = m.group(1) if m else base.replace(".md", "")
        title = first_heading(txt) or base
        title = re.sub(r"^Epic\s*\d+\s*[:\-–—]\s*", "", title, flags=re.I).strip()
        st = extract_status(txt)
        ensure_epic(eid, title, rel(root, f), norm_status(st, None) if st else None)

    # epics from a monolithic prd
    for prd_name in ("docs/prd.md", "docs/PRD.md", "prd.md", "PRD.md"):
        prd = os.path.join(root, prd_name)
        if os.path.isfile(prd):
            for m in re.finditer(r"^#{1,3}\s*(?:Epic|Épic\w*)\s*(\d+)\s*[:\-–—]?\s*(.*)$",
                                 read(prd), re.M | re.I):
                ensure_epic(m.group(1), (m.group(2) or "").strip() or None, prd_name)
            break

    # stories
    for f in sorted(stories):
        txt = read(f)
        base = os.path.basename(f)
        m = re.search(r"(\d+)[.\-_](\d+)", base) or re.search(
            r"^#\s*Story\s*(\d+)[.\-](\d+)", txt, re.M | re.I)
        if m:
            eid, sid = m.group(1), "%s.%s" % (m.group(1), m.group(2))
        else:
            eid, sid = "0", base.replace(".md", "")
        title = first_heading(txt) or base
        title = re.sub(r"^Story\s*[\d.]+\s*[:\-–—]\s*", "", title, flags=re.I).strip()
        raw = extract_status(txt)
        items.append({"id": sid, "type": "story", "parent": str(eid), "title": title,
                      "status": norm_status(raw), "status_raw": raw, "team": None,
                      "path": rel(root, f), "checks": count_checks(txt),
                      "source": "bmad", "order": len(items)})
        ensure_epic(eid)

    src = "BMAD"
    if cfg_path:
        src += " (%s)" % cfg_path.split("/")[0].lstrip(".")
    all_items = sorted(epics.values(), key=lambda e: nat_key(e["id"])) + items
    return all_items, [src], []


def detect_bmad6(root):
    """BMAD v6: sprint-status.yaml (development_status) + epics.md for titles."""
    sprint = None
    for cand in ("_bmad-output/implementation-artifacts/sprint-status.yaml",
                 "_bmad-output/sprint-status.yaml",
                 "bmad-output/implementation-artifacts/sprint-status.yaml",
                 "docs/implementation-artifacts/sprint-status.yaml",
                 "sprint-status.yaml"):
        full = os.path.join(root, cand)
        if os.path.isfile(full):
            sprint = full
            break
    if not sprint:
        for dirpath, dirnames, filenames in os.walk(root):
            if dirpath[len(root):].count(os.sep) >= 3:
                dirnames[:] = []
                continue
            dirnames[:] = [d for d in dirnames if not d.startswith(".")
                           and d not in ("node_modules", "__pycache__", "venv", ".venv", "dist", "build")]
            if "sprint-status.yaml" in filenames:
                sprint = os.path.join(dirpath, "sprint-status.yaml")
                break
    if not sprint:
        return [], [], []

    txt = read(sprint)
    m = re.search(r"^development_status:[ \t]*$\n(.*?)(?=^\S|\Z)", txt, re.M | re.S)
    if not m:
        return [], [], []
    block = m.group(1)

    # titles from the epics/stories breakdown, when present
    titles_e, titles_s, epics_doc = {}, {}, None
    for cand in ("_bmad-output/planning-artifacts/epics.md", "_bmad-output/planning-artifacts/epics-and-stories.md",
                 "bmad-output/planning-artifacts/epics.md", "docs/epics.md", "docs/prd/epics.md"):
        full = os.path.join(root, cand)
        if os.path.isfile(full):
            epics_doc = full
            break
    if epics_doc:
        etxt = read(epics_doc)
        for mm in re.finditer(r"^#{2,4}[ \t]*[EÉ]pics?[ \t]*(\d+)[ \t]*[:\-\u2013\u2014][ \t]*(.+?)[ \t]*$",
                              etxt, re.M | re.I):
            titles_e.setdefault(mm.group(1), mm.group(2).strip())
        for mm in re.finditer(r"^#{2,4}[ \t]*Story[ \t]*(\d+)\.(\d+)[ \t]*[:\-\u2013\u2014][ \t]*(.+?)[ \t]*$",
                              etxt, re.M | re.I):
            titles_s.setdefault("%s.%s" % (mm.group(1), mm.group(2)), mm.group(3).strip())

    # story files (spec-1-3-*.md) for clickable paths
    cfg = mini_yaml(txt)
    spec_paths = {}
    story_dir = cfg.get("story_location") or cfg.get("storyLocation") or os.path.dirname(rel(root, sprint))
    for f in list_md(os.path.join(root, story_dir), recursive=False):
        mm = re.match(r"(?:spec|story)-(\d+)-(\d+)-", os.path.basename(f), re.I)
        if mm:
            spec_paths.setdefault("%s.%s" % (mm.group(1), mm.group(2)), rel(root, f))

    epics, items = {}, []
    for line in block.splitlines():
        mm = re.match(r"^\s+([A-Za-z0-9][\w\-\u00c0-\u024f]*)\s*:\s*([\w\-]+)\s*$", line)
        if not mm:
            continue
        key, raw = mm.group(1), mm.group(2).strip()
        me = re.match(r"^epic-(\d+)$", key, re.I)
        if me:
            eid = me.group(1)
            epics.setdefault(eid, {
                "id": eid, "type": "epic", "parent": None,
                "title": titles_e.get(eid) or ("Epic %s" % eid), "status": None,
                "status_raw": raw, "team": None,
                "path": rel(root, epics_doc) if epics_doc else None,
                "checks": {"done": 0, "total": 0}, "source": "bmad", "order": len(epics)})
            continue
        if re.match(r"^epic-\d+-retro", key, re.I):
            continue
        ms = re.match(r"^(\d+)-(\d+)-(.*)$", key)
        if not ms:
            continue
        eid, sid = ms.group(1), "%s.%s" % (ms.group(1), ms.group(2))
        title = titles_s.get(sid) or ms.group(3).replace("-", " ").strip().capitalize()
        items.append({"id": sid, "type": "story", "parent": eid, "title": title,
                      "status": norm_status(raw), "status_raw": raw, "team": None,
                      "path": spec_paths.get(sid), "checks": {"done": 0, "total": 0},
                      "source": "bmad", "order": len(items)})
        epics.setdefault(eid, {
            "id": eid, "type": "epic", "parent": None,
            "title": titles_e.get(eid) or ("Epic %s" % eid), "status": None,
            "status_raw": None, "team": None,
            "path": rel(root, epics_doc) if epics_doc else None,
            "checks": {"done": 0, "total": 0}, "source": "bmad", "order": len(epics)})

    if not items and not epics:
        return [], [], []
    all_items = sorted(epics.values(), key=lambda e: nat_key(e["id"])) + items
    return all_items, ["BMAD v6 (%s)" % rel(root, sprint)], []


def extract_status(txt):
    """Find a status value in a markdown doc (frontmatter, `## Status`, `Status:`)."""
    fm = re.match(r"^---\n(.*?)\n---", txt, re.S)
    if fm:
        m = re.search(r"^\s*(?:status|statut|état|etat)\s*:\s*(.+)$", fm.group(1), re.M | re.I)
        if m:
            return m.group(1).strip()
    m = re.search(r"^#{1,4}\s*(?:status|statut|état|etat)\s*$\n+([^\n#]+)", txt, re.M | re.I)
    if m:
        return m.group(1).strip(" *_`")
    m = re.search(r"^\s*\**\s*(?:status|statut|état|etat)\s*\**\s*[:：]\s*(.+)$", txt, re.M | re.I)
    if m:
        return m.group(1).strip(" *_`")
    return None


def nat_key(s):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", str(s))]


PLAN_HEADING_DEFAULT = r"^#{2,3}\s*(?:Phase|Étape|Etape|Lot)\s*([A-Za-z]{0,2}\d+)\s*[:\-–—]?\s*(.*)$"
# Fallback when a project's plan headings carry a bare code instead of a
# "Phase/Étape/Lot" keyword, e.g. "## B1 · Le miroir" or "### P1 · Titre".
PLAN_HEADING_CODE = r"^#{2,3}\s*([A-Za-z]{1,3}\d+(?:\.\d+)?)\s*[·:\-–—]\s+(\S.*)$"
ARCHIVE_DIR_RE = re.compile(r"(^|/)(archive|archives)(/|$)", re.I)


def strip_code_fences(text):
    """Blank fenced code blocks so ASCII-art or code comments inside them
    never get mistaken for phase headings."""
    return re.sub(r"^```.*?^```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.M | re.S)


def find_plan_files(root, max_files=12):
    """A plan often outgrows one file: a satellite carries the slice being
    built right now (`docs/PLAN-carnet.md`), an archive carries what's closed.
    Discover the canonical entry point, sibling `PLAN-*.md` satellites, and
    any plan file referenced by path from what's already found — skipping
    archive paths, since their content is normally already summarized
    upstream and would otherwise be double-counted."""
    found = []
    seen = set()

    def consider(relpath):
        if len(found) >= max_files:
            return False
        relpath = relpath.strip().replace("\\", "/")
        if relpath.startswith("./"):
            relpath = relpath[2:]
        if not relpath.lower().endswith(".md") or ARCHIVE_DIR_RE.search(relpath):
            return False
        full = os.path.join(root, relpath)
        key = os.path.normcase(os.path.normpath(os.path.abspath(full)))
        if key in seen or not os.path.isfile(full):
            return False
        seen.add(key)
        found.append(relpath)
        return True

    for cand in ("docs/PLAN.md", "docs/plan.md", "PLAN.md", "docs/PLAN.MD"):
        consider(cand)

    for d in ("docs", "."):
        dfull = os.path.join(root, d)
        if os.path.isdir(dfull):
            for fn in sorted(os.listdir(dfull)):
                if re.match(r"plan[-_].+\.md$", fn, re.I):
                    consider(fn if d == "." else "%s/%s" % (d, fn))

    # follow explicit references to other plan docs, e.g. "dans `docs/PLAN-carnet.md`"
    frontier = list(found)
    depth = 0
    while frontier and depth < 2 and len(found) < max_files:
        depth += 1
        nxt = []
        for relp in frontier:
            txt = read(os.path.join(root, relp))
            refs = re.findall(r"`([^`\n]+?\.md)`", txt) + re.findall(r"\]\(([^)\n]+?\.md)\)", txt)
            for ref in refs:
                if not re.search(r"plan", ref, re.I):
                    continue
                before = len(found)
                if consider(ref):
                    nxt.append(found[-1])
                if len(found) >= max_files:
                    break
        frontier = nxt
    return found


def split_inline_status(title):
    """A heading sometimes carries its own status inline, e.g.
    'Le miroir — **tenue le 6 septembre 2026**'. Pull it out if present."""
    m = re.match(r"^(.*?)\s*[—\-]\s*\*\*(.+?)\*\*\s*$", title)
    if m and m.group(1).strip():
        return m.group(1).strip(), m.group(2).strip()
    return title.strip(), None


def parse_plan_phases(txt, plan_path, heading_re):
    """Split one plan file into phases on `Phase/Étape/Lot N` headings, or —
    if none match — on a bare code heading like `## B1 · Titre`."""
    txt = strip_code_fences(txt)
    matches = list(re.finditer(heading_re or PLAN_HEADING_DEFAULT, txt, re.M | re.I))
    if not matches:
        matches = list(re.finditer(PLAN_HEADING_CODE, txt, re.M))
    items = []
    for i, m in enumerate(matches):
        num, raw_title = m.group(1), (m.group(2) or "").strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(txt)
        body = txt[start:end]
        title, inline_status = split_inline_status(raw_title)
        eid = num if num[:1].isalpha() else "P%s" % num
        checks = count_checks(body)
        raw = inline_status or extract_status(body)
        if raw:
            st = norm_status(raw)
        elif checks["total"] and checks["done"] == checks["total"]:
            st = "done"
        elif checks["done"]:
            st = "in_progress"
        else:
            st = "todo"
        blocked_by = None
        mb = re.search(r"^#{2,4}\s*Bloqu[ée]e?\s+par\s*$\n+([^\n#]+)", body, re.M | re.I)
        if not mb:
            # some plans state it inline instead of as its own heading:
            # "**Bloquée par** — `P1`."
            mb = re.search(r"\*\*Bloqu[ée]e?\s+par\*\*\s*[—:\-]\s*([^\n]+)", body, re.I)
        if mb:
            blocked_by = re.sub(r"^[-*]\s*", "", mb.group(1).strip()).replace("`", "").strip(" *_")
            if re.search(r"aucune|none|rien", blocked_by, re.I):
                blocked_by = None
        items.append({"id": eid, "type": "epic", "parent": None,
                      "title": title or ("Phase %s" % num), "status": st, "status_raw": raw,
                      "team": None, "path": plan_path, "checks": checks, "source": "plan",
                      "order": len(items), "blocked_by": blocked_by})
        n = 0
        for cm in re.finditer(r"^\s*[-*]\s*\[([ xX])\]\s*(.+)$", body, re.M):
            n += 1
            items.append({"id": "%s.%d" % (eid, n), "type": "check", "parent": eid,
                          "title": cm.group(2).strip(), "status": "done" if cm.group(1).lower() == "x" else "todo",
                          "status_raw": None, "team": None, "path": plan_path,
                          "checks": {"done": 0, "total": 0}, "source": "plan",
                          "order": len(items)})
    return items


def detect_plan(root, heading_re=None):
    """claude-mastery: phases + acceptance criteria, across every plan file
    found (see find_plan_files) — not just a single docs/PLAN.md."""
    plan_files = find_plan_files(root)
    if not plan_files:
        return [], [], []
    items, seen_epics = [], set()
    for plan_path in plan_files:
        txt = read(os.path.join(root, plan_path))
        for it in parse_plan_phases(txt, plan_path, heading_re):
            if it["type"] == "epic":
                if it["id"] in seen_epics:
                    continue
                seen_epics.add(it["id"])
            it["order"] = len(items)
            items.append(it)
    if not items:
        return [], [], []
    return items, ["claude-mastery (%s)" % ", ".join(plan_files)], []


def detect_generic(root):
    """Fallback: TODO.md / ROADMAP.md with `## Section` + checkboxes."""
    for cand in ("TODO.md", "ROADMAP.md", "docs/TODO.md", "docs/ROADMAP.md", "docs/roadmap.md"):
        path = os.path.join(root, cand)
        if not os.path.isfile(path):
            continue
        txt = read(path)
        parts = re.split(r"^#{2,3}\s+(.+)$", txt, flags=re.M)
        if len(parts) < 3:
            continue
        items = []
        n_epic = 0
        for i in range(1, len(parts) - 1, 2):
            title, body = parts[i].strip(), parts[i + 1]
            checks = count_checks(body)
            if not checks["total"]:
                continue
            n_epic += 1
            eid = "G%d" % n_epic
            st = "done" if checks["done"] == checks["total"] else ("in_progress" if checks["done"] else "todo")
            items.append({"id": eid, "type": "epic", "parent": None, "title": title,
                          "status": st, "status_raw": None, "team": None, "path": cand,
                          "checks": checks, "source": "generic", "order": len(items)})
            n = 0
            for m in re.finditer(r"^\s*[-*]\s*\[([ xX])\]\s*(.+)$", body, re.M):
                n += 1
                items.append({"id": "%s.%d" % (eid, n), "type": "check", "parent": eid,
                              "title": m.group(2).strip(),
                              "status": "done" if m.group(1).lower() == "x" else "todo",
                              "status_raw": None, "team": None, "path": cand,
                              "checks": {"done": 0, "total": 0}, "source": "generic",
                              "order": len(items)})
        if items:
            return items, ["markdown (%s)" % cand], []
    return [], [], []


def detect_artifacts(root):
    out = []

    def add(label, path, detail=""):
        full = os.path.join(root, path)
        present = os.path.exists(full)
        if present and os.path.isdir(full):
            n = len(list_md(full))
            detail = detail or ("%d fichier%s" % (n, "s" if n > 1 else ""))
        out.append({"label": label, "path": path, "present": present, "detail": detail})

    for label, cands in [
        ("Brief / PRD", ["docs/PRD.md", "docs/prd.md", "docs/brief.md"]),
        ("Plan de phases", ["docs/PLAN.md", "docs/plan.md"]),
        ("Design system", ["docs/DESIGN.md", "docs/design.md"]),
        ("Architecture", ["docs/architecture.md", "docs/architecture", "docs/ARCHITECTURE.md"]),
        ("PRD shardé", ["docs/prd", "docs/epics"]),
        ("Stories", ["docs/stories", "stories"]),
        ("Portes QA", ["docs/qa/gates", "docs/qa"]),
        ("Config BMAD", [".bmad-core/core-config.yaml", "bmad/bmm/config.yaml", "bmad"]),
    ]:
        chosen = None
        for c in cands:
            if os.path.exists(os.path.join(root, c)):
                chosen = c
                break
        add(label, chosen or cands[0])
    return out


def git_activity(root, limit=12, days=21):
    try:
        out = subprocess.run(
            ["git", "-C", root, "log", "--since=%d.days" % days,
             "--pretty=%h%x1f%ad%x1f%s", "--date=short", "-n", str(limit)],
            capture_output=True, text=True, timeout=8)
        if out.returncode != 0:
            return []
        res = []
        for line in out.stdout.strip().splitlines():
            p = line.split("\x1f")
            if len(p) == 3:
                res.append({"hash": p[0], "date": p[1], "text": p[2]})
        return res
    except Exception:
        return []


def project_name(root):
    for cand, lvl in (("docs/PRD.md", 1), ("docs/prd.md", 1), ("README.md", 1)):
        p = os.path.join(root, cand)
        if os.path.isfile(p):
            h = first_heading(read(p))
            if h:
                return re.sub(r"^(PRD|Brief)\s*[:\-–—]\s*", "", h, flags=re.I).strip()
    return os.path.basename(os.path.abspath(root)) or "Projet"


# ---------------------------------------------------------------------- state
def state_path(root, out):
    return os.path.join(root, out, "state.json")


def load_state(root, out):
    p = state_path(root, out)
    if os.path.isfile(p):
        try:
            return json.loads(read(p))
        except Exception:
            print("! state.json illisible, réinitialisation", file=sys.stderr)
    return {"schema": SCHEMA, "project": {"name": project_name(root), "item_word": "éléments"},
            "config": {"out_dir": out},
            "detected": {"items": [], "sources": [], "artifacts": [], "scanned_at": None},
            "manual": {"items": []}, "overrides": {}, "notes": [], "milestones": [],
            "activity": []}


def save_state(root, out, st):
    d = os.path.join(root, out)
    os.makedirs(d, exist_ok=True)
    with open(state_path(root, out), "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=2)


# ----------------------------------------------------------------- assembling
def merged_items(st):
    items = list(st["detected"]["items"]) + list(st["manual"]["items"])
    ov = st.get("overrides", {})
    out = []
    for it in items:
        it = dict(it)
        o = ov.get(it["id"])
        if o:
            for k, v in o.items():
                if v is not None:
                    it[k] = v
            it["overridden"] = True
        out.append(it)
    return out


def build_view(st):
    items = merged_items(st)
    by_id = {i["id"]: i for i in items}
    epics = [i for i in items if i.get("type") == "epic"]
    leaves = [i for i in items if i.get("type") != "epic"]

    # attach children
    kids = {}
    for l in leaves:
        kids.setdefault(l.get("parent") or "0", []).append(l)
    orphans = [l for l in leaves if (l.get("parent") or "0") not in by_id]
    if orphans:
        eid = orphans[0].get("parent") or "0"
        if eid not in by_id:
            e = {"id": eid, "type": "epic", "parent": None, "title": "Hors epic",
                 "status": None, "team": None, "path": None,
                 "checks": {"done": 0, "total": 0}, "source": "auto", "order": 999}
            epics.append(e)
            by_id[eid] = e

    def item_progress(i):
        if i.get("progress") is not None:
            try:
                return float(i["progress"])
            except Exception:
                pass
        c = i.get("checks") or {}
        if i.get("status") == "done":
            return 1.0
        if c.get("total"):
            base = c["done"] / float(c["total"])
            return max(base, WEIGHT.get(i.get("status", "todo"), 0))
        return WEIGHT.get(i.get("status", "todo"), 0)

    def erank(x):
        return (SOURCE_RANK.get(x.get("source"), 5), x.get("order", 0), nat_key(x["id"]))

    epic_views = []
    for e in sorted(epics, key=erank):
        ch = sorted(kids.get(e["id"], []), key=lambda x: (x.get("order", 0), nat_key(x["id"])))
        if ch:
            prog = sum(item_progress(c) for c in ch) / float(len(ch))
            if e.get("overridden") and e.get("status"):
                status = e["status"]
            elif all(c["status"] == "done" for c in ch):
                status = "done"
            elif any(c["status"] == "blocked" for c in ch):
                status = "blocked"
            elif any(c["status"] in ("in_progress", "review", "ready") for c in ch) or prog > 0:
                status = "in_progress"
            else:
                status = e.get("status") or "todo"
        else:
            status = e.get("status") or "todo"
            prog = item_progress(e)
        if e.get("progress") is not None:
            try:
                prog = float(e["progress"])
            except Exception:
                pass
        if status == "done":
            prog = 1.0
        epic_views.append({
            "id": e["id"] if not str(e["id"]).startswith(("P", "G")) else e["id"],
            "title": e["title"], "status": status, "progress": round(prog, 4),
            "team": e.get("team"), "path": e.get("path"), "blocked_by": e.get("blocked_by"),
            "group": SOURCE_LABEL.get(e.get("source"), ""),
            "child_word": ("critères" if ch and ch[0].get("type") == "check" else "stories"),
            "children": [{"id": c["id"], "title": c["title"], "status": c["status"],
                          "team": c.get("team"),
                          "checks": c.get("checks") or {}, "path": c.get("path")} for c in ch],
            "notes": [n for n in st.get("notes", [])
                      if n.get("scope") in ([e["id"]] + [c["id"] for c in ch])],
        })

    # counters over the primary source only, so two roadmaps never double-count
    present = [s for s in ("bmad", "plan", "generic") if any(i.get("source") == s for i in items)]
    primary = st.get("config", {}).get("primary_source") or (present[0] if present else None)
    keep = (primary, "manual")
    epic_src = {e["id"]: e.get("source") for e in epics}
    pool = [l for l in leaves if l.get("source") in keep]
    # un epic sans enfant compte comme une unité à lui seul
    pool += [{"id": ev["id"], "title": ev["title"], "status": ev["status"], "type": "epic",
              "progress": ev["progress"]}
             for ev in epic_views
             if not ev["children"] and epic_src.get(ev["id"]) in keep]
    if not pool:
        pool = leaves or [{"id": ev["id"], "title": ev["title"], "status": ev["status"],
                           "type": "epic", "progress": ev["progress"]} for ev in epic_views]
    counts = {s: 0 for s in STATUS_ORDER}
    for i in pool:
        counts[i.get("status", "todo")] = counts.get(i.get("status", "todo"), 0) + 1
    total = len(pool) or 1
    gp = sum(item_progress(i) for i in pool) / float(total)

    pipeline = []
    order = ["blocked", "todo", "ready", "in_progress", "review", "done"]
    for s in order:
        if s == "blocked" and not counts.get("blocked"):
            continue
        sel = [i for i in pool if i.get("status") == s]
        pipeline.append({"key": s, "label": STAGE_LABEL[s], "count": len(sel),
                         "items": [{"id": i["id"], "title": i["title"]} for i in sel]})

    types = set(i.get("type") for i in pool)
    word = "stories" if "story" in types else ("critères" if "check" in types else "epics")

    return {
        "project": {"name": st["project"].get("name") or "Projet",
                    "generated_at": now_str(),
                    "sources": st["detected"].get("sources", []) or ["saisie manuelle"]},
        "labels": LABELS,
        "primary": SOURCE_LABEL.get(primary, ""),
        "multi_group": len({e.get("group") for e in epic_views if e.get("group")}) > 1,
        "summary": {"progress": round(gp, 4), "item_word": word,
                    "epics": {"total": len(epic_views),
                              "done": len([e for e in epic_views if e["status"] == "done"])},
                    "items": dict(counts, total=len(pool))},
        "pipeline": pipeline,
        "epics": epic_views,
        "notes": sorted(st.get("notes", []),
                        key=lambda n: (["blocker", "risk", "decision", "win", "info"].index(n.get("level", "info"))
                                       if n.get("level") in ("blocker", "risk", "decision", "win", "info") else 9,
                                       n.get("date", ""))),
        "milestones": st.get("milestones", []),
        "artifacts": st["detected"].get("artifacts", []),
        "activity": st.get("activity", []),
        "footer": [
            "Généré par le skill <b>/avancement</b> — état dans <code>%s/state.json</code>." % st["config"].get("out_dir", DEFAULT_OUT),
            "Mise à jour : <code>/avancement</code> (re-scan) · <code>/avancement note \"…\"</code> · <code>/avancement 1.2 done</code>",
        ],
    }


def render(root, out, st):
    view = build_view(st)
    tpl = read(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "template.html"))
    if not tpl:
        print("! template.html introuvable", file=sys.stderr)
        return None
    data = json.dumps(view, ensure_ascii=False).replace("</", "<\\/")
    page = tpl.replace("__STATUS_DATA__", data).replace(
        "__TITLE__", html.escape(view["project"]["name"] + " — avancement"))
    d = os.path.join(root, out)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "index.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    return path, view


# -------------------------------------------------------------------- actions
def cmd_scan(args, st):
    root = args.root
    items, sources, _ = detect_bmad6(root)
    if not items:
        items, sources, _ = detect_bmad(root)
    p_items, p_sources, _ = detect_plan(root, st.get("config", {}).get("plan_heading"))
    items += p_items
    sources += p_sources
    if not items:
        items, sources, _ = detect_generic(root)
    st.setdefault("config", {})
    st["detected"] = {"items": items, "sources": sources,
                      "artifacts": detect_artifacts(root), "scanned_at": today()}
    if not st["project"].get("name") or st["project"].get("name") in ("Projet", ""):
        st["project"]["name"] = project_name(root)
    if not args.no_git:
        st["activity"] = git_activity(root)
    return st


def cmd_set(args, st):
    ov = st.setdefault("overrides", {})
    ids = args.ids
    known = {i["id"] for i in merged_items(st)}
    for iid in ids:
        matches = [k for k in known if k.lower() == iid.lower()] or \
                  [k for k in known if k.lower().startswith(iid.lower())]
        target = matches[0] if len(matches) == 1 else iid
        if args.clear:
            ov.pop(target, None)
            print("override supprimé : %s" % target)
            continue
        entry = ov.setdefault(target, {})
        if args.status:
            entry["status"] = norm_status(args.status)
        if args.team:
            entry["team"] = args.team
        if args.title:
            entry["title"] = args.title
        if args.progress is not None:
            entry["progress"] = args.progress
        if args.blocked_by:
            entry["blocked_by"] = args.blocked_by
        print("%s → %s" % (target, json.dumps(entry, ensure_ascii=False)))
        if target not in known:
            print("  (id inconnu du scan : override conservé, il s'appliquera dès qu'il apparaîtra)")
    return st


def cmd_note(args, st):
    notes = st.setdefault("notes", [])
    if args.list:
        for n in notes:
            print("%s [%s] %s%s" % (n["id"], n["level"], n["text"],
                                    " (%s)" % n["scope"] if n.get("scope") and n["scope"] != "global" else ""))
        return st
    if args.remove:
        st["notes"] = [n for n in notes if n["id"] != args.remove]
        print("note %s supprimée" % args.remove)
        return st
    nid = "n%d" % (max([int(re.sub(r"\D", "", n["id"]) or 0) for n in notes] or [0]) + 1)
    scope = args.scope or "global"
    label = None
    if scope != "global":
        for i in merged_items(st):
            if i["id"].lower() == scope.lower():
                label = i["title"]
                scope = i["id"]
                break
    notes.append({"id": nid, "level": args.level, "text": args.text, "date": today(),
                  "scope": scope, "scope_label": label})
    print("note %s ajoutée" % nid)
    return st


def cmd_add(args, st):
    manual = st["manual"].setdefault("items", [])
    iid = args.id
    if not iid:
        if args.type == "epic":
            n = len([i for i in merged_items(st) if i.get("type") == "epic"]) + 1
            iid = "M%d" % n
        else:
            sib = [i for i in merged_items(st) if i.get("parent") == args.parent]
            iid = "%s.%d" % (args.parent, len(sib) + 1)
    manual.append({"id": iid, "type": args.type, "parent": args.parent if args.type != "epic" else None,
                   "title": args.title, "status": norm_status(args.status),
                   "status_raw": args.status, "team": args.team, "path": None,
                   "checks": {"done": 0, "total": 0}, "source": "manual", "order": 500 + len(manual)})
    print("ajouté : %s — %s" % (iid, args.title))
    return st


def cmd_milestone(args, st):
    ms = st.setdefault("milestones", [])
    if args.remove:
        st["milestones"] = [m for m in ms if m.get("id") != args.remove]
        print("jalon %s supprimé" % args.remove)
        return st
    mid = "m%d" % (len(ms) + 1)
    ms.append({"id": mid, "title": args.title, "date": args.date or "",
               "status": norm_status(args.status)})
    ms.sort(key=lambda m: m.get("date") or "9999")
    print("jalon %s ajouté" % mid)
    return st


def cmd_info(args, st):
    v = build_view(st)
    if args.json:
        print(json.dumps({"project": v["project"], "summary": v["summary"],
                          "epics": [{k: e[k] for k in ("id", "title", "status", "progress")}
                                    for e in v["epics"]],
                          "notes": v["notes"]}, ensure_ascii=False, indent=2))
        return st
    s = v["summary"]
    print("%s — %d%% global" % (v["project"]["name"], round(s["progress"] * 100)))
    print("sources : %s" % ", ".join(v["project"]["sources"]))
    print("epics %d/%d terminés · %s : %s" % (
        s["epics"]["done"], s["epics"]["total"], s["item_word"],
        " ".join("%s=%d" % (LABELS[k], s["items"][k]) for k in STATUS_ORDER if s["items"].get(k))))
    for e in v["epics"]:
        print("  %-6s %-46s %3d%%  %s%s" % (e["id"], e["title"][:46], round(e["progress"] * 100),
                                            LABELS.get(e["status"], e["status"]),
                                            "  [%d items]" % len(e["children"]) if e["children"] else ""))
    for n in v["notes"]:
        print("  ! %s [%s] %s" % (n["id"], n["level"], n["text"]))
    return st


# ------------------------------------------------------------------------ CLI
def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--root", default=".")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--no-git", action="store_true")
    sub = ap.add_subparsers(dest="cmd")

    sub.add_parser("scan")
    sub.add_parser("render")
    p = sub.add_parser("info"); p.add_argument("--json", action="store_true")

    p = sub.add_parser("set")
    p.add_argument("ids", nargs="+")
    p.add_argument("--status"); p.add_argument("--team"); p.add_argument("--title")
    p.add_argument("--progress", type=float); p.add_argument("--blocked-by", dest="blocked_by")
    p.add_argument("--clear", action="store_true")

    p = sub.add_parser("note")
    p.add_argument("text", nargs="?", default="")
    p.add_argument("--level", default="info",
                   choices=["info", "risk", "blocker", "win", "decision"])
    p.add_argument("--scope"); p.add_argument("--list", action="store_true")
    p.add_argument("--remove")

    p = sub.add_parser("add")
    p.add_argument("--type", default="story", choices=["epic", "story", "check"])
    p.add_argument("--title", required=True); p.add_argument("--parent")
    p.add_argument("--id"); p.add_argument("--status", default="todo"); p.add_argument("--team")

    p = sub.add_parser("milestone")
    p.add_argument("title", nargs="?", default="")
    p.add_argument("--date"); p.add_argument("--status", default="todo"); p.add_argument("--remove")

    p = sub.add_parser("project"); p.add_argument("--name", required=True)

    args = ap.parse_args()
    cmd = args.cmd or "scan"
    st = load_state(args.root, args.out)
    st["config"]["out_dir"] = args.out

    if cmd == "scan":
        st = cmd_scan(args, st)
    elif cmd == "set":
        st = cmd_set(args, st)
    elif cmd == "note":
        st = cmd_note(args, st)
        if args.list:
            return
    elif cmd == "add":
        st = cmd_add(args, st)
    elif cmd == "milestone":
        st = cmd_milestone(args, st)
    elif cmd == "project":
        st["project"]["name"] = args.name
    elif cmd == "info":
        cmd_info(args, st)
        return

    save_state(args.root, args.out, st)
    res = render(args.root, args.out, st)
    if res:
        path, view = res
        print("→ %s  (%d%% global, %d epics, %d %s)" % (
            rel(args.root, path), round(view["summary"]["progress"] * 100),
            view["summary"]["epics"]["total"], view["summary"]["items"]["total"],
            view["summary"]["item_word"]))


if __name__ == "__main__":
    main()
