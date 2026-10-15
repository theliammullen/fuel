# Phone-photo-like variants of the clean renders: rotation (small/90/180), blur, perspective + uneven light + noise + JPEG.
import json, random, numpy as np
from PIL import Image, ImageFilter, ImageDraw
D = 'test/ocr/'; T = json.load(open(D + 'truth.json')); random.seed(7); np.random.seed(7)
ids = sorted(k for k in T if '-' in k and T[k].get('variant') is None)
def on_bg(im, pad=80, col=(196, 120, 60)):
    bg = Image.new('RGB', (im.width + 2 * pad, im.height + 2 * pad), col); bg.paste(im, (pad, pad)); return bg
def photo(im):
    im = on_bg(im.convert('RGB'), 120, random.choice([(40, 90, 160), (200, 60, 40), (230, 200, 60), (60, 140, 80)]))
    w, h = im.size; d = 0.06
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(w*random.uniform(0, d), h*random.uniform(0, d)), (w*(1-random.uniform(0, d)), h*random.uniform(0, d)), (w*(1-random.uniform(0, d)), h*(1-random.uniform(0, d))), (w*random.uniform(0, d), h*(1-random.uniform(0, d)))]
    A = []; B = []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u*x, -u*y], [0, 0, 0, x, y, 1, -v*x, -v*y]]; B += [u, v]
    coef = np.linalg.solve(np.array(A), np.array(B))
    im = im.transform((w, h), Image.PERSPECTIVE, coef, Image.BICUBIC, fillcolor=(30, 30, 30))
    im = im.rotate(random.uniform(-6, 6), Image.BICUBIC, expand=True, fillcolor=(30, 30, 30))
    a = np.asarray(im).astype(np.float32)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    light = 0.62 + 0.38 * (xx / a.shape[1] * 0.6 + yy / a.shape[0] * 0.4)            # shadow gradient
    a = a * light[..., None] * np.array([1.0, 0.97, 0.9]) + np.random.normal(0, 7, a.shape)  # warm cast + sensor noise
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
    s = 1400 / max(im.size); im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    return im
V = {}
for i, k in enumerate(ids):
    im = Image.open(D + 'img/' + k + '.png').convert('RGB')
    if i % 2 == 0: V[k + '~rot5'] = on_bg(im, 60, (235, 235, 235)).rotate(5, Image.BICUBIC, expand=True, fillcolor=(235, 235, 235))
    if i % 4 == 1: V[k + '~rot90'] = im.rotate(90, expand=True)
    if i % 4 == 3: V[k + '~rot180'] = im.rotate(180, expand=True)
    if i % 3 == 0: V[k + '~blur'] = im.resize((im.width // 2, im.height // 2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.1))
    V[k + '~photo'] = photo(im)
for k, im in V.items():
    ext = '.jpg' if 'photo' in k else '.png'
    im.save(D + 'img/' + k + ext, quality=62) if ext == '.jpg' else im.save(D + 'img/' + k + ext)
    base = k.split('~')[0]; T[k] = dict(T[base], variant=k.split('~')[1], file=k + ext)
for k in ids: T[k]['file'] = k + '.png'; T[k]['variant'] = 'clean'
json.dump(T, open(D + 'truth.json', 'w'), indent=1)
from collections import Counter; print(len(T), Counter(v['variant'] for v in T.values()))
