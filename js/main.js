(function () {
  "use strict";
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  var pill = document.querySelector("[data-nav-pill]");
  if (pill) {
    // The scroll state changes only when crossing 20px, not on every scroll event.
    var lastScrolled;
    function updateNav() {
      var scrolled = window.scrollY > 20;
      if (scrolled === lastScrolled) return;
      lastScrolled = scrolled;
      pill.classList.toggle("bg-background/40", !scrolled);
      pill.classList.toggle("backdrop-blur-xl", !scrolled);
      pill.classList.toggle("bg-background/80", scrolled);
      pill.classList.toggle("backdrop-blur-2xl", scrolled);
    }
    updateNav();
    window.addEventListener("scroll", updateNav, { passive: true });
  }

  var reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });

    // Keep every existing CSS animation while visible. Stop off-screen animations
    // from consuming rendering time; their playback resumes when scrolled into view.
    var looping = document.querySelectorAll(".animate-float, .animate-float-slow, .animate-drift, .animate-ping, .animate-bounce, .text-shimmer");
    var motionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
      });
    }, { rootMargin: "100px" });
    looping.forEach(function (el) { motionObserver.observe(el); });
  } else {
    reveals.forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }

  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) return;

  function trackMouse(el, compute, reset) {
    var bounds = null;
    var pending = 0;
    var coords = null;

    el.addEventListener("mouseenter", function () {
      bounds = el.getBoundingClientRect();
    });
    el.addEventListener("mousemove", function (e) {
      // Cache geometry: reading it after a transform can trigger layout + feedback jitter.
      if (!bounds) bounds = el.getBoundingClientRect();
      coords = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      if (pending) return;
      pending = window.requestAnimationFrame(function () {
        pending = 0;
        compute(bounds, coords);
      });
    }, { passive: true });
    el.addEventListener("mouseleave", function () {
      if (pending) window.cancelAnimationFrame(pending);
      pending = 0;
      bounds = null;
      coords = null;
      reset();
    });
    window.addEventListener("resize", function () { bounds = null; }, { passive: true });
  }

  document.querySelectorAll("[data-magnetic]").forEach(function (a) {
    var glow = a.querySelector("[data-glow]");
    trackMouse(a, function (r, pos) {
      var x = pos.x, y = pos.y;
      var tx = (x - r.width / 2) * 0.18;
      var ty = (y - r.height / 2) * 0.3;
      a.style.transform = "translate(" + tx + "px, " + ty + "px) scale(1.04)";
      if (glow) {
        glow.style.opacity = "1";
        glow.style.background = "radial-gradient(120px circle at " + (x / r.width * 100) + "% " + (y / r.height * 100) + "%, oklch(1 0 0 / 0.35), transparent 70%)";
      }
    }, function () {
      a.style.transform = "translate(0px, 0px) scale(1)";
      if (glow) glow.style.opacity = "0";
    });
  });

  document.querySelectorAll("[data-tilt]").forEach(function (el) {
    var max = Number(el.getAttribute("data-tilt")) || 8;
    var glow = el.querySelector(":scope > [data-sheen]");
    el.addEventListener("mouseenter", function () {
      el.style.transition = "transform 0.1s ease-out";
    });
    trackMouse(el, function (r, pos) {
      var i = pos.x / r.width;
      var o = pos.y / r.height;
      el.style.transform = "perspective(900px) rotateX(" + ((0.5 - o) * max) + "deg) rotateY(" + ((i - 0.5) * max) + "deg) translateY(-6px) scale(1.015)";
      if (glow) {
        glow.style.opacity = "1";
        glow.style.background = "radial-gradient(320px circle at " + (i * 100) + "% " + (o * 100) + "%, oklch(1 0 0 / 0.22), transparent 65%)";
      }
    }, function () {
      el.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
      if (glow) glow.style.opacity = "0";
    });
  });
})();
