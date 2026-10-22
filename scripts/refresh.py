#!/usr/bin/env python3
"""Refresh publications and public repositories for the personal site.

Private repositories are never requested. Curated blurbs in data/curated.json
are the only place private work is described, and that file is edited by hand.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CURATED_PATH = ROOT / "data" / "curated.json"
LIVE_PATH = ROOT / "data" / "live.json"
USER_AGENT = "awwal-site-refresh/1.0 (mailto:awwalola@umich.edu)"


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def fetch(url: str, headers: dict | None = None, timeout: int = 30) -> bytes:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def normalize_title(title: str) -> str:
    text = title.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def titles_match(left: str, right: str) -> bool:
    a = normalize_title(left)
    b = normalize_title(right)
    if not a or not b:
        return False
    if a == b or a.startswith(b) or b.startswith(a):
        return True
    a_tokens = set(a.split())
    b_tokens = set(b.split())
    if not a_tokens or not b_tokens:
        return False
    overlap = len(a_tokens & b_tokens) / min(len(a_tokens), len(b_tokens))
    return overlap >= 0.86


def type_rank(kind: str) -> int:
    order = {"article": 3, "journal-article": 3, "review": 3, "preprint": 2, "posted-content": 2}
    return order.get(kind or "", 1)


def tidy_name(name: str) -> str:
    parts = [part.strip() for part in name.split(",")]
    if len(parts) == 2 and parts[0] and parts[1] and " " not in parts[0]:
        return f"{parts[1]} {parts[0]}"
    return name


def author_line(authorships: list, limit: int = 3) -> str:
    names = []
    for authorship in authorships or []:
        name = tidy_name((authorship.get("author") or {}).get("display_name") or "")
        if name and name not in names:
            names.append(name)
    if not names:
        return ""
    shown = names[:limit]
    extra = len(names) - len(shown)
    if extra > 0:
        return f"{', '.join(shown)}, and {extra} others"
    if len(shown) == 2:
        return f"{shown[0]} and {shown[1]}"
    if len(shown) == 1:
        return shown[0]
    return f"{', '.join(shown[:-1])}, and {shown[-1]}"


def openalex_works(orcid: str) -> list[dict]:
    works = []
    cursor = "*"
    while cursor:
        url = (
            "https://api.openalex.org/works?filter=author.orcid:"
            + orcid
            + "&per-page=100&cursor="
            + urllib.parse.quote(cursor)
            + "&select=display_name,publication_year,type,cited_by_count,doi,"
            + "primary_location,authorships,publication_date"
        )
        payload = json.loads(fetch(url))
        for work in payload.get("results") or []:
            source = ((work.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
            doi = work.get("doi") or ""
            url_out = doi if doi.startswith("http") else (f"https://doi.org/{doi}" if doi else "")
            kind = work.get("type") or "other"
            venue_key = source.lower()
            if "zenodo" in venue_key:
                label = "Deposit"
            elif kind == "article":
                label = "Journal"
            elif kind in {"preprint", "posted-content"}:
                label = "Preprint"
            else:
                label = kind.replace("-", " ").title()
            works.append(
                {
                    "title": work.get("display_name") or "Untitled",
                    "year": work.get("publication_year"),
                    "venue": source,
                    "type": kind,
                    "typeLabel": label,
                    "citedBy": work.get("cited_by_count") or 0,
                    "url": url_out,
                    "authors": author_line(work.get("authorships") or []),
                }
            )
        cursor = (payload.get("meta") or {}).get("next_cursor") or ""
    return works


def dedupe_works(works: list[dict]) -> list[dict]:
    kept: list[dict] = []
    for work in works:
        match = next((item for item in kept if titles_match(item["title"], work["title"])), None)
        if match is None:
            kept.append(work)
            continue
        replace = False
        if type_rank(work.get("type", "")) > type_rank(match.get("type", "")):
            replace = True
        elif type_rank(work.get("type", "")) == type_rank(match.get("type", "")):
            if (work.get("citedBy") or 0) > (match.get("citedBy") or 0):
                replace = True
            elif (work.get("year") or 0) > (match.get("year") or 0) and not match.get("url"):
                replace = True
        if replace:
            if not work.get("url") and match.get("url"):
                work["url"] = match["url"]
            if not work.get("venue") and match.get("venue"):
                work["venue"] = match["venue"]
            if not work.get("authors") and match.get("authors"):
                work["authors"] = match["authors"]
            kept[kept.index(match)] = work
        else:
            if not match.get("url") and work.get("url"):
                match["url"] = work["url"]
            if (work.get("citedBy") or 0) > (match.get("citedBy") or 0) and work.get("type") == match.get("type"):
                match["citedBy"] = work["citedBy"]
    kept.sort(key=lambda item: (item.get("year") or 0, item.get("citedBy") or 0), reverse=True)
    return kept


def fetch_scholar_metrics(profile_url: str) -> dict | None:
    try:
        raw = fetch(
            profile_url,
            headers={
                "Accept": "text/html",
                "User-Agent": "Mozilla/5.0 (compatible; awwal-site-refresh/1.0)",
            },
            timeout=20,
        ).decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"Scholar refresh skipped: {error}", file=sys.stderr)
        return None
    numbers = [int(value) for value in re.findall(r'gsc_rsb_std">(\d+)', raw)]
    # Scholar prints two columns, All and Since 2021, so a full table has six cells.
    if len(numbers) >= 6:
        citations, h_index, i10_index = numbers[0], numbers[2], numbers[4]
    elif len(numbers) >= 3:
        citations, h_index, i10_index = numbers[0], numbers[1], numbers[2]
    else:
        print("Scholar page did not include citation metrics; keeping the saved snapshot.", file=sys.stderr)
        return None
    if h_index > citations or i10_index > citations:
        print("Scholar metrics failed a sanity check; keeping the saved snapshot.", file=sys.stderr)
        return None
    return {
        "citations": citations,
        "hIndex": h_index,
        "i10Index": i10_index,
        "fetchedAt": datetime.now(timezone.utc).date().isoformat(),
    }


GITHUB_LEVEL_COLORS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]

CONTRIB_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        colors
        weeks {
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
    }
  }
}
"""


def github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    if token:
        return token
    try:
        import subprocess

        completed = subprocess.run(
            ["gh", "auth", "token"],
            check=False,
            capture_output=True,
            text=True,
        )
        if completed.returncode == 0:
            return completed.stdout.strip()
    except OSError:
        return ""
    return ""


def post_json(url: str, payload: dict, headers: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request_headers = {"User-Agent": USER_AGENT, "Content-Type": "application/json"}
    request_headers.update(headers)
    request = urllib.request.Request(url, data=body, headers=request_headers, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def calendar_graphql(user: str, token: str) -> dict | None:
    payload = post_json(
        "https://api.github.com/graphql",
        {"query": CONTRIB_QUERY, "variables": {"login": user}},
        {"Authorization": f"Bearer {token}"},
    )
    if payload.get("errors"):
        raise RuntimeError(payload["errors"][0].get("message") or "graphql error")
    calendar = (
        payload.get("data", {})
        .get("user", {})
        .get("contributionsCollection", {})
        .get("contributionCalendar")
    )
    if not calendar:
        return None
    weeks = []
    for week in calendar.get("weeks") or []:
        days = []
        for day in week.get("contributionDays") or []:
            days.append(
                {
                    "date": day.get("date") or "",
                    "count": day.get("contributionCount") or 0,
                    "color": day.get("color") or GITHUB_LEVEL_COLORS[0],
                }
            )
        weeks.append(days)
    if not weeks:
        return None
    return {
        "total": calendar.get("totalContributions") or 0,
        "colors": calendar.get("colors") or GITHUB_LEVEL_COLORS,
        "weeks": weeks,
    }


def calendar_html(user: str) -> dict | None:
    url = f"https://github.com/users/{urllib.parse.quote(user)}/contributions"
    raw = fetch(url, headers={"Accept": "text/html"}).decode("utf-8", "replace")
    days = []
    for attrs in re.findall(r"<(?:rect|td)\b([^>]*)>", raw, flags=re.I):
        date_match = re.search(r'data-date="(\d{4}-\d{2}-\d{2})"', attrs)
        if not date_match:
            continue
        level_match = re.search(r'data-level="(\d+)"', attrs)
        count_match = re.search(r'data-count="(\d+)"', attrs)
        color_match = re.search(r'(?:fill|data-color)="(#[0-9A-Fa-f]{3,8})"', attrs)
        level = int(level_match.group(1)) if level_match else 0
        level = max(0, min(level, len(GITHUB_LEVEL_COLORS) - 1))
        count = int(count_match.group(1)) if count_match else None
        days.append(
            {
                "date": date_match.group(1),
                "count": count,
                "level": level,
                "color": color_match.group(1) if color_match else GITHUB_LEVEL_COLORS[level],
            }
        )
    if not days:
        return None
    if any(day["count"] is None for day in days):
        counts = {}
        for label in re.findall(r'aria-label="([^"]+)"', raw):
            counted = re.search(
                r"(?:No contributions|(\d+) contributions?) on ([A-Z][a-z]+ \d{1,2})(?:st|nd|rd|th)?(?:, (\d{4}))?",
                label,
            )
            if not counted:
                continue
            number = 0 if counted.group(1) is None else int(counted.group(1))
            when = counted.group(2)
            year = counted.group(3)
            counts.setdefault(when, []).append((year, number))
        for day in days:
            if day["count"] is not None:
                continue
            parsed = datetime.strptime(day["date"], "%Y-%m-%d")
            key = parsed.strftime("%B") + " " + str(parsed.day)
            options = counts.get(key) or []
            match = next((item[1] for item in options if item[0] in (None, str(parsed.year))), None)
            day["count"] = day["level"] if match is None else match
    for day in days:
        day.pop("level", None)
        if day["count"] is None:
            day["count"] = 0
    weeks = [days[index : index + 7] for index in range(0, len(days), 7)]
    return {
        "total": sum(day["count"] for day in days),
        "colors": GITHUB_LEVEL_COLORS,
        "weeks": weeks,
    }


def contribution_calendar(user: str) -> dict | None:
    token = github_token()
    if token:
        try:
            calendar = calendar_graphql(user, token)
            if calendar:
                return calendar
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, RuntimeError, KeyError) as error:
            print(f"GraphQL contribution calendar failed: {error}", file=sys.stderr)
    try:
        return calendar_html(user)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        print(f"HTML contribution calendar failed: {error}", file=sys.stderr)
        return None


def public_repos(user: str, hide: set[str], blurbs: dict) -> list[dict]:
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    repos = []
    page = 1
    while page <= 10:
        url = f"https://api.github.com/users/{user}/repos?per_page=100&page={page}&type=owner&sort=updated"
        batch = json.loads(fetch(url, headers=headers))
        if not isinstance(batch, list) or not batch:
            break
        for repo in batch:
            name = repo.get("name") or ""
            if repo.get("private") or repo.get("fork") or name in hide:
                continue
            description = (blurbs.get(name) or repo.get("description") or "").strip()
            homepage = (repo.get("homepage") or "").strip()
            if "github.io" not in homepage:
                homepage = ""
            repos.append(
                {
                    "name": name,
                    "description": description,
                    "language": (repo.get("language") or ""),
                    "url": repo.get("html_url") or "",
                    "stars": repo.get("stargazers_count") or 0,
                    "updated": (repo.get("pushed_at") or repo.get("updated_at") or "")[:10],
                    "homepage": homepage if homepage.startswith("http") else "",
                }
            )
        if len(batch) < 100:
            break
        page += 1
    repos.sort(key=lambda item: (item["stars"], item["updated"]), reverse=True)
    return repos


def main() -> int:
    curated = load_json(CURATED_PATH)
    previous = load_json(LIVE_PATH) if LIVE_PATH.exists() else {}
    scholar = dict(curated.get("scholar") or {})
    refreshed = fetch_scholar_metrics(scholar.get("profile", ""))
    if refreshed:
        scholar.update(refreshed)

    try:
        works = openalex_works(curated["orcid"])
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        print(f"OpenAlex refresh failed: {error}", file=sys.stderr)
        works = previous.get("works") or []
        if not works:
            return 1

    for extra in curated.get("extraWorks") or []:
        kind = extra.get("type") or "article"
        works.append(
            {
                "title": extra["title"],
                "year": extra.get("year"),
                "venue": extra.get("venue") or "",
                "type": kind,
                "typeLabel": "Journal" if kind == "article" else kind.title(),
                "citedBy": extra.get("citedBy") or 0,
                "url": extra.get("url") or "",
                "authors": extra.get("authors") or "",
            }
        )
    works = dedupe_works(works)

    try:
        repos = public_repos(
            curated["githubUser"],
            set(curated.get("hideRepos") or []),
            curated.get("repoBlurbs") or {},
        )
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        print(f"GitHub refresh failed: {error}", file=sys.stderr)
        repos = previous.get("repos") or []
        if not repos:
            return 1

    contributions = contribution_calendar(curated["githubUser"])
    if not contributions:
        print("Contribution calendar refresh failed; keeping the previous calendar.", file=sys.stderr)
        contributions = previous.get("contributions") or {"total": 0, "colors": GITHUB_LEVEL_COLORS, "weeks": []}

    live = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "scholar": {
            "profile": scholar.get("profile"),
            "citations": scholar.get("citations"),
            "hIndex": scholar.get("hIndex"),
            "i10Index": scholar.get("i10Index"),
            "fetchedAt": scholar.get("fetchedAt"),
        },
        "works": works,
        "repos": repos,
        "contributions": contributions,
    }
    unchanged = (
        previous.get("scholar") == live["scholar"]
        and previous.get("works") == live["works"]
        and previous.get("repos") == live["repos"]
        and previous.get("contributions") == live["contributions"]
    )
    if unchanged:
        print(f"Already current: {len(works)} works, {len(repos)} public repositories, {contributions.get('total', 0)} contributions.")
        return 0
    save_json(LIVE_PATH, live)
    print(f"Wrote {len(works)} works, {len(repos)} public repositories, {contributions.get('total', 0)} contributions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
