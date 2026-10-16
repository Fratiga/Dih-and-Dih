"""Genera los PNG provisionales de las criaturas de los corrales: assets/criaturas/<id de la carta>.png (32 x 32, fondo transparente,
mirando a la derecha, con los pies en la base) y assets/criaturas/generica.png. Cada habitat tiene su silueta (ave, cuadrupedo, roedor, rana,
mamut, dragon) y cada especie su color. Son recursos de prueba: se sustituyen por el pixel art propio con el mismo nombre de archivo.
Uso: python tools/criaturas_placeholder.py"""
import colorsys, os, struct, zlib

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SALIDA = os.path.join(RAIZ, "assets", "criaturas")
N = 32
CONTORNO = (20, 16, 28, 255)

# Las especies que traen hoy los corrales (docs/economia-18_crianza.sql) y su habitat
ESPECIES = {
    "aviario": ["cuervo-del-augurio", "halcon-linire", "manta-del-cielo", "guiverno", "zraith"],
    "bosque": ["colmillo-gris", "lobo", "perro-sabio", "felino-veloz-mistico", "guillotina"],
    "madriguera": ["rata", "kobold"],
    "pantano": ["sapo-beluto", "hidra", "kraken"],
    "glaciar": ["mamut-gelido"],
    "cubil": ["cocatriz", "dragarto", "protodraco", "draco"],
}
FORMA = {"aviario": "ave", "bosque": "cuadrupedo", "madriguera": "roedor", "pantano": "rana", "glaciar": "mamut", "cubil": "dragon"}


def color(id_, claro=0.0):
    h = (sum(ord(c) * (i + 3) for i, c in enumerate(id_)) % 360) / 360.0
    r, g, b = colorsys.hls_to_rgb(h, 0.42 + claro, 0.45)
    return (int(r * 255), int(g * 255), int(b * 255), 255)


class Lienzo:
    def __init__(self):
        self.px = [[(0, 0, 0, 0)] * N for _ in range(N)]

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < N and 0 <= yy < N:
                    self.px[yy][xx] = c

    def contorno(self):
        lleno = [[self.px[y][x][3] > 0 for x in range(N)] for y in range(N)]
        for y in range(N):
            for x in range(N):
                if lleno[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and 0 <= ny < N and lleno[ny][nx]:
                        self.px[y][x] = CONTORNO
                        break


def ojo(l, x, y):
    l.rect(x, y, 2, 2, (255, 255, 255, 255))
    l.rect(x + 1, y + 1, 1, 1, (20, 16, 28, 255))


def ave(l, c, s, k):
    l.rect(3, 14, 6, 3, s); l.rect(8, 12, 14, 10, c); l.rect(9, 18, 12, 4, k); l.rect(10, 13, 9, 6, s)
    l.rect(20, 8, 8, 8, c); l.rect(28, 11, 3, 3, (230, 184, 74, 255)); l.rect(13, 22, 2, 6, (230, 184, 74, 255)); l.rect(17, 22, 2, 6, (230, 184, 74, 255)); ojo(l, 24, 10)


def cuadrupedo(l, c, s, k):
    l.rect(3, 12, 5, 3, s); l.rect(6, 12, 18, 10, c); l.rect(6, 19, 18, 3, k); l.rect(22, 8, 8, 8, c); l.rect(29, 11, 2, 3, k)
    l.rect(23, 5, 2, 3, s); l.rect(27, 5, 2, 3, s)
    for x in (7, 12, 18, 22):
        l.rect(x, 22, 3, 7, s)
    ojo(l, 26, 9)


def roedor(l, c, s, k):
    l.rect(2, 22, 7, 1, s); l.rect(1, 21, 2, 1, s); l.rect(8, 16, 14, 9, c); l.rect(9, 22, 12, 3, k); l.rect(20, 14, 8, 8, c); l.rect(28, 18, 2, 2, s)
    l.rect(21, 11, 3, 4, s); l.rect(25, 11, 3, 4, s); l.rect(10, 25, 3, 3, s); l.rect(18, 25, 3, 3, s); ojo(l, 24, 16)


def rana(l, c, s, k):
    l.rect(6, 14, 20, 11, c); l.rect(8, 21, 16, 4, k); l.rect(18, 10, 10, 8, c); l.rect(20, 7, 4, 4, c); l.rect(25, 7, 4, 4, c)
    l.rect(21, 8, 2, 2, (255, 255, 255, 255)); l.rect(26, 8, 2, 2, (255, 255, 255, 255)); l.rect(22, 9, 1, 1, CONTORNO); l.rect(27, 9, 1, 1, CONTORNO)
    l.rect(5, 22, 6, 6, s); l.rect(3, 26, 8, 3, s); l.rect(20, 24, 3, 5, s); l.rect(19, 15, 9, 1, s)


def mamut(l, c, s, k):
    l.rect(4, 8, 24, 16, c); l.rect(4, 8, 24, 3, k); l.rect(22, 10, 8, 12, c); l.rect(20, 10, 4, 8, k)
    l.rect(28, 16, 3, 9, s); l.rect(27, 24, 3, 3, s); l.rect(26, 20, 5, 2, (240, 240, 230, 255))
    for x in (6, 12, 18, 23):
        l.rect(x, 24, 4, 6, s)
    for x in (7, 12, 17):
        l.rect(x, 13, 1, 6, s)
    ojo(l, 25, 12)


def dragon(l, c, s, k):
    l.rect(1, 17, 8, 3, c); l.rect(0, 19, 3, 2, c); l.rect(8, 13, 15, 9, c); l.rect(9, 19, 13, 3, k); l.rect(20, 8, 5, 7, c)
    l.rect(23, 6, 8, 6, c); l.rect(30, 8, 2, 3, k); l.rect(24, 3, 2, 3, s); l.rect(27, 3, 2, 3, s)
    l.rect(9, 5, 8, 3, k); l.rect(11, 8, 6, 3, k); l.rect(13, 11, 4, 3, k)
    l.rect(10, 22, 3, 6, s); l.rect(18, 22, 3, 6, s); ojo(l, 27, 7)


FORMAS = {"ave": ave, "cuadrupedo": cuadrupedo, "roedor": roedor, "rana": rana, "mamut": mamut, "dragon": dragon}


def escribir(ruta, lienzo):
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in fila) for fila in lienzo.px)

    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(raw, 9)) + trozo(b"IEND", b"")
    open(ruta, "wb").write(out)


def hacer(id_, forma, base):
    l = Lienzo()
    c, s, k = base, tuple(max(0, v - 45) for v in base[:3]) + (255,), tuple(min(255, v + 40) for v in base[:3]) + (255,)
    FORMAS[forma](l, c, s, k)
    l.contorno()
    escribir(os.path.join(SALIDA, f"{id_}.png"), l)


os.makedirs(SALIDA, exist_ok=True)
total = 0
for habitat, ids in ESPECIES.items():
    for id_ in ids:
        hacer(id_, FORMA[habitat], color(id_))
        total += 1
hacer("generica", "cuadrupedo", (130, 126, 140, 255))
print(f"{total} criaturas y la genérica en {SALIDA}")
