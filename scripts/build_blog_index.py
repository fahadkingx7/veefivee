#!/usr/bin/env python3
"""Build veefivee's browser-readable blog index from industry guides + /blogs/*.html.
Runs in standard Python 3 without packages or a server. GitHub Actions runs on commit.
The archive stays static; each story has a real, crawlable HTML URL.
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime,timezone
from html.parser import HTMLParser
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
import html, json, re, sys

ROOT=Path(__file__).resolve().parent.parent
BASE='https://veefivee.com/'

class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__();self.metadata={};self.title='';self.reading_title=False
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='title':self.reading_title=True
        if tag=='meta':
            key=(attrs.get('name') or attrs.get('property') or '').strip().lower()
            if key:self.metadata[key]=attrs.get('content','')
    def handle_endtag(self,tag):
        if tag=='title':self.reading_title=False
    def handle_data(self,data):
        if self.reading_title:self.title+=data

def safe_text(text):
    return re.sub(r'\s+',' ',html.unescape(text or '')).strip()

def safe_image(path):
    path=str(path or '').strip().lstrip('/')
    if path.startswith(BASE):path=path[len(BASE):]
    if path.startswith('assets/') and (ROOT/path.split('?',1)[0]).is_file():return path
    return 'assets/og-industries.jpg'

def safe_date(raw):
    text=str(raw or '').strip()[:10]
    try:datetime.strptime(text,'%Y-%m-%d');return text
    except ValueError:return ''

def existing_guides():
    seeds=json.loads((ROOT/'data/blog-seed.json').read_text(encoding='utf-8'))
    result=[]
    for slug,item in seeds.items():
        if not re.fullmatch('[a-z0-9-]+',slug):raise ValueError(f'Invalid seed slug: {slug}')
        file=ROOT/'industries'/f'{slug}.html'
        if not file.is_file():raise FileNotFoundError(file)
        result.append(dict(id=f'industry-{slug}',url=f'industries/{slug}.html',
            title=safe_text(item['title']),excerpt=safe_text(item['excerpt']),
            image=safe_image(item['image']),imageAlt=safe_text(item.get('imageAlt') or item['title']),
            category=safe_text(item.get('category') or 'Industries'),
            date=safe_date(item.get('date','2026-10-18')),
            updated=safe_date(item.get('updated','2026-10-18')),
            readMinutes=max(1,min(int(item.get('readMinutes',8)),45)),
            keywords=item.get('keywords',[])))
    return result

def new_blog_articles():
    posts=[]
    for file in sorted((ROOT/'blogs').glob('*.html')):
        raw=file.read_text(encoding='utf-8');parse=HeadParser();parse.feed(raw)
        meta=parse.metadata
        if meta.get('blog:draft','').lower() in ('true','1','yes'):continue
        title=safe_text(meta.get('blog:title') or parse.title.split('|')[0])
        description=safe_text(meta.get('description') or meta.get('og:description'))
        category=safe_text(meta.get('blog:category') or 'Ideas & Insights')
        published=safe_date(meta.get('article:published_time') or meta.get('blog:date'))
        updated=safe_date(meta.get('article:modified_time') or meta.get('blog:updated') or published)
        if not title or not description or not published:
            raise ValueError(f'{file.relative_to(ROOT)} needs a <title>, description, and article:published_time (YYYY-MM-DD).')
        if not re.fullmatch('[a-z0-9-]+',file.stem):raise ValueError('Use lowercase hyphenated blog filenames')
        img=safe_image(meta.get('og:image') or meta.get('blog:image'))
        keywords=[x.strip() for x in meta.get('keywords','').split(',') if x.strip()][:16]
        content=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',raw,flags=re.I|re.S)
        content=re.sub(r'<[^>]+>',' ',content)
        word_count=len(safe_text(content).split())
        minutes=max(3,min(45,round(word_count/200)))
        posts.append(dict(id=f'blog-{file.stem}',url=f'blogs/{file.name}',title=title,
            excerpt=description,category=category,image=img,imageAlt=title,
            date=published,updated=updated,readMinutes=minutes,keywords=keywords))
    return posts

def render_card(p,i):
    escape=lambda x:html.escape(str(x),quote=True)
    published=p.get('updated') or p.get('date') or ''
    label=datetime.strptime(published,'%Y-%m-%d').strftime('%b %Y') if published else 'Guide'
    return f'''<article class="vf-blog-card"><a class="vf-blog-card-image" href="{escape(p['url'])}" tabindex="-1" aria-hidden="true"><img src="{escape(p['image'])}" alt="{escape(p.get('imageAlt') or p['title'])}" width="740" height="480" decoding="async" loading="{'eager' if i<3 else 'lazy'}"><span class="vf-blog-card-category">{escape(p['category'])}</span></a><div class="vf-blog-card-copy"><div class="vf-blog-card-overline"><span>{escape(label)}</span><span class="vf-dot"></span><span>{p['readMinutes']} min read</span></div><h3><a href="{escape(p['url'])}">{escape(p['title'])}</a></h3><p>{escape(p['excerpt'])}</p><a class="vf-blog-card-link" href="{escape(p['url'])}" aria-label="Read: {escape(p['title'])}">Read the story <span aria-hidden="true">↗</span></a></div></article>'''

def render_studio_card(p):
    escape=lambda x:html.escape(str(x),quote=True)
    return f'''<article class="vf-home-journal-card">
      <a class="vf-home-journal-image" href="{escape(p['url'])}" aria-label="Read {escape(p['title'])}">
        <img loading="lazy" decoding="async" width="740" height="480" src="{escape(p['image'])}" alt="{escape(p.get('imageAlt') or p['title'])}" />
      </a>
      <div class="vf-home-journal-copy">
        <span class="vf-home-journal-tag">{escape(p['category'])} <span aria-hidden="true">·</span> {p['readMinutes']} min read</span>
        <h3><a href="{escape(p['url'])}">{escape(p['title'])}</a></h3>
        <p>{escape(p['excerpt'])}</p>
        <a class="vf-home-journal-read" href="{escape(p['url'])}">Read the story <span aria-hidden="true">↗</span></a>
      </div>
    </article>'''

def fill_section(content,mark,body):
    pattern=f'<!-- {mark}_START -->'+r'.*?'+f'<!-- {mark}_END -->'
    out,n=re.subn(pattern,lambda _: f'<!-- {mark}_START -->'+body+f'<!-- {mark}_END -->',content,flags=re.S)
    if n!=1:raise RuntimeError(f'Missing {mark} section in blog.html')
    return out

def build():
    posts=existing_guides()+new_blog_articles()
    posts.sort(key=lambda p:(p.get('updated') or p.get('date') or '',p['title'].casefold()),reverse=True)
    index={'version':1,'source':'GitHub Pages repository file generated by scripts/build_blog_index.py','posts':posts}
    (ROOT/'data/blog-posts.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    content=(ROOT/'blog.html').read_text(encoding='utf8')
    content=fill_section(content,'POSTS_STATIC','\n'+'\n'.join(render_card(p,i) for i,p in enumerate(posts[:6]))+'\n')
    cat=sorted({p['category'] for p in posts})
    content=fill_section(content,'FILTERS_STATIC', ''.join(f'<button class="vf-blog-chip" type="button" data-category="{html.escape(c,quote=True)}" aria-pressed="false">{html.escape(c)}</button>' for c in cat))
    content=fill_section(content,'NOSCRIPT_POSTS', ' '.join(f'<a href="{html.escape(p["url"],quote=True)}">{html.escape(p["title"])}</a>.' for p in posts[6:]))
    content=fill_section(content,'FALLBACK_JSON',json.dumps(posts,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
    content=re.sub(r'<span class="vf-blog-post-count" id="blogTotal" aria-live="polite">.*?</span>',f'<span class="vf-blog-post-count" id="blogTotal" aria-live="polite">{len(posts)} stories to explore</span>',content,count=1)
    content=re.sub(r'(<div id="blogResults" class="vf-blog-results-info" aria-live="polite">).*?(</div>)',rf'\g<1>Showing {min(6,len(posts))} of {len(posts)} stories\g<2>',content,count=1)
    (ROOT/'blog.html').write_text(content,encoding='utf8')
    # Keep Home, About and Services' three featured stories synced to the same
    # index used by the blog. Static HTML preserves SEO and no-JS availability.
    top_stories='\n'+'\n'.join(render_studio_card(p) for p in posts[:3])+'\n'
    for name in ('index.html','about.html','services.html'):
        page=ROOT/name
        page.write_text(fill_section(page.read_text(encoding='utf8'),
                                     'STUDIO_FEATURED',top_stories),encoding='utf8')
    # Preserve existing URLs; append blog archive and any new blog articles to sitemap.
    sitemap=ROOT/'sitemap.xml';ET.register_namespace('','http://www.sitemaps.org/schemas/sitemap/0.9')
    ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'
    tree=ET.parse(sitemap); parent=tree.getroot()
    existing={e.text for e in parent.findall(f'{ns}url/{ns}loc')}
    # Remove stale /blogs/ URLs only, because posts can be withdrawn later.
    for child in list(parent):
        url=child.find(f'{ns}loc');value=url.text if url is not None else ''
        if value.startswith(BASE+'blogs/') and value not in {BASE+p['url'] for p in posts}:
            parent.remove(child);existing.discard(value)
    for path in ['blog.html']+[p['url'] for p in posts]:
        url=BASE+path
        if url not in existing:
            e=ET.SubElement(parent,ns+'url');ET.SubElement(e,ns+'loc').text=url
            existing.add(url)
    ET.indent(tree,space='  ');tree.write(sitemap,encoding='utf-8',xml_declaration=True)
    print(f'Generated {len(posts)} stories, static first 6, {len(cat)} categories and crawlable sitemap URLs.')

if __name__=='__main__':
    try:build()
    except Exception as exc:print('Blog indexing failed:',exc,file=sys.stderr);raise
