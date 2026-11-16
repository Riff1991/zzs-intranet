#!/usr/bin/env python3
"""Převede export starého intranetu (import/) na data/intranet.json pro nový intranet.

Zdroje: import/pages/*AllItems*.html (tabulky seznamů a knihoven), import/lists/*.xml
(úplnější data seznamů), import/files-manifest.csv (názvy souborů).
Spuštění:  python tools/build_data.py
"""
import csv, html, json, os, re, sys
from urllib.parse import unquote, urljoin, quote
from lxml import html as LH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMP = os.path.join(ROOT, 'import')
PAGES = os.path.join(IMP, 'pages')
BASE = 'http://intranet.zzsjck.local'

SITES = [  # klíč, adresář webu, název
    ('root', '', 'Intranet ZZS JčK'),
    ('predpisy', 'dokumenty', 'Vnitřní předpisy ZZS JčK'),
    ('krizove-rizeni', 'krizoverizeni', 'Krizové řízení'),
    ('odbory', 'odbory', 'Odbory'),
    ('vycvikove-stredisko', 'vycvikove_stredisko', 'Výcvikové středisko'),
    ('zzs-jh', 'zzsjh', 'ZZS JH'),
]
SITE_BY_TITLE = {t: k for k, d, t in SITES}


def fix_moji(s):
    """XML z v1 exportu je UTF-8 přečtené jako Latin-1; opravit zpět."""
    try:
        return s.encode('latin-1').decode('utf-8')
    except Exception:
        try:
            return s.encode('cp1252').decode('utf-8')
        except Exception:
            return s


def js_unescape(s):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s).replace('\\u002f', '/')


def clean(t):
    return re.sub(r'\s+', ' ', (t or '').replace('\xa0', ' ')).strip()


def parse_cz_datetime(s):
    m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?', s or '')
    if not m:
        return ''
    d, mo, y, h, mi = m.groups()
    return '%s-%02d-%02dT%02d:%s' % (y, int(mo), int(d), int(h or 0), mi or '00')


def parse_listpage(path):
    raw = open(path, encoding='utf-8', errors='replace').read()
    mt = re.search(r'ctx\.ListTitle = "([^"]*)"', raw)
    ms = re.search(r'ctx\.SiteTitle = "([^"]*)"', raw)
    mu = re.search(r'ctx\.listUrlDir = "([^"]*)"', raw)
    mb = re.search(r'ctx\.listBaseType = (\d+)', raw)
    mg = re.search(r'ctx\.listName = "(\{[^}]+\})"', raw)
    if not (mt and ms):
        return None
    doc = LH.fromstring(raw)
    tbl = doc.xpath('//table[contains(@class,"ms-listviewtable")]')
    cols, rows = [], []
    if tbl:
        t = tbl[0]
        heads = t.xpath('.//tr[contains(@class,"ms-viewheadertr")]/th')
        for th in heads:
            tt = th.xpath('.//table[@displayname]')
            cols.append(tt[0].get('displayname') if tt else clean(th.text_content()))
        for tr in t.xpath('./tr[not(contains(@class,"ms-viewheadertr"))] | ./tbody/tr[not(contains(@class,"ms-viewheadertr"))]'):
            tds = tr.xpath('./td')
            if len(tds) < 2:
                continue
            cells = [clean(td.text_content()) for td in tds]
            link = ''
            for a in tr.xpath('.//a[@href]'):
                h = a.get('href')
                if h and not h.startswith('javascript') and 'DispForm' not in h and '#' != h[:1]:
                    link = urljoin(BASE + '/', html.unescape(h))
                    break
            if not link:
                for a in tr.xpath('.//a[@href]'):
                    h = a.get('href')
                    if h and 'DispForm' in h:
                        link = urljoin(BASE + '/', html.unescape(h)); break
            attach = bool(tr.xpath('.//img[contains(@src,"attach.gif")]'))
            icon = ''
            im = tr.xpath('.//img[contains(@src,"/ic") or contains(@src,"folder.gif")]')
            if im:
                icon = im[0].get('src', '').split('/')[-1].split('.')[0]
            mid = re.search(r'DispForm\.aspx\?ID=(\d+)', link)
            rows.append({'cells': cells, 'href': link, 'attach': attach, 'icon': icon, 'id': mid.group(1) if mid else ''})
    return {
        'title': js_unescape(mt.group(1)),
        'site': js_unescape(ms.group(1)),
        'dir': unquote(js_unescape(mu.group(1)).replace('%25', '%')) if mu else '',
        'base': int(mb.group(1)) if mb else 0,
        'guid': mg.group(1) if mg else '',
        'cols': cols, 'rows': rows, 'file': os.path.basename(path),
    }


def xml_rows(path):
    raw = fix_moji(open(path, encoding='utf-8', errors='replace').read())
    out = []
    for m in re.finditer(r'<z:row ([^>]*?)/>', raw):
        d = {}
        for k, v in re.findall(r"ows_([A-Za-z0-9_]+)='([^']*)'", m.group(1)):
            d[k] = html.unescape(v)
        out.append(d)
    return out


def decode_name(k):
    return re.sub(r'_x([0-9a-fA-F]{4})_', lambda m: chr(int(m.group(1), 16)), k)


def tidy_phone(v):
    v = (v or '').split('.')[0].strip()
    d = re.sub(r'\D', '', v)
    if len(d) == 9:
        return '%s %s %s' % (d[:3], d[3:6], d[6:])
    return v


def main():
    # 1) stránky seznamů/knihoven -> sloučit podle (web, název)
    lists = {}
    for f in sorted(os.listdir(PAGES)):
        if not f.endswith('.html'):
            continue
        if 'AllItems' not in f or 'DispForm' in f:
            continue
        p = parse_listpage(os.path.join(PAGES, f))
        if not p or not p['cols']:
            continue
        key = (p['site'], p['title'])
        cur = lists.get(key)
        if not cur:
            lists[key] = p
        else:  # slučování stránkování a podsložek
            seen = {(tuple(r['cells']), r['href']) for r in cur['rows']}
            for r in p['rows']:
                k = (tuple(r['cells']), r['href'])
                if k not in seen:
                    cur['rows'].append(r); seen.add(k)
            if len(p['cols']) > len(cur['cols']):
                cur['cols'] = p['cols']

    # 2) XML data (Oznámení hlavního webu, telefonní seznamy, uživatelé)
    xml = {}
    xd = os.path.join(IMP, 'lists')
    if os.path.isdir(xd):
        for f in os.listdir(xd):
            if f.endswith('.xml'):
                xml['{%s}' % f[1:-5].strip('{}')] = xml_rows(os.path.join(xd, f))

    PH = {'{7A8B85DD-FBDE-4FC5-AF55-D90CF422E649}': 'CB', '{6B8F19CA-A259-4C5F-BCEE-3B83006B65B8}': 'JH',
          '{8AAC3A0D-E295-43AB-A28B-367B519EBAA3}': 'PI', '{A58D0E4F-5F91-4383-8875-21C97A398D16}': 'PT',
          '{E2BA4E75-4781-4410-9784-79ED5CAC364A}': 'ST', '{16B0D828-B88B-40F4-879C-569C3633A442}': 'TA',
          '{544DE896-1C1F-4B0C-9C55-E3BA91798A3B}': 'ČK'}
    phones = {}
    for g, k in PH.items():
        rows = []
        for r in xml.get(g, []):
            d = {decode_name(a): b for a, b in r.items()}
            rows.append({
                'prijmeni': d.get('LinkTitleNoMenu', ''), 'jmeno': d.get('Jméno', ''),
                'misto': d.get('Umístění', ''), 'klapka': d.get('Klapka', ''),
                'cislo': tidy_phone(d.get('Číslo', '')), 'mobil': tidy_phone(d.get('Mobil', '')),
                'typ': d.get('Typ', '').split(';#')[-1]})
        phones[k] = sorted(rows, key=lambda x: (x['prijmeni'], x['jmeno']))

    # 3) lidé a skupiny (uživatelé webu)
    people = []
    for r in xml.get('{270EACE3-8F7E-426F-A2EC-E9A84C1E5269}', []):
        people.append({'jmeno': r.get('Title', ''), 'email': r.get('EMail', ''), 'spravce': r.get('IsSiteAdmin') == '1'})

    # 4) oznámení hlavního webu z XML (kompletní seznam, 611 položek)
    news_main = []
    for r in xml.get('{F62CF0A4-B28D-4EEC-BF77-6BB900EAE981}', []):
        news_main.append({'title': clean(r.get('LinkTitle', '')), 'date': (r.get('Modified', '') or '').replace(' ', 'T')[:16],
                          'attach': r.get('Attachments') == '1'})

    events = []
    for r in xml.get('{41887D9E-74AB-4BDE-89F9-9A6F88E239AE}', []):
        events.append({'start': (r.get('EventDate', '') or '').replace(' ', 'T')[:16], 'end': (r.get('EndDate', '') or '').replace(' ', 'T')[:16],
                       'title': r.get('Title', ''), 'text': clean(r.get('Description', '')), 'allDay': r.get('fAllDayEvent') == '1'})

    # 5) sestavení webů
    out_sites = []
    for key, d, title in SITES:
        site = {'key': key, 'title': title, 'dir': d, 'url': BASE + ('/' + d if d else ''), 'lists': []}
        for (st, lt), p in sorted(lists.items(), key=lambda x: x[0][1]):
            if st != title or lt in ('-', '_'):
                continue
            kind = 'library' if p['base'] == 1 else 'list'
            if p['base'] == 0 and p['cols'] and p['cols'][:1] == ['Telefonní seznam']:
                kind = 'list'
            rows = p['rows']
            site['lists'].append({
                'title': lt, 'kind': kind, 'guid': p['guid'], 'cols': p['cols'],
                'rows': [{'c': r['cells'], 'h': r['href'], 'a': r['attach'], 'i': r['icon'], 'id': r.get('id', '')} for r in rows],
                'legacy': BASE + '/' + (p['dir'].strip('/') if p['dir'] else '')})
        out_sites.append(site)

    # 6) manifest souborů: přílohy oznámení a soubory knihoven
    files, att, libfiles = [], {}, []
    mf = os.path.join(IMP, 'files-manifest.csv')
    if os.path.exists(mf):
        for r in csv.DictReader(open(mf, encoding='utf-8-sig')):
            n = r.get('Name', ''); sz = int(r.get('Length', 0) or 0)
            files.append({'n': n, 's': sz})
            parts = n.split('__')
            url = BASE + '/' + '/'.join(quote(x) for x in parts)
            if 'Attachments' in parts:
                i = parts.index('Attachments')
                key = ('/'.join(parts[:i]).lower(), parts[i + 1])
                att.setdefault(key, []).append({'n': '__'.join(parts[i + 2:]), 'u': url, 's': sz})
            else:
                libfiles.append({'p': '/'.join(parts), 'u': url, 's': sz})
    for s in out_sites:
        for l in s['lists']:
            ld = unquote(l['legacy'][len(BASE):]).strip('/').lower()
            for r in l['rows']:
                if r.get('id'):
                    r['f'] = att.get((ld, r['id']), [])
            if l['kind'] == 'library':
                pre = ld + '/'
                l['files'] = [dict(x, p=x['p'][len(pre):]) for x in libfiles if x['p'].lower().startswith(pre)]

    data = {'sites': out_sites, 'phones': phones, 'people': people, 'newsMain': news_main, 'events': events, 'files': files}
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'intranet.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    print('weby:', len(out_sites))
    for s in out_sites:
        print(' ', s['title'], [(l['title'], len(l['rows'])) for l in s['lists']])
    print('telefony:', {k: len(v) for k, v in phones.items()}, 'lidé:', len(people), 'oznámení root:', len(news_main), 'soubory:', len(files))


if __name__ == '__main__':
    main()
