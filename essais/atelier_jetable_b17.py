# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B17 — les moteurs qui
remplacent une génération**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8483 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b17.py

`sans-servir` en argument peuple, mesure et imprime le résumé sans lancer
uvicorn — c'est ce mode-là qui sert de banc : il rend les cinq mesures de la
tranche sur de vraies routes, pas sur des tableaux fabriqués à la main.

## Ce qu'il monte, et pourquoi ces sujets-là

**Le Marais du Vieux Moulin**, une case de 64 px, 16 couleurs, et **quatre
pèlerins qui partent tous de la même image** — c'est le point : ce qui les
sépare est une recette, jamais une génération.

| Le sujet | Ce que sa recette porte | Ce qu'on vient voir |
|---|---|---|
| **Le pèlerin** | la chaîne ordinaire, rien de `B17` | le témoin |
| **Le pèlerin en cape bleue** | un échange de couleurs | **la même silhouette à l'octet près**, une autre cape — et zéro centime |
| **Le pèlerin au crépuscule** | les quatre curseurs | l'exposition rattrapée *avant* que les 16 couleurs soient dépensées |
| **Le pèlerin dépoussiéré** | grain de couleur et lissage | le grain vert que la robe portait, et les dents du bord |

**Le magenta sous la transparence** se lit sur les quatre : le résumé imprime,
pour chacun, s'il reste un pixel vide qui porte encore la couleur du fond.

**Rien n'a été payé** : les images arrivent par `/assets/import`, jamais par une
route de génération. Le script marche réseau coupé.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin en cape bleue › Retoucher › Couleurs.**
   La table porte six réglages de plus : les quatre curseurs, sous la phrase
   *avant de réduire*, et la table d'échange sous *après la réduction*. Bouger
   *couleurs* de 16 à 32 **ne doit pas effacer l'échange** — c'est la panne que
   `decalage` a payée en `E17`, et c'est le premier geste à faire.
2. **La même table, curseurs.** Descendre *luminosité* à −40 et regarder les
   couleurs obtenues : elles changent, parce que la réduction voit une autre
   image. Remonter à 0 doit rendre l'image de départ **au pixel près**.
3. **Retoucher › Nettoyer.** Deux curseurs de plus, chacun avec la phrase qui
   dit ce qu'il fait et ce qu'il ne touche jamais. Monter *grain de couleur* à 1
   fait partir le pixel vert au milieu de la robe — ce qu'aucune valeur de
   *tache minimale* n'a jamais pu faire.
4. **Retoucher › Détourage**, tout en bas : la ligne qui annonce le lit de
   couleur. Il n'a pas de curseur, et c'est dit.
5. **La barre des tables** : le carré de *Nettoyer* doit se remplir quand seul
   le grain est posé, et son résumé lire `grain 1` à côté du titre.
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
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** — même raison qu'en B9/B10 :
# deux doubles qui divergeraient finiraient par ne plus décrire le produit.
from conftest import image_sujet  # noqa: E402

PORT = 8483

# Le fond du jeu — une couleur franche que la palette ne contient pas, comme
# `atelier/domaine/fond.py` la propose. C'est elle qu'on cherchera sous la
# transparence des fichiers rendus.
FOND = "#FF00FF"

# La cape, telle que la quantification la rend, et ce qu'on veut à la place.
# Les deux sont relues sur le rendu au lancement — rien n'est deviné ici.
CAPE_VOULUE = "#3A6BC4"


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _sur_fond_magenta(octets: bytes) -> bytes:
    """La même image, reposée sur un fond magenta franc.

    Le double des essais peint sur un gris clair ; le détourage l'emporte tout
    aussi bien, mais **ce qui reste sous la transparence serait alors gris**, et
    le magenta du jeu est très exactement ce que la tranche vient chasser.
    """
    with Image.open(io.BytesIO(octets)) as image:
        tableau = np.asarray(image.convert("RGB")).copy()
    coin = tableau[0, 0].copy()
    fond = np.all(tableau == coin, axis=2)
    tableau[fond] = (255, 0, 255)
    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _pelerin_pique(cote: int = 64) -> bytes:
    """Un pèlerin peint **directement à la taille de la case**, avec ses défauts.

    **Pourquoi celui-là ne passe pas par le double des essais.** Les trois autres
    sujets partent d'une image de 144 px que la chaîne réduit ; un grain d'un
    pixel n'y survivrait pas à la réduction, et la mesure dirait *zéro* sans que
    rien ne soit cassé — `docs/PIEGES.md` appelle ça *une mesure qui ne dit pas
    « il n'y a rien » mais « je ne sais pas regarder »*. Peint à 64 px et posé
    **sans place `grille`**, un pixel de la source est un pixel du rendu, et les
    deux défauts se comptent pour de vrai.

    Ce qu'il porte, et que rien dans le produit d'avant `B17` ne voyait :

    - **un grain vert** au milieu de la robe — opaque, collé au sujet, donc
      aucune tache : aucune valeur de *tache minimale* ne l'atteint ;
    - **un compagnon vert de deux pixels** un peu plus bas, qui doit **survivre**
      — un détail a un compagnon, une poussière n'en a pas ;
    - **quatre dents en diagonale** au bord, qui ne tiennent au sujet que par un
      coin — ce que le lissage décroche.
    """
    tableau = np.zeros((cote, cote, 3), dtype=np.uint8)
    tableau[:, :] = (255, 0, 255)

    haut, bas = 12, cote - 6
    gauche, droite = 22, cote - 22
    for colonne in range(gauche, droite):
        tableau[haut:bas, colonne] = (190, 40, 40) if colonne % 2 == 0 else (120, 25, 25)

    # Le grain, et son voisin de deux pixels.
    tableau[28, 30] = (0, 255, 0)
    tableau[36, 30] = (0, 255, 0)
    tableau[36, 31] = (0, 255, 0)

    # Quatre dents qui ne tiennent au sujet que par un coin.
    for y, x in ((haut - 1, gauche - 1), (haut - 1, droite), (bas, gauche - 1), (bas, droite)):
        tableau[y, x] = (190, 40, 40)

    # **Et une étincelle qui flotte à cinq pixels du sujet.** C'est elle qui
    # sépare les deux moteurs. La planche nomme le raté d'un seuil de taille —
    # *« la pointe de la lance du garde, une étincelle, un éclat de magie
    # disparaissent en même temps que les miettes »* — et c'est exactement ce
    # que le décrochage évite : il ne retire que ce qui **touche le sujet par un
    # coin**, jamais ce qui flotte au large.
    tableau[haut + 6, gauche - 5] = (250, 240, 30)

    tampon = io.BytesIO()
    Image.fromarray(tableau, mode="RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def _recette(sans_grille: bool = False, **places) -> dict:
    """La chaîne ordinaire du produit, plus ce que l'appelant ajoute.

    **Une passe de détourage vive, toujours** : c'est elle qui fait exister le
    magenta sous la transparence, donc le défaut que la tranche répare — et
    c'est elle aussi qui fait compter `occupation` (`sur_grille`, `case=True`).
    """
    charge: dict = {
        "passes": [{"moteur": "bord", "tolerance": 28, "seuil_alpha": 128}],
        "grille": {"cible": 64, "occupation": 100, "ancrage": "bas", "methode": "proche"},
        "quantification": {"couleurs": 16, "palette": [], "tramage": "aucun"},
    }
    if sans_grille:
        # **Sans remise sur grille**, pour le sujet déjà peint à 64 px : un pixel
        # de la source reste un pixel du rendu, et un grain d'un pixel se compte.
        charge.pop("grille")
    for nom, valeur in places.items():
        if nom == "quantification":
            charge["quantification"].update(valeur)
        else:
            charge[nom] = valeur
    return charge


def _poser(client, gabarit: Path, personnage: str, charge: dict) -> dict:
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        f"l'import d'une image pour « {personnage} »",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": "repos"},
        ),
        f"la case « repos » de « {personnage} »",
    )
    asset = _exiger(
        client.put(f"/api/assets/{identifiant}/recipe", json=charge),
        f"la recette de « {personnage} »",
    )
    _exiger(
        client.put("/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}),
        f"la retenue de « {personnage} »",
    )
    return asset


def _rendu(client, identifiant: str) -> np.ndarray:
    """**Le fichier que l'auteur télécharge**, relu en tableau.

    `/download` et non `/image` : le critère de la tranche parle d'*un fichier
    exporté*, et c'est cette route-là qui l'écrit. C'est aussi le seul niveau qui
    prouve quoi que ce soit — `B1` l'a appris en découvrant que la queue
    s'appliquait deux fois sans qu'aucun essai ne puisse le voir depuis le
    domaine.
    """
    reponse = client.get(f"/api/assets/{identifiant}/download")
    if reponse.status_code >= 400:
        raise SystemExit(f"le rendu de {identifiant} : {reponse.status_code} {reponse.text}")
    with Image.open(io.BytesIO(reponse.content)) as image:
        return np.asarray(image.convert("RGBA")).copy()


def _porte_du_magenta(rgba: np.ndarray) -> bool:
    vides = rgba[:, :, 3] == 0
    if not vides.any():
        return False
    return bool((rgba[vides][:, :3] == np.array([255, 0, 255], np.uint8)).all(axis=1).any())


def _pixels_proches_du_fond(rgba: np.ndarray, tolerance: int = 40) -> int:
    """Combien de pixels **transparents** portent encore une couleur voisine du
    fond du jeu.

    **C'est la mesure qui manquait, et le magenta exact ne suffisait pas** : la
    réduction sur grille et la quantification déplacent le `#FF00FF` de quelques
    crans, si bien qu'un rendu pouvait annoncer « plus de magenta » tout en
    portant, sous ses pixels vides, un rose que la moindre réduction fera
    remonter en liseré. C'est ce liseré-là que la tranche chasse, pas une valeur
    d'octet particulière.
    """
    vides = rgba[:, :, 3] == 0
    if not vides.any():
        return 0
    couleurs = rgba[vides][:, :3].astype(np.int16)
    fond = np.array([255, 0, 255], np.int16)
    return int((np.abs(couleurs - fond).max(axis=1) <= tolerance).sum())


def _couleur_dominante(rgba: np.ndarray) -> str:
    """La couleur la plus portée par les pixels **visibles**."""
    visibles = rgba[rgba[:, :, 3] > 0][:, :3].astype(np.int32)
    if not len(visibles):
        return "—"
    codes = visibles[:, 0] * 65536 + visibles[:, 1] * 256 + visibles[:, 2]
    gagnant = int(np.bincount(codes).argmax())
    return f"#{gagnant:06X}"


def _monter_sans_le_lit() -> dict:
    """Le même montage, **le lit de couleur éteint** — le témoin de la mesure 1.

    Un second atelier jetable, dans un second dossier temporaire : c'est le seul
    moyen d'obtenir les fichiers d'avant la tranche sans les fabriquer à la
    main. Le moteur est remplacé par l'identité le temps du montage, puis remis —
    `queue` le cherche dans son module, donc l'échange suffit.
    """
    from atelier.image import traitement

    vrai = traitement.etaler_sous_la_transparence
    traitement.etaler_sous_la_transparence = lambda rgba, *reste, **nommes: rgba
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b17-temoin-"))
    try:
        return peupler(Atelier(racine=dossier), dossier)["sujets"]
    finally:
        traitement.etaler_sous_la_transparence = vrai


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le Marais du Vieux Moulin"}),
            "le projet",
        )["projet"]["identifiant"]
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 64,
                    "methode_pixels": "proche",
                    "couleurs": 16,
                    "fond": FOND,
                },
            ),
            "les réglages de l'univers",
        )

        brut = image_sujet(toile=48, bloc=3, logique_l=8, logique_h=14)
        propre = dossier / "pelerin.png"
        propre.write_bytes(_sur_fond_magenta(brut))
        pique = dossier / "pelerin-pique.png"
        pique.write_bytes(_pelerin_pique())

        sujets: dict[str, dict] = {}
        for nom, gabarit, charge in (
            ("Le pèlerin", propre, _recette()),
            (
                "Le pèlerin en cape bleue",
                propre,
                _recette(
                    quantification={
                        "echanges": [
                            {"depuis": "#BE2828", "vers": CAPE_VOULUE, "tolerance": 40}
                        ]
                    }
                ),
            ),
            (
                "Le pèlerin au crépuscule",
                propre,
                _recette(
                    quantification={
                        "luminosite": -25,
                        "contraste": 15,
                        "saturation": -20,
                        "teinte": 40,
                    }
                ),
            ),
            (
                "Le pèlerin dépoussiéré",
                pique,
                # **`aire_min` à zéro, et c'est tout le point de la mesure** :
                # ce qui part ici, seul le décrochage sait le retirer — et il
                # laisse l'étincelle qu'un seuil de taille aurait emportée.
                _recette(
                    sans_grille=True,
                    bords={"aire_min": 0, "grain_min": 1, "lissage": 1},
                ),
            ),
        ):
            personnage = _exiger(
                client.post(
                    "/api/characters",
                    json={"nom": nom, "description": "", "type": "personnage"},
                ),
                f"la création de « {nom} »",
            )["personnage"]["identifiant"]
            asset = _poser(client, gabarit, personnage, charge)
            sujets[nom] = {
                "personnage": personnage,
                "asset": asset,
                "rendu": _rendu(client, asset["identifiant"]),
            }

        # ── Le témoin du grain, la même recette sans le moteur ───────────────
        #
        # **On mesure une réparation contre son absence**, jamais contre une
        # intention : `docs/PIEGES.md` — une mesure trop large ne dit pas « il
        # n'y a rien », elle dit « je ne sais pas regarder ».
        temoin = _exiger(
            client.post(
                "/api/characters",
                json={"nom": "Le pèlerin piqué (témoin)", "description": "", "type": "personnage"},
            ),
            "la création du témoin",
        )["personnage"]["identifiant"]
        asset_temoin = _poser(
            client,
            pique,
            temoin,
            _recette(sans_grille=True, bords={"aire_min": 0, "grain_min": 0, "lissage": 0}),
        )
        sujets["Le pèlerin piqué (témoin)"] = {
            "personnage": temoin,
            "asset": asset_temoin,
            "rendu": _rendu(client, asset_temoin["identifiant"]),
        }

        return {"projet": projet, "sujets": sujets}


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et
    # des flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b17-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)
    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    sujets = monte["sujets"]
    print()
    print(f"  Montage : {duree:.1f} s  ·  case du jeu 64 px  ·  16 couleurs  ·  fond {FOND}")
    print()
    print("  Ce que le serveur a vraiment rendu — relu sur les octets servis par la route :")
    for nom, sujet in sujets.items():
        rgba = sujet["rendu"]
        print(
            f"    · {nom:<28} {rgba.shape[1]}×{rgba.shape[0]} px  ·  "
            f"couleur dominante {_couleur_dominante(rgba)}  ·  "
            f"magenta sous la transparence : {'OUI' if _porte_du_magenta(rgba) else 'non'}"
        )

    print()
    print("  Les cinq mesures de la tranche :")

    # 1. Le lit de couleur — **contre son témoin**, comme les mesures 4 et 5.
    #
    # ⚠️ La première écriture comptait seulement « combien de rendus ne portent
    # plus de magenta », et répondait 5 sur 5 — **y compris le moteur éteint**.
    # Trois des cinq sujets passent par la réduction sur grille, qui détruit
    # déjà le magenta exact sous la transparence : ils ne mesuraient rien, et le
    # chiffre disait plus que ce qui avait été mesuré. Le même montage tourne
    # donc une seconde fois, moteur éteint, et les deux comptes se lisent
    # ensemble — c'est la règle de `docs/PIEGES.md` : *une mesure trop large ne
    # dit pas « il n'y a rien », elle dit « je ne sais pas regarder »*.
    sans_le_lit = _monter_sans_le_lit()
    portaient = [n for n, s in sans_le_lit.items() if _porte_du_magenta(s["rendu"])]
    reste = [n for n, s in sujets.items() if _porte_du_magenta(s["rendu"])]
    print(
        f"    1. lit de couleur — magenta sous la transparence : "
        f"{len(portaient)}/{len(sans_le_lit)} sans le moteur → "
        f"{len(reste)}/{len(sujets)} avec"
    )
    if portaient:
        print(f"       il en portait : {', '.join(portaient)}")
    if reste:
        print(f"       il en reste : {', '.join(reste)}")
    # Et **ce que le moteur change vraiment**, sujet par sujet : combien de
    # pixels transparents portaient une couleur qu'il a remplacée, et combien en
    # portaient une voisine du fond. Les deux comptes ensemble disent où il sert
    # et où il ne sert pas — un moteur qui ne changerait rien nulle part
    # afficherait une colonne de zéros, et c'est ce qu'il faut pouvoir lire.
    print("       ce que le moteur change, sujet par sujet :")
    for nom, sujet in sujets.items():
        avant = sans_le_lit[nom]["rendu"]
        apres = sujet["rendu"]
        vides = apres[:, :, 3] == 0
        changes = int((avant[vides][:, :3] != apres[vides][:, :3]).any(axis=1).sum())
        print(
            f"         · {nom:<28} {changes:>5} pixels transparents repeints  ·  "
            f"couleur voisine du fond : {_pixels_proches_du_fond(avant)} → "
            f"{_pixels_proches_du_fond(apres)}"
        )

    # 2. L'échange — la silhouette doit être identique à l'octet près.
    temoin = sujets["Le pèlerin"]["rendu"]
    bleue = sujets["Le pèlerin en cape bleue"]["rendu"]
    meme_silhouette = temoin.shape == bleue.shape and np.array_equal(
        temoin[:, :, 3], bleue[:, :, 3]
    )
    couleurs_differentes = not np.array_equal(temoin[:, :, :3], bleue[:, :, :3])
    print(
        f"    2. échange de couleurs — silhouette identique à l'octet près : "
        f"{'oui' if meme_silhouette else 'NON'}  ·  "
        f"couleurs changées : {'oui' if couleurs_differentes else 'NON'}  ·  "
        f"dominante {_couleur_dominante(temoin)} → {_couleur_dominante(bleue)}  ·  "
        f"coût : $0.000"
    )

    # 3. Les curseurs — l'image réduite n'est pas la même.
    crepuscule = sujets["Le pèlerin au crépuscule"]["rendu"]
    print(
        f"    3. quatre curseurs — l'image réduite diffère du témoin : "
        f"{'oui' if not np.array_equal(temoin, crepuscule) else 'NON'}  ·  "
        f"dominante {_couleur_dominante(temoin)} → {_couleur_dominante(crepuscule)}"
    )

    # 4. Le grain de couleur — contre son propre témoin.
    piquee = sujets["Le pèlerin piqué (témoin)"]["rendu"]
    nette = sujets["Le pèlerin dépoussiéré"]["rendu"]
    vert = np.array([0, 255, 0], np.uint8)

    def _grains(rgba: np.ndarray) -> int:
        vus = rgba[rgba[:, :, 3] > 0][:, :3].astype(np.int16)
        return int((np.abs(vus - vert).max(axis=1) <= 90).sum())

    print(
        f"    4. grain de couleur — pixels verts visibles : "
        f"{_grains(piquee)} sans le moteur → {_grains(nette)} avec  ·  "
        f"aucune valeur de « tache minimale » ne les atteignait"
    )

    # 5. L'escalier — et surtout ce qu'il **laisse**, là où un seuil de taille
    # aurait mangé. C'est cette seconde moitié qui justifie le moteur : sans
    # elle, `aire_min` faisait déjà le travail.
    etincelle = np.array([250, 240, 30], np.int16)

    def _etincelles(rgba: np.ndarray) -> int:
        vus = rgba[rgba[:, :, 3] > 0][:, :3].astype(np.int16)
        return int((np.abs(vus - etincelle).max(axis=1) <= 60).sum())

    print(
        f"    5. escalier — pixels opaques : {int((piquee[:, :, 3] > 0).sum())} sans "
        f"lissage → {int((nette[:, :, 3] > 0).sum())} avec une passe  ·  "
        f"l'étincelle détachée survit : "
        f"{'oui' if _etincelles(nette) == _etincelles(piquee) > 0 else 'NON'} "
        f"({_etincelles(piquee)} → {_etincelles(nette)}) — un seuil de taille l'aurait emportée"
    )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin en cape bleue › Retoucher › Couleurs")
    print("    · bouger « couleurs » de 16 à 32 ne doit PAS effacer l'échange")
    print("    · les quatre curseurs sont sous « avant de réduire »")
    print("    · la table d'échange est sous « après la réduction »")
    print("  → Le pèlerin dépoussiéré › Retoucher › Nettoyer : grain de couleur, lissage")
    print("  → Retoucher › Détourage, tout en bas : la ligne du lit de couleur")
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
