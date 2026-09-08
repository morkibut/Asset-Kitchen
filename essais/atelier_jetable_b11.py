# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B11 — ses animations, et le départage**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8477 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b11.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

Un jeu, **« Le marais »**, quatre directions déclarées, et un sujet vedette
dont les rangées d'animations couvrent chacun des états que `B11` introduit —
c'est tout l'objet du montage.

| La pose | La direction | Ce qu'elle montre |
|---|---|---|
| **repos** | `sud` | une retenue, une gardée, **et une écartée** (déborde exprès) |
| **repos** | `nord` | deux essais, **aucun retenu** — le seul rouge de l'écran |
| **repos** | `est` | une seule bande, retenue d'emblée — le cas simple |
| **repos** | `ouest` | rien du tout — une direction vide |
| **marche** | `sud` | **une seule bande, écartée** : la case est vide à l'œil, et pourtant rien n'a été détruit — l'archive est derrière la flèche |
| **course** | — | aucune bande nulle part — la pose replie sur « rien » |

**Aucun clip n'est découpé ici, et c'est délibéré** — même choix que
`tests/test_b11.py` : ce qui se vérifie est ce que la matrice et l'écran font
d'une bande, pas l'extraction vidéo. Les bandes sont donc écrites directement
dans le dépôt, comme un montage les aurait laissées — fiche d'abord, planche
ensuite, index enfin, exactement l'ordre de `ServiceMontage._sauver`.

**Chaque bande porte une vraie planche de sprites** (un PNG à quatre cases,
chacune d'une teinte différente et numérotée), pour que `BandeQuiTourne`
(`Apercu.tsx`) ait vraiment de quoi tourner à l'écran plutôt que de rester sur
son « … » de chargement.

**Rien n'a été payé** : aucune route de génération n'est appelée, aucun
fournisseur n'est sollicité.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin** ouvre *sa page*, sur *Sa fiche*.
2. Onglet **Ses animations** : les rangées, une par pose puis par direction.
3. `repos / sud` : la retenue a l'anneau vert, la gardée est à côté, et un
   bouton **« 1 écartée »** replie la troisième — cliquer l'ouvre et montre le
   bouton « restaurer ».
   ⚠️ **Ce bouton refusera** — la bande a été écartée au montage du décor, il y
   a largement plus de huit secondes : le clic rend « L'annulation a expiré »,
   et c'est la bonne réponse. Pour voir un restaurer qui **réussit**, écarter
   une bande *depuis cet écran-ci* (`repos / nord` en a deux, gardez-en une
   sous la main) et cliquer « restaurer » tout de suite après — la fenêtre est
   courte, un aller-retour d'outil de navigateur la dépasse déjà.
4. `repos / nord` : le bandeau rouge de la pose dit **« 1 à départager »**, et
   la rangée n'a pas de vignette entourée de vert.
5. Cliquer le rond vert d'une gardée de `repos / sud` : la retenue change, et
   l'ancienne redevient gardée sans se déplacer dans la file.
6. Cliquer **« L'écarter »** sur la retenue de `repos / est` (la seule bande de
   la rangée) : la case se vide, mais rien ne se restaure à sa place — il n'y
   a personne d'autre à promouvoir, et la rangée le montre.
   Cliquer ensuite **« L'écarter »** sur la retenue de `repos / sud` (qui, elle,
   a une gardée) : la gardée devient retenue **toute seule**, sans repasser par
   la case verte — c'est le geste que les images n'ont pas besoin de faire.
7. `marche / sud` : la rangée paraît vide, et pourtant **« 1 écartée »** est là
   — la preuve que l'écart n'a rien détruit.
8. `course` : la pose entière dit **« rien »**.

⚠️ **Chaque écart ou restauration balaie aussi les autres écarts expirés du
sujet entier** (`ServiceMontage.ecarter`/`.purger`) : passées les huit
secondes, cliquer « L'écarter » ailleurs peut faire disparaître pour de bon la
puce « 1 écartée » de `repos / sud` ou de `marche / sud` — constaté en
vérifiant cet atelier au navigateur. Ce n'est pas un bogue de l'écran, c'est le
même balayage que la bibliothèque fait pour les images ; regarder ces deux
rangées-là **avant** de cliquer ailleurs si on veut encore les voir.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée un jeu, un sujet et des bandes. Le dossier
temporaire est imprimé à chaque lancement ; c'est lui qu'on efface après.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import uvicorn
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.bande import Bande, Cadre, Prise  # noqa: E402
from atelier.domaine.generation import Generation  # noqa: E402
from atelier.services import Atelier  # noqa: E402

PORT = 8477

DIRECTIONS = (
    ("sud", "seen from the front"),
    ("nord", "seen from behind"),
    ("est", "seen from the right"),
    ("ouest", "seen from the left"),
)

# Une case, quatre teintes bien distinctes — pour que l'œil voie tourner la
# planche plutôt que de deviner une seule couleur qui se répète.
TEINTES = ((196, 90, 90), (90, 150, 196), (120, 180, 100), (210, 170, 70))
CASE = 24


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _planche(compte: int) -> bytes:
    """Un PNG de `compte` cases de `CASE` px, chacune d'une teinte et d'un
    numéro — la même idée que `image_sujet` de `tests/conftest.py`, mais pour
    une bande entière plutôt qu'une seule image."""
    feuille = Image.new("RGB", (CASE * compte, CASE), TEINTES[0])
    dessin = ImageDraw.Draw(feuille)
    for i in range(compte):
        teinte = TEINTES[i % len(TEINTES)]
        dessin.rectangle([i * CASE, 0, (i + 1) * CASE - 1, CASE - 1], fill=teinte)
        dessin.text((i * CASE + 6, 6), str(i), fill=(20, 20, 20))
    tampon = io.BytesIO()
    feuille.save(tampon, format="PNG")
    return tampon.getvalue()


def _poser_un_clip(atelier: Atelier, projet: str, clip: str) -> None:
    """Une génération minimale, pour que le clip existe **aux yeux du dépôt**.

    ⚠️ Sans elle, tout tourne au premier lancement — mais `ServiceBibliotheque
    .reconstruire()` (déclenché dès que la table `generations` est vide, ce
    qui est le cas ici : cet atelier n'a jamais généré une seule image) ne
    relit une bande que si `clip in connus`, `connus` étant l'ensemble des
    générations trouvées sur le disque (`atelier/services/bibliotheque.py`).
    Une bande dont le clip est inconnu est traitée comme une bande dont le
    clip a disparu : filtrée, pas perdue — ses fichiers restent sur le disque,
    mais l'index ne la reprend plus. **Trouvé en essayant cet atelier-ci pour
    de vrai** : le résumé imprimé avant `uvicorn.run` montrait les bonnes
    bandes, l'écran ouvert dans le navigateur les montrait toutes vides,
    parce qu'entre les deux `ouvrir()` tourne une seconde fois et ce contrôle
    s'applique alors à un index qui, cette fois, a quelque chose à perdre."""
    generation = Generation(
        identifiant=clip, modele="double", demande={}, parametres_resolus={}, projet=projet
    )
    atelier.fichiers.ecrire_enregistrement(clip, generation.en_json())
    atelier.base.enregistrer(generation)


def _poser_une_bande(
    atelier: Atelier,
    projet: str,
    personnage: str,
    pose: str,
    direction: str | None,
    *,
    identifiant: str,
    nom: str,
    cree_le: float,
    favori: bool = False,
    supprime_le: float | None = None,
    prises: int = 4,
) -> Bande:
    """Une bande gardée, écrite directement dans le dépôt — le geste documenté
    par `tests/test_b11.py` : pas de découpage, pas de fournisseur, une fiche
    posée comme un montage l'aurait laissée. Son clip est posé juste avant,
    pour la raison expliquée sur `_poser_un_clip`."""
    _poser_un_clip(atelier, projet, f"clip-{identifiant}")
    bande = Bande(
        identifiant=identifiant,
        clip=f"clip-{identifiant}",
        nom=nom,
        prises=tuple(Prise(numero=n) for n in range(prises)),
        cadence=8.0,
        cadre=Cadre(gauche=0, sommet=0, droite=CASE - 1, bas=CASE - 1),
        projet=projet,
        personnage=personnage,
        pose=pose,
        direction=direction,
        case_largeur=CASE,
        case_hauteur=CASE,
        favori=favori,
        supprime_le=supprime_le,
    )
    bande.cree_le = cree_le
    # **Planche d'abord** : une fois posée, `ServiceMontage.planche()` la sert
    # telle quelle et ne tente jamais de la recalculer depuis un clip qui
    # n'existe pas — voir sa docstring, § cache.
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(
        bande.clip, bande.identifiant, _planche(prises)
    )
    # **Fichier d'abord, index ensuite** — le même ordre que
    # `ServiceMontage._sauver`, pour que le dépôt reste relisable depuis le
    # disque seul si l'index disparaissait.
    atelier.fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
    atelier.base.enregistrer_bande(bande)
    return bande


def peupler(atelier: Atelier) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le marais"}),
            "le projet « Le marais »",
        )["projet"]["identifiant"]

        for nom, consigne in DIRECTIONS:
            _exiger(
                client.post(
                    "/api/characters/directions", json={"nom": nom, "consigne": consigne}
                ),
                f"la direction « {nom} »",
            )

        vedette = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": (
                        "A weathered pilgrim in a hooded brown robe, leather straps, "
                        "a walking staff, worn boots."
                    ),
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]

        # Un voisin, pour que le carnet ait de quoi montrer une liste et
        # qu'on puisse changer de sujet et revenir.
        autre = _exiger(
            client.post(
                "/api/characters", json={"nom": "La sorcière des roseaux", "description": ""}
            ),
            "la création de la sorcière",
        )["personnage"]["identifiant"]

        base = time.time() - 3600  # toutes datées dans l'heure qui précède, dans l'ordre

        bandes: dict[str, Bande] = {}

        # repos / sud — la rangée qui déborde : retenue, gardée, écartée.
        bandes["sud-vieille"] = _poser_une_bande(
            atelier, projet, vedette, "repos", "sud",
            identifiant="bande-sud-1", nom="marche au repos", cree_le=base + 1,
        )
        bandes["sud-retenue"] = _poser_une_bande(
            atelier, projet, vedette, "repos", "sud",
            identifiant="bande-sud-2", nom="marche au repos", cree_le=base + 2,
            favori=True,
        )
        bandes["sud-ecartee"] = _poser_une_bande(
            atelier, projet, vedette, "repos", "sud",
            identifiant="bande-sud-3", nom="marche au repos", cree_le=base + 3,
            supprime_le=time.time(),
        )

        # repos / nord — à départager : deux essais, aucun retenu.
        _poser_une_bande(
            atelier, projet, vedette, "repos", "nord",
            identifiant="bande-nord-1", nom="salut", cree_le=base + 4,
        )
        _poser_une_bande(
            atelier, projet, vedette, "repos", "nord",
            identifiant="bande-nord-2", nom="salut", cree_le=base + 5,
        )

        # repos / est — le cas simple : une seule bande, retenue d'emblée.
        _poser_une_bande(
            atelier, projet, vedette, "repos", "est",
            identifiant="bande-est-1", nom="profil", cree_le=base + 6,
            favori=True,
        )

        # repos / ouest — rien : une direction vide.

        # marche / sud — une seule bande, écartée : la case paraît vide, mais
        # l'archive est toujours là derrière la flèche.
        _poser_une_bande(
            atelier, projet, vedette, "marche", "sud",
            identifiant="bande-marche-1", nom="foulée", cree_le=base + 7,
            supprime_le=time.time(),
        )

        # course — aucune bande du tout : la pose entière dit « rien ».

        charge = _exiger(client.get("/api/characters"), "la liste des sujets")
        sien = next(
            (p for p in charge["personnages"] if p["identifiant"] == vedette), None
        )
        if sien is None:
            raise SystemExit("le pèlerin n'est pas dans la liste que le serveur rend")
        return {"projet": projet, "vedette": vedette, "cases": sien.get("cases", [])}


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et
    # des flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b11-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print("  Ce que le serveur rend vraiment, case par case :")
    for sienne in monte["cases"]:
        directions = sienne.get("directions") or []
        if not directions:
            print(f"    · {sienne['pose']:8s} — aucune bande")
            continue
        for d in directions:
            bandes = d.get("bandes", [])
            ecartees = d.get("bandes_ecartees", [])
            retenues = sum(1 for b in bandes if b["favori"])
            marque = ""
            if len(bandes) > 1 and retenues == 0:
                marque = "  ← à départager (le seul rouge de l'écran)"
            print(
                f"    · {sienne['pose']:8s} {d['identifiant']:6s} "
                f"{len(bandes)} bande(s), {retenues} retenue(s),"
                f" {len(ecartees)} écartée(s){marque}"
            )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin : sa page s'ouvre sur SA FICHE")
    print("  → onglet « Ses animations »")
    print("  → repos/sud : retenue verte, gardée à côté, « 1 écartée » à déplier")
    print("  → repos/nord : bandeau rouge « 1 à départager »")
    print("  → marche/sud : la rangée paraît vide, « 1 écartée » prouve le contraire")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    sys.stdout.flush()
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
