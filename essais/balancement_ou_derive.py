# -*- coding: utf-8 -*-
"""Balancement ou dérive d'échelle ? Deux causes, un seul symptôme.

Une case plus courte qu'une autre peut vouloir dire deux choses opposées :

- **un balancement** — le corps se tasse et se détend pendant la marche. La
  hauteur change, la largeur beaucoup moins : **la forme se déforme**.
- **une dérive d'échelle** — le modèle a simplement dessiné le sujet plus petit.
  Hauteur et largeur bougent **ensemble**, et la forme reste la même.

Le juge est donc le **rapport hauteur / largeur**, case par case. Constant, c'est
une dérive : rien ne bouge, tout rétrécit. Variable, c'est une déformation, donc
du mouvement.

La dérive se rattrape sans un centime — c'est du recalage. Le balancement, lui,
ne se fabrique pas après coup : s'il n'est pas dans l'image payée, il n'existera
jamais.

    .venv\\Scripts\\python.exe essais/balancement_ou_derive.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from atelier.domaine.recette import Passe, Recette
from atelier.image.decoupe import en_ordre_de_lecture, zones_opaques
from atelier.image.traitement import detourer

BANC = RACINE / "resultats_animation"
DEPOT_GEN = RACINE.parent / "donnees" / "generations"

PLANCHES = [(p.parent.name.replace("_", "/", 1), p.stem, p) for p in sorted(BANC.glob("*/jet*.png"))]
PLANCHES += [
    ("openai/gpt-image-2 (facon A)", "jet1", DEPOT_GEN / "cb3ebb37f3cd4e21987964cd1af87770" / "0-brut.png"),
    ("openai/gpt-image-2 (facon A)", "jet2", DEPOT_GEN / "35608624563d412290a88b4a0c08ee75" / "0-brut.png"),
    ("openai/gpt-image-2 (facon B)", "jet1", DEPOT_GEN / "13583f345d32430a8d90b8a68954ed4e" / "0-brut.png"),
]

entete = f"{'modele':<38} {'jet':<5} {'suj':>4} {'haut%':>6} {'larg%':>6} {'forme%':>7}  lecture"
print(entete)
print("-" * (len(entete) + 22))

for modele, jet, chemin in PLANCHES:
    rgba = detourer(Recette(passes=(Passe(moteur="bord"),)), chemin.read_bytes())
    boites = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    if len(boites) != 8:
        print(f"{modele:<38} {jet:<5} {len(boites):>4}   compte faux — ecartee")
        continue
    h = np.array([b[3] - b[1] for b in boites], float)
    w = np.array([b[2] - b[0] for b in boites], float)
    forme = h / w
    eh = (h.max() / h.min() - 1) * 100
    ew = (w.max() / w.min() - 1) * 100
    ef = (forme.max() / forme.min() - 1) * 100
    if ef < 3:
        lecture = "rien ne se deforme — huit copies, a l'echelle pres"
    elif ef < 8:
        lecture = "deformation faible"
    else:
        lecture = "VRAIE deformation — le corps travaille"
    print(f"{modele:<38} {jet:<5} {len(boites):>4} {eh:>6.1f} {ew:>6.1f} {ef:>7.1f}  {lecture}")

print()
print("haut%  = ecart de hauteur entre les huit sujets")
print("larg%  = ecart de largeur")
print("forme% = ecart du rapport hauteur/largeur  <- LE juge")
print()
print("Si haut% est grand et forme% petit, le modele a dessine le meme sprite a")
print("des tailles differentes : c'est une derive d'echelle, et elle se recale.")
print("Si forme% est grand, le corps change vraiment de forme : c'est du mouvement.")
