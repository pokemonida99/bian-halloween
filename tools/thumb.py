# 分享縮圖合成：GPT 主視覺（work/thumb/thumb-h.png、thumb-v.png）＋程式疊標題字
# 輸出 og-landscape.jpg（1200×630，連結預覽用）、og-portrait.jpg（1080×1920，直式分享用）
# 字型：霞鶩文楷 TC Bold（work/thumb/wenkai-bold.ttf，從 Google Fonts 下載，不進 git）
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.chdir(os.path.join(os.path.dirname(__file__), '..'))
T = 'work/thumb'
FONT = f'{T}/wenkai-bold.ttf'
logo = Image.open('art/logo.webp').convert('RGBA')
paper = Image.open('art/ui-paper.webp').convert('RGB')

def font(s): return ImageFont.truetype(FONT, s)

def text(img, s, xy, size, fill, anchor='la', stroke=None):
    d = ImageDraw.Draw(img)
    d.text(xy, s, font=font(size), fill=fill, anchor=anchor, stroke_width=stroke or max(3, size // 9), stroke_fill=(12, 9, 6))

def shade(img, box, fr, to, horizontal=True):
    # 漸層壓暗：fr→to 是 alpha（0～255）
    x0, y0, x1, y1 = box
    n = (x1 - x0) if horizontal else (y1 - y0)
    g = Image.new('L', (n, 1) if horizontal else (1, n))
    g.putdata([int(fr + (to - fr) * i / max(1, n - 1)) for i in range(n)])
    g = g.resize((x1 - x0, y1 - y0))
    dark = Image.new('RGBA', (x1 - x0, y1 - y0), (8, 10, 22, 255)); dark.putalpha(g)
    img.alpha_composite(dark, (x0, y0))

def tag(img, s, xy, size):
    # 「山頂國小」作業簿紙小標籤（跟遊戲標題畫面一樣）
    f = font(size); w = int(f.getlength(s) + size * 0.9); h = int(size * 1.5)
    t = Image.new('RGBA', (w, h)); t.paste(paper.crop((0, 0, w, h)), (0, 0))
    ImageDraw.Draw(t).text((size * 0.45, h / 2), s, font=f, fill=(58, 53, 48), anchor='lm')
    t = t.rotate(3, expand=True, resample=Image.BICUBIC)
    sh = Image.new('RGBA', t.size, (0, 0, 0, 0)); sh.putalpha(t.getchannel('A').point(lambda v: v * 0.45))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)), (xy[0] + 3, xy[1] + 6)); img.alpha_composite(t, xy)

def put_logo(img, x, y, w):
    l = logo.resize((w, int(logo.height * w / logo.width)), Image.LANCZOS)
    glow = Image.new('RGBA', l.size, (0, 0, 0, 0)); glow.putalpha(l.getchannel('A'))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8)), (x + 2, y + 6))
    img.alpha_composite(l, (x, y))
    return l.height

# ---------- 橫板 1200×630 ----------
src = Image.open(f'{T}/thumb-h.png').convert('RGBA')
W, H = 1200, 630
s = W / src.width; h = int(src.height * s)
img = src.resize((W, h), Image.LANCZOS)
top = int((h - H) * float(os.environ.get('HY', 0.12)))   # 往上留多一點（針筒超人的針頭不要被切）
img = img.crop((0, top, W, top + H))
shade(img, (0, 0, 760, H), 225, 0)
tag(img, '山頂國小', (44, 34), 30)
lh = put_logo(img, 30, 96, 620)
text(img, '萬聖節校舍生存小遊戲', (50, 96 + lh + 22), 46, (244, 240, 227))
text(img, '手機免費玩・不用下載', (52, 96 + lh + 88), 34, (242, 212, 107))
img.convert('RGB').save('og-landscape.jpg', quality=88)

# ---------- 直板 1080×1920 ----------
src = Image.open(f'{T}/thumb-v.png').convert('RGBA')
W, H = 1080, 1920
s = W / src.width; h = int(src.height * s)
body = src.resize((W, h), Image.LANCZOS)
img = Image.new('RGBA', (W, H))
ext = H - h
if ext > 0:
    # 上面不夠高：用原圖左上角的夜空顏色補滿（不拉長原圖，月亮才不會被拉成一條光）
    px = body.crop((0, 0, 300, 30)).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
    img.alpha_composite(Image.new('RGBA', (W, ext + 120), px + (255,)), (0, 0))
    for _ in range(260):   # 一點點星星
        import random; x, y = random.randrange(W), random.randrange(ext); a = random.randrange(80, 220)
        img.putpixel((x, y), (255, 250, 230, 255)) if a > 200 else img.alpha_composite(Image.new('RGBA', (2, 2), (255, 250, 230, a)), (x, y))
    m = Image.new('L', (1, 120)); m.putdata([int(255 * i / 119) for i in range(120)]); m = m.resize((W, 120))
    head = body.crop((0, 0, W, 120)); head.putalpha(m)
    img.alpha_composite(body.crop((0, 120, W, h)), (0, ext + 120)); img.alpha_composite(head, (0, ext))
else:
    img.alpha_composite(body.crop((0, -ext, W, -ext + H)))
shade(img, (0, 0, W, 760), 200, 0, horizontal=False)
shade(img, (0, H - 380, W, H), 0, 220, horizontal=False)
tag(img, '山頂國小', (64, 110), 44)
lh = put_logo(img, 60, 220, 960)
text(img, '萬聖節校舍生存小遊戲', (W // 2, 220 + lh + 60), 66, (244, 240, 227), 'mm')
text(img, '手機免費玩・不用下載', (W // 2, H - 210), 60, (242, 212, 107), 'mm')
text(img, 'pokemonida99.github.io/bian-halloween', (W // 2, H - 120), 34, (244, 240, 227), 'mm')
img.convert('RGB').save('og-portrait.jpg', quality=88)
print('ok')
