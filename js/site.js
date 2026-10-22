(function () {
  var themeButton = document.getElementById("theme");

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function syncTheme(theme) {
    var dark = theme === "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (themeButton) {
      themeButton.setAttribute("aria-pressed", dark ? "true" : "false");
      themeButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#161310" : "#efeae2");
    if (typeof renderContributions === "function" && window.__calendar) renderContributions(window.__calendar);
  }

  if (themeButton) {
    syncTheme(currentTheme());
    themeButton.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", next); } catch (error) {}
      syncTheme(next);
    });
  }

  var stats = {
    contrib: document.getElementById("stat-contrib"),
    citations: document.getElementById("stat-citations"),
    h: document.getElementById("stat-h"),
    i10: document.getElementById("stat-i10")
  };

  function text(value) {
    return document.createTextNode(value == null ? "" : String(value));
  }

  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.appendChild(text(content));
    return node;
  }

  function renderWorks(works) {
    var list = document.getElementById("papers");
    if (!list) return;
    list.replaceChildren();
    if (!works || !works.length) {
      list.appendChild(el("li", "pending", "Publication list is unavailable right now."));
      return;
    }
    works.forEach(function (work) {
      var item = document.createElement("li");
      item.appendChild(el("span", "year", work.year || ""));
      var body = document.createElement("div");
      var title = el("p", "paper-title");
      if (work.url) {
        var link = document.createElement("a");
        link.href = work.url;
        link.appendChild(text(work.title));
        title.appendChild(link);
      } else {
        title.appendChild(text(work.title));
      }
      body.appendChild(title);
      var bits = [work.typeLabel, work.venue, work.authors].filter(Boolean);
      body.appendChild(el("p", "paper-meta", bits.join(" · ")));
      item.appendChild(body);
      var cites = Number(work.citedBy || 0);
      item.appendChild(el("p", "cites", cites === 1 ? "1 citation" : cites + " citations"));
      list.appendChild(item);
    });
  }

  function renderRepos(repos) {
    var list = document.getElementById("repos");
    if (!list) return;
    list.replaceChildren();
    if (!repos || !repos.length) {
      list.appendChild(el("li", "pending", "Repository list is unavailable right now."));
      return;
    }
    repos.forEach(function (repo) {
      var item = document.createElement("li");
      item.appendChild(el("span", "year", repo.language || "—"));
      var body = document.createElement("div");
      var title = el("p", "repo-name");
      var link = document.createElement("a");
      link.href = repo.url;
      link.appendChild(text(repo.name));
      title.appendChild(link);
      body.appendChild(title);
      if (repo.description) body.appendChild(el("p", "repo-meta", repo.description));
      if (repo.homepage) {
        var home = document.createElement("p");
        home.className = "repo-meta";
        var homeLink = document.createElement("a");
        homeLink.href = repo.homepage;
        homeLink.appendChild(text("Project site"));
        home.appendChild(homeLink);
        body.appendChild(home);
      }
      item.appendChild(body);
      var starLabel = repo.stars === 1 ? "1 star" : (repo.stars || 0) + " stars";
      item.appendChild(el("p", "cites", starLabel));
      list.appendChild(item);
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setStat(node, value) {
    var target = Number(value);
    if (!node || !isFinite(target)) return;
    if (node.dataset.value === String(target) && node.textContent === String(target)) return;
    node.dataset.value = String(target);
    if (reduceMotion) {
      node.textContent = String(target);
      return;
    }
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / 800);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (stats.contrib) setStat(stats.contrib, stats.contrib.textContent);
  if (stats.citations) setStat(stats.citations, stats.citations.textContent);
  if (stats.h) setStat(stats.h, stats.h.textContent);
  if (stats.i10) setStat(stats.i10, stats.i10.textContent);

  var folds = document.querySelectorAll("details.fold");
  folds.forEach(function (fold) {
    fold.addEventListener("toggle", function () {
      if (!fold.open) return;
      folds.forEach(function (other) {
        if (other !== fold) other.open = false;
      });
    });
  });

  function renderContributions(calendar) {
    var caption = document.getElementById("contrib-caption");
    var grid = document.getElementById("contrib-grid");
    if (!caption || !grid) return;
    var weeks = calendar && calendar.weeks;
    if (!weeks || !weeks.length) {
      caption.textContent = "The contribution calendar is unavailable right now.";
      grid.replaceChildren();
      return;
    }
    var total = Number(calendar.total || 0);
    var noun = total === 1 ? "public contribution" : "public contributions";
    caption.replaceChildren();
    var profile = document.createElement("a");
    profile.href = "https://github.com/Awwal41";
    profile.appendChild(text(total.toLocaleString("en-US") + " " + noun));
    caption.appendChild(profile);
    caption.appendChild(text(" in the last year."));
    if (stats.contrib) setStat(stats.contrib, total);
    grid.replaceChildren();
    grid.setAttribute("aria-label", caption.textContent);
    weeks.forEach(function (week) {
      var column = document.createElement("div");
      column.className = "contrib-week";
      (week || []).forEach(function (day) {
        var count = Number(day.count || 0);
        var cell = document.createElement("span");
        cell.className = "contrib-day";
        var color = day.color || "#ebedf0";
        if (currentTheme() === "dark" && color.toLowerCase() === "#ebedf0") color = "#3a342e";
        cell.style.backgroundColor = color;
        var dayNoun = count === 1 ? "contribution" : "contributions";
        cell.title = (day.date || "Day") + ": " + count + " " + dayNoun;
        column.appendChild(cell);
      });
      grid.appendChild(column);
    });
  }

  if (!reduceMotion && "IntersectionObserver" in window) {
    var observed = document.querySelectorAll(".section-head, .featured article, .moves li, .item, .also");
    observed.forEach(function (node) { node.classList.add("await"); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("shown");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16 });
    observed.forEach(function (node) { observer.observe(node); });
  }

  fetch("data/live.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("missing live.json");
      return response.json();
    })
    .then(function (data) {
      var scholar = data.scholar || {};
      if (scholar.citations != null) setStat(stats.citations, scholar.citations);
      if (scholar.hIndex != null) setStat(stats.h, scholar.hIndex);
      if (scholar.i10Index != null) setStat(stats.i10, scholar.i10Index);
      renderWorks(data.works);
      renderRepos(data.repos);
      window.__calendar = data.contributions;
      renderContributions(data.contributions);
      var colophon = document.getElementById("colophon");
      if (data.generatedAt && colophon) {
        colophon.textContent = "Publications and public repositories refresh every Monday. Last built " + data.generatedAt.slice(0, 10) + ".";
      }
    })
    .catch(function () {
      renderWorks([]);
      renderRepos([]);
    });
})();
