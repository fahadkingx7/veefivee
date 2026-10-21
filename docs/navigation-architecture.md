# veefivee navigation and CSS architecture
Updated: 2026-10-21

## Why the header was unstable
Previously, header rules were interleaved throughout `css/extras.css` and
overridden by `css/blog-nav.css`. Many pages placed the viewport-fixed glass
header under `overflow-x-hidden`. This can turn a purely decorative clip into
a scroll container because CSS computes `overflow-y` to `auto`. Meanwhile
`html { scroll-behavior:smooth }` also applied to browser-driven scroll
changes, not just user-requested section navigation. iOS Chrome's visual
viewport/address bar varies during cross-document navigation. Together these
are plausible causes of the intermittent header/content displacement observed
in the user-supplied screen recording. Physical-device confirmation is still
required.

## Canonical sources (do not reintroduce competing overrides)
- `css/styles.css`: compiled utility CSS and **original** page/hero animations.
- `css/extras.css`: site visuals, layouts and typography, **no header rules**.
- `css/site-nav.css`: one owner for glass navigation, mobile branding, responsive
  links, active states, and the non-scrolling `.vf-site-frame` overflow clip.
- `css/home-industries.css`: approved homepage Industries cards, two columns
  with a 1140px desktop bound and 16:9 mobile imagery.
- `js/main.js`: original interactions and motion observers; intentional
  in-page anchor links scroll smoothly without global scroll restoration effects.
- Page-specific CSS continues after extras and before site-nav.

## Layout invariant
```html
<body>
  <nav class="fixed ..." data-vf-site-nav>...</nav>
  <div class="relative min-h-screen vf-site-frame">
    <main>...</main>
    <!-- footer and other original page content -->
  </div>
</body>
```
The nav is a direct body child, not a child of overflow/transform/filter
ancestors. No content or visual effects were removed. The header and its
responsive menu styles retain the original properties and transitions.

## Regression checks
Run `node scripts/check-site-navigation.mjs` after modifying shared styles
or navigation markup. Test mobile page transitions (Home, About, Industries,
Services, Products, Blog, Consultation) in Safari and iOS Chrome; scroll
mid-page and use the browser Back button. Also test Android Chrome and desktop.
This is a static check, not a replacement for iOS real-device testing.

## Rollback
The pre-refactor GitHub main commit is
`d99edaccde9520dd3ba04013968b09b007e77418`. The refactor is atomic so
it can be reverted as one commit. The LogIn download page is excluded.
