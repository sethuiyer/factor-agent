/**
 * Theme-aware D3 visualizations for the ShunyaBar essay.
 * The charts intentionally read CSS custom properties at render time so the
 * Paper/Tokyo Night toggle remains the single source of visual truth.
 */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var activeCleanups = new Map();
  var renderQueued = false;
  var resizeObserver = null;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function theme() {
    return {
      mode: document.documentElement.getAttribute("data-theme") || "dark",
      bg: cssVar("--bg"),
      bg2: cssVar("--bg-2"),
      bg3: cssVar("--bg-3"),
      fg: cssVar("--fg"),
      fg2: cssVar("--fg-2"),
      fg3: cssVar("--fg-3"),
      pink: cssVar("--pink"),
      purple: cssVar("--purple"),
      cyan: cssVar("--cyan"),
      green: cssVar("--green"),
      yellow: cssVar("--yellow"),
      orange: cssVar("--orange"),
      red: cssVar("--red"),
      rule: cssVar("--rule"),
      line: cssVar("--line"),
      panel: cssVar("--bg-2")
    };
  }

  function panelSize(el, fallback) {
    var w = Math.max(el.clientWidth || fallback.w, 280);
    var h = parseInt(el.getAttribute("data-height"), 10) || fallback.h;
    return { w: w, h: h };
  }

  function cleanup(id) {
    if (activeCleanups.has(id)) {
      activeCleanups.get(id)();
      activeCleanups.delete(id);
    }
  }

  function clear(el) {
    cleanup(el.id);
    d3.select(el).selectAll("*").remove();
  }

  function makeSvg(el, fallback, title) {
    var t = theme();
    var sz = panelSize(el, fallback);
    var svg = d3.select(el).append("svg")
      .attr("viewBox", "0 0 " + sz.w + " " + sz.h)
      .attr("width", "100%")
      .attr("height", sz.h)
      .attr("role", "img")
      .attr("aria-label", title || el.getAttribute("data-label") || "Essay visualization")
      .style("display", "block");

    svg.append("title").text(title || el.getAttribute("data-label") || "Essay visualization");
    svg.append("rect")
      .attr("width", sz.w)
      .attr("height", sz.h)
      .attr("rx", 3)
      .attr("fill", t.bg2)
      .attr("opacity", t.mode === "light" ? 0.54 : 0.28);

    return { svg: svg, t: t, w: sz.w, h: sz.h, markerSeq: 0 };
  }

  function marker(ctx, color, name) {
    var id = "viz-" + name + "-" + ctx.markerSeq++;
    ctx.svg.append("defs").append("marker")
      .attr("id", id)
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 7)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", color);
    return "url(#" + id + ")";
  }

  function mono(sel) {
    return sel.style("font-family", '"JetBrains Mono", monospace');
  }

  function label(sel, color, size) {
    return mono(sel)
      .attr("fill", color)
      .style("font-size", size || "10px")
      .style("letter-spacing", "0.02em");
  }

  function callout(ctx, text, x, y, color) {
    return label(ctx.svg.append("text"), color || ctx.t.fg3, "9px")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", "middle")
      .text(text);
  }

  function nodeBox(g, width, height, fill, stroke) {
    g.append("rect")
      .attr("x", -width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("rx", 6)
      .attr("fill", fill)
      .attr("stroke", stroke)
      .attr("stroke-width", 1.3);
  }

  function attachDrag(sim) {
    return d3.drag()
      .on("start", function (event, d) {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function (event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function (event, d) {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  function addCleanup(id, fn) {
    activeCleanups.set(id, fn);
  }

  function vizBlob(el) {
    var ctx = makeSvg(el, { w: 680, h: 320 }, "Overloaded agent topology");
    var t = ctx.t;
    var concerns = ["planning", "reasoning", "retrieval", "memory", "tools", "permissions", "effects", "errors", "repair"];
    var nodes = [{ id: "Big Agent", r: 54, core: true }].concat(concerns.map(function (id, i) {
      return { id: id, r: 24 + (i % 3) * 3 };
    }));
    var links = concerns.map(function (id) {
      return { source: "Big Agent", target: id };
    });
    var sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(92).strength(0.46))
      .force("charge", d3.forceManyBody().strength(-170))
      .force("center", d3.forceCenter(ctx.w / 2, ctx.h / 2))
      .force("collide", d3.forceCollide().radius(function (d) { return d.r + 6; }));

    var link = ctx.svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("stroke", t.red)
      .attr("stroke-width", 1.4)
      .attr("stroke-opacity", t.mode === "light" ? 0.34 : 0.5);

    var node = ctx.svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .attr("cursor", "grab")
      .call(attachDrag(sim));
    node.append("circle")
      .attr("r", function (d) { return d.r; })
      .attr("fill", function (d) { return d.core ? t.red : t.bg3; })
      .attr("fill-opacity", function (d) { return d.core ? 0.22 : 0.88; })
      .attr("stroke", function (d) { return d.core ? t.red : t.rule; })
      .attr("stroke-width", function (d) { return d.core ? 2.2 : 1.2; });
    label(node.append("text"), t.fg, "9px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.id; });
    callout(ctx, "one process, too many responsibilities", ctx.w / 2, 24, t.red);

    sim.on("tick", function () {
      link.attr("x1", function (d) { return d.source.x; }).attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; }).attr("y2", function (d) { return d.target.y; });
      node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    });
    addCleanup(el.id, function () { sim.stop(); });
  }

  function vizPrimeFactor(el) {
    var ctx = makeSvg(el, { w: 680, h: 260 }, "Unique factorization tree");
    var t = ctx.t;
    var root = d3.hierarchy({
      name: "360",
      children: [
        { name: "2^3", children: [{ name: "2" }, { name: "2" }, { name: "2" }] },
        { name: "3^2", children: [{ name: "3" }, { name: "3" }] },
        { name: "5" }
      ]
    });
    d3.tree().size([ctx.w - 90, ctx.h - 66])(root);
    var g = ctx.svg.append("g").attr("transform", "translate(45,34)");
    g.selectAll("path").data(root.links()).enter().append("path")
      .attr("fill", "none")
      .attr("stroke", t.rule)
      .attr("stroke-width", 1.6)
      .attr("d", d3.linkVertical().x(function (d) { return d.x; }).y(function (d) { return d.y; }));
    var n = g.selectAll("g").data(root.descendants()).enter().append("g")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    n.append("circle")
      .attr("r", function (d) { return d.depth === 0 ? 19 : 16; })
      .attr("fill", function (d) { return d.depth === 0 ? t.purple : d.children ? t.bg3 : t.pink; })
      .attr("fill-opacity", function (d) { return d.depth === 0 ? 0.28 : 0.85; })
      .attr("stroke", function (d) { return d.depth === 0 ? t.purple : t.rule; });
    label(n.append("text"), t.fg, "11px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.data.name; });
  }

  function vizProcessTree(el) {
    var ctx = makeSvg(el, { w: 680, h: 320 }, "Addressable process decomposition");
    var t = ctx.t;
    var root = d3.hierarchy({
      name: "Workflow Supervisor",
      children: ["Orchestrator", "Docs Agent", "CRM Agent", "Memory Service", "Tool Executor", "Audit Logger"].map(function (name) {
        return { name: name };
      })
    });
    d3.tree().size([ctx.h - 70, ctx.w - 170])(root);
    var g = ctx.svg.append("g").attr("transform", "translate(96,34)");
    g.selectAll("path").data(root.links()).enter().append("path")
      .attr("fill", "none")
      .attr("stroke", t.green)
      .attr("stroke-opacity", 0.62)
      .attr("stroke-width", 1.8)
      .attr("d", d3.linkHorizontal().x(function (d) { return d.y; }).y(function (d) { return d.x; }));
    var n = g.selectAll("g").data(root.descendants()).enter().append("g")
      .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });
    n.each(function (d) {
      var width = Math.max(82, d.data.name.length * 7.3 + 16);
      var fill = d.depth === 0 ? t.green : t.bg3;
      nodeBox(d3.select(this), width, 24, fill, d.depth === 0 ? t.green : t.rule);
      d3.select(this).select("rect").attr("fill-opacity", d.depth === 0 ? 0.2 : 0.86);
    });
    label(n.append("text"), t.fg, "10px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.data.name; });
  }

  function vizWorkflowDag(el) {
    var ctx = makeSvg(el, { w: 680, h: 430 }, "Workflow DAG");
    var t = ctx.t;
    var steps = ["Retrieve QBR", "Summarize", "Query SF", "Compare", "Risks", "Draft Slack", "Approval", "Send"];
    var nodes = steps.map(function (label, i) {
      return { label: label, x: ctx.w / 2, y: 42 + i * ((ctx.h - 84) / (steps.length - 1)) };
    });
    var arrow = marker(ctx, t.purple, "workflow-arrow");
    ctx.svg.append("g").selectAll("path").data(d3.pairs(nodes)).enter().append("path")
      .attr("fill", "none")
      .attr("stroke", t.purple)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.78)
      .attr("marker-end", arrow)
      .attr("d", function (d) {
        return "M" + d[0].x + "," + (d[0].y + 16) + "L" + d[1].x + "," + (d[1].y - 18);
      });
    var n = ctx.svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    n.each(function (d) {
      nodeBox(d3.select(this), 116, 28, t.bg3, t.purple);
    });
    label(n.append("text"), t.fg, "10px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.label; });
  }

  function vizSupervision(el) {
    var ctx = makeSvg(el, { w: 720, h: 380 }, "OTP supervision tree");
    var t = ctx.t;
    var root = d3.hierarchy({
      name: "Platform Sup",
      children: [
        { name: "Gateway Sup" },
        { name: "Shared Sup", children: [{ name: "Policy" }, { name: "Tools" }, { name: "Memory" }, { name: "Audit" }] },
        { name: "Workflow Sup", children: [{ name: "Orchestrator" }, { name: "Docs" }, { name: "CRM" }, { name: "Data" }, { name: "Slack" }] },
        { name: "Jobs Sup", children: [{ name: "Eval" }, { name: "Compact" }, { name: "Embed" }] }
      ]
    });
    var dx = 22;
    var dy = (ctx.w - 160) / (root.height + 1);
    var tree = d3.tree().nodeSize([dx, dy]);
    var g = ctx.svg.append("g").attr("transform", "translate(96,34)");
    root.descendants().forEach(function (d, i) { d.id = i; d.x0 = 0; d.y0 = 0; });

    function diagonal(s, d) {
      return "M" + s.y + "," + s.x + "C" + (s.y + d.y) / 2 + "," + s.x + " " + (s.y + d.y) / 2 + "," + d.x + " " + d.y + "," + d.x;
    }

    function update(source) {
      tree(root);
      var nodes = root.descendants();
      var links = root.links();
      nodes.forEach(function (d) { d.y = d.depth * dy; });

      var link = g.selectAll("path.link").data(links, function (d) { return d.target.id; });
      link.enter().append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", t.rule)
        .attr("stroke-width", 1.5)
        .attr("d", function () { return diagonal(source, source); })
        .merge(link)
        .transition().duration(prefersReducedMotion.matches ? 0 : 220)
        .attr("d", function (d) { return diagonal(d.source, d.target); });
      link.exit().remove();

      var node = g.selectAll("g.node").data(nodes, function (d) { return d.id; });
      var enter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", function () { return "translate(" + source.y0 + "," + source.x0 + ")"; })
        .attr("cursor", "pointer")
        .on("click", function (event, d) {
          if (d.children) { d._children = d.children; d.children = null; }
          else { d.children = d._children; d._children = null; }
          update(d);
        });
      enter.append("circle")
        .attr("r", 6)
        .attr("fill", function (d) { return d.children || d._children ? t.bg3 : t.cyan; })
        .attr("stroke", t.purple)
        .attr("stroke-width", 1.5);
      label(enter.append("text"), t.fg2, "9px")
        .attr("dy", "0.32em")
        .attr("x", 11)
        .text(function (d) { return d.data.name; });
      node.merge(enter)
        .transition().duration(prefersReducedMotion.matches ? 0 : 220)
        .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });
      node.exit().remove();
      root.each(function (d) { d.x0 = d.x; d.y0 = d.y; });
    }
    update(root);
  }

  function vizIharaGraph(el) {
    var ctx = makeSvg(el, { w: 680, h: 360 }, "Call graph with prime cycle");
    var t = ctx.t;
    var nodes = ["Orch", "Docs", "CRM", "Tools", "Memory", "Audit"].map(function (label) {
      return { id: label, label: label };
    });
    var links = [
      ["Orch", "Docs", false], ["Docs", "Tools", false], ["Orch", "CRM", false], ["Docs", "Memory", false],
      ["Tools", "CRM", true], ["CRM", "Memory", true], ["Memory", "Audit", true], ["Audit", "Orch", true]
    ].map(function (d) { return { source: d[0], target: d[1], prime: d[2] }; });
    var sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(104).strength(0.58))
      .force("charge", d3.forceManyBody().strength(-360))
      .force("center", d3.forceCenter(ctx.w / 2, ctx.h / 2))
      .force("collide", d3.forceCollide(34));
    var link = ctx.svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("stroke", function (d) { return d.prime ? t.pink : t.rule; })
      .attr("stroke-width", function (d) { return d.prime ? 3 : 1.4; })
      .attr("stroke-opacity", function (d) { return d.prime ? 0.9 : 0.58; });
    var node = ctx.svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .attr("cursor", "grab")
      .call(attachDrag(sim));
    node.append("circle")
      .attr("r", 24)
      .attr("fill", t.bg3)
      .attr("stroke", t.cyan)
      .attr("stroke-width", 1.6);
    label(node.append("text"), t.fg, "9px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.label; });
    callout(ctx, "pink loop = primitive cycle in runtime topology", ctx.w / 2, 24, t.pink);
    sim.on("tick", function () {
      link.attr("x1", function (d) { return d.source.x; }).attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; }).attr("y2", function (d) { return d.target.y; });
      node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    });
    addCleanup(el.id, function () { sim.stop(); });
  }

  function vizEulerPrimes(el) {
    var ctx = makeSvg(el, { w: 680, h: 230 }, "Euler product factors");
    var t = ctx.t;
    var primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
    var margin = { top: 34, right: 18, bottom: 34, left: 42 };
    var w = ctx.w - margin.left - margin.right;
    var h = ctx.h - margin.top - margin.bottom;
    var g = ctx.svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var x = d3.scaleBand().domain(primes.map(String)).range([0, w]).padding(0.26);
    var y = d3.scaleLinear().domain([0, 0.55]).range([h, 0]);
    g.append("g").selectAll("line").data(y.ticks(4)).enter().append("line")
      .attr("x1", 0).attr("x2", w).attr("y1", y).attr("y2", y)
      .attr("stroke", t.rule).attr("stroke-opacity", 0.5);
    g.selectAll("rect").data(primes).enter().append("rect")
      .attr("x", function (d) { return x(String(d)); })
      .attr("y", function (d) { return y(1 / d); })
      .attr("width", x.bandwidth())
      .attr("height", function (d) { return h - y(1 / d); })
      .attr("rx", 3)
      .attr("fill", t.purple)
      .attr("opacity", 0.78);
    var axis = g.append("g").attr("transform", "translate(0," + h + ")").call(d3.axisBottom(x).tickSizeOuter(0));
    axis.selectAll("path,line").attr("stroke", t.rule);
    label(axis.selectAll("text"), t.fg3, "9px");
    callout(ctx, "schematic local weights for early primes", ctx.w / 2, 22, t.fg3);
  }

  function vizSchedule(el) {
    var ctx = makeSvg(el, { w: 680, h: 280 }, "Lattice versus aperiodic schedules");
    var t = ctx.t;
    var tenants = ["tenant 1", "tenant 2", "tenant 3", "tenant 4", "tenant 5", "tenant 6"];
    var lattice = tenants.map(function (name) { return { name: name, x: 0 }; });
    var aperiodic = [17, 42, 65, 91, 118, 143].map(function (x, i) { return { name: tenants[i], x: x }; });
    var margin = { top: 34, right: 24, bottom: 26, left: 76 };
    var w = ctx.w - margin.left - margin.right;
    var h = ctx.h - margin.top - margin.bottom;
    var g = ctx.svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var y1 = d3.scaleBand().domain(tenants).range([0, h * 0.42]).padding(0.18);
    var y2 = d3.scaleBand().domain(tenants).range([h * 0.56, h]).padding(0.18);
    var x = d3.scaleLinear().domain([0, 160]).range([0, w]);
    g.append("line").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", h * 0.42).attr("stroke", t.red).attr("stroke-width", 2);
    g.selectAll("rect.l").data(lattice).enter().append("rect")
      .attr("class", "l")
      .attr("x", function (d) { return x(d.x); }).attr("y", function (d) { return y1(d.name); })
      .attr("width", 10).attr("height", y1.bandwidth()).attr("rx", 2)
      .attr("fill", t.red).attr("opacity", 0.72);
    g.selectAll("rect.a").data(aperiodic).enter().append("rect")
      .attr("class", "a")
      .attr("x", function (d) { return x(d.x); }).attr("y", function (d) { return y2(d.name); })
      .attr("width", 10).attr("height", y2.bandwidth()).attr("rx", 2)
      .attr("fill", t.green).attr("opacity", 0.82);
    label(g.append("text"), t.red, "9px").attr("x", 0).attr("y", -10).text("lattice: synchronized at :00");
    label(g.append("text"), t.green, "9px").attr("x", 0).attr("y", h * 0.52).text("aperiodic: deterministic offsets");
  }

  function vizSpectral(el) {
    var ctx = makeSvg(el, { w: 680, h: 250 }, "Interaction graph spectrum");
    var t = ctx.t;
    var data = [
      { k: "lambda 1", label: "λ1", v: 2.4 },
      { k: "lambda 2", label: "λ2", v: 1.1 },
      { k: "lambda 3", label: "λ3", v: 0.8 },
      { k: "lambda 4", label: "λ4", v: 0.5 },
      { k: "lambda 5", label: "λ5", v: 0.3 }
    ];
    var margin = { top: 28, right: 24, bottom: 38, left: 44 };
    var w = ctx.w - margin.left - margin.right;
    var h = ctx.h - margin.top - margin.bottom;
    var g = ctx.svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var x = d3.scaleBand().domain(data.map(function (d) { return d.k; })).range([0, w]).padding(0.28);
    var y = d3.scaleLinear().domain([0, 2.6]).range([h, 0]);
    g.append("g").selectAll("line").data([0.5, 1, 1.5, 2]).enter().append("line")
      .attr("x1", 0).attr("x2", w).attr("y1", y).attr("y2", y)
      .attr("stroke", t.rule).attr("stroke-opacity", 0.48);
    g.selectAll("rect").data(data).enter().append("rect")
      .attr("x", function (d) { return x(d.k); })
      .attr("y", function (d) { return y(d.v); })
      .attr("width", x.bandwidth())
      .attr("height", function (d) { return h - y(d.v); })
      .attr("rx", 3)
      .attr("fill", function (d) { return d.v > 1 ? t.red : t.cyan; })
      .attr("opacity", 0.84);
    g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(1)).attr("y2", y(1))
      .attr("stroke", t.yellow).attr("stroke-width", 1.5).attr("stroke-dasharray", "5,4");
    label(g.append("text"), t.yellow, "9px").attr("x", w - 4).attr("y", y(1) - 7).attr("text-anchor", "end").text("rho = 1");
    var axis = g.append("g").attr("transform", "translate(0," + h + ")").call(d3.axisBottom(x).tickFormat(function (_, i) { return data[i].label; }).tickSizeOuter(0));
    axis.selectAll("path,line").attr("stroke", t.rule);
    label(axis.selectAll("text"), t.fg3, "9px");
  }

  function vizLabelLattice(el) {
    var ctx = makeSvg(el, { w: 680, h: 310 }, "Confidentiality label lattice");
    var t = ctx.t;
    var nodes = [
      { id: "top", label: "pii·customer·internal", x: 0.5, y: 0.12 },
      { id: "pc", label: "pii·customer", x: 0.28, y: 0.36 },
      { id: "pi", label: "pii·internal", x: 0.72, y: 0.36 },
      { id: "p", label: "pii", x: 0.2, y: 0.62 },
      { id: "c", label: "customer", x: 0.5, y: 0.62 },
      { id: "i", label: "internal", x: 0.8, y: 0.62 },
      { id: "bot", label: "public (1)", x: 0.5, y: 0.88 }
    ];
    var links = [["top", "pc"], ["top", "pi"], ["pc", "p"], ["pc", "c"], ["pi", "p"], ["pi", "i"], ["p", "bot"], ["c", "bot"], ["i", "bot"]];
    var px = function (d) { return 50 + d.x * (ctx.w - 100); };
    var py = function (d) { return 28 + d.y * (ctx.h - 56); };
    var byId = new Map(nodes.map(function (d) { return [d.id, d]; }));
    ctx.svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("x1", function (d) { return px(byId.get(d[0])); })
      .attr("y1", function (d) { return py(byId.get(d[0])); })
      .attr("x2", function (d) { return px(byId.get(d[1])); })
      .attr("y2", function (d) { return py(byId.get(d[1])); })
      .attr("stroke", t.rule)
      .attr("stroke-width", 1.4);
    var n = ctx.svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .attr("transform", function (d) { return "translate(" + px(d) + "," + py(d) + ")"; });
    n.append("ellipse")
      .attr("rx", function (d) { return Math.max(45, d.label.length * 4.2); })
      .attr("ry", 16)
      .attr("fill", t.bg3)
      .attr("stroke", t.purple);
    label(n.append("text"), t.fg, "9px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(function (d) { return d.label; });
  }

  function vizArchitecture(el) {
    var ctx = makeSvg(el, { w: 720, h: 420 }, "Production topology");
    var t = ctx.t;
    var root = d3.hierarchy({
      name: "Platform",
      children: [
        { name: "Gateway" }, { name: "Auth" }, { name: "Policy" },
        { name: "Workflow", children: [{ name: "Orch" }, { name: "Docs" }, { name: "CRM" }, { name: "Data" }, { name: "Slack" }] },
        { name: "Tools" }, { name: "Memory" }, { name: "Retrieval" }, { name: "ACL" }, { name: "Approval" }, { name: "Audit" }, { name: "Eval" }
      ]
    });
    var radius = Math.min(ctx.w, ctx.h) / 2 - 48;
    d3.tree().size([2 * Math.PI, radius])(root);
    var g = ctx.svg.append("g").attr("transform", "translate(" + ctx.w / 2 + "," + ctx.h / 2 + ")");
    g.selectAll("path").data(root.links()).enter().append("path")
      .attr("fill", "none")
      .attr("stroke", t.rule)
      .attr("stroke-width", 1.3)
      .attr("d", d3.linkRadial().angle(function (d) { return d.x; }).radius(function (d) { return d.y; }));
    var n = g.selectAll("g").data(root.descendants()).enter().append("g")
      .attr("transform", function (d) {
        return "rotate(" + (d.x * 180 / Math.PI - 90) + ") translate(" + d.y + ",0)";
      });
    n.append("circle")
      .attr("r", function (d) { return d.depth === 0 ? 7 : d.children ? 5 : 3.5; })
      .attr("fill", function (d) { return d.depth === 0 ? t.pink : d.children ? t.purple : t.cyan; });
    label(n.append("text"), t.fg2, "8px")
      .attr("dy", "0.31em")
      .attr("x", function (d) { return d.x < Math.PI ? 9 : -9; })
      .attr("text-anchor", function (d) { return d.x < Math.PI ? "start" : "end"; })
      .attr("transform", function (d) { return d.x >= Math.PI ? "rotate(180)" : null; })
      .text(function (d) { return d.data.name; });
  }

  function vizBridge(el) {
    var ctx = makeSvg(el, { w: 680, h: 380 }, "Six-pillar bridge");
    var t = ctx.t;
    var colors = [t.pink, t.purple, t.cyan, t.green, t.orange, t.yellow, t.fg];
    var nodes = [
      { id: "primes", label: "Primes", group: 0 }, { id: "erlang", label: "Erlang", group: 1 },
      { id: "denning", label: "Denning", group: 2 }, { id: "solid", label: "SOLID", group: 3 },
      { id: "cap", label: "CAP", group: 4 }, { id: "ihara", label: "Ihara", group: 5 },
      { id: "core", label: "Lawful\ncomposition", group: 6, r: 34 }
    ];
    var links = [
      ["primes", "core"], ["erlang", "core"], ["denning", "core"], ["solid", "core"], ["cap", "core"], ["ihara", "core"],
      ["primes", "ihara"], ["erlang", "ihara"], ["denning", "erlang"]
    ].map(function (d) { return { source: d[0], target: d[1] }; });
    var sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(92).strength(0.56))
      .force("charge", d3.forceManyBody().strength(-450))
      .force("center", d3.forceCenter(ctx.w / 2, ctx.h / 2))
      .force("collide", d3.forceCollide(function (d) { return (d.r || 24) + 8; }));
    var link = ctx.svg.append("g").selectAll("line").data(links).enter().append("line")
      .attr("stroke", t.rule)
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.3);
    var node = ctx.svg.append("g").selectAll("g").data(nodes).enter().append("g")
      .attr("cursor", "grab")
      .call(attachDrag(sim));
    node.append("circle")
      .attr("r", function (d) { return d.r || 23; })
      .attr("fill", function (d) { return colors[d.group]; })
      .attr("fill-opacity", 0.18)
      .attr("stroke", function (d) { return colors[d.group]; })
      .attr("stroke-width", 1.5);
    node.each(function (d) {
      var lines = d.label.split("\n");
      var el = d3.select(this);
      lines.forEach(function (line, i) {
        label(el.append("text"), t.fg, d.r ? "10px" : "9px")
          .attr("text-anchor", "middle")
          .attr("dy", ((i - (lines.length - 1) / 2) * 12) + "px")
          .text(line);
      });
    });
    sim.on("tick", function () {
      link.attr("x1", function (d) { return d.source.x; }).attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; }).attr("y2", function (d) { return d.target.y; });
      node.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
    });
    addCleanup(el.id, function () { sim.stop(); });
  }

  function vizFactorFlow(el) {
    var ctx = makeSvg(el, { w: 680, h: 280 }, "FactorAgent message flow");
    var t = ctx.t;
    var actors = ["User", "Orch", "Policy", "Agent", "Tools", "Audit"];
    var steps = [
      { from: "User", to: "Orch", msg: "query" },
      { from: "Orch", to: "Policy", msg: "check" },
      { from: "Orch", to: "Agent", msg: "task" },
      { from: "Agent", to: "Tools", msg: "cap call" },
      { from: "Agent", to: "Audit", msg: "log" }
    ];
    var margin = { top: 38, right: 22, bottom: 24, left: 22 };
    var w = ctx.w - margin.left - margin.right;
    var h = ctx.h - margin.top - margin.bottom;
    var g = ctx.svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var x = d3.scalePoint().domain(actors).range([0, w]).padding(0.5);
    var y = d3.scaleLinear().domain([0, steps.length]).range([28, h - 8]);
    var arrow = marker(ctx, t.purple, "message-arrow");
    g.selectAll("line.life").data(actors).enter().append("line")
      .attr("class", "life")
      .attr("x1", function (d) { return x(d); }).attr("x2", function (d) { return x(d); })
      .attr("y1", 14).attr("y2", h)
      .attr("stroke", t.rule)
      .attr("stroke-dasharray", "3,3");
    label(g.selectAll("text.actor").data(actors).enter().append("text"), t.cyan, "9px")
      .attr("class", "actor")
      .attr("x", function (d) { return x(d); })
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .text(function (d) { return d; });
    var msg = g.selectAll("g.msg").data(steps).enter().append("g")
      .attr("transform", function (_, i) { return "translate(0," + y(i + 0.5) + ")"; });
    msg.append("line")
      .attr("x1", function (d) { return x(d.from); })
      .attr("x2", function (d) { return x(d.to); })
      .attr("y1", 0).attr("y2", 0)
      .attr("stroke", t.purple)
      .attr("stroke-width", 1.5)
      .attr("marker-end", arrow);
    label(msg.append("text"), t.fg2, "8px")
      .attr("x", function (d) { return (x(d.from) + x(d.to)) / 2; })
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .text(function (d) { return d.msg; });
  }

  var registry = {
    "viz-blob": vizBlob,
    "viz-prime-factor": vizPrimeFactor,
    "viz-process-tree": vizProcessTree,
    "viz-workflow-dag": vizWorkflowDag,
    "viz-supervision": vizSupervision,
    "viz-ihara-graph": vizIharaGraph,
    "viz-euler-primes": vizEulerPrimes,
    "viz-schedule": vizSchedule,
    "viz-spectral": vizSpectral,
    "viz-label-lattice": vizLabelLattice,
    "viz-architecture": vizArchitecture,
    "viz-bridge": vizBridge,
    "viz-factor-flow": vizFactorFlow
  };

  function renderOne(id) {
    var el = document.getElementById(id);
    if (!el || !registry[id] || typeof d3 === "undefined") return;
    clear(el);
    registry[id](el);
  }

  function renderAll() {
    Object.keys(registry).forEach(renderOne);
  }

  function queueRenderAll() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(function () {
      renderQueued = false;
      renderAll();
    });
  }

  function init() {
    if (typeof d3 === "undefined") return;
    renderAll();

    resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(function () {
      queueRenderAll();
    }) : null;
    if (resizeObserver) {
      Object.keys(registry).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) resizeObserver.observe(el);
      });
    }

    new MutationObserver(function (records) {
      if (records.some(function (r) { return r.attributeName === "data-theme"; })) {
        queueRenderAll();
      }
    }).observe(document.documentElement, { attributes: true });

    window.addEventListener("essay-theme-change", queueRenderAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.EssayViz = { renderAll: renderAll, renderOne: renderOne };
})();
