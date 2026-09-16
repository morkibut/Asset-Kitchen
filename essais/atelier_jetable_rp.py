# -*- coding: utf-8 -*-
"""L'atelier jetable du chantier **remise à plat** — le décor des quinze gestes.

**L'auteur travaille sur le port 8420 pendant la session, et il se sert aussi
du 8421.** Cet atelier-ci vit sur un dossier temporaire, sur le port 8424 :
rien n'est écrit dans `donnees/`, et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_rp.py

`sans-servir` en argument peuple, imprime le résumé et rend la main sans lancer
`uvicorn` — de quoi vérifier le montage sans occuper le port.

## Pourquoi celui-ci existe

Les vingt-deux tranches du chantier ont toutes leurs essais d'écran, et aucune
n'avait été regardée au navigateur. **Un essai d'écran pousse l'état lui-même**
— il monte le composant avec les objets qu'il a fabriqués — et ne voit donc
jamais ce que le serveur ne remonte pas. Ce script monte l'état par les
**routes**, exactement comme l'interface le fera, puis sert l'interface
construite : ce qui manque au serveur manque aussi à l'écran.

## Ce qu'il monte, et pour quel geste du parcours

| Ce qui est monté | Le geste qu'il sert |
|---|---|
| **Le Marais du Vieux Moulin**, sa bible et son allure | 1, 15 |
| Quatre cartes sur la toile et deux notes | 2 |
| Une **planche de six cases** collée sur la toile | 3 |
| Quatre familles peuplées, deux collections vides | 4, 5 |
| **Le pèlerin** : signalement, textes de style, images d'exemple | 6 |
| Des images fixes, **une rangée volontairement vide** | 7 |
| Une image **non retenue** comme référence | 8 |
| Six poses, une direction — de quoi ajouter un mouvement | 9 |
| Un clip de huit images et **trois animations** | 10 |
| **Deux animations sur la même case**, à deux cadences | 11 |
| Vingt et une images, dont des planches et un clip | 12, 13 |
| Une **fabrication préparée et jamais lancée** | 14 |
| Un dossier de jeu, **une livraison déjà partie**, un fichier réécrit à la main | 15 |

**Rien n'a été payé.** Le fournisseur est le double de `tests/conftest.py` et
l'animateur celui de `tests/test_a9.py` : le script marche réseau coupé, et
aucune route de génération ne sort de la machine.

## Ce qu'on vient voir à l'écran

Le parcours complet est dans `docs/status/etat.md` § *La relecture croisée*.
Les deux entrées les plus fragiles, celles qu'aucun essai ne peut voir :

1. **Le glisser-déposer d'un sujet sur une ligne de collection** (`RP7`) — la
   colonne de gauche de la grille des sujets porte deux collections vides.
2. **La livraison qui décide au lieu de bloquer** (`RP10`) — le dossier du jeu
   porte un fichier que l'atelier n'a pas écrit, à l'endroit exact où il
   voudrait écrire : la préparation doit offrir *conserver · copier à côté ·
   remplacer*, et non refuser.

⚠️ **Ce qu'il ne faut pas faire** : le lancer sur `donnees/`. Il écrit un
dossier de jeu, pose des cartes et livre des fichiers — le faire sur l'atelier
de l'auteur y laisserait tout ça.
"""

from __future__ import annotations

import io
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import uvicorn
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.domaine.animation import Clip  # noqa: E402
from atelier.domaine.generation import Generation  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** : deux doubles qui
# divergeraient finiraient par ne plus décrire le même produit.
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402

PORT = 8424
MODELE = "essai:rend-du-png"
COTE = 64
IMAGES_DU_CLIP = 8

LE_TRAVAIL_DE_LAUTEUR = b"# Cette scene a ete reecrite a la main dans le jeu.\n"


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


# ── Les images que le décor emploie ─────────────────────────────────────────


def _planche(cases: int = 6, cote: int = 96) -> bytes:
    """Une planche de `cases` sujets côte à côte, **séparables**.

    Écrite comme `conftest.planche_sujets` le fait pour les essais, en plus
    petit et sur une seule rangée : ce qu'on vient voir n'est pas la qualité du
    détourage mais le fait que *Découper* propose quelque chose, ici comme sur
    la toile. Une gouttière large tient les cases séparées ; un sujet qui
    toucherait le bord ferait de la planche entière une seule tache.
    """
    tableau = np.full((cote, cases * cote, 3), (216, 217, 216), dtype=np.uint8)
    for rang in range(cases):
        gauche = rang * cote + cote // 3
        largeur = cote // 3
        haut = cote // 4 + rang * 2
        for colonne in range(largeur):
            teinte = (190, 40, 40) if colonne % 2 == 0 else (120, 25, 25)
            tableau[haut : cote - 8, gauche + colonne] = teinte
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _images_du_clip() -> list[np.ndarray]:
    """Un corps qui **descend d'image en image**, comme dans `B20`.

    Un sujet immobile ferait se ressembler les trois animations, et *Comparer*
    ne montrerait rien : c'est le déplacement qui rend une cadence visible à
    l'œil.
    """
    suite = []
    for numero in range(IMAGES_DU_CLIP):
        image = np.zeros((COTE, COTE, 4), dtype="uint8")
        haut = 6 + numero * 3
        image[haut : haut + 28, 20:44] = (48, 44, 40, 255)
        image[haut + 8 : haut + 13, 44 : 44 + numero * 2] = (48, 44, 40, 255)
        suite.append(image)
    return suite


def _poser_un_clip(atelier: Atelier, identifiant: str = "clip-du-pelerin") -> str:
    """Un clip posé sur le disque **sans passer par une vidéo**, comme `B20`.

    Le décodeur `ffmpeg` n'est pas installé sur cette machine, et l'y ajouter
    pour monter un décor coûterait une dépendance sans rien montrer de plus :
    ce que le montage demande d'un clip tient en deux choses — une génération
    qui se dit clip, et des PNG numérotés à côté.
    """
    atelier.base.enregistrer(
        Generation(
            identifiant=identifiant,
            modele="modele-video-jetable",
            demande={},
            parametres_resolus={},
            projet=atelier.bibliotheque.courant,
            clip=Clip(travail="jetable-rp", images=IMAGES_DU_CLIP, cadence=8.0),
        )
    )
    dossier = atelier.fichiers.dossier_images_clip(identifiant, 0)
    for numero, image in enumerate(_images_du_clip()):
        Image.fromarray(image, mode="RGBA").save(dossier / f"{numero:04d}.png")
    return identifiant


# ── Le montage, route par route ─────────────────────────────────────────────


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _generer(client, double, **corps) -> dict:
    """Une image de plus, par **la seule route qui paie** — mais sur le double.

    `double.rendre` est posé avant chaque appel : sans lui le double rend un
    aplat de 48 × 32, et une grille d'aplats ne dit rien de ce qu'on vient
    regarder.
    """
    double.rendre = lambda: image_sujet(toile=32, bloc=3, logique_l=8, logique_h=16)
    lancee = client.post("/api/generations", json={"modele": MODELE, **corps})
    if lancee.status_code != 202:
        raise SystemExit(f"la génération a été refusée : {lancee.status_code} {lancee.text}")
    finie = _attendre(client, lancee.json()["identifiant"])
    double.rendre = None
    return finie


def peupler(atelier: Atelier, double: FournisseurDouble, dossier: Path) -> dict:
    gabarits = dossier / "gabarits"
    gabarits.mkdir(parents=True, exist_ok=True)
    monte: dict = {}

    with TestClient(creer_application(atelier)) as client:
        # ── Le jeu, ses règles, sa bible ─────────────────────────────────────
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "la création du jeu",
        )["projet"]
        monte["projet"] = projet
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 64,
                    "methode_pixels": "proche",
                    "couleurs": 24,
                    "fond": "#FF00FF",
                    "bible": [
                        {"nom": "monde", "texte": "des marais de sel, au crépuscule", "actif": True},
                        {"nom": "epoque", "texte": "un Moyen Âge lent", "actif": True},
                        {"nom": "trait", "texte": "contour sombre, une seule épaisseur", "actif": True},
                        {"nom": "eclairage", "texte": "une lumière rasante venue de l'ouest", "actif": True},
                    ],
                },
            ),
            "les règles du jeu",
        )

        # ── Quatre familles peuplées, et deux collections vides ──────────────
        #
        # Les collections naissent **vides** : ce qu'on vient voir au geste 4 est
        # un sujet qu'on glisse dessus, et une collection déjà pleine ne dirait
        # pas si le dépôt a marché.
        sujets = {}
        for nom, extra in (
            ("Le pèlerin", {}),
            ("Le garde du moulin", {}),
            ("Le tonneau cerclé", {"famille": "objets", "type": "objet tenu"}),
            ("Le vieux moulin", {"famille": "decors"}),
            # ⚠️ **Pas de famille `terrains`** : le serveur n'en connaît que
            # quatre — `personnages`, `objets`, `decors`, `interface` — plus
            # les équipements, qui sont des pièces et non des sujets.
            ("Le bouton de dialogue", {"famille": "interface"}),
        ):
            sujets[nom] = _exiger(
                client.post("/api/characters", json={"nom": nom, **extra}),
                f"la création de « {nom} »",
            )["personnage"]
        monte["sujets"] = sujets
        pelerin = sujets["Le pèlerin"]["identifiant"]

        collections = []
        for nom in ("Les héros", "Les monstres du marais"):
            collections.append(
                _exiger(
                    client.post("/api/collections", json={"nom": nom, "projet": projet["identifiant"]}),
                    f"la collection « {nom} »",
                )["collection"]
            )
        monte["collections"] = collections

        # Une pièce d'équipement, portée : sans porteur elle naît *déclarée
        # vide* depuis `B19`, et la famille *Les équipements* dirait « aucun
        # emploi » alors que c'est la quatrième porte du geste 4.
        piece = _exiger(
            client.post(
                "/api/characters/pieces",
                json={
                    "nom": "Le bourdon du pèlerin",
                    "description": "a long pilgrim walking staff",
                    "porteur": pelerin,
                },
            ),
            "la pièce d'équipement",
        )["piece"]
        monte["piece"] = piece

        # ── Ce qui décrit le pèlerin (geste 6) ───────────────────────────────
        _exiger(
            client.put(
                f"/api/characters/{pelerin}",
                json={
                    "description": "a weathered pilgrim in a red robe, hood down",
                    # Les clés sont celles de la bible (`CHAMPS_BIBLE`) : un nom
                    # hors de la liste est accepté par la route et **ignoré en
                    # silence**, et la fiche dirait alors « 0 texte » sans qu'on
                    # sache pourquoi.
                    "textes": {
                        "trait": "un contour d'une seule épaisseur, jamais doublé",
                        "eclairage": "une lumière rasante venue de l'ouest",
                    },
                },
            ),
            "le signalement du pèlerin",
        )

        # ── Les images fixes, et une rangée laissée vide (geste 7) ───────────
        #
        # `repos` et `marche` sont remplies, `course` **ne l'est pas** : c'est
        # sur une rangée vide que l'import pointé sur la case se regarde.
        directions = _exiger(
            client.get("/api/characters/directions"), "les directions du jeu"
        )
        premiere = (directions.get("directions") or [{}])[0].get("identifiant") or None
        monte["direction"] = premiere

        for pose in ("repos", "marche", "attaque"):
            _generer(
                client,
                double,
                prompt=f"le pèlerin, {pose}",
                echelle="personnage",
                personnage=pelerin,
                pose=pose,
                **({"direction": premiere} if premiere else {}),
            )
        # **Une seconde image sur la même case**, pour *Comparer* deux versions.
        _generer(
            client,
            double,
            prompt="le pèlerin, marche, seconde version",
            echelle="personnage",
            personnage=pelerin,
            pose="marche",
            **({"direction": premiere} if premiere else {}),
        )
        # Deux images qui n'appartiennent à aucune case — l'onglet *Pas encore
        # rangé*, et de quoi filtrer dans la galerie.
        _generer(client, double, prompt="le vieux moulin au crépuscule", echelle="décor")
        _generer(
            client,
            double,
            prompt="le tonneau cerclé",
            echelle="objet tenu",
            personnage=sujets["Le tonneau cerclé"]["identifiant"],
            pose="tenu",
        )

        # ── Une planche importée de plusieurs cases (gestes 7, 13) ───────────
        fichier = gabarits / "pelerin-six-poses.png"
        fichier.write_bytes(_planche())
        feuille = _exiger(
            client.post("/api/assets/import", json={"chemin": str(fichier), "forcer": True}),
            "l'import de la planche",
        )["asset"]
        _exiger(
            client.put(
                f"/api/assets/{feuille['identifiant']}/character",
                json={"personnage": pelerin},
            ),
            "le rangement de la planche sous le pèlerin",
        )
        monte["feuille"] = feuille

        # ── La toile : quatre cartes, deux notes, une planche (gestes 2, 3) ──
        cartes = []
        for rang, nom in enumerate(
            ("le marais au crépuscule.png", "le moulin de trois quarts.png", "la robe du pèlerin.png")
        ):
            reponse = client.post(
                "/api/board/paste",
                params={"nom": nom, "forcer": True},
                content=image_sujet(toile=64, bloc=4, logique_l=6 + rang),
            )
            if reponse.status_code >= 400:
                raise SystemExit(f"la carte « {nom} » : {reponse.status_code} {reponse.text}")
            cartes.append(reponse.json()["carte"])
        # La planche collée sur la toile — celle qu'on découpe au geste 3.
        reponse = client.post(
            "/api/board/paste",
            params={"nom": "six poses du pèlerin.png", "forcer": True},
            content=_planche(),
        )
        if reponse.status_code >= 400:
            raise SystemExit(f"la planche de la toile : {reponse.status_code} {reponse.text}")
        cartes.append(reponse.json()["carte"])
        notes = []
        for texte in (
            "le sel blanchit tout, même les vêtements",
            "les ailes du moulin tournent lentement, jamais à vide",
        ):
            notes.append(
                _exiger(
                    client.post("/api/board/text", json={"texte": texte, "projet": projet["identifiant"]}),
                    "une note de la toile",
                )
            )

        # **Posées sur le plan, et pas seulement collées.** Une carte collée
        # naît `position: null`, donc *en réserve* : la vue *toile* dit alors
        # « La toile est nue » pendant que le bandeau compte six cartes. Poser
        # les positions ici est ce que le glisser fait à l'écran — et sans ça,
        # le geste 2 n'aurait rien à sélectionner.
        places = [(120, 140), (420, 140), (720, 140), (120, 460), (760, 460), (1040, 460)]
        for carte, (x, y) in zip(cartes + notes, places):
            _exiger(
                client.put(
                    f"/api/board/{carte['identifiant']}",
                    json={
                        "position": [x, y],
                        # Les deux premières entrent dans un îlot : *Mettre en
                        # réserve* doit le vider, et Ctrl+Z le rendre.
                        **({"groupe": "les marais"} if (x, y) in places[:2] else {}),
                    },
                ),
                "la pose d'une carte sur la toile",
            )
        monte["cartes"] = cartes
        monte["notes"] = notes

        # ── Un clip, et trois animations (gestes 10, 11) ─────────────────────
        clip = _poser_un_clip(atelier)
        monte["clip"] = clip
        bandes = []
        for nom, images, cadence, case in (
            ("marche", [0, 1, 2, 3, 4, 5], 8, True),
            ("marche — plus lente", [0, 2, 4, 6], 4, True),
            ("repos", [0, 1], 6, False),
        ):
            corps = {
                "clip": clip,
                "nom": nom,
                "images": images,
                "cadence": cadence,
                "sens": "boucle",
            }
            if case:
                corps.update(
                    {
                        "personnage": pelerin,
                        "pose": "marche",
                        **({"direction": premiere} if premiere else {}),
                    }
                )
            bandes.append(
                _exiger(client.post("/api/strips", json=corps), f"l'animation « {nom} »")
            )
        monte["bandes"] = bandes

        # ── Une fabrication préparée et jamais lancée (geste 14) ─────────────
        #
        # Un travail `prepare` est très exactement ce que `RP16` range sous
        # *Fabrications interrompues* : il attend un geste, et il n'est ni fini
        # ni annulé.
        prepare = client.post(
            f"/api/projects/{projet['identifiant']}/production-jobs/preview",
            json={
                "cle": "rp-garde-marche",
                "personnage": sujets["Le garde du moulin"]["identifiant"],
                "pose": "marche",
                "direction": premiere or "",
                "modele_video": MELE.identifiant,
                "prompt_video": "le garde du moulin marche le long de la digue",
                "modele_image": MODELE,
                "prompt_image": "le garde du moulin, au repos",
            },
        )
        monte["travail_prepare"] = (
            prepare.json() if prepare.status_code < 400 else {"refus": prepare.text, "code": prepare.status_code}
        )

        # ── Le dossier du jeu, une livraison partie, un conflit (geste 15) ───
        godot = dossier / "Jeu Godot"
        godot.mkdir(exist_ok=True)
        (godot / "project.godot").write_text(
            'config_version=5\n[application]\nconfig/name="Le Marais du Vieux Moulin"\n'
            'config/features=PackedStringArray("4.7", "GL Compatibility")\n',
            encoding="utf-8",
        )
        _exiger(
            client.put(
                f"/api/projects/{projet['identifiant']}/godot-link",
                json={"dossier": str(godot)},
            ),
            "l'association au dossier du jeu",
        )
        monte["godot"] = godot

        # **Une seule des deux marches part**, et le serveur l'exige : deux
        # animations sur la même case sont deux versions à départager, et la
        # livraison refuse de choisir à la place de l'auteur — « Deux versions
        # visent le même mouvement et la même direction. En choisir une. »
        # C'est justement ce que l'écran *Comparer* du geste 11 sert à faire.
        livrable = [next(b["identifiant"] for b in bandes if b.get("pose"))]
        premiere_sortie = _exiger(
            client.post(
                f"/api/projects/{projet['identifiant']}/deliveries/preview",
                json={"personnage": pelerin, "bandes": livrable},
            ),
            "la première préparation de livraison",
        )
        partie = _exiger(
            client.post(
                f"/api/projects/{projet['identifiant']}/deliveries",
                json={"jeton": premiere_sortie["jeton"]},
            ),
            "la livraison précédente",
        )
        monte["livraison_precedente"] = partie

        # **Le fichier réécrit à la main**, à l'endroit exact où l'atelier
        # voudrait écrire. C'est ce qui fait naître un conflit — et il ne doit
        # pas bloquer : il doit attendre une décision.
        scene = godot / premiere_sortie["scene"].removeprefix("res://")
        scene.parent.mkdir(parents=True, exist_ok=True)
        scene.write_bytes(LE_TRAVAIL_DE_LAUTEUR)
        monte["scene_reecrite"] = scene

        attendu = _exiger(
            client.post(
                f"/api/projects/{projet['identifiant']}/deliveries/preview",
                json={"personnage": pelerin, "bandes": livrable},
            ),
            "la préparation en conflit",
        )
        monte["conflits"] = attendu.get("conflits", [])
        monte["pret"] = attendu.get("pret")

    return monte


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents — le
    # même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-rp-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        # **Un animateur double, et pas muet.** Sans lui, l'ouverture de
        # l'atelier irait relire le catalogue vidéo chez OpenRouter (`A9`) ; et
        # un catalogue vide refuserait la fabrication préparée du geste 14, qui
        # nomme un modèle de clip. Il ne commande rien : le travail reste
        # `prepare`, ce qui est exactement ce qu'on vient regarder.
        fabrique_animateur=lambda: animateur,
    )

    depart = time.perf_counter()
    monte = peupler(atelier, double, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s — aucun appel payant, aucun réseau")
    print(f"  Jeu        : {monte['projet']['nom']}")
    print(f"  Sujets     : {', '.join(monte['sujets'])}")
    print(f"  Équipement : {monte['piece']['nom']}")
    print(f"  Collections: {', '.join(c['nom'] for c in monte['collections'])} (vides, exprès)")
    print(f"  Toile      : {len(monte['cartes'])} cartes, dont une planche de six cases, et deux notes")
    print(f"  Clip       : {monte['clip']} — {IMAGES_DU_CLIP} images")
    print("  Animations :")
    for bande in monte["bandes"]:
        ou = bande.get("pose") or "sans case"
        print(
            f"    · {bande['nom']:<22} {len(bande.get('prises', []))} images  ·  "
            f"cadence {bande.get('cadence')}  ·  {ou}"
        )
    travail = monte["travail_prepare"]
    print(
        "  Interrompue: "
        + (
            f"{travail.get('identifiant')} — état « {travail.get('etat')} »"
            if "identifiant" in travail
            else f"REFUSÉE ({travail.get('code')}) : {str(travail.get('refus'))[:160]}"
        )
    )
    print(f"  Dossier du jeu : {monte['godot']}")
    print(f"  Livraison précédente : {len(monte['livraison_precedente'].get('fichiers', []))} fichiers")
    print(f"  Conflits en attente : {len(monte['conflits'])} — prête : {monte['pret']}")
    for conflit in monte["conflits"]:
        print(f"    · {conflit['chemin']} — {conflit['raison']} — décision : {conflit['decision']}")

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  Le parcours des quinze gestes : docs/status/etat.md § La relecture croisée")
    print("  → 2 · Univers & toile : Ctrl-clic sur deux cartes, puis Mettre en réserve")
    print("  → 3 · la carte « six poses du pèlerin » : Découper, puis Animer")
    print("  → 4 · Les sujets : glisser un sujet sur « Les héros » dans la colonne")
    print("  → 7 · Le pèlerin › Images fixes : la rangée « course » est vide")
    print("  → 11 · Comparer : les deux marches, 8 et 4 images par seconde")
    print("  → 15 · Livrer au jeu : un conflit, trois décisions")
    print("  Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print()

    if sans_servir:
        print("  (sans-servir : uvicorn n'a pas été lancé)")
        return 0

    # **Un second `Atelier` sur le même dossier**, et il le faut : deux
    # `creer_application` sur une même instance lèvent « StreamableHTTPSession
    # Manager.run() can only be called once per instance ».
    servi = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )
    sys.stdout.flush()
    uvicorn.run(creer_application(servi), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal(sans_servir="sans-servir" in sys.argv[1:]))
