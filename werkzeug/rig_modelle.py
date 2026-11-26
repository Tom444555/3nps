#!/usr/bin/env python3
"""v162: Gitarren-Modelle aus Toms öffentlichem Lager druckwerk für den Reiter „Rig“ (app/www/rig/modelle/*.glb) erzeugen.

  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/Tom444555/druckwerk /pfad/druckwerk
  pip install --break-system-packages trimesh manifold3d scipy numpy pymeshlab   (pymeshlab braucht libopengl0)
  python3 werkzeug/rig_modelle.py /pfad/druckwerk [--nur schecter|strat] [--arbeit /tmp/rigbau]

Quellen (nur Toms eigene Modelle aus dem öffentlichen druckwerk, nichts aus druckwerk-modelle):
  Schecter: modelle/gitarre_rundum.py (+ gitarre_rundum_daten.json) --laenge 200 --wolken 3 --decke einlage --armschraege 0.25 --kante 3
  Strat:    werkzeug/gitarre_farben.py modelle/quelle/stratocaster_original.stl … 240 --schnur 1 --details 1  (danach auf 200 Einheiten skaliert)
Die Skripte werden NICHT verändert: dieses Werkzeug liest sie, ersetzt für die Anzeige einzelne Druck-Hilfen per Textersatz
(jede Ersetzung muss genau einmal passen, sonst Abbruch) und führt die Kopie aus:
  – Saitenlöcher durch Korpus/Kopfplatte, Kerben in Sattel/Reitern, Kegellöcher für Steckwirbel, Rinne für Lochkugeln: weg
  – Strat: Original-Saiten, Mechanik-Achsen und Saitenniederhalter bleiben (statt Steckwirbel-Ersatz), Steckwirbel-Teile werden nicht gebaut
  – Schecter: Mechaniken nicht plan abgeschnitten (kein Druckbett), Schrauben-Kreuzschlitze bleiben; Saiten als dünne silberne Linien ergänzt
Danach je Farbe ein Netz: vereinfacht (pymeshlab, Quadric Edge Collapse), Normalen mit Knickwinkel, quantisiert (KHR_mesh_quantization) als GLB.
Einheit im Rig: 1 = 5 mm am Original (Gesamtlänge ca. 200), y = 0 am Korpusende, x quer, z nach vorn (Decke).
In scene.extras stehen die Lagen für die Einblendungen (Tonabnehmer, Regler, Schalter, Buchse) in denselben Einheiten.
"""
import argparse, json, math, os, re, struct, subprocess, sys
from pathlib import Path
import numpy as np, trimesh

HIER = Path(__file__).resolve().parent
WIEDER = False
ZIEL = HIER.parent / 'app' / 'www' / 'rig' / 'modelle'


def patch(src, ersatz, ziel):
    t = Path(src).read_text(encoding='utf-8')
    for alt, neu in ersatz:
        n = t.count(alt)
        assert n == 1, f'{Path(src).name}: Stelle {n}× statt 1× gefunden – druckwerk hat sich geändert, Ersetzung prüfen:\n{alt[:120]}'
        t = t.replace(alt, neu)
    Path(ziel).write_text(t, encoding='utf-8'); return ziel


def lauf(cmd, cwd):
    if WIEDER and (Path(cwd) / 'lauf.log').exists() and 'Traceback' not in (Path(cwd) / 'lauf.log').read_text():
        print('vorhanden:', cwd); return (Path(cwd) / 'lauf.log').read_text()
    print('>', ' '.join(map(str, cmd)), flush=True)
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    (Path(cwd) / 'lauf.log').write_text(r.stdout + r.stderr)
    if r.returncode: sys.exit(f'Skript abgebrochen ({r.returncode}):\n{(r.stdout + r.stderr)[-3000:]}')
    return r.stdout


# ---------------------------------------------------------------- Schecter
def schecter(dw, arb):
    arb = arb / 'schecter'; arb.mkdir(parents=True, exist_ok=True)
    src = dw / 'modelle' / 'gitarre_rundum.py'
    kopie = patch(src, [
        ('HIER = Path(__file__).resolve().parent', f'HIER = Path({str(src.parent)!r})'),
        ('    koerper = {n: k - bohr for n, k in koerper.items()}', '    koerper = {n: k - vereint(kreuze) for n, k in koerper.items()}   # Anzeige: keine Saitenlöcher/Kerben'),
        ('    koerper = {n: k - boden for n, k in koerper.items()}', '    pass   # Anzeige: Mechaniken nicht aufs Druckbett abschneiden'),
        ('    teile_k = {"": koerper}', '    teile_k = {"": koerper}\n'
         '    import json as _j; _j.dump({"f": f, "bb": list(bb), "pu": [Y(s) for s in PU], "regler": [list(q) for q in regler], "schalter": [list(map(float, sA)), list(map(float, sB))],'
         ' "buchse": list(map(float, b3)), "T_B": T_B, "ZF": ZF, "zs": zs, "steg": Y(MENSUR + 0.3), "sattel": Y(-2.3), "mech": [list(map(float, m_)) for m_ in mech], "Z_H": Z_H, "Y0": Y(0)},'
         ' open(Path(a.ziel) / "meta.json", "w"))'),
    ], arb / 'gitarre_rundum_anzeige.py')
    lauf([sys.executable, kopie, '--laenge', '200', '--wolken', '3', '--decke', 'einlage', '--armschraege', '0.25', '--kante', '3',
          '--ziel', str(arb), '--name', 'sch'], arb)
    m = json.load(open(arb / 'meta.json')); f, bb = m['f'], m['bb']
    cx = (bb[0] + bb[3]) / 2
    T = lambda x, y, z: [(x - cx) * f, (y - bb[1]) * f, (z - bb[2]) * f]
    teile = {}
    for n in ('grau', 'rot', 'dunkelrot', 'schwarz', 'weiss'):
        p = arb / f'sch_{n}.stl'
        if p.exists(): teile[n] = trimesh.load(p)
    # Saiten (Anzeige): Steg-Auflage → Sattel, Ø ~1 mm am Original
    st = []
    for i in range(6):
        a_ = np.array(T((i - 2.5) * 10.5, m['steg'], m['zs'] + 8.3 + 0.5)); b_ = np.array(T((i - 2.5) * 7.0, m['sattel'], m['ZF'] + 2.6 + 0.5))
        r = (0.55 - i * 0.05) * f
        c = trimesh.creation.cylinder(radius=r, segment=[a_, b_], sections=6); st.append(c)
    teile['saiten'] = trimesh.util.concatenate(st)
    pu = [T(0, y, 0)[1] for y in m['pu']]; px = T(0, 0, 0)[0]
    meta = {'T': 'schecter', 'top': (m['T_B'] - bb[2]) * f,
            'pu': {'N': {'x': px, 'y': pu[0], 'w': 70 * f, 'h': 38 * f, 'coil': [9.6 * f, 68 * f, 18.2 * f], 'z': (m['T_B'] + 5.5 - bb[2]) * f},
                   'B': {'x': px, 'y': pu[1], 'w': 70 * f, 'h': 38 * f, 'coil': [9.6 * f, 68 * f, 18.2 * f], 'z': (m['T_B'] + 6.5 - bb[2]) * f}},
            'knobs': [T(q[0], q[1], m['T_B'] + 19.4)[:2] for q in m['regler']], 'knobZ': (m['T_B'] + 19.4 - bb[2]) * f,
            'sw': T(*((np.array(m['schalter'][0]) + np.array(m['schalter'][1])) / 2), 0)[:2],
            'jack': T(*m['buchse'])[:3], 'bridge': T(0, m['steg'], 0)[1], 'nut': T(0, m['sattel'], 0)[1]}
    return teile, (lambda tm, ziel: tm), meta   # STL liegt schon in Rig-Einheiten


# ---------------------------------------------------------------- Strat
def strat(dw, arb):
    arb = arb / 'strat'; arb.mkdir(parents=True, exist_ok=True)
    src = dw / 'werkzeug' / 'gitarre_farben.py'
    kopie = patch(src, [
        ('    M = M - mf.Manifold.batch_boolean(weg, mf.OpType.Add)\n', '    pass   # Anzeige: Saiten, Mechanik-Achsen und Saitenniederhalter des Originals bleiben\n'),
        ('    M = M + mf.Manifold.batch_boolean(ringe, mf.OpType.Add) - mf.Manifold.batch_boolean(bohr, mf.OpType.Add)\n', '    pass   # Anzeige: keine Saitenlöcher, Rinne, Kegellöcher\n'),
        ('(DECKEL.extrude(1.6) - SCHLITZ)', 'DECKEL.extrude(1.6)'),
        ('    M = M + baum(4, 5, -243.0) + baum(2, 3, -276.0)\n', '    pass   # Anzeige: Original-Niederhalter sind noch da\n'),
        ('if A.schnur:\n    # ================= Steckwirbel', 'if False:\n    # ================= Steckwirbel'),
    ], arb / 'gitarre_farben_anzeige.py')
    out = lauf([sys.executable, kopie, str(dw / 'modelle' / 'quelle' / 'stratocaster_original.stl'), str(arb), '240', '--schnur', '1', '--details', '1'], arb)
    s = float(re.search(r'Maßstab ([0-9.]+)', out).group(1))
    teile = {n: trimesh.load(arb / f'strat_{n}.stl') for n in ('korpus', 'weiss', 'hals', 'metall', 'schwarz') if (arb / f'strat_{n}.stl').exists()}
    k = 200.0 / 240.0
    # Lagen am Original-Netz (gitarre_farben.py: Pole, REG, Schalter) → Druckmaß 240 → Rig-Einheiten; Bezug wie im Skript: c = (-(x0+x1)/2, -y0, -0)
    t0 = trimesh.load(dw / 'modelle' / 'quelle' / 'stratocaster_original.stl'); b = t0.bounds
    R = lambda x, y, z=0: [(x - (b[0][0] + b[1][0]) / 2) * s * k, (y - b[0][1]) * s * k, z * s * k]
    meta = {'T': 'strat', 'top': 44.02 * s * k,
            'pu': {'N': R(51, -830.5)[:2], 'M': R(51, -890.5)[:2], 'B': R(51, -948)[:2]},
            'knobs': [R(x, y)[:2] for x, y in [(107.55, -958.07), (145.94, -979.29), (179.48, -1007.86)]], 'knobZ': 59.6 * s * k}
    return teile, (lambda tm, ziel: tm.apply_scale(k)), meta


# ---------------------------------------------------------------- Netze → GLB
def vereinfachen(tm, ziel):
    """Quadric Edge Collapse aus MeshLab (pymeshlab) – fast_simplification blieb an den Splitter-Dreiecken der Schecter-Netze hängen."""
    import pymeshlab as ml
    tm = trimesh.Trimesh(tm.vertices, tm.faces, process=True); tm.update_faces(tm.nondegenerate_faces()); tm.remove_unreferenced_vertices()
    if len(tm.faces) > ziel:
        ms = ml.MeshSet(); ms.add_mesh(ml.Mesh(np.asarray(tm.vertices, float), np.asarray(tm.faces, np.int32)))
        ms.meshing_decimation_quadric_edge_collapse(targetfacenum=int(ziel), preservenormal=True, planarquadric=True, qualitythr=0.3, preserveboundary=True, optimalplacement=False)   # Punkte bleiben auf dem Original (flache Decken bleiben flach)
        m = ms.current_mesh(); tm = trimesh.Trimesh(m.vertex_matrix(), m.face_matrix(), process=True)
    return tm


def glb(pfad, netze, extras, knick=32):
    """netze: {name: trimesh} → GLB mit int16-Positionen und int8-Normalen (KHR_mesh_quantization, three.js GLTFLoader kann das ohne Zusatz)."""
    bin_, bviews, acc, meshes, nodes = bytearray(), [], [], [], []
    def view(data, target):
        while len(bin_) % 4: bin_.append(0)
        bviews.append({'buffer': 0, 'byteOffset': len(bin_), 'byteLength': len(data), 'target': target}); bin_.extend(data); return len(bviews) - 1
    for name, tm in netze.items():
        sm = trimesh.graph.smooth_shade(tm, angle=np.radians(knick)) if knick else tm
        V = np.asarray(sm.vertices, np.float64); N = np.asarray(sm.vertex_normals, np.float64); F = np.asarray(sm.faces, np.int64)
        lo, hi = V.min(0), V.max(0); mid = (lo + hi) / 2; step = max((hi - lo).max() / 65000.0, 1e-6)
        q = np.round((V - mid) / step).astype(np.int16)
        pos = np.zeros((len(V), 4), np.int16); pos[:, :3] = q
        nn = np.zeros((len(V), 4), np.int8); nn[:, :3] = np.clip(np.round(N * 127), -127, 127).astype(np.int8)
        bvp = view(pos.tobytes(), 34962); bviews[bvp]['byteStride'] = 8
        bvn = view(nn.tobytes(), 34962); bviews[bvn]['byteStride'] = 4
        big = len(V) > 65535; idx = F.astype(np.uint32 if big else np.uint16).tobytes()
        bvi = view(idx, 34963)
        acc += [{'bufferView': bvp, 'componentType': 5122, 'count': len(V), 'type': 'VEC3', 'min': q.min(0).tolist(), 'max': q.max(0).tolist()},
                {'bufferView': bvn, 'componentType': 5120, 'normalized': True, 'count': len(V), 'type': 'VEC3'},
                {'bufferView': bvi, 'componentType': 5125 if big else 5123, 'count': F.size, 'type': 'SCALAR'}]
        a0 = len(acc) - 3
        meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': a0, 'NORMAL': a0 + 1}, 'indices': a0 + 2, 'material': len(meshes)}]})
        nodes.append({'name': name, 'mesh': len(meshes) - 1, 'translation': mid.tolist(), 'scale': [step] * 3})
    while len(bin_) % 4: bin_.append(0)
    js = {'asset': {'version': '2.0', 'generator': '3nps werkzeug/rig_modelle.py (v162)'},
          'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
          'scene': 0, 'scenes': [{'nodes': list(range(len(nodes))), 'extras': extras}], 'nodes': nodes, 'meshes': meshes,
          'materials': [{'name': n, 'pbrMetallicRoughness': {'baseColorFactor': [.8, .8, .8, 1]}} for n in netze],
          'accessors': acc, 'bufferViews': bviews, 'buffers': [{'byteLength': len(bin_)}]}
    j = json.dumps(js, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
    with open(pfad, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(bin_)))
        fh.write(struct.pack('<II', len(j), 0x4E4F534A)); fh.write(j)
        fh.write(struct.pack('<II', len(bin_), 0x004E4942)); fh.write(bin_)
    return os.path.getsize(pfad)


# Dreiecke je Farbe (Anzeige; zusammen deutlich unter 1 MB je Gitarre)
BUDGET = {'schecter': {'grau': 5000, 'rot': 9000, 'dunkelrot': 7000, 'schwarz': 11000, 'weiss': 4000, 'saiten': 200},
          'strat': {'korpus': 7000, 'weiss': 7000, 'hals': 5000, 'metall': 11000, 'schwarz': 2500}}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('druckwerk'); ap.add_argument('--nur'); ap.add_argument('--arbeit', default='/tmp/rigbau'); ap.add_argument('--ziel', default=str(ZIEL))
    ap.add_argument('--wieder', action='store_true', help='vorhandene druckwerk-Ergebnisse in --arbeit wiederverwenden (nur Export neu)')
    a = ap.parse_args(); WIEDER = a.wieder; dw = Path(a.druckwerk).resolve(); arb = Path(a.arbeit); ziel = Path(a.ziel); ziel.mkdir(parents=True, exist_ok=True)
    rev = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=dw, capture_output=True, text=True).stdout.strip() or '?'
    for name, fn in (('schecter', schecter), ('strat', strat)):
        if a.nur and a.nur != name: continue
        teile, trafo, meta = fn(dw, arb)
        netze = {}
        for n, tm in teile.items():
            if n != 'saiten': tm = trafo(tm, BUDGET[name].get(n, 6000))
            netze[n] = vereinfachen(tm, BUDGET[name].get(n, 6000))
        meta['quelle'] = f'Tom444555/druckwerk@{rev}'
        gr = glb(ziel / f'{name}.glb', netze, meta)
        print(name, f'{gr / 1024:.0f} KB', {n: len(t.faces) for n, t in netze.items()}, json.dumps(meta)[:400])
