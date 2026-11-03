"""Generate touch-only assets; original desktop files are never overwritten."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COLORS = ['COASTAL SAND', 'TOBACCO', 'CHARWOOD', 'HEMLOCK', 'FAWN', 'HEARTWOOD', 'HICKORY', 'IRONWOOD', 'MAHOGANY']
PROFILES = ['', 'RANDOM PLANK', 'CHANNEL SIDING', 'FOLDED WALL', 'VARIABLE WALL', 'NEO LUMBER', 'BOARD + BATTEN']
jobs = []
for folder in ('Scroll_01-mobile', 'Scroll_01_fast'):
    for path in sorted((ROOT / folder).glob('*.jpg')):
        jobs.append((path, Path('mobile') / path.relative_to(ROOT).with_suffix('.webp'), None, 86))
for folder in PROFILES:
    for color in COLORS:
        path = ROOT / folder / (color + ('.png' if folder == 'NEO LUMBER' else '.jpg'))
        jobs.append((path, Path('mobile') / path.relative_to(ROOT).with_suffix('.webp'), (2250, 435), 88))
jobs.extend([
    (ROOT / 'soffit vents.png', Path('mobile/soffit vents.webp'), (2250, 435), 90),
    (ROOT / 'hold-extended.jpg', Path('mobile/hold-extended.webp'), (3840, 2160), 86),
    (ROOT / '360-mobile.jpg', Path('mobile/360.webp'), None, 86),
])
for path in sorted((ROOT / 'Thumb').glob('*.png')):
    jobs.append((path, Path('mobile') / path.relative_to(ROOT).with_suffix('.webp'), (300, 388), 88))
for name in ['coastal sand', 'Tobacco', 'Charwood', 'HEMLOCK', 'FAWN', 'HEARTWOOD', 'HICKORY', 'IRONWOOD', 'MAHOGANY']:
    path = ROOT / 'Mood' / (name + '.jpg')
    jobs.append((path, Path('mobile') / path.relative_to(ROOT), (1280, 720), 86))

def convert(job):
    path, rel, size, quality = job
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(path) as image:
        profile = image.info.get('icc_profile', b'')
        if size: image = image.resize(size, Image.Resampling.LANCZOS)
        if out.suffix == '.webp':
            image.save(out, quality=quality, method=6, exact=True, icc_profile=profile)
        else:
            image.convert('RGB').save(out, quality=quality, optimize=True, progressive=True, icc_profile=profile)
        dims = image.size
    return {'source': str(path.relative_to(ROOT)), 'path': str(rel), 'before': path.stat().st_size, 'after': out.stat().st_size, 'width': dims[0], 'height': dims[1]}

with ThreadPoolExecutor(max_workers=4) as pool:
    rows = list(pool.map(convert, jobs))
print('Images complete:', len(rows), flush=True)
for name in ['coastal sand', 'Tobacco', 'Charwood', 'HEMLOCK', 'FAWN', 'HEARTWOOD', 'HICKORY', 'IRONWOOD', 'MAHOGANY']:
    path = ROOT / 'Mood' / (name + '.mp4')
    out = ROOT / 'mobile' / 'Mood' / path.name
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(path), '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '1800k', '-bufsize', '3600k', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'copy', '-movflags', '+faststart', str(out)], check=True)
    rows.append({'source':str(path.relative_to(ROOT)), 'path':str(out.relative_to(ROOT)), 'before':path.stat().st_size, 'after':out.stat().st_size, 'width':1280, 'height':720})
    print('Video complete:', name, flush=True)
(ROOT / 'mobile/manifest.json').write_text(json.dumps(rows, indent=2) + '\n')
print(json.dumps({'files':len(rows), 'before':sum(r['before'] for r in rows), 'after':sum(r['after'] for r in rows)}), flush=True)
