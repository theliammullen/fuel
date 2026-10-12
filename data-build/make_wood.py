"""Generate Fuel's seamless wood-grain textures (offline, deterministic). Output: img/wood-light.jpg, img/wood-dark.jpg
   python3 data-build/make_wood.py   — periodic FFT noise -> warped growth rings + fibres, colour-mapped per species."""
import numpy as np
from PIL import Image
W, H = 512, 256
def pnoise(seed, fx, fy, power=2.2):
    """periodic (seamless) noise; energy concentrated at |kx|<=fx, |ky|<=fy"""
    r = np.random.default_rng(seed)
    kx = np.fft.fftfreq(W) * W; ky = np.fft.fftfreq(H) * H
    KX, KY = np.meshgrid(kx, ky)
    k = np.sqrt((KX / fx) ** 2 + (KY / fy) ** 2) + 1e-6
    amp = 1 / (1 + k ** power)
    ph = np.exp(2j * np.pi * r.random((H, W)))
    n = np.real(np.fft.ifft2(amp * ph))
    return (n - n.mean()) / n.std()
def wood(seed, stops, rings=22, warp=0.9, fibre=0.35):
    y = np.arange(H)[:, None] / H; x = np.arange(W)[None, :] / W
    w1 = pnoise(seed, 1.5, 1.2)          # slow drift of the rings across the board
    w2 = pnoise(seed + 1, 4, 6)          # gentle waviness
    ph = rings * y + warp * (0.9 * w1 + 0.25 * w2) / 2.5
    ring = (0.5 + 0.5 * np.sin(2 * np.pi * ph)) ** 3      # thin latewood lines
    fib = pnoise(seed + 2, 3, 90, 1.4)                     # fine straight fibres along the grain
    tone = pnoise(seed + 3, 1, 2)                          # broad colour variation
    t = np.clip(0.38 + 0.42 * ring + fibre * 0.22 * fib + 0.06 * tone, 0, 1)
    cs = np.array(stops, float)
    pos = np.linspace(0, 1, len(cs))
    img = np.stack([np.interp(t, pos, cs[:, i]) for i in range(3)], -1)
    return Image.fromarray(np.clip(img, 0, 255).astype('uint8'))
hexs = lambda *h: [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in h]
# pale white oak / maple
light = wood(7, hexs('#e9d9bd', '#dcc6a0', '#c9ab7e', '#b28f62'), rings=18, warp=1.0, fibre=0.35)
# walnut / smoked oak
dark = wood(11, hexs('#5a3d27', '#4a3020', '#36231a', '#241712'), rings=22, warp=0.9, fibre=0.4)
for im, n in [(light, 'wood-light'), (dark, 'wood-dark')]:
    im.save(f'img/{n}.jpg', quality=62, optimize=True, progressive=True, subsampling=2)
    a = np.asarray(im.convert('RGB')).astype(float) / 255
    lin = np.where(a <= 0.03928, a / 12.92, ((a + 0.055) / 1.055) ** 2.4); L = lin @ [0.2126, 0.7152, 0.0722]
    print(n, 'luminance p1/p50/p99', *np.percentile(L, [1, 50, 99]).round(4))
