#!/usr/bin/env node
/* Dependency-free regression checks for the shared site shell. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");
const fail = (message) => { throw new Error(message); };
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const htmlFiles = walk(root).filter((path) => path.endsWith(".html"));
let checked = 0;
for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  const name = relative(root, file);
  const usesSharedNav = /(?:\.{2}\/)?css\/site-nav\.css\?v=2/.test(source);
  if (!usesSharedNav) {
    if (/css\/blog-nav\.css\?v=/.test(source)) fail(name + ": stale navigation stylesheet");
    continue;
  }
  checked++;
  if (/css\/blog-nav\.css\?v=/.test(source)) fail(name + ": duplicate navigation stylesheet");
  if (!/(?:\.{2}\/)?css\/extras\.css\?v=42/.test(source)) fail(name + ": missing unified extras CSS");
  const header = source.indexOf('<nav class="fixed inset-x-0 top-0 z-50');
  if (header < 0 || !source.slice(header, source.indexOf(">", header) + 1).includes("data-vf-site-nav")) {
    fail(name + ": missing canonical fixed header");
  }
  const frame = source.indexOf('class="relative min-h-screen vf-site-frame"');
  if (frame >= 0 && header > frame) fail(name + ": fixed header placed inside content frame");
  if (source.includes('class="relative min-h-screen overflow-x-hidden"')) fail(name + ": legacy scroll container");
  if (!/(?:\.{2}\/)?js\/main\.js\?v=29/.test(source)) fail(name + ": missing shared navigation JavaScript");
  if (source.includes("scrollRestoration")) fail(name + ": outdated navigation scroll workaround");
}
const navCss = read("css/site-nav.css");
const extras = read("css/extras.css");
const industries = read("css/home-industries.css");
const script = read("js/main.js");
const base = read("css/styles.css");
if (!navCss.includes("[data-nav-pill]") || !navCss.includes(".vf-mobile-brand")) fail("Missing header styling");
if (extras.includes("[data-nav-pill]") || extras.includes(".vf-mobile-brand")) fail("Header styles leaked into extras.css");
if (!navCss.includes(".vf-site-frame { overflow-x:clip; overflow-y:visible; min-height:100vh; }")) fail("Missing non-scrollable content frame");
if (!navCss.includes(".vf-site-frame { min-height:100svh; }")) fail("Viewport fallback to 100vh remains active on mobile Chrome");
if (!industries.includes("max-width:1140px") || !industries.includes("aspect-ratio: 16 / 9")) fail("Homepage Industries layout changed");
if (!read("index.html").includes("css/home-industries.css?v=1")) fail("Homepage missing Industries stylesheet");
if (!base.includes("@keyframes page-enter") || !base.includes("@keyframes rise-in")) fail("Base page animations changed");
if (!script.includes('target.scrollIntoView({') || !script.includes('behavior: window.matchMedia')) fail("Smooth in-page links changed");
if (!existsSync(join(root, "downloads/login/index.html"))) fail("LogIn download page missing");
console.log("Navigation architecture verified across " + checked + " pages.");
