# Optik „DJ-Pult“: schwarz eloxiertes, fein gebürstetes Aluminium (Hintergrund + Platten), nahtlos, deterministisch.
import sys; sys.path.insert(0, '.')
from texlib import *
# Bürstung: stark gestreckte Struktur in x-Richtung + feines Korn
brush = noise(0.9, 41, aniso=(1.0, 0.04)) * 0.9 + noise(1.6, 42) * 0.35 + noise(0.4, 43) * 0.25
mott = blur(noise(1.2, 44), 30)                      # ganz leichte Fleckigkeit der Eloxierung
def make(base, amp, name):
    v = base + brush * amp + mott * amp * 0.6
    col = np.stack([v * 0.97, v * 0.99, v * 1.05], -1)   # leicht kühles Schwarz
    save(col, name, q=78)
make(20, 4.5, '../www/bg-dj.jpg')
make(27, 5.5, '../www/panel-dj.jpg')
