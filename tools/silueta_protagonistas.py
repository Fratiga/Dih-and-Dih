"""Genera assets/protagonistas/_silueta.png: sprite provisional de 32x48 px, fondo transparente, figura sentada de frente.
Sirve de recurso de prueba hasta que haya pixel art propio; el ancla es el centro de la base (16, 47)."""
import os, struct, zlib
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
W, H = 32, 48
px = [[(0, 0, 0, 0)] * W for _ in range(H)]

CONTORNO = (18, 13, 25, 255)
CAPA = (74, 56, 104, 255)
CAPA_CLARA = (96, 76, 132, 255)
CAPA_SOMBRA = (44, 33, 64, 255)
VACIO = (13, 8, 22, 255)
OJO = (232, 184, 74, 255)


def pon(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[y][x] = c


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            pon(x, y, c)


# Capucha (cabeza): óvalo con punta
for y, (a, b) in enumerate([(13, 18), (11, 20), (10, 21), (9, 22), (9, 22), (9, 22), (9, 22), (9, 22), (10, 21), (10, 21), (11, 20), (12, 19)], start=3):
    rect(a, y, b, y, CAPA)
# Rostro vacío bajo la capucha
rect(12, 8, 19, 13, VACIO)
pon(13, 10, OJO); pon(18, 10, OJO)
# Hombros y torso (sentado: se ven hasta la cintura y algo de rodillas)
for y, (a, b) in enumerate([(9, 22), (7, 24), (6, 25), (5, 26), (5, 26), (5, 26), (5, 26), (6, 25), (6, 25), (6, 25), (6, 25), (6, 25), (6, 25), (6, 25), (6, 25)], start=15):
    rect(a, y, b, y, CAPA)
# Brazos cruzados sobre la mesa
rect(8, 27, 23, 29, CAPA_CLARA)
rect(8, 29, 23, 29, CAPA_SOMBRA)
# Piernas y base
rect(7, 31, 24, 38, CAPA)
rect(7, 38, 24, 38, CAPA_SOMBRA)
rect(6, 39, 12, 47, CAPA); rect(19, 39, 25, 47, CAPA)
rect(6, 45, 12, 47, CAPA_SOMBRA); rect(19, 45, 25, 47, CAPA_SOMBRA)
# Luz en el lado izquierdo de la capucha y los hombros
for y in range(4, 12):
    pon(10 if y > 5 else 12, y, CAPA_CLARA)
for y in range(16, 27):
    pon(6, y, CAPA_CLARA)

# Contorno: cualquier píxel opaco con un vecino transparente (u otro borde) se oscurece por fuera
lleno = [[px[y][x][3] > 0 for x in range(W)] for y in range(H)]
for y in range(H):
    for x in range(W):
        if lleno[y][x]:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and lleno[ny][nx]:
                px[y][x] = CONTORNO
                break


def png(ruta):
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in fila) for fila in px)
    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    out = b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)) + trozo(b"IDAT", zlib.compress(raw, 9)) + trozo(b"IEND", b"")
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    open(ruta, "wb").write(out)


png("assets/protagonistas/_silueta.png")
print("ok", os.path.getsize("assets/protagonistas/_silueta.png"), "bytes")
