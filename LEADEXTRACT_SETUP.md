# LeadExtract public contacts

LeadExtract runs as a static HTML/CSS/JavaScript page. Visitors do not supply API keys, install software, or run a local server. Internet access is required for live research. Serve `leadextract.html` and its linked assets using the existing static website deployment.

## What it does

- **Find businesses:** bounded OpenStreetMap/Overpass searches for a supported category within an exact city boundary, optionally scoped to a full region/country name. Up to 20 listings per search. Missing/ambiguous places produce an explicit error; searches never expand to the whole world.
- **Website URLs:** up to 10 public HTTP(S) URLs. Reads the starting page and optionally follows relevant contact/about/team links on the same hostname. Up to 3 pages per business and 30 pages per run.
- **Paste a page:** parses user-provided public page HTML/text locally, retaining the supplied original URL and marking that the live source was not verified. HTML is parsed inertly and never injected into the page.
- Names and roles require explicit structured/visible evidence. Person-specific contacts remain separate from website/listing contacts. Missing values remain blank. Finding a contact does not verify deliverability, employment or ownership.
- Source links, partial results, cancellation, local saved lists, filtering and CSV export. Saved data uses a new schema; old synthetic demo data is never imported.

## External dependencies and limits

Website reads use [Jina Reader](https://jina.ai/reader/) at `https://r.jina.ai/{public-url}`. Anonymous reads are currently supported at 20 requests/minute. Requests are spaced at least 3.2 seconds apart within a run. The key-required Jina Search endpoint is not used. Requests can be refused, blocked by target sites, or throttled. A 429 ends further reading for that run; there is no proxy rotation or attempt to bypass site protections.

Business discovery uses `https://overpass-api.de/api/interpreter`, with simple CORS POST requests, exact administrative-boundary lookup, explicit response limits, caching within the source client and conservative request pacing. This is a low-volume, best-effort dependency on a community public service; it has no availability guarantee. Read [Overpass public-instance guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) before broader commercial rollout. A high-traffic product would require its own appropriately provisioned hosted services. No Nominatim dependency is present.

OpenStreetMap listing coverage varies substantially by city/category; many listings have no website, phone or email. Owner/staff names are generally obtained from business websites, not the listing directory. The tool cannot guarantee all three requested fields for every business or search the unrestricted web without a search provider. Blocked pages can be handled manually through Paste a page when their public content is accessible to the visitor.

The UI discloses the providers, attribution, third-party requests and data limits. Search locations and requested URLs reach the respective services. Saved results stay in this browser. Keys, login cookies and authenticated content are not sent. Public URLs are validated, remote content uses text-only rendering, and CSV cells are quoted and protected against formula prefixes.

## Files

- `leadextract.html`, `css/leadextract-live.css`: page and scoped styling, preserving the studio header/footer.
- `js/leadextract.js`: UI, orchestration, same-site follow-up reads, storage and export.
- `js/leadextract-sources.js`: public source transports, throttling, failures and boundaries.
- `js/leadextract-parser.js`: JSON-LD, staff sections, Markdown, public contact extraction and validation.
- Legacy `css/leadextract.css` and `js/leadextract-experience.js` are no longer loaded by this page.

## Verification

Run the dependency-free Node regression checks:

```text
node --test scripts/test_leadextract_parser.cjs scripts/test_leadextract_sources.cjs scripts/test_leadextract_ui.cjs
```

Open `scripts/test-leadextract-parser.html` through a local/static preview to run the real DOMParser fixtures. These test staff cards, nested sections, JSON-LD references, authors/testimonials, shared contacts and inert hostile HTML. The harness is separate from the production page and marked noindex.

Before release, check desktop/mobile layouts and perform a small real listing and website run, cancellation, save/reload and CSV export. Never treat a source error as an empty successful lookup. The production page retains the site's existing GA4 identifier once.

