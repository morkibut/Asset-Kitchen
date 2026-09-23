# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier RV7 au navigateur, sans toucher à celui de l'auteur.

**RV7 — le retour, là où l'on a cliqué.** Ce qu'on vient regarder :

- la fenêtre « Préparer une fabrication », en mode clip, sur Mara, deux
  directions cochées : la relecture de la série montre, **case par case**,
  l'image de départ et les références envoyées ;
- après « Lancer », chaque case dit son étape et son temps écoulé ; le pied dit
  qu'on peut fermer, avec un bouton ;
- sur la fiche de Mara, onglet des animations : une case « en cours » dans la
  rangée de chaque direction visée — **et encore là après un rechargement** ;
- au bout de `DUREE_S` secondes, la première devient sa vignette sans
  rechargement, la seconde revient **noire** et dit « ratée », avec sa raison
  et « Relancer » ; la fente du châssis annonce les deux, et son lien mène à
  la case.

Fournisseur et animateur doublés : rien n'est payé, rien ne sort de la
machine. Le dossier est temporaire, le port est le 8426 — l'auteur travaille
sur 8420 et 8421, qui ne bougent pas.

⚠️ **L'atelier sert `interface/dist`** : lancer `npm --prefix interface run build`
après la dernière modification d'écran.

    py essais/atelier_jetable_rv7.py            prépare, rien ne part
    py essais/atelier_jetable_rv7.py --lancer   lance aussi la série par les routes

Ctrl-C pour l'arrêter.
"""

from __future__ import annotations

import sys
import tempfile
import threading
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx  # noqa: E402
import uvicorn  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from tests.conftest import FournisseurDouble, image_sujet  # noqa: E402
from tests.test_a9 import MELE, AnimateurDouble, clip_mp4  # noqa: E402
from tests.test_rv1 import clip_noir  # noqa: E402

PORT = 8426
DUREE_S = 45


class AnimateurLent(AnimateurDouble):
    """Un clip met `DUREE_S` secondes à « se fabriquer » ; le second revient noir."""

    def __init__(self) -> None:
        super().__init__()
        self.depuis: dict[str, float] = {}

    async def soumettre(self, modele, demande):
        travail = await super().soumettre(modele, demande)
        self.depuis[travail] = time.monotonic()
        return travail

    async def etat(self, travail):
        from atelier.fournisseur.port import EtatTravail
        if time.monotonic() - self.depuis.get(travail, 0) < DUREE_S:
            return EtatTravail(travail=travail, raison="il le fabrique encore")
        return EtatTravail(travail=travail, fini=True)

    async def recuperer(self, travail):
        from dataclasses import replace
        produit = await super().recuperer(travail)
        return replace(produit, octets=clip_noir() if travail.endswith("-2") else clip_mp4(images=12, cote=48))


def peupler(atelier):
    """Mara, deux directions demandées dans son objectif, et une image de départ."""
    projet = atelier.bibliotheque.courant
    objet = atelier.base.lire_projet(projet)
    objet.univers.vue = "vue-dessus-34"
    atelier.bibliotheque.sauver_projet(objet)
    directions = [d.identifiant for d in atelier.production.directions_du_jeu(projet)][:2]
    mara = atelier.production.creer_personnage(projet, "Mara", "Une éclaireuse en cape courte", objectif={
        "sorties": [{"nature": "animation", "pose": "marche", "direction": d} for d in directions],
        "largeur": 64, "hauteur": 64, "cadence": 8, "boucle": True, "repere": {"x": 32, "y": 64},
    })
    reference = atelier.generations.importer(image_sujet(), "Mara de face", projet=projet)["asset"]["identifiant"]
    return projet, mara, reference, directions


def lancer_par_les_routes(projet, mara, reference, directions) -> None:
    """`--lancer` : la série part par les routes, trois secondes après le départ du serveur."""
    time.sleep(3)
    racine = f"http://127.0.0.1:{PORT}/api/projects/{projet}/production-jobs"
    corps = {"cle": "rv7-jetable", "personnage": mara.identifiant, "reference_asset": reference,
             "modele_video": MELE.identifiant, "prompt_video": "walk in place", "secondes": 4,
             "resolution": "480p", "proportions": "1:1", "nombre_images": 6, "cadence": 8, "sens": "boucle",
             "cases": [{"pose": "marche", "direction": d} for d in directions], "nombre": 1}
    print("  préparée :", httpx.post(racine + "/preview-series", json=corps, timeout=30).status_code)
    print("  lancée :", httpx.post(racine + "/series/rv7-jetable/start", timeout=30).status_code)


def principal() -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rv7-"))
    print(f"Dossier jetable : {dossier}")
    if not (RACINE / "interface" / "dist").exists():
        print("⚠️  interface/dist absent — lance `npm --prefix interface run build` d'abord.")

    double = FournisseurDouble()
    double.rendre = image_sujet
    animateur = AnimateurLent()
    animateur.facture = 0.0
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)

    # **Peuplé sous une application à part** (patron d'`atelier_jetable_rt.py`) :
    # son cycle de vie ouvre l'atelier, et le serveur MCP embarqué refuse
    # d'ouvrir le sien deux fois sur la même instance.
    from fastapi.testclient import TestClient
    with TestClient(creer_application(atelier)):
        projet, mara, reference, directions = peupler(atelier)
    print(f"  Mara : {mara.identifiant} · directions visées : {directions} · image de départ : {reference}")
    print(f"  modèle vidéo doublé : {MELE.identifiant} — chaque clip met {DUREE_S} s, le second revient noir")
    if "--lancer" in sys.argv:
        threading.Thread(target=lancer_par_les_routes, args=(projet, mara, reference, directions), daemon=True).start()

    print()
    print(f"Atelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
