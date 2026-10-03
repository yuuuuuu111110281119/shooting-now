from pathlib import Path
import json, re, shutil, sys, unicodedata
BASE=Path(__file__).resolve().parent
CONFIG=BASE/"oshimap_config.json"; OUTPUT=BASE/"shooting_history.json"; WEB_IMAGES=BASE/"shooting_images"
IMAGE_EXTS={".jpg",".jpeg",".png",".webp"}
def load_root():
    with CONFIG.open("r",encoding="utf-8-sig") as f: cfg=json.load(f)
    return Path(cfg["models_root"])
def fullwidth_kana(text):
    return re.sub(r'[｡-ﾟ]+', lambda m: unicodedata.normalize('NFKC', m.group(0)), text)
def clean_name(raw): return fullwidth_kana(re.sub(r'^[★○]+\s*','',raw).strip())
def parse_shoot_folder(name):
    m=re.match(r'^(\d{4})(\d{2})(\d{2})(?:[_\-\s]+)?(.*)$',name)
    if not m:return None,name
    y,mo,d,title=m.groups(); return f"{y}-{mo}-{d}",fullwidth_kana(title.strip(" _-") or name)
def safe_slug(t): return re.sub(r'[<>:"/\\|?*]+','_',t).strip().strip(".") or "model"
def map_images(d):
    out=[]
    for n in range(1,5):
        xs=[p for p in d.iterdir() if p.is_file() and p.stem.lower()==f"map_{n}" and p.suffix.lower() in IMAGE_EXTS]
        if xs: out.append(sorted(xs,key=lambda p:p.name.lower())[0])
    return out
def main():
    root=load_root()
    if not root.is_dir(): raise FileNotFoundError(root)
    if WEB_IMAGES.exists(): shutil.rmtree(WEB_IMAGES)
    WEB_IMAGES.mkdir(parents=True,exist_ok=True)
    models=[]
    for md in sorted((p for p in root.iterdir() if p.is_dir()),key=lambda p:clean_name(p.name).casefold()):
        name=clean_name(md.name)
        if not name: continue
        shoots=[]
        for sd in sorted((p for p in md.iterdir() if p.is_dir()),key=lambda p:p.name,reverse=True):
            date,event=parse_shoot_folder(sd.name); images=[]
            fs=map_images(sd)
            if fs:
                destdir=WEB_IMAGES/safe_slug(name)/safe_slug(sd.name); destdir.mkdir(parents=True,exist_ok=True)
                for src in fs:
                    dest=destdir/src.name; shutil.copy2(src,dest); images.append(dest.relative_to(BASE).as_posix())
            shoots.append({"folder":sd.name,"date":date,"event":event,"images":images})
        dates=[x["date"] for x in shoots if x["date"]]
        models.append({"name":name,"source_folder":md.name,"shoot_count":len(shoots),"last_shoot":max(dates) if dates else None,"shoots":shoots})
    OUTPUT.write_text(json.dumps({"model_count":len(models),"models":models},ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Models: {len(models)}")
    print(f"Output: {OUTPUT}")
if __name__=="__main__":
    try: main()
    except Exception as e: print("ERROR:",e); sys.exit(1)
