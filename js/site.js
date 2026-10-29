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
    var simCtx = sim.getContext("2d");
    var atoms = [];
    var simWidth = 1;
    var simHeight = 1;
    var simPhase = 0;
    var pointer = { x: -9999, y: -9999 };
    var simLoop = false;

    function simColor(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#1c1915";
    }

    function resizeSim() {
      var rect = sim.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      simWidth = Math.max(1, rect.width);
      simHeight = Math.max(1, rect.height);
      sim.width = Math.round(simWidth * dpr);
      sim.height = Math.round(simHeight * dpr);
      simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(150, Math.max(56, simWidth * simHeight / 2600)));
      while (atoms.length < count) {
        atoms.push({
          x: Math.random() * simWidth,
          y: Math.random() * simHeight,
          vx: 0,
          vy: 0,
          species: atoms.length % 2
        });
      }
      if (atoms.length > count) atoms.length = count;
    }

    function placeAtom(index, count, mode) {
      var pad = 16;
      var span = Math.min(simWidth, simHeight);
      var cx = simWidth * 0.64;
      var cy = simHeight * 0.5;
      var wide = simHeight < simWidth * 0.55;
      if (mode === 0 || mode === 4) {
        var turn = index * 2.399;
        var ring = 12 + (index % 7) * span * 0.055;
        return { x: cx + Math.cos(turn) * ring, y: cy + Math.sin(turn) * ring * 0.9 };
      }
      if (mode === 1) {
        var shell = index % 3;
        var around = Math.floor(index / 3) / Math.max(1, Math.ceil(count / 3)) * Math.PI * 2;
        var radius = span * (0.16 + shell * 0.13);
        return { x: cx + Math.cos(around) * radius, y: cy + Math.sin(around) * radius };
      }
      if (mode === 2) {
        var side = index % 2 === 0 ? -1 : 1;
        if (index % 8 === 0) side *= -1;
        var local = index * 2.15;
        var blob = 10 + (index % 5) * 11;
        var shift = wide ? simWidth * 0.22 : simWidth * 0.16;
        return {
          x: cx + side * shift + Math.cos(local) * blob,
          y: cy + Math.sin(local) * blob * 0.85
        };
      }
      var along = index / Math.max(1, count - 1);
      var helixRadius = Math.min(wide ? simHeight * 0.28 : simWidth * 0.22, 78);
      var helixTurn = along * Math.PI * 2 * (wide ? 3.2 : 2.6);
      if (wide) {
        return {
          x: pad + along * (simWidth - pad * 2),
          y: cy + Math.sin(helixTurn) * helixRadius
        };
      }
      return {
        x: cx + Math.cos(helixTurn) * helixRadius,
        y: pad + along * (simHeight - pad * 2)
      };
    }

    function atomGoal(index, count, phase) {
      var stops = [0, 0.22, 0.48, 0.74, 1];
      var slot = 0;
      var s;
      for (s = 0; s < stops.length - 1; s++) {
        if (phase >= stops[s]) slot = s;
      }
      var span = stops[slot + 1] - stops[slot];
      var mix = span ? (phase - stops[slot]) / span : 0;
      var from = placeAtom(index, count, slot);
      var to = placeAtom(index, count, slot + 1);
      return {
        x: from.x + (to.x - from.x) * mix,
        y: from.y + (to.y - from.y) * mix
      };
    }

    function drawSim(moving) {
      var count = atoms.length;
      var i;
      var j;
      var ink = simColor("--ink");
      var umber = simColor("--umber");
      var moss = simColor("--moss");
      if (moving) {
        var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        var targetPhase = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        simPhase += (targetPhase - simPhase) * 0.045;
        for (i = 0; i < count; i++) {
          var atom = atoms[i];
          var goal = atomGoal(i, count, simPhase);
          var ax = (goal.x - atom.x) * 0.05 + (Math.random() - 0.5) * 0.1;
          var ay = (goal.y - atom.y) * 0.05 + (Math.random() - 0.5) * 0.1;
          var mdx = atom.x - pointer.x;
          var mdy = atom.y - pointer.y;
          var md2 = mdx * mdx + mdy * mdy;
          if (md2 < 8100 && md2 > 0.01) {
            var md = Math.sqrt(md2);
            var push = (90 - md) / 90 * 1.6;
            ax += mdx / md * push;
            ay += mdy / md * push;
          }
          if (atom.x < 10) ax += 0.45;
          if (atom.x > simWidth - 10) ax -= 0.45;
          if (atom.y < 10) ay += 0.45;
          if (atom.y > simHeight - 10) ay -= 0.45;
          atom.vx = (atom.vx + ax) * 0.84;
          atom.vy = (atom.vy + ay) * 0.84;
          atom.x += atom.vx;
          atom.y += atom.vy;
        }
        for (i = 0; i < count; i++) {
          for (j = i + 1; j < count; j++) {
            var a = atoms[i];
            var b = atoms[j];
            var rx = a.x - b.x;
            var ry = a.y - b.y;
            var r2 = rx * rx + ry * ry;
            if (r2 > 784 || r2 < 0.01) continue;
            var dist = Math.sqrt(r2);
            var repel = (28 - dist) / 28 * 0.22;
            var fx = rx / dist * repel;
            var fy = ry / dist * repel;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }
      if (!moving) {
        for (i = 0; i < count; i++) {
          var parked = atomGoal(i, count, 0);
          atoms[i].x = parked.x;
          atoms[i].y = parked.y;
          atoms[i].vx = 0;
          atoms[i].vy = 0;
        }
      }
      simCtx.clearRect(0, 0, simWidth, simHeight);
      simCtx.lineWidth = 1;
      simCtx.strokeStyle = ink;
      simCtx.globalAlpha = 0.16;
      simCtx.beginPath();
      for (i = 0; i < count; i++) {
        for (j = i + 1; j < count; j++) {
          var left = atoms[i];
          var right = atoms[j];
          var bx = left.x - right.x;
          var by = left.y - right.y;
          var bond = bx * bx + by * by;
          if (bond < 49 || bond > 900) continue;
          simCtx.moveTo(left.x, left.y);
          simCtx.lineTo(right.x, right.y);
        }
      }
      simCtx.stroke();
      simCtx.globalAlpha = 0.95;
      for (i = 0; i < count; i++) {
        var dot = atoms[i];
        simCtx.fillStyle = dot.species ? moss : umber;
        simCtx.beginPath();
        simCtx.arc(dot.x, dot.y, dot.species ? 3.15 : 2.55, 0, Math.PI * 2);
        simCtx.fill();
      }
      simCtx.globalAlpha = 1;
    }

    function runSim() {
      if (simLoop) return;
      simLoop = true;
      function tick() {
        drawSim(true);
        if (document.hidden) {
          simLoop = false;
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    resizeSim();
    if (reduceMotion) {
      for (var n = 0; n < atoms.length; n++) {
        var parked = atomGoal(n, atoms.length, 0);
        atoms[n].x = parked.x;
        atoms[n].y = parked.y;
      }
      drawSim(false);
    } else {
      runSim();
    }

    window.addEventListener("resize", function () {
      resizeSim();
      if (reduceMotion) drawSim(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !reduceMotion) runSim();
    });
    window.addEventListener("pointermove", function (event) {
      var rect = sim.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      if (pointer.x < 0 || pointer.y < 0 || pointer.x > rect.width || pointer.y > rect.height) {
        pointer.x = -9999;
        pointer.y = -9999;
      }
    });
    if (themeButton) {
      themeButton.addEventListener("click", function () {
        if (reduceMotion) drawSim(false);
      });
    }
  }
})();
