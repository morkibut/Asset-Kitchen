# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B9 — la grille d'une famille**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8475 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b9.py

Ajouter `sans-servir` en argument peuple et imprime le résumé, sans lancer
uvicorn — pratique pour vérifier le montage sans avoir à faire Ctrl+C.

## Ce qu'il monte

**Le montage mesuré tient autour de 73 secondes** (deux tirages : 72,8 s et
73,5 s), sous la barre des 90 s visée — le nombre est imprimé à chaque
lancement plutôt que gelé ici.

Un jeu, **« Le marais »**, avec de quoi éprouver la grille d'une famille pour
de vrai, pas sur une poignée de sujets qui rendraient n'importe quel filtre
vide de sens :

- **260 personnages**, des noms de bestiaire de marais fabriqués par
  combinaison (« La bête des tourbières », « Le seigneur des roseaux »…) —
  assez pour dépasser le plafond de page de 120 sujets et voir
  **« Charger la suite » deux fois**. Un tiers environ n'a pas de description,
  pour le filtre du même nom.
- **Une quarantaine de meubles et une vingtaine de décors** — leur seul rôle
  est de prouver que le filtre de famille les écarte de la grille des
  personnages. Posés par le champ `famille` de la création : c'est lui qui
  choisit `premier_type_de`, pas un identifiant de type recopié à la main.
- **Une complétude étalée** — 90 sujets à 6/6, 15 à 5/6, 25 à 3/6, 60 à 1/6,
  70 à 0/6 — dans l'esprit des proportions de la planche
  (`docs/archive/pistes-2026-09-04/carnet/Famille.dc.html` : 31 incomplets sur 54,
  57 % ; ici 170 sur 260, 65 % — un peu plus creusé, pour que le montage
  tienne sous 90 secondes malgré le nombre d'images : voir le commentaire de
  `COMPTES_DE_POSES`).
- **Six collections** — *Les héros* (3), *Les PNJ* (20), *Les boss* (10),
  *Les vilains* (5), *Les monstres* (16), le reste sans collection — et
  quatre sujets rangés dans deux collections à la fois, pour que le
  glisser-déposer montre que rien n'est retiré nulle part.

**Les images se posent par import, jamais par génération** — le geste exact de
`tests/test_b9.py::_poser`. Une petite dizaine de gabarits PNG sont écrits une
seule fois puis réemployés des centaines de fois, avec `forcer=True` : sans ce
levier, `ServiceGenerations.importer` verrait une empreinte déjà connue après
le premier emploi de chaque gabarit et rendrait un doublon (`asset: null`) au
lieu d'une image neuve à ranger.

**Rien n'a été payé** : le fournisseur est le double des essais, il ne touche
pas au réseau et ne facture rien — et de toute façon aucune route de
génération n'est appelée ici.

## Ce qu'on vient voir à l'écran

- La grille de la famille *Personnages* : **trois onglets** — *Tous*,
  *Incomplets*, *Sans description* — et leurs comptes doivent dire les mêmes
  chiffres que ceux imprimés plus bas.
- **« Charger la suite »** apparaît, et il faut cliquer deux fois pour voir
  les 260 sujets.
- **Les meubles et les décors n'apparaissent jamais** dans cette grille-là.
- **Une carte porte son « X sur 6 »**, ses collections, et une carte rangée
  dans deux collections le montre aux deux endroits sans avoir disparu de
  l'un pour apparaître dans l'autre.

## ⚠️ Ce qu'il ne faut pas faire

Rien ici ne coûte : chaque image est importée, jamais générée. Il n'y a donc
pas de geste à éviter — seulement, comme toujours, ne pas confondre ce port-ci
avec celui de l'auteur.
"""

from __future__ import annotations

import itertools
import logging
import random
import sys
import tempfile
import time
from pathlib import Path

# `httpx2` — le client sous le `TestClient` de ce dépôt — journalise chaque
# appel en `INFO` ; sur ~2000 appels, ce sont des lignes que personne ne
# relit ici, et les couper au silence.
logging.getLogger("httpx2").setLevel(logging.WARNING)

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** : deux fournisseurs doubles
# qui divergeraient finiraient par ne plus décrire le même produit. Même
# chose pour `image_sujet` : c'est le sujet net sur fond plat que
# `tests/test_b9.py::_poser` importe déjà, et en fabriquer un second ici
# referait diverger la même image.
from conftest import FournisseurDouble, image_sujet  # noqa: E402

PORT = 8475

# ── Le nommage, par combinaison plutôt qu'un par un ──────────────────────────
#
# Chaque liste ne partage aucun mot avec les autres : deux catégories ne
# peuvent donc jamais produire le même nom complet, et le jeu entier n'a
# qu'une seule règle d'unicité à tenir — celle du produit, sur tout le projet
# (`ServiceProduction.creer_personnage`).

TITRES_PERSONNAGES = (
    "La bête", "Le seigneur", "La veuve", "Le pèlerin", "Le passeur",
    "Le tourbier", "La lavandière", "Le braconnier", "La rebouteuse",
    "Le veilleur", "La recluse", "Le charbonnier", "La fileuse", "Le noyé",
    "La brumeuse", "Le sonneur", "La gardienne", "Le maraîcher",
    "La tisserande", "Le forgeron", "La sorcière", "Le meunier",
    "La bergère", "Le chasseur", "La prieure", "Le colporteur",
    "La rôdeuse", "Le fossoyeur", "La guetteuse", "Le vagabond",
)
COMPLEMENTS_PERSONNAGES = (
    "des tourbières", "des roseaux", "du moulin", "des brumes", "du marais",
    "des saules", "de la tourbe", "des joncs", "du gué", "des marécages",
    "de l'étang", "des fondrières",
)

TITRES_MEUBLES = (
    "Un coffre", "Une jarre", "Un chaudron", "Une lanterne", "Un tabouret",
    "Une malle", "Un établi", "Une armoire", "Un baril", "Une balance",
)
COMPLEMENTS_MEUBLES = ("de chêne", "de fer", "du tourbier", "de la veuve", "du passeur")

TITRES_DECORS = (
    "Une chapelle", "Un pont", "Une tourbière", "Un moulin", "Une masure",
    "Un ponton", "Une digue", "Un calvaire",
)
COMPLEMENTS_DECORS = (
    "du marais", "des brumes", "de la tourbière", "du gué", "des roseaux",
)

TOTAL_PERSONNAGES = 260
TOTAL_MEUBLES = 40
TOTAL_DECORS = 20

# ── La complétude étalée, proche des proportions de la planche ──────────────
#
# 31 incomplets sur 54 dans `Famille.dc.html`, soit 57 % ; ici 170 sur 260,
# soit 65 % — un peu plus creusé, **exprès** : chaque image posée coûte deux
# appels (l'import, puis la case), et un tirage qui viserait 57 % pile
# demanderait 112 sujets à 6/6, donc 672 images rien que pour ce palier-là —
# largement au-delà du budget de 90 secondes. Les paliers bas (`1/6`, `0/6`)
# sont donc favorisés sur les paliers hauts (`5/6`) : la grille reste étalée
# sur les six paliers, seule la proportion exacte cède devant le temps de
# montage. Mélangée par un tirage à graine fixe pour ne pas faire courir la
# complétude et la description sur le même index.
COMPTES_DE_POSES = (6,) * 90 + (5,) * 15 + (3,) * 25 + (1,) * 60 + (0,) * 70
assert len(COMPTES_DE_POSES) == TOTAL_PERSONNAGES

# Un sujet sur trois n'a pas de description — le filtre du même nom.
SANS_DESCRIPTION = lambda index: index % 3 == 0  # noqa: E731

# Les collections, par tranche du même index — voir `peupler` pour le détail
# des recouvrements.
COLLECTIONS = (
    ("Les héros", 0, 3),
    ("Les PNJ", 3, 23),
    ("Les boss", 23, 33),
    ("Les vilains", 33, 38),
    ("Les monstres", 38, 54),
)


def _noms(titres: tuple[str, ...], complements: tuple[str, ...], total: int) -> list[str]:
    """`total` noms distincts, par combinaison — jamais `sujet-0187`."""
    combos = list(itertools.islice(itertools.product(titres, complements), total))
    assert len(combos) == total, f"pas assez de combinaisons pour {total} noms"
    return [f"{titre} {complement}" for titre, complement in combos]


def _gabarits(dossier: Path) -> list[Path]:
    """Une petite dizaine de PNG distincts, écrits une seule fois.

    En fabriquer un par image ferait durer le montage des minutes ; ceux-ci
    sont réemployés des centaines de fois par `_poser`, avec `forcer=True`.
    """
    sous = dossier / "gabarits"
    sous.mkdir(parents=True, exist_ok=True)
    chemins = []
    for rang in range(1, 11):
        chemin = sous / f"gabarit-{rang}.png"
        chemin.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
        chemins.append(chemin)
    return chemins


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _creer_personnage(
    client, nom: str, description: str = "", famille: str | None = None
) -> str:
    corps: dict = {"nom": nom, "description": description}
    if famille:
        corps["famille"] = famille
    return _exiger(client.post("/api/characters", json=corps), f"la création de « {nom} »")[
        "personnage"
    ]["identifiant"]


def _poser(client, gabarit: Path, personnage: str, pose: str) -> None:
    """Une image importée puis rangée dans sa case — le geste de `test_b9._poser`.

    `forcer=True` : le même gabarit sert des centaines de fois, donc son
    empreinte est déjà connue après le premier import — sans ce levier,
    `ServiceGenerations.importer` rendrait `{"asset": null, "doublon": …}` au
    lieu d'une image neuve à ranger dans la case.
    """
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} / {pose} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": pose},
        ),
        f"la pose « {pose} » de « {personnage} »",
    )


def _creer_collection(client, nom: str) -> str:
    return _exiger(
        client.post("/api/collections", json={"nom": nom}), f"la collection « {nom} »"
    )["collection"]["identifiant"]


def _ranger(client, collection: str, jeu: str, sujet: str, nom: str) -> None:
    _exiger(
        client.put(
            f"/api/collections/{collection}/members", json={"jeu": jeu, "sujet": sujet}
        ),
        f"ranger « {nom} » dans la collection",
    )


def peupler(atelier: Atelier, double: FournisseurDouble, dossier: Path) -> dict:
    """Le marais : ses meubles et ses décors, ses 260 sujets, ses six
    collections — et rien de tout ça n'a été généré."""
    gabarits = _gabarits(dossier)
    compteur_gabarit = itertools.count()

    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le marais"}), "le projet « Le marais »"
        )["projet"]["identifiant"]

        # ── Les meubles et les décors : de quoi prouver que le filtre écarte ─
        for nom in _noms(TITRES_MEUBLES, COMPLEMENTS_MEUBLES, TOTAL_MEUBLES):
            _creer_personnage(client, nom, famille="objets")
        for nom in _noms(TITRES_DECORS, COMPLEMENTS_DECORS, TOTAL_DECORS):
            _creer_personnage(client, nom, famille="decors")

        # ── Les 260 personnages, décrits ou non, complets ou non ────────────
        noms = _noms(TITRES_PERSONNAGES, COMPLEMENTS_PERSONNAGES, TOTAL_PERSONNAGES)
        complements = [
            c for _, c in itertools.islice(
                itertools.product(TITRES_PERSONNAGES, COMPLEMENTS_PERSONNAGES),
                TOTAL_PERSONNAGES,
            )
        ]
        buckets = list(COMPTES_DE_POSES)
        random.Random(20260907).shuffle(buckets)

        poses = [p["identifiant"] for p in client.get("/api/characters").json()["plan"]]
        assert len(poses) == 6, f"le plan par défaut ne porte plus six poses : {poses}"

        identifiants: list[str] = []
        for index, nom in enumerate(noms):
            sans_description = SANS_DESCRIPTION(index)
            description = (
                "" if sans_description
                else f"Une présence du marais, du côté {complements[index]}."
            )
            identifiant = _creer_personnage(client, nom, description)
            identifiants.append(identifiant)

            for pose in poses[: buckets[index]]:
                gabarit = gabarits[next(compteur_gabarit) % len(gabarits)]
                _poser(client, gabarit, identifiant, pose)

        # ── Les six collections, avec quatre sujets rangés dans deux à la fois
        collections: dict[str, str] = {}
        for nom, debut, fin in COLLECTIONS:
            identifiant_collection = _creer_collection(client, nom)
            collections[nom] = identifiant_collection
            for i in range(debut, fin):
                _ranger(client, identifiant_collection, projet, identifiants[i], noms[i])

        # **Le recouvrement** : deux PNJ aussi rangés chez les héros, deux
        # monstres aussi rangés chez les vilains — sans qu'ils quittent leur
        # premier groupe. C'est ce qui rend visible « rien n'est retiré
        # nulle part » au glisser-déposer.
        recouvrements = [
            (identifiants[3], noms[3], "Les héros"),
            (identifiants[4], noms[4], "Les héros"),
            (identifiants[38], noms[38], "Les vilains"),
            (identifiants[39], noms[39], "Les vilains"),
        ]
        for identifiant, nom, dans in recouvrements:
            _ranger(client, collections[dans], projet, identifiant, nom)

        # Ce que la grille recevra, relu ici depuis le serveur : si les deux
        # ne disaient pas la même chose, l'un des deux mentirait.
        servi = _exiger(
            client.get("/api/characters/families/personnages", params={"limite": 120}),
            "la grille de la famille « personnages »",
        )

        return {
            "projet": projet,
            "meubles": TOTAL_MEUBLES,
            "decors": TOTAL_DECORS,
            "personnages": TOTAL_PERSONNAGES,
            "incomplets_locaux": sum(1 for b in buckets if b < 6),
            "sans_description_locaux": sum(1 for i in range(TOTAL_PERSONNAGES) if SANS_DESCRIPTION(i)),
            "collections": collections,
            "recouvrements": [(nom, dans) for _, nom, dans in recouvrements],
            "servi": servi,
        }


def principal(sans_servir: bool = False) -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b9-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    atelier = Atelier(racine=dossier, fabrique_fournisseur=lambda: double)

    depart = time.perf_counter()
    monte = peupler(atelier, double, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage           : {duree:.1f} s")
    print(f"  Appels payés       : {double.appels}  (double : facture zéro)")
    print(
        f"  Créés              : {monte['personnages']} personnages, "
        f"{monte['meubles']} meubles, {monte['decors']} décors"
    )
    print()
    print("  Calculé ici, pour être confronté à l'écran :")
    print(f"    · incomplets       : {monte['incomplets_locaux']} / {monte['personnages']}")
    print(f"    · sans description : {monte['sans_description_locaux']} / {monte['personnages']}")
    print(f"    · collections      : {', '.join(monte['collections'])}")
    print(f"    · rangés en double : {', '.join(f'{n} → aussi {d}' for n, d in monte['recouvrements'])}")

    print()
    print("  Ce que la route rend vraiment (GET .../families/personnages?limite=120) :")
    servi = monte["servi"]
    print(f"    · total            : {servi['total']}")
    print(f"    · sujets sur la page : {len(servi['personnages'])}")
    if servi["total"] != monte["personnages"]:
        print(
            f"    ⚠️ le total de la route ({servi['total']}) ne dit pas {monte['personnages']} "
            "— le filtre de famille laisse passer autre chose que les personnages"
        )
    for carte in servi["personnages"][:3]:
        compte = carte["compte"]
        noms_collections = [c["nom"] for c in carte["collections"]] or ["(aucune)"]
        print(f"    · {carte['nom']}")
        print(
            f"        images {compte['images']['fait']}/{compte['images']['attendu']}"
            f"  poses {compte['poses']['fait']}/{compte['poses']['attendu']}"
            f"  complet={compte['complet']}"
        )
        print(f"        collections : {', '.join(noms_collections)}")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages, onglets Tous / Incomplets / Sans description")
    print("  → « Charger la suite » deux fois avant de voir les 260 sujets")
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
