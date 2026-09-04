"""
Icon-Generator fuer Rudermesser App
"""
from PIL import Image, ImageDraw
import os

OUTPUT_DIR = r'E:\EDGE TX Eachine TX16s\ESP32 Bluetooth\Rudder Messen\webapp'

def draw_icon(size):
    img = Image.new('RGBA', (size, size), (13, 17, 23, 255))
    d = ImageDraw.Draw(img)
    s = size

    # Hintergrund-Kreis
    margin = int(s * 0.05)
    d.ellipse([margin, margin, s-margin, s-margin], fill=(22, 27, 34, 255))

    cx = s // 2
    cy = s // 2

    # Flosse (grau, links)
    fw = int(s * 0.28)
    fh = int(s * 0.14)
    fy = cy - fh // 2
    d.rounded_rectangle([int(s*0.18), fy, int(s*0.18)+fw, fy+fh],
                         radius=int(s*0.03), fill=(48, 54, 61, 255))

    # Ruderblatt (blau, rechts, leicht geneigt = Ausschlag)
    rw = int(s * 0.32)
    rh = int(s * 0.14)
    pts = [
        (cx,      cy - rh // 2),
        (cx + rw, cy - int(rh * 0.8)),
        (cx + rw, cy - int(rh * 0.8) + rh),
        (cx,      cy + rh // 2),
    ]
    d.polygon(pts, fill=(88, 166, 255, 255))

    # Winkel-Bogen (gelb)
    arc_r = int(s * 0.18)
    d.arc([cx - arc_r, cy - arc_r, cx + arc_r, cy + arc_r],
          start=-20, end=0, fill=(210, 153, 34, 255), width=max(2, int(s * 0.025)))

    # Scharnierachse (weisser Punkt in der Mitte)
    r = int(s * 0.05)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(230, 237, 243, 255))
    d.ellipse([cx - r//2, cy - r//2, cx + r//2, cy + r//2], fill=(13, 17, 23, 255))

    return img

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    img = draw_icon(size)
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path, 'PNG')
    print(f'OK: {name} ({size}x{size})')

print('Fertig!')
