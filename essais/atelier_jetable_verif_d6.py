# -*- coding: utf-8 -*-
"""Un atelier jetable pour regarder **`D6` — le dernier châssis tombe** au navigateur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8502 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Ce que `D6` a fait, en clair

`chassis.tsx` portait les quelques contrôles que tout le produit réutilise — le
bouton, le libellé, la raison sous un contrôle grisé, les segments, le curseur,
le bloc repliable, la jauge d'attente. Chacun en avait **deux habillages** : celui
du châssis chaud et sombre d'avant, et celui du papier du carnet, choisi par une
prop `papier`. Plus un seul écran ne demandait le premier : la branche sombre est
partie, la prop avec elle, et le fichier s'appelle maintenant
`interface/src/composants/pieces.tsx` — le nom de ce qu'il est.

Trois choses n'avaient plus d'appelant du tout et sont parties : le composant
`Etape` (la place de recette de l'ancien établi), le contexte `NomDuReglage` que
personne ne fournissait, et `ouvrirPli`.

Et cinq derniers restes de couleur sombre, atteignables depuis des écrans
pourtant clairs, ont été portés au papier :

- la **bulle d'explication** (`Infobulle.tsx`) : elle était presque noire au
  survol de n'importe quel libellé du produit ; elle est en `--carte` sur
  `--trait`, avec le lien « Le guide › » en rouille ;
- l'**aperçu plein écran** (`Apercu.tsx`) : son fond en `--encre/92`, son pied en
  `--papier` ;
- le **damier de transparence** : il y en avait deux, celui du papier et celui de
  l'ancien châssis — dix-huit surfaces employaient encore le second ;
- le **curseur** de l'écran de découpe, qui gardait le rail bleu d'avant ;
- trois **couleurs posées à la main** dans le montage d'une animation, et la
  surface « choisir une image de référence » d'`App.tsx`.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_verif_d6.py

## Ce qu'il monte

Le même décor que la vérification de `C9`, parce que c'est celui qui touche tous
les écrans d'un coup : un projet avec ses règles réglées, trois sujets — un
personnage, un objet, un décor — chacun avec deux images générées (donc deux
dépenses), une pièce d'équipement portée par le personnage, un clip et une bande
montée dessus, rangée dans une attitude.

Rien n'a été payé : le fournisseur et l'animateur sont des doubles.

## Ce qu'on vient voir à l'écran

**La question est une seule : reste-t-il un rectangle sombre quelque part ?**
Sur chacun des six écrans, on cherche ce qui n'est pas du papier.

1. **La galerie.** Survole n'importe quel libellé pointillé — dans la barre
   d'outils, dans la fiche d'une image : **la bulle qui paraît doit être claire**,
   fond crème, trait beige, « Le guide › » en rouille. C'était le reste le plus
   visible du châssis sombre, et il paraissait sur tous les écrans à la fois.
   Clique une tuile détourée : son damier de transparence est celui du papier,
   carreaux de 14 px en beige clair — plus le gris ardoise d'avant. Ouvre une
   image en grand (touche Espace) : le fond de l'aperçu est de l'encre à 92 %,
   son pied est du papier avec le titre en encre.
2. **L'univers** (le carnet › une famille). La grille et ses vignettes ; là
   encore, le damier et les bulles.
3. **L'établi d'un sujet** (clique le personnage). C'est l'écran le plus dense en
   pièces : libellés, blocs repliables, segments, curseurs, boutons. Replie et
   déplie un bloc — sa valeur passe à droite en rouille, sa rangée s'éclaire en
   `--papier-cote` au survol, l'arrondi est de 5 px. Tire un curseur et **tape un
   chiffre pendant que tu le tiens** : le champ à sa droite fait 70 px, en encre
   sur du papier.
4. **Les réglages** (les règles du jeu, puis l'installation). Beaucoup de
   libellés, de segments et de boutons grisés : chaque grisé porte sa raison en
   ligne sœur, mono, en `--encre-4`, avec son tiret. Aucun texte bleu-cyan ne
   doit rester.
5. **L'atelier d'une animation** (le personnage › ses animations › la bande
   « marche »). Ouvre le montage : les vignettes de la pellicule s'encadrent en
   rouille quand elles sont retenues (c'était du cyan), et la rangée de bas de
   page des images retirées est sur `--carte` bordé `--trait` (c'était un fond
   presque noir).
6. **Les dépenses.** Les deux générations y sont ; on y vérifie surtout que la
   jauge et les blocs y sont du même papier que partout.

**La jauge, si tu veux la voir :** elle ne paraît qu'au-delà de 240 ms d'attente.
Relance une génération depuis la barre qui paie (le double répond tout de suite,
donc elle peut passer trop vite) ; sur une tuile en cours, c'est désormais **un
filet d'un pixel en `--encre-3`** sur un rail `--trait-faible`, et non deux
pixels de rouille — le rouille reste au bouton qui dépense, un seul par écran.

Et le point de comparaison des mots du vocabulaire papier, à côté :

    .venv/Scripts/python.exe -m http.server 8933 --directory docs/pistes-2026-09-04/carnet
"""

from __future__ import annotations

import sys
import tempfile
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.image import clip as decodeur  # noqa: E402
from atelier.services import Atelier  # noqa: E402

from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402
from test_a10 import clip_connu  # noqa: E402

PORT = 8502
MODELE = "essai:rend-du-png"


def _exiger(reponse, quoi: str):
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _attendre(client, generation: str) -> dict:
    for _ in range(600):
        etat = client.get(f"/api/generations/{generation}").json()
        if etat["statut"] in ("reussie", "echouee"):
            return etat
        client.get("/api/status")
    return client.get(f"/api/generations/{generation}").json()


def _sujet(client, nom: str, **corps) -> dict:
    return _exiger(
        client.post("/api/characters", json={"nom": nom, **corps}),
        f"la création de « {nom} »",
    )["personnage"]


def _calque(
    atelier, client, dossier: Path, *, personnage: str, piece: str, pose: str
) -> str:
    """Un calque posé à la main — même geste que `atelier_jetable_verif_c9.py`."""
    fichier = dossier / f"{personnage}-{piece}-{pose}.png"
    fichier.write_bytes(image_sujet(toile=64, bloc=4))
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(fichier), "forcer": True}),
        f"l'import du calque « {piece} »",
    )["asset"]
    objet = atelier.assets.lire(importe["identifiant"])
    objet.personnage = personnage
    objet.pose = pose
    objet.piece = piece
    objet.label = f"{piece} · {pose}"
    atelier.assets.sauver(objet)
    return objet.identifiant


def _images(
    client, double, sujet_id: str | None, nom: str, *, poses: tuple[str, ...] = ("", "")
) -> None:
    """Deux images générées — donc deux dépenses (une génération coûte)."""
    for rang, pose in enumerate(poses):
        double.rendre = lambda r=rang: image_sujet(bloc=4, toile=24, logique_l=8 + r)
        corps = {
            "modele": MODELE,
            "prompt": f"{nom}, vue {rang + 1}",
            "echelle": "personnage",
        }
        if sujet_id is not None:
            corps["personnage"] = sujet_id
            corps["pose"] = pose
        lancee = client.post("/api/generations", json=corps)
        assert lancee.status_code == 202, lancee.text
        _attendre(client, lancee.json()["identifiant"])
    double.rendre = None


def peupler(
    atelier: Atelier,
    double: FournisseurDouble,
    animateur: AnimateurDouble,
    dossier: Path,
) -> dict:
    gabarits = dossier / "gabarits"
    gabarits.mkdir(parents=True, exist_ok=True)
    with TestClient(creer_application(atelier)) as client:
        _exiger(
            client.post("/api/projects", json={"nom": "Vérification D6"}),
            "la création du projet",
        )
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": 32,
                    "couleurs": 24,
                    "vue": "vue-dessus-34",
                },
            ),
            "le réglage des règles du jeu",
        )

        personnage = _sujet(client, "Le nain forgeron")
        objet = _sujet(client, "Une épée courte", famille="objets", type="objet tenu")
        decor = _sujet(client, "Les cavernes du nord", famille="decors")

        _images(
            client,
            double,
            personnage["identifiant"],
            "le nain forgeron",
            poses=("repos", "marche"),
        )
        _images(
            client, double, objet["identifiant"], "une épée courte", poses=("tenu", "tenu")
        )
        _images(client, double, None, "les cavernes du nord")

        piece = _exiger(
            client.post(
                "/api/characters/pieces",
                json={
                    "nom": "Marteau de forge",
                    "description": "a heavy two-handed war hammer",
                    "emplacement": "les mains",
                },
            ),
            "la création de la pièce d'équipement",
        )["piece"]
        _calque(
            atelier,
            client,
            gabarits,
            personnage=personnage["identifiant"],
            piece=piece["identifiant"],
            pose="repos",
        )
        _exiger(
            client.post(
                f"/api/characters/pieces/{piece['identifiant']}/uses",
                json={"genre": "porte", "porteur": personnage["identifiant"]},
            ),
            "l'attribution de la pièce à son porteur",
        )

        # ── Un clip, et une bande montée dessus ───────────────────────────────
        sprite_id = client.get("/api/assets").json()["assets"][0]["identifiant"]
        animateur.octets = clip_connu()
        animateur.facture = 0.0
        lot = client.post(
            "/api/clips",
            json={"modele": MELE.identifiant, "mouvement": "marche", "asset": sprite_id},
        ).json()["clips"]
        clip = lot[0]["identifiant"]
        for _ in range(600):
            arrives = client.get("/api/clips").json()["clips"]
            if arrives and all(c["statut"] in ("reussie", "echouee") for c in arrives):
                break
            client.get("/api/status")

        bande = client.post(
            "/api/strips",
            json={
                "clip": clip,
                "nom": "marche",
                "images": [12, 14, 16, 18, 20],
                "cadence": 8,
                "sens": "boucle",
            },
        ).json()
        client.put(
            f"/api/strips/{bande['identifiant']}/case",
            json={"personnage": personnage["identifiant"], "pose": "marche"},
        )

        return {
            "personnage": personnage["identifiant"],
            "objet": objet["identifiant"],
            "decor": decor["identifiant"],
            "piece": piece["identifiant"],
            "clip": clip,
            "bande": bande["identifiant"],
        }


def principal() -> int:
    manque = decodeur.indisponible()
    if manque:
        print(f"Le décodeur vidéo manque : {manque}")
        print("Sans lui, le clip n'a aucune image à découper — la bande sera absente.")

    dossier = Path(tempfile.mkdtemp(prefix="atelier-verif-d6-"))
    print(f"Dossier jetable : {dossier}")

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )

    depart = time.perf_counter()
    monte = peupler(atelier, double, animateur, dossier)
    duree = time.perf_counter() - depart

    print()
    print("  Appels payés : 0  (fournisseur et animateur sont des doubles)")
    print(f"  Montage      : {duree:.1f} s")
    print(f"  Personnage   : {monte['personnage']}")
    print(f"  Objet        : {monte['objet']}")
    print(f"  Décor        : {monte['decor']}")
    print(f"  Pièce        : {monte['piece']}")
    print(f"  Clip         : {monte['clip']}")
    print(f"  Bande        : {monte['bande']}")
    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → survole n'importe quel libellé pointillé : la bulle est CLAIRE")
    print("  → une tuile détourée : damier du papier, carreaux de 14 px")
    print("  → Espace sur une image : aperçu plein écran, pied en papier")
    print("  → l'établi du personnage : blocs, segments, curseurs, champ de 70 px")
    print("  → les règles du jeu et l'installation : les grisés et leurs raisons")
    print("  → ses animations › la bande « marche » › le montage : encadrés rouille")
    print("  → les dépenses : deux générations")
    print("  On cherche une seule chose : un rectangle sombre. Il n'y en a plus.")
    print()
    print("Ctrl-C pour arrêter. Le dossier jetable peut être effacé après.")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
