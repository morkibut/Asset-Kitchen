# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer la tranche **B12 — l'essai**.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8484 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

## Comment le lancer

    cd interface && npm run build      # sans quoi l'écran servi est l'ancien
    .venv/Scripts/python.exe essais/atelier_jetable_b12.py

`sans-servir` en argument peuple et imprime le résumé sans lancer uvicorn.

## Ce qu'il monte, et pourquoi ces cas-là

Un jeu, **« Le marais »**, une case de 48 px, quatre directions, et deux sujets.
Le pèlerin porte une animation par pose, et **chacune à une cadence
différente** — c'est ce qui rend la vitesse vérifiable à l'œil et au chiffre.

| La pose | La direction | Sa cadence | Le temps d'une image | Ce qu'elle montre |
|---|---|---|---|---|
| **repos** | `sud`, `nord`, `est`, `ouest` | 8 i/s | **125 ms**, pile | le repli quand une pose manque, dans les quatre sens |
| **marche** | `sud` | 12 i/s | **83 ms** (et non 83,33) | l'arrondi que le descriptif écrit |
| **course** | `sud` | 14 i/s | **71 ms** | visiblement plus vif que la marche |
| **attaque** | `est` **seulement** | 16 i/s | **62 ms** | ⚠️ **la cadence qui fait diverger les deux arrondis** : `Math.round` aurait rendu 63 |
| **dégâts**, **mort** | — | — | — | deux poses sans aucune animation |

La **grenouille** porte un seul repos, à 6 i/s, sur une case de 24 px — la
moitié du pèlerin. C'est le second sujet qu'on pose à côté pour juger les
tailles en mouvement.

Le pèlerin porte en plus **une image fixe au repos**, importée. Elle ne sert pas
l'essai, qui ne montre que des animations : elle sert l'écran du clip, qui
refuse de chiffrer quoi que ce soit sans image de départ — sans elle, le prix
ne s'annoncerait pas et le troisième critère ne serait pas vérifiable.

**Aucun clip n'est découpé ici** — même choix que `essais/atelier_jetable_b11.py`
et `tests/test_b11.py` : les bandes sont écrites directement dans le dépôt,
fiche d'abord, planche ensuite, index enfin, comme un montage les aurait
laissées. Chaque bande porte une **vraie planche de sprites** dont la case
change de teinte et porte son numéro, pour que le mouvement se voie et que
l'image jouée se compte.

**Rien n'a été payé** : aucune route de génération n'est appelée, aucun
fournisseur n'est sollicité.

## Ce qu'on vient voir à l'écran

1. **Codex › Personnages › Le pèlerin**, puis l'onglet **L'essai**.
2. **Cliquer dans la scène** : elle prend un contour rouille, et le pied écrit
   *La scène a le clavier*. Avant ce clic, aucune touche ne fait rien — c'est
   voulu : Ctrl+K et `?` restent au carnet.
3. **Z Q S D** déplacent, **Maj** fait courir, **Espace** attaque, **1 à 6**
   jouent une pose directement. L'étiquette en haut à gauche écrit la pose, la
   direction, la cadence, **le temps d'une image en millisecondes** et le rang
   de l'image jouée.
4. **La vitesse, vérifiée au chiffre** : au repos elle écrit `8 i/s · 125 ms` ;
   en marchant, `12 i/s · 83 ms` ; l'attaque vers l'est, `16 i/s · 62 ms`.
   **Ce sont exactement les nombres du descriptif d'export** — le résumé
   ci-dessous les imprime, relus de `duree_en_ms`, avant même d'ouvrir le
   navigateur.
5. **L'animation qui manque** : appuyer sur **4** (l'attaque) alors qu'on
   regarde vers le sud. Le volet écrit *attaque vers sud n'existe pas*, le
   personnage **reste au repos**, et la liste dessous montre que l'attaque
   existe vers l'est — sans y aller toute seule. Cliquer *vers est* y va.
6. **La scène** (onglet du volet) : le fond (gris neutre, clair, damier, la
   couleur du jeu), la grille, le cadre de la case, le sol plat ou en pente, et
   *un deuxième sujet* — choisir **La grenouille**, qui apparaît à côté, deux
   fois plus petite et animée à sa propre cadence. **Aucun de ces gestes
   n'appelle le serveur** : l'onglet réseau du navigateur reste vide.
7. **Demander un clip** : le bouton rouille porte la pose et la direction
   regardées. Il ouvre l'écran du clip **déjà rempli**, et c'est là que le prix
   s'annonce, avant de commander.
8. **La barre qui paie a disparu** sur cet onglet, et revient sur les trois
   autres : un seul bouton rouille par écran.

## ⚠️ Ce qu'il ne faut pas faire

Le lancer sur `donnees/` — il crée un jeu, deux sujets et sept bandes. Le
dossier temporaire est imprimé à chaque lancement ; c'est lui qu'on efface
après.
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
from atelier.domaine import aseprite  # noqa: E402
from atelier.domaine.bande import Bande, Cadre, Prise  # noqa: E402
from atelier.domaine.generation import Generation  # noqa: E402
from atelier.services import Atelier  # noqa: E402

# Le double des essais, **importé et pas recopié** — même raison qu'en B9/B10 :
# deux doubles qui divergeraient finiraient par ne plus décrire le produit.
from conftest import image_sujet  # noqa: E402

PORT = 8484

CASE = 48

# Quatre teintes bien distinctes, et le corps se déplace d'une case à l'autre :
# une planche dont seule la couleur change laisserait croire que rien ne bouge
# quand le métronome s'arrête.
TEINTES = ((196, 90, 90), (90, 150, 196), (120, 180, 100), (210, 170, 70))


def _exiger(reponse, quoi: str):
    """**Le refus se lit, il ne se devine pas.**"""
    if reponse.status_code >= 400:
        raise SystemExit(
            f"Le serveur a refusé {quoi} ({reponse.status_code}) : {reponse.text}"
        )
    return reponse.json()


def _planche(compte: int, cote: int) -> bytes:
    """Un PNG de `compte` cases, **et le sujet y bouge vraiment**.

    Chaque case porte son numéro et une silhouette dont la position varie : le
    numéro sert à compter l'image jouée, la silhouette à voir le rythme.
    """
    feuille = Image.new("RGB", (cote * compte, cote), (40, 44, 42))
    dessin = ImageDraw.Draw(feuille)
    for i in range(compte):
        gauche = i * cote
        teinte = TEINTES[i % len(TEINTES)]
        dessin.rectangle([gauche, 0, gauche + cote - 1, cote - 1], fill=(40, 44, 42))
        # Le corps monte et redescend au fil du cycle — une foulée, en gros.
        saut = abs((i % 4) - 2) * (cote // 12)
        dessin.rectangle(
            [
                gauche + cote // 3,
                cote // 4 + saut,
                gauche + 2 * cote // 3,
                cote - 1 - saut // 2,
            ],
            fill=teinte,
        )
        dessin.text((gauche + 3, 3), str(i), fill=(240, 236, 228))
    tampon = io.BytesIO()
    feuille.save(tampon, format="PNG")
    return tampon.getvalue()


def _poser_un_clip(atelier: Atelier, projet: str, clip: str) -> None:
    """Une génération minimale, pour que le clip existe **aux yeux du dépôt**.

    ⚠️ Sans elle, tout tourne au premier lancement et l'écran montre des bandes
    vides au second : `ServiceBibliotheque.reconstruire()` ne relit une bande
    que si son clip est parmi les générations trouvées sur le disque. C'est le
    piège que `essais/atelier_jetable_b11.py` a payé, et il est le même ici.
    """
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
    direction: str,
    *,
    identifiant: str,
    nom: str,
    cadence: float,
    images: int,
    cote: int = CASE,
) -> Bande:
    """Une bande gardée et **retenue**, écrite comme un montage l'aurait
    laissée. Retenue d'emblée : l'essai joue ce qui sortirait dans le jeu, et
    une rangée sans retenue ferait porter au décor une question qui appartient
    à *Ses animations*."""
    _poser_un_clip(atelier, projet, f"clip-{identifiant}")
    bande = Bande(
        identifiant=identifiant,
        clip=f"clip-{identifiant}",
        nom=nom,
        prises=tuple(Prise(numero=n) for n in range(images)),
        cadence=cadence,
        cadre=Cadre(gauche=0, sommet=0, droite=cote - 1, bas=cote - 1),
        projet=projet,
        personnage=personnage,
        pose=pose,
        direction=direction,
        case_largeur=cote,
        case_hauteur=cote,
        favori=True,
    )
    bande.cree_le = time.time()
    # **Planche d'abord** : une fois posée, `ServiceMontage.planche()` la sert
    # telle quelle et ne tente jamais de la recalculer depuis un clip qui n'a
    # aucune image sur le disque.
    bande.planche = atelier.fichiers.ecrire_planche_de_bande(
        bande.clip, bande.identifiant, _planche(images, cote)
    )
    # Fichier d'abord, index ensuite — l'ordre de `ServiceMontage._sauver`.
    atelier.fichiers.ecrire_bande(bande.clip, bande.identifiant, bande.en_json())
    atelier.base.enregistrer_bande(bande)
    return bande


def _poser_une_image(client, dossier: Path, personnage: str, pose: str) -> None:
    """Une image fixe sur une case du pèlerin, **importée et jamais générée**.

    Elle ne sert pas l'essai lui-même — qui ne montre que des animations —, mais
    l'écran du clip, qui refuse de chiffrer quoi que ce soit sans image de
    départ : *un clip part toujours d'une image*. Sans elle, on ne peut pas
    vérifier que le prix est annoncé, et c'est le troisième critère.
    """
    gabarit = dossier / "pelerin.png"
    gabarit.write_bytes(image_sujet(toile=32, bloc=2, logique_l=6, logique_h=12))
    importe = _exiger(
        client.post("/api/assets/import", json={"chemin": str(gabarit), "forcer": True}),
        "l'import de l'image de départ",
    )
    identifiant = importe["asset"]["identifiant"]
    _exiger(
        client.put(
            f"/api/assets/{identifiant}/character",
            json={"personnage": personnage, "pose": pose},
        ),
        "la case de l'image de départ",
    )
    _exiger(
        client.put(
            "/api/assets/favorite", json={"identifiants": [identifiant], "favori": True}
        ),
        "la retenue de l'image de départ",
    )


def peupler(atelier: Atelier, dossier: Path) -> dict:
    with TestClient(creer_application(atelier)) as client:
        projet = _exiger(
            client.post("/api/projects", json={"nom": "Le marais"}),
            "le projet « Le marais »",
        )["projet"]["identifiant"]

        # La vue déclare les quatre directions, et la case du jeu fait 48 px —
        # la taille des planches posées plus bas, pour que le cadre de la case
        # tombe pile autour du personnage.
        _exiger(
            client.put(
                "/api/universe",
                json={
                    "style": "pixel",
                    "cible_px": CASE,
                    "vue": "vue-dessus-34",
                    "methode_pixels": "proche",
                    "couleurs": 16,
                    "fond": "#2d5a3d",
                },
            ),
            "les réglages de l'univers",
        )
        # **Les quatre directions viennent de la vue, pas d'un geste.** Poser
        # `vue-dessus-34` les déclare déjà (`atelier/domaine/vue.py`, `QUATRE`) ;
        # les repousser une par une rend `409 Conflict`, ce qui est la bonne
        # réponse du serveur et une ligne inutile de plus dans ce script.

        pelerin = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "Le pèlerin",
                    "description": "A weathered pilgrim in a hooded brown robe.",
                    "type": "personnage",
                },
            ),
            "la création du pèlerin",
        )["personnage"]["identifiant"]
        grenouille = _exiger(
            client.post(
                "/api/characters",
                json={
                    "nom": "La grenouille",
                    "description": "A fat marsh frog.",
                    "type": "créature",
                },
            ),
            "la création de la grenouille",
        )["personnage"]["identifiant"]

        _poser_une_image(client, dossier, pelerin, "repos")

        posees: list[Bande] = []

        # Le repos dans les quatre sens : c'est lui qui répond quand une pose
        # manque, et il doit donc exister partout.
        for angle in ("sud", "nord", "est", "ouest"):
            posees.append(
                _poser_une_bande(
                    atelier, projet, pelerin, "repos", angle,
                    identifiant=f"repos-{angle}", nom="repos", cadence=8.0, images=4,
                )
            )
        # La marche et la course, vers le sud seulement — deux cadences qu'on
        # distingue à l'œil, et deux arrondis différents.
        posees.append(
            _poser_une_bande(
                atelier, projet, pelerin, "marche", "sud",
                identifiant="marche-sud", nom="foulée", cadence=12.0, images=8,
            )
        )
        posees.append(
            _poser_une_bande(
                atelier, projet, pelerin, "course", "sud",
                identifiant="course-sud", nom="course", cadence=14.0, images=8,
            )
        )
        # **L'attaque n'existe que vers l'est**, et à 16 i/s : c'est le cas du
        # manque, et la cadence qui fait diverger les arrondis.
        posees.append(
            _poser_une_bande(
                atelier, projet, pelerin, "attaque", "est",
                identifiant="attaque-est", nom="coup de bâton", cadence=16.0, images=6,
            )
        )
        # Le voisin, deux fois plus petit et à sa propre cadence.
        posees.append(
            _poser_une_bande(
                atelier, projet, grenouille, "repos", "sud",
                identifiant="grenouille-repos", nom="respiration", cadence=6.0,
                images=4, cote=CASE // 2,
            )
        )

        charge = _exiger(client.get("/api/characters"), "la liste des sujets")
        sien = next(p for p in charge["personnages"] if p["identifiant"] == pelerin)
        return {
            "projet": projet,
            "pelerin": pelerin,
            "grenouille": grenouille,
            "cases": sien.get("cases", []),
            "bandes": posees,
        }


def principal(sans_servir: bool = False) -> int:
    # Windows : la console est en cp1252, et le résumé porte des accents et des
    # flèches — le même geste que `essais/essai_jetons.py`.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    dossier = Path(tempfile.mkdtemp(prefix="atelier-b12-"))
    print(f"Dossier jetable : {dossier}")

    atelier = Atelier(racine=dossier)

    depart = time.perf_counter()
    monte = peupler(atelier, dossier)
    duree = time.perf_counter() - depart

    print()
    print(f"  Montage : {duree:.1f} s")
    print()
    print("  Les vitesses, telles que l'export les écrira :")
    for bande in monte["bandes"]:
        print(
            f"    · {bande.pose:8s} {(bande.direction or '—'):6s} "
            f"{bande.cadence:5.1f} i/s → {aseprite.duree_en_ms(bande.cadence):4d} ms par image"
            f"   ({bande.compte} images, {bande.case_largeur} px)"
        )
    print()
    print("    → l'étiquette de la scène doit afficher ces millisecondes-là, pas d'autres.")

    print()
    print("  Ce que le serveur rend, case par case :")
    for sienne in monte["cases"]:
        directions = sienne.get("directions") or []
        if not directions:
            print(f"    · {sienne['pose']:8s} — aucune direction")
            continue
        remplies = [d["identifiant"] for d in directions if d.get("bandes")]
        vides = [d["identifiant"] for d in directions if not d.get("bandes")]
        print(
            f"    · {sienne['pose']:8s} — animée vers {', '.join(remplies) or 'rien'}"
            f"   ·   rien vers {', '.join(vides) or 'rien'}"
        )

    print()
    print(f"  Ouvre  http://127.0.0.1:{PORT}/")
    print("  → Codex › Personnages › Le pèlerin › onglet « L'essai »")
    print("  → clique DANS la scène (elle prend un contour rouille), puis Z Q S D")
    print("  → Maj pour courir, Espace pour attaquer, 1 à 6 pour une pose directe")
    print("  → touche 4 en regardant vers le sud : « attaque vers sud n'existe pas »,")
    print("    et le pèlerin reste au repos — l'attaque vers l'est ne joue jamais seule")
    print("  → volet « La scène » : fond, grille, cadre, sol, et « La grenouille » à côté")
    print("  → « Demander un clip » : l'écran du clip s'ouvre rempli, et annonce son prix")
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
