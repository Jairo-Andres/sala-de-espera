# Corta una captura de página completa en trozos para revisarla.
import sys
from PIL import Image
src, out, alto = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1400
im = Image.open(src)
for i, y in enumerate(range(0, im.height, alto)):
    im.crop((0, y, im.width, min(im.height, y + alto))).save(f"{out}-{i:02d}.png")
print(im.size)
