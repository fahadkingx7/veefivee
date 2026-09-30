
(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  var pill = document.querySelector("[data-nav-pill]");
  if (pill) {
    var onScroll = function () {
      var scrolled = window.scrollY > 20;
      pill.classList.toggle("bg-background/40", !scrolled);
      pill.classList.toggle("backdrop-blur-xl", !scrolled);
      pill.classList.toggle("bg-background/80", scrolled);
      pill.classList.toggle("backdrop-blur-2xl", scrolled);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
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
  } else {
    reveals.forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }

  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) return;

  document.querySelectorAll("[data-magnetic]").forEach(function (a) {
    var glow = a.querySelector("[data-glow]");
    a.addEventListener("mousemove", function (e) {
      var r = a.getBoundingClientRect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;
      var tx = (x - r.width / 2) * 0.18;
      var ty = (y - r.height / 2) * 0.3;
      a.style.transform = "translate(" + tx + "px, " + ty + "px) scale(1.04)";
      if (glow) {
        glow.style.opacity = "1";
        glow.style.background = "radial-gradient(120px circle at " + (x / r.width * 100) + "% " + (y / r.height * 100) + "%, oklch(1 0 0 / 0.35), transparent 70%)";
      }
    });
    a.addEventListener("mouseleave", function () {
      a.style.transform = "translate(0px, 0px) scale(1)";
      if (glow) glow.style.opacity = "0";
    });
  });

  document.querySelectorAll("[data-tilt]").forEach(function (el) {
    var max = Number(el.getAttribute("data-tilt")) || 8;
    var glow = el.querySelector(":scope > [data-sheen]");
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var i = (e.clientX - r.left) / r.width;
      var o = (e.clientY - r.top) / r.height;
      el.style.transition = "transform 0.1s ease-out";
      el.style.transform = "perspective(900px) rotateX(" + ((0.5 - o) * max) + "deg) rotateY(" + ((i - 0.5) * max) + "deg) translateY(-6px) scale(1.015)";
      if (glow) {
        glow.style.opacity = "1";
        glow.style.background = "radial-gradient(320px circle at " + (i * 100) + "% " + (o * 100) + "%, oklch(1 0 0 / 0.22), transparent 65%)";
      }
    });
    el.addEventListener("mouseleave", function () {
      el.style.transition = "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
      if (glow) glow.style.opacity = "0";
    });
  });
})();
