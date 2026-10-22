# Awwal Oladipupo

Personal site for GitHub Pages: [awwal41.github.io](https://awwal41.github.io/).

The prose in `index.html` is written by hand. That includes private work, which is described only at the level of the contribution and is never linked. The refresh job does not read private repositories.

`scripts/refresh.py` rebuilds `data/live.json` from three public sources:

- OpenAlex, filtered by ORCID `0009-0006-3979-2078`
- The Google Scholar profile, for the citation totals when the page is reachable
- Public, non-fork repositories on GitHub

Two papers that are on Google Scholar and missing from the ORCID feed live in `data/curated.json` under `extraWorks`. Repository blurbs and the hide list live there too.

GitHub Actions runs the script every Monday and whenever the curated data or the script changes, then commits `data/live.json`. A run can also be started by hand from the Actions tab.

To refresh locally:

```bash
python scripts/refresh.py
```
