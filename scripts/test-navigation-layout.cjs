/* Run with Playwright installed: node scripts/test-navigation.cjs.
 * Optional WEBKIT_EXECUTABLE selects a local WebKit runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = path.resolve(__dirname, '..');
const pages = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'test') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (file.endsWith('.html') && fs.readFileSync(file, 'utf8').includes('data-nav-pill'))
      pages.push(path.relative(root, file).split(path.sep).join('/'));
  }
}
scan(root);
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://local').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file += '/index.html';
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const b=await webkit.launch({executablePath:process.env.WEBKIT_EXECUTABLE});
 try {
 for(const width of [430,1440]){
 const p=await b.newPage({viewport:{width,height:850},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
 await p.route('https://**/*',r=>r.abort());
 const sample=()=>p.evaluate(()=>({title:document.title,canonical:document.querySelector('link[rel="canonical"]').href,geometry:Array.from(document.querySelectorAll('h1,main h2,[data-nav-pill],.site-footer')).map(e=>{const r=e.getBoundingClientRect();return [e.textContent.trim(),r.x,r.y,r.width,r.height]})}));
 const expected={};
 for(const name of ['index','about','industries','services','products','contact']){await p.goto(base+'/'+name+'.html');await p.waitForTimeout(350);expected[name]=await sample();}
 await p.evaluate(()=>window.__doc='persistent');
 for(const name of ['index','about','industries','services','products','contact']){
 await p.evaluate(name=>document.querySelector('a[href="'+name+'.html"]').click(),name);
 await p.waitForURL('**/'+name+'.html');await p.waitForTimeout(350);
 assert.equal(await p.evaluate(()=>window.__doc),'persistent',name+' document replaced');
 const actual=await sample();assert.equal(actual.title,expected[name].title);assert.equal(actual.canonical,expected[name].canonical);
 assert.deepEqual(actual.geometry,expected[name].geometry,name+' layout changed');
 }

 console.log('PASS visual geometry, title, canonical, persistent document on six pages at '+width+'px');await p.close();
 }
 }finally{await b.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
