"""
Baixa os atributos oficiais das criaturas da wiki de Creatures of Sonaria
(Module:CreatureData/data) e gera js/creatures-data.js.

Uso:  python scripts/atualizar_dados.py
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

API = ("https://creatures-of-sonaria-official.fandom.com/api.php?action=query&prop=revisions"
       "&rvprop=content&rvslots=main&titles=Module:CreatureData/data&format=json&formatversion=2")
OUT = Path(__file__).resolve().parent.parent / "js" / "creatures-data.js"


def fetch_lua():
    req = urllib.request.Request(API, headers={"User-Agent": "Mozilla/5.0 (sonaria-battle-sim)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read().decode("utf-8", errors="replace"))
    return data["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]


BASE = "https://creatures-of-sonaria-official.fandom.com/api.php?format=json&formatversion=2&"


def api(params):
    url = BASE + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (sonaria-battle-sim)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))


def fetch_images(names, size=400):
    """Imagem principal da página de cada criatura; se não houver página, tenta File:<Nome>_MALE-STOCK.png"""
    imgs = {}
    for i in range(0, len(names), 50):
        batch = names[i:i + 50]
        d = api({"action": "query", "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": size,
                 "redirects": 1, "titles": "|".join(batch)})
        q = d.get("query", {})
        # mapeia título final -> nome original (redirecionamentos/normalização)
        back = {n: n for n in batch}
        for key in ("normalized", "redirects"):
            for x in q.get(key, []):
                back[x["to"]] = back.get(x["from"], x["from"])
        for p in q.get("pages", []):
            if "thumbnail" in p:
                imgs[back.get(p["title"], p["title"])] = p["thumbnail"]["source"]
    missing = [n for n in names if n not in imgs]
    for i in range(0, len(missing), 50):
        batch = missing[i:i + 50]
        files = {f"File:{n.replace(' ', '_')}_MALE-STOCK.png": n for n in batch}
        d = api({"action": "query", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": size, "titles": "|".join(files)})
        q = d.get("query", {})
        back = dict(files)
        for x in q.get("normalized", []):
            back[x["to"]] = files.get(x["from"])
        for p in q.get("pages", []):
            info = (p.get("imageinfo") or [{}])[0]
            if info.get("thumburl") and back.get(p["title"]):
                imgs[back[p["title"]]] = info["thumburl"]
    return imgs


def fetch_plushies(size=160):
    """Nome, raridade e imagem de cada pelúcia (página Plushies da wiki)."""
    d = api({"action": "parse", "page": "Plushies", "prop": "wikitext"})
    text = re.sub(r"<!--.*?-->", "", d["parse"]["wikitext"], flags=re.S)
    plush = {}
    for row in re.split(r"\n\|-", text):
        m = re.search(r"<h3>\s*(.*?)\s*</h3>", row)
        if not m:
            continue
        f = re.search(r"\[\[File:([^|\]]+)", row)
        r = re.search(r"\{\{cl\|(\w+)\}\}", row)
        plush[m.group(1)] = {"file": f.group(1).strip() if f else "", "rarity": r.group(1) if r else ""}
    files = {f"File:{p['file']}": n for n, p in plush.items() if p["file"]}
    keys = list(files)
    for i in range(0, len(keys), 50):
        d = api({"action": "query", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": size, "titles": "|".join(keys[i:i + 50])})
        q = d.get("query", {})
        back = dict(files)
        for x in q.get("normalized", []):
            back[x["to"]] = files.get(x["from"])
        for p in q.get("pages", []):
            info = (p.get("imageinfo") or [{}])[0]
            if info.get("thumburl") and back.get(p["title"]):
                plush[back[p["title"]]]["img"] = info["thumburl"]
    return {n: {"rarity": p["rarity"], "img": p.get("img", "")} for n, p in plush.items()}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_passives(text):
    """'Bleed Attack (2), Block Burn (0.45), Pack Healer' -> {'Bleed Attack': 2, 'Block Burn': 0.45, 'Pack Healer': True}"""
    out = {}
    for part in re.split(r",\s*(?![^()]*\))", text or ""):
        part = part.strip()
        if not part or part == "N/A":
            continue
        m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", part)
        if m:
            name, val = m.group(1).strip(), m.group(2).strip()
            n = num(val)
            out[name] = n if n is not None else val
        else:
            out[part] = True
    return out


def parse(lua):
    # Somente criaturas lançadas (p.creatureStats), ignorando p.unreleasedStats
    released = re.split(r"\np\.unreleasedStats\s*=", lua)[0]
    entries = re.findall(r'\["([^"]+)"\]\s*=\s*\{(.*?)\},\s*\n', released, re.S)
    rows = []
    for _, body in entries:
        d = {k: (a if a or not b else b) for k, a, b in
             re.findall(r"\['(\w+)'\]\s*=\s*(?:\"([^\"]*)\"|'([^']*)')", body)}
        hp, dmg, w = num(d.get("health")), num(d.get("damage")), num(d.get("weight"))
        if not (hp and w and dmg is not None):
            continue
        try:
            added = datetime.strptime(d.get("dateAdded", ""), "%m/%d/%Y").strftime("%Y-%m-%d")
        except ValueError:
            added = ""
        rows.append({
            "name": d["common"],
            "tier": int(num(d.get("tier")) or 0),
            "type": d.get("type", ""),
            "diet": d.get("diet", ""),
            "hp": hp, "dmg": dmg, "dmg2": num(d.get("damage2")),
            "weight": w,
            "cd": num(d.get("biteCooldown")) or 1,
            "regen": num(d.get("healthRegen")) or 0,
            "passives": parse_passives(d.get("passive")),
            "actives": [a.strip() for a in (d.get("activated") or "").split(",") if a.strip() and a.strip() != "N/A"],
            "breath": d.get("breath") if d.get("breath") not in (None, "", "N/A") else None,
            "added": added,
            "species": d.get("species") or "",
            "class": d.get("class") or "",
        })
    rows.sort(key=lambda r: r["name"].lower())
    return rows


ROOT = OUT.parent.parent
IMG_HEADERS = {
    # A Fandom só entrega a imagem quando o pedido vem "de dentro" da wiki (Referer)
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Referer": "https://creatures-of-sonaria-official.fandom.com/",
}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def download_images(items, folder):
    """Baixa {nome: url} para img/<folder>/<slug>.webp e devolve {nome: caminho local}.
    Imagens já baixadas são reaproveitadas (apague a pasta para baixar tudo de novo)."""
    dest = ROOT / "img" / folder
    dest.mkdir(parents=True, exist_ok=True)

    def get(item):
        name, url = item
        path = dest / f"{slug(name)}.webp"
        if path.exists() and path.stat().st_size > 0:
            return name, path
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers=IMG_HEADERS)
                with urllib.request.urlopen(req, timeout=60) as r:
                    data, ctype = r.read(), r.headers.get("Content-Type", "")
                if not ctype.startswith("image/"):
                    raise ValueError(ctype)
                if ctype != "image/webp":  # garante WebP mesmo que a Fandom devolva PNG
                    from io import BytesIO
                    from PIL import Image
                    buf = BytesIO()
                    Image.open(BytesIO(data)).save(buf, "WEBP", quality=85)
                    data = buf.getvalue()
                path.write_bytes(data)
                return name, path
            except Exception:
                time.sleep(1 + attempt * 2)
        return name, None

    out = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for name, path in pool.map(get, [(n, u) for n, u in items.items() if u]):
            if path:
                out[name] = path.relative_to(ROOT).as_posix()
    return out


def main():
    lua = fetch_lua()
    rows = parse(lua)
    if len(rows) < 100:
        sys.exit(f"Algo deu errado: só {len(rows)} criaturas lidas.")
    imgs = fetch_images([r["name"] for r in rows])
    local = download_images(imgs, "criaturas")
    for r in rows:
        # usa a cópia local; se o download falhar, cai para o link da wiki
        r["img"] = local.get(r["name"]) or imgs.get(r["name"], "")
    print(f"Imagens: {len(local)}/{len(rows)} baixadas para img/criaturas")
    js = ("// Gerado por scripts/atualizar_dados.py a partir da wiki oficial de Creatures of Sonaria.\n"
          f"// Atualizado em {datetime.now():%Y-%m-%d}. Não edite à mão — rode o script novamente.\n"
          f"const CREATURES_UPDATED = \"{datetime.now():%Y-%m-%d}\";\n"
          "const CREATURES = " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
    OUT.write_text(js, encoding="utf-8")
    print(f"{len(rows)} criaturas salvas em {OUT}")

    plush = fetch_plushies()
    local = download_images({n: p["img"] for n, p in plush.items()}, "pelucias")
    for n, p in plush.items():
        p["img"] = local.get(n) or p["img"]
    print(f"Pelúcias: {len(local)}/{len(plush)} imagens baixadas para img/pelucias")
    out2 = OUT.parent / "plushies-data.js"
    out2.write_text("// Gerado por scripts/atualizar_dados.py (raridade e imagem das pelúcias, wiki oficial).\n"
                    "const PLUSHIE_INFO = " + json.dumps(plush, ensure_ascii=False, separators=(",", ":")) + ";\n",
                    encoding="utf-8")
    print(f"{len(plush)} pelúcias salvas em {out2} ({sum(1 for p in plush.values() if p['img'])} com imagem)")


if __name__ == "__main__":
    main()
