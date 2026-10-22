(function () {
  var stats = {
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

  fetch("data/live.json", { cache: "no-cache" })
    .then(function (response) {
      if (!response.ok) throw new Error("missing live.json");
      return response.json();
    })
    .then(function (data) {
      var scholar = data.scholar || {};
      if (scholar.citations != null) stats.citations.textContent = scholar.citations;
      if (scholar.hIndex != null) stats.h.textContent = scholar.hIndex;
      if (scholar.i10Index != null) stats.i10.textContent = scholar.i10Index;
      renderWorks(data.works);
      renderRepos(data.repos);
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
