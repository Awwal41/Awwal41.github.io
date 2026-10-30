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
    document.documentElement.style.colorScheme = dark ? "dark" : "only light";
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

  var sim = document.getElementById("sim");
  if (sim) {
    var simCtx = sim.getContext("2d", { alpha: true });
    var simCount = 0;
    var simX = null;
    var simY = null;
    var simShapes = [];
    var simWidth = 1;
    var simHeight = 1;
    var simPhase = 0;
    var pointer = { x: -9999, y: -9999 };
    var simLoop = false;
    var simWide = false;

    function simColor(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#1c1915";
    }

    function simHash(index, salt) {
      var value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
      return value - Math.floor(value);
    }

    function shapePoint(index, count, mode) {
      var u = simHash(index, mode + 1);
      var v = simHash(index, mode + 9);
      var cx = simWidth * 0.5;
      var cy = simHeight * 0.48;
      var rx = simWidth * (simWide ? 0.42 : 0.4);
      var ry = simHeight * (simWide ? 0.38 : 0.4);
      var angle;
      var radius;
      if (mode === 0) {
        radius = Math.pow(u, 0.45);
        angle = v * Math.PI * 2;
        return [cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius];
      }
      if (mode === 1) {
        var shell = index % 4;
        var perShell = Math.max(1, Math.floor(count / 4));
        angle = (Math.floor(index / 4) / perShell) * Math.PI * 2 + shell * 0.35;
        radius = 0.24 + shell * 0.2;
        return [cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius];
      }
      if (mode === 2) {
        var group = index % 2;
        var blob = Math.min(rx, ry) * 0.32 * Math.pow(u, 0.55);
        angle = v * Math.PI * 2;
        var shift = group ? rx * 0.58 : -rx * 0.58;
        return [cx + shift + Math.cos(angle) * blob, cy + Math.sin(angle) * blob];
      }
      if (mode === 3) {
        var along = index / Math.max(1, count - 1);
        var strand = index % 2;
        angle = along * Math.PI * 8 + strand * Math.PI;
        if (simWide) {
          return [cx + (along - 0.5) * simWidth * 0.86, cy + Math.sin(angle) * ry * 0.8];
        }
        return [cx + Math.cos(angle) * rx * 0.7, cy + (along - 0.5) * ry * 1.9];
      }
      var turn = index / Math.max(1, count - 1);
      var arm = index % 2;
      radius = 0.06 + turn * 0.94;
      angle = turn * Math.PI * 2 * 2.5 + arm * Math.PI;
      return [cx + Math.cos(angle) * rx * radius, cy + Math.sin(angle) * ry * radius];
    }

    function buildField() {
      var rect = sim.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      simWidth = Math.max(1, rect.width);
      simHeight = Math.max(1, rect.height);
      simWide = simWidth > simHeight * 1.25;
      sim.width = Math.round(simWidth * dpr);
      sim.height = Math.round(simHeight * dpr);
      simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      simCount = Math.round(Math.min(7200, Math.max(1400, simWidth * simHeight / 70)));
      simX = new Float32Array(simCount);
      simY = new Float32Array(simCount);
      simShapes = [];
      var mode;
      var i;
      for (mode = 0; mode < 5; mode++) {
        var field = new Float32Array(simCount * 2);
        for (i = 0; i < simCount; i++) {
          var point = shapePoint(i, simCount, mode);
          field[i * 2] = point[0];
          field[i * 2 + 1] = point[1];
          if (mode === 0) {
            simX[i] = point[0];
            simY[i] = point[1];
          }
        }
        simShapes.push(field);
      }
    }

    function fieldGoal(index, phase) {
      var stops = [0, 0.18, 0.4, 0.62, 0.82, 1];
      var slot = 0;
      var s;
      for (s = 0; s < stops.length - 1; s++) {
        if (phase >= stops[s]) slot = s;
      }
      var span = stops[slot + 1] - stops[slot];
      var raw = span ? (phase - stops[slot]) / span : 0;
      var mix = raw < 0.42 ? 0 : (raw - 0.42) / 0.58;
      mix = mix * mix * (3 - 2 * mix);
      var from = simShapes[Math.min(slot, 4)];
      var to = simShapes[Math.min(slot + 1, 4)];
      var at = index * 2;
      return {
        x: from[at] + (to[at] - from[at]) * mix,
        y: from[at + 1] + (to[at + 1] - from[at + 1]) * mix
      };
    }

    function drawField(moving) {
      var umber = simColor("--umber");
      var moss = simColor("--moss");
      var i;
      if (!moving) simPhase = 0;
      if (moving) {
        var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        var targetPhase = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        simPhase += (targetPhase - simPhase) * 0.12;
      }
      for (i = 0; i < simCount; i++) {
        var goal = fieldGoal(i, simPhase);
        var x = moving ? simX[i] + (goal.x - simX[i]) * 0.16 : goal.x;
        var y = moving ? simY[i] + (goal.y - simY[i]) * 0.16 : goal.y;
        var dx = x - pointer.x;
        var dy = y - pointer.y;
        var dist2 = dx * dx + dy * dy;
        if (dist2 < 19600 && dist2 > 0.01) {
          var dist = Math.sqrt(dist2);
          var push = (140 - dist) / 140 * 14;
          x += dx / dist * push;
          y += dy / dist * push;
        }
        simX[i] = x;
        simY[i] = y;
      }
      simCtx.clearRect(0, 0, simWidth, simHeight);
      simCtx.globalAlpha = 0.9;
      simCtx.fillStyle = umber;
      simCtx.beginPath();
      for (i = 0; i < simCount; i += 2) {
        simCtx.moveTo(simX[i] + 1.45, simY[i]);
        simCtx.arc(simX[i], simY[i], i % 18 === 0 ? 2.35 : 1.45, 0, Math.PI * 2);
      }
      simCtx.fill();
      simCtx.fillStyle = moss;
      simCtx.beginPath();
      for (i = 1; i < simCount; i += 2) {
        simCtx.moveTo(simX[i] + 1.55, simY[i]);
        simCtx.arc(simX[i], simY[i], i % 22 === 0 ? 2.45 : 1.55, 0, Math.PI * 2);
      }
      simCtx.fill();
      simCtx.globalAlpha = 1;
    }

    function runField() {
      if (simLoop) return;
      simLoop = true;
      function tick() {
        drawField(true);
        if (document.hidden) {
          simLoop = false;
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    buildField();
    if (reduceMotion) drawField(false);
    else runField();

    window.addEventListener("resize", function () {
      buildField();
      if (reduceMotion) drawField(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !reduceMotion) runField();
    });
    window.addEventListener("pointermove", function (event) {
      var rect = sim.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      if (pointer.x < -40 || pointer.y < -40 || pointer.x > rect.width + 40 || pointer.y > rect.height + 40) {
        pointer.x = -9999;
        pointer.y = -9999;
      }
    });
    if (themeButton) {
      themeButton.addEventListener("click", function () {
        if (reduceMotion) drawField(false);
      });
    }
  }
})();
