# GPT 原圖（work/gen/*.png）→ 遊戲用 art/*.webp
# 房間縮成 900×600；怪物、圖示去洋紅底；4×4 圖示表切成每格 128 的圖集；粉筆標題黑底轉透明
# 用法：python3 tools/convert.py（缺的原圖會跳過）
import os, sys
from PIL import Image, ImageFilter, ImageChops

os.chdir(os.path.join(os.path.dirname(__file__), '..'))
G, A = 'work/gen', 'art'

def key_magenta(im):
    r, g, b = im.convert('RGB').split()
    # 越接近洋紅越透明：洋紅是 r、b 高、g 低
    mag = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = mag.point(lambda v: max(0, min(255, round((150 - v) / 70 * 255))))
    # 去掉邊緣的洋紅反光
    spill = mag.point(lambda v: max(0, round((v - 40) * 0.6)))
    img = Image.merge('RGBA', (ImageChops.subtract(r, spill), g, ImageChops.subtract(b, spill), alpha))
    # alpha 收一點邊，避免一圈粉紅
    img.putalpha(alpha.filter(ImageFilter.MinFilter(3)))
    return img

def crop(img, pad=4):
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bb: return img
    x0, y0, x1, y1 = bb
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))

def fit(img, size):
    s = min(size / img.width, size / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)

def have(n): return os.path.exists(f'{G}/{n}.png')

for n in ['class', 'lab', 'library', 'nurse', 'music', 'gym', 'office', 'hall', 'roof']:
    if not have(f'room-{n}'): print('skip room', n); continue
    Image.open(f'{G}/room-{n}.png').convert('RGB').resize((900, 600), Image.LANCZOS).save(f'{A}/room-{n}.webp', quality=82)
if have('sky'):
    Image.open(f'{G}/sky.png').convert('RGB').resize((720, 1080), Image.LANCZOS).save(f'{A}/sky.webp', quality=80)

for n in ['pumpkin', 'ghost', 'bat', 'mummy', 'boss']:
    if not have(f'm-{n}'): print('skip mon', n); continue
    img = crop(key_magenta(Image.open(f'{G}/m-{n}.png')))
    fit(img, 400 if n == 'boss' else 200).save(f'{A}/m-{n}.webp', quality=88)

# 圖示表：4×4，每格切出來去背、置中放進 128 的格子
for n in ['items', 'skills']:
    if not have(n): continue
    src = key_magenta(Image.open(f'{G}/{n}.png'))
    cw, ch = src.width / 4, src.height / 4
    atlas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    for i in range(16):
        cx, cy = i % 4, i // 4
        cell = crop(src.crop((round(cx * cw) + 14, round(cy * ch) + 14, round((cx + 1) * cw) - 14, round((cy + 1) * ch) - 14)))
        cell = fit(cell, 120)
        atlas.paste(cell, (cx * 128 + (128 - cell.width) // 2, cy * 128 + (128 - cell.height) // 2), cell)
    atlas.save(f'{A}/{n}.webp', quality=90)

if have('logo'):
    src = Image.open(f'{G}/logo.png').convert('RGB')
    r, g, b = src.split()
    lum = ImageChops.lighter(ImageChops.lighter(r, g), b)
    src.putalpha(lum.point(lambda v: max(0, min(255, round((v - 40) / 120 * 255)))))
    fit(crop(src, 10), 1000).save(f'{A}/logo.webp', quality=88)
print('done')
