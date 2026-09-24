# -*- coding: utf-8 -*-
"""TS19 · La planche des directions ne dessine pas un miroir
(`docs/PLAN-de-la-toile-au-sujet.md`).

*Retour de l'auteur, 24 septembre 2026* : la planche d'Elias sortait en
miroir — ses deux profils étaient la même image retournée, la trousse de soin,
le fusil et le sac changeaient de côté avec lui.

Deux moitiés, et chacune a ses essais :

- **la phrase qui part** : dès que la planche porte deux directions opposées,
  le texte dit que c'est le même sujet vu de l'autre côté, pas un miroir ;
- **le signal à l'arrivée** : deux vues opposées dont l'une n'est que l'autre
  retournée sont signalées sur la planche.

Rien ne coûte un centime : le double du fournisseur rend des planches
dessinées ici.
"""

from __future__ import annotations

import io
import time

import numpy as np
from PIL import Image, ImageDraw

from atelier.domaine.direction import paires_opposees
from atelier.domaine.pliage import CasePliee, Pliage
from atelier.domaine.recette import BORD, Passe, Recette
from atelier.image import detourer
from atelier.image.pliage import SEUIL_MIROIR, ecart_au_miroir, vues_en_miroir
from atelier.services.pliage import consignes
from tests.conftest import image_sujet

MODELE = "essai:rend-du-png"
DESIGN = "THE CHARACTER DESIGN TO REPRODUCE"
PHRASE = "from opposite sides, not a mirrored copy"
FOND = (230, 230, 230)


# ── Le personnage fabriqué ───────────────────────────────────────────────────
#
# Un voyageur de profil, dessiné à plat : un manteau, une tête, un sac dans le
# dos, un fusil devant, et **une sacoche claire à croix rouge sur sa hanche
# gauche** — l'objet que la phrase de TS19 prend pour exemple. Tout se touche :
# la planche doit se découper en une seule tache par vue.

MANTEAU = (120, 90, 50)
TETE = (220, 170, 130)
SAC = (80, 90, 40)
FUSIL = (60, 60, 65)
SACOCHE = (225, 210, 170)
CROIX = (200, 30, 30)
GOURDE = (170, 175, 190)
JAMBES = (50, 60, 40)


def _profil(vers_la_droite: bool, *, sacoche: bool, gourde: bool) -> Image.Image:
    """Un profil dans une case de 200 × 280, fond compris.

    Dessiné **tourné vers la droite**, puis retourné si on le veut vers la
    gauche : la silhouette de l'autre côté est ainsi exactement celle d'un
    miroir, et seul ce qu'il porte d'un côté du corps distingue les deux. C'est
    le cas le plus dur pour la mesure — un sujet symétrique ne se reconnaît
    qu'à ses objets.
    """
    image = Image.new("RGB", (200, 280), FOND)
    d = ImageDraw.Draw(image)
    d.rectangle([80, 60, 130, 200], fill=MANTEAU)  # le manteau
    d.rectangle([88, 20, 122, 60], fill=TETE)  # la tête
    d.rectangle([122, 36, 128, 44], fill=TETE)  # le nez, devant
    d.rectangle([50, 70, 80, 150], fill=SAC)  # le sac, dans le dos
    d.rectangle([128, 110, 180, 118], fill=FUSIL)  # le fusil, devant
    d.rectangle([88, 200, 100, 250], fill=JAMBES)
    d.rectangle([110, 200, 122, 250], fill=JAMBES)
    if sacoche:
        # Sur la hanche gauche : du côté qu'on voit quand il regarde à droite.
        d.rectangle([84, 140, 124, 180], fill=SACOCHE)
        d.rectangle([100, 146, 108, 174], fill=CROIX)
        d.rectangle([90, 156, 118, 164], fill=CROIX)
    if gourde:
        # Sur la hanche droite : ce qu'on voit de l'autre côté.
        d.rectangle([92, 120, 112, 168], fill=GOURDE)
    return image if vers_la_droite else image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def _redessine(image: Image.Image, decalage: int = 3, graine: int = 7) -> Image.Image:
    """Le même dessin, trois pixels plus loin et bruité — un modèle qui
    retourne son image la redessine, il ne la copie pas à l'octet."""
    tableau = np.asarray(image, dtype=np.int16)
    tableau = np.roll(tableau, decalage, axis=1)
    bruit = np.random.default_rng(graine).integers(-15, 16, tableau.shape)
    sujet = np.any(tableau != np.array(FOND), axis=2, keepdims=True)
    tableau = np.where(sujet, np.clip(tableau + bruit, 0, 255), tableau)
    return Image.fromarray(tableau.astype(np.uint8), "RGB")


def _miroir() -> Image.Image:
    """Le défaut d'Elias : la vue de gauche n'est que celle de droite retournée,
    sacoche comprise."""
    return _redessine(
        _profil(True, sacoche=True, gourde=False).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    )


def _autre_cote() -> Image.Image:
    """Ce qu'on demande : le même voyageur tourné vers la gauche, qui montre
    son flanc droit — la sacoche est cachée, la gourde se voit."""
    return _redessine(_profil(False, sacoche=False, gourde=True))


def _planche(*vues: Image.Image) -> bytes:
    """Les vues côte à côte, avec de l'air autour — comme un modèle les rend."""
    planche = Image.new("RGB", (40 + 240 * len(vues), 360), FOND)
    for rang, vue in enumerate(vues):
        planche.paste(vue, (40 + 240 * rang, 40))
    tampon = io.BytesIO()
    planche.save(tampon, format="PNG")
    return tampon.getvalue()


def _detouree(octets: bytes) -> np.ndarray:
    return detourer(Recette(passes=(Passe(moteur=BORD),)), octets)


def _rgba(image: Image.Image) -> np.ndarray:
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return _detouree(tampon.getvalue())


# ── 1. Les paires ────────────────────────────────────────────────────────────


def test_les_paires_opposees_sont_celles_d_un_miroir_gauche_droite():
    assert paires_opposees(["sud", "nord", "est", "ouest"]) == ((2, 3),)
    assert paires_opposees(["droite", "gauche"]) == ((0, 1),)
    assert paires_opposees(
        ["sud", "nord", "est", "ouest", "sud-ouest", "nord-ouest", "nord-est", "sud-est"]
    ) == ((2, 3), (4, 7), (5, 6))
    # Le sud et le nord ne sont le miroir de personne, et une direction que
    # le produit ne livre pas ne se devine pas.
    assert paires_opposees(["sud", "nord"]) == ()
    assert paires_opposees(["bas", "haut", "droite"]) == ()
    assert paires_opposees([None, None]) == ()


# ── 2. La phrase qui part ────────────────────────────────────────────────────


def _texte(*directions: str | None) -> str:
    return consignes(
        Pliage(
            cases=tuple(
                CasePliee(texte=f"idle stance, facing {d}", pose="repos", direction=d)
                for d in directions
            )
        )
    )


def test_deux_profils_opposes_font_partir_la_phrase_de_l_autre_cote():
    texte = _texte("droite", "gauche")
    assert (
        "Cells 1 and 2 show the same subject from opposite sides, not a mirrored "
        "copy: anything on one side of its body stays on that side — a pouch on "
        "its left hip shows in one view and is hidden in the other."
    ) in texte
    # Elle ne remplace rien : la consigne de la planche est toujours là.
    assert "It must be the same subject in every cell" in texte
    assert "Plain flat light gray background" in texte


def test_huit_directions_nomment_toutes_leurs_paires():
    texte = _texte(
        "sud", "nord", "est", "ouest", "sud-ouest", "nord-ouest", "nord-est", "sud-est"
    )
    assert (
        "Cells 3 and 4, and cells 5 and 8, and cells 6 and 7 each show the same "
        "subject from opposite sides"
    ) in texte


def test_sans_paire_opposee_rien_ne_s_ajoute():
    assert PHRASE not in _texte("sud", "nord")
    assert PHRASE not in _texte(None, None)
    # Un lot de poses sans direction, la planche de C2 d'avant TS19.
    assert PHRASE not in consignes(
        Pliage(cases=(CasePliee(texte="idle"), CasePliee(texte="walk")))
    )


def _sujet_de_la_toile(client, rang: int = 5) -> str:
    octets = image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12)
    carte = client.post(f"/api/board/paste?nom=carte-{rang}.png", content=octets)
    assert carte.status_code == 201, carte.text
    cree = client.post(
        f"/api/board/{carte.json()['carte']['identifiant']}/subject",
        json={"nom": "Elias", "description": "a veteran with a medical satchel"},
    )
    assert cree.status_code == 201, cree.text
    return cree.json()["personnage"]["identifiant"]


def test_la_premiere_planche_d_un_jeu_de_cote_dit_l_autre_cote_et_garde_le_design(client):
    """Le cas d'Elias : un jeu vu de côté, deux profils. La phrase se lit dans
    *Relire avant l'envoi*, et le concept art part toujours comme le design à
    reproduire (TS3, TS11)."""
    assert client.put("/api/universe", json={"vue": "vue-cote-plateforme"}).status_code == 200
    ident = _sujet_de_la_toile(client)

    ecran = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "", "personnage": ident, "premiere_planche": True},
    )

    assert ecran.status_code == 200, ecran.text
    texte = ecran.json()["texte"]
    assert "Cells 1 and 2 show the same subject from opposite sides" in texte
    assert f"Image 1 — {DESIGN}" in texte


def test_un_jeu_vu_de_dessus_nomme_l_est_et_l_ouest(client):
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    ident = _sujet_de_la_toile(client, 6)

    ecran = client.post(
        "/api/outgoing",
        json={"modele": MODELE, "prompt": "", "personnage": ident, "premiere_planche": True},
    )

    assert ecran.status_code == 200, ecran.text
    # sud, nord, est, ouest : l'est et l'ouest sont les cases 3 et 4.
    assert "Cells 3 and 4 show the same subject from opposite sides" in ecran.json()["texte"]


# ── 3. La mesure ─────────────────────────────────────────────────────────────


def test_un_miroir_redessine_mesure_sous_le_seuil_et_l_autre_cote_au_dessus():
    droite = _rgba(_profil(True, sacoche=True, gourde=False))
    miroir = ecart_au_miroir(droite, _rgba(_miroir()))
    autre = ecart_au_miroir(droite, _rgba(_autre_cote()))

    assert miroir < SEUIL_MIROIR < autre, (miroir, autre)
    # Et avec de la marge des deux côtés : un seuil qui passe de justesse
    # sur un exemple fabriqué ne tiendrait pas sur une vraie planche.
    assert miroir < SEUIL_MIROIR / 2, miroir
    assert autre > SEUIL_MIROIR * 1.5, autre


def test_la_mesure_ne_confond_pas_deux_vues_qu_on_n_a_pas_retournees():
    """Témoin : la même vue deux fois, **sans** la retourner, n'est pas un
    miroir — sinon la mesure dirait « miroir » de tout ce qui se ressemble."""
    droite = _rgba(_profil(True, sacoche=True, gourde=False))
    assert ecart_au_miroir(droite, droite) > SEUIL_MIROIR


def test_seules_les_vues_opposees_sont_comparees():
    rgba = _detouree(
        _planche(_profil(True, sacoche=True, gourde=False), _miroir())
    )
    boites = [(40, 40, 239, 319), (280, 40, 479, 319)]
    assert vues_en_miroir(rgba, boites, ["droite", "gauche"]) == ((0, 1),)
    # Les mêmes vues sans direction, ou dans deux directions qui ne se font pas
    # face : rien à dire.
    assert vues_en_miroir(rgba, boites, [None, None]) == ()
    assert vues_en_miroir(rgba, boites, ["sud", "nord"]) == ()


# ── 4. Le signal, à l'arrivée d'une vraie planche ────────────────────────────


def _attendre(client, identifiant: str, tours: int = 120) -> dict:
    for _ in range(tours):
        lue = client.get(f"/api/generations/{identifiant}").json()
        if lue["statut"] in ("reussie", "echouee", "interrompue"):
            return lue
        time.sleep(0.05)
    return client.get(f"/api/generations/{identifiant}").json()


def _premiere_planche(client, double, planche: bytes, rang: int) -> dict:
    assert client.put("/api/universe", json={"vue": "vue-cote-plateforme"}).status_code == 200
    ident = _sujet_de_la_toile(client, rang)
    double.rendre = lambda: planche
    appel = client.post(
        "/api/generations",
        json={"modele": MODELE, "prompt": "Elias", "personnage": ident, "premiere_planche": True},
    )
    assert appel.status_code == 202, appel.text
    lue = _attendre(client, appel.json()["identifiant"])
    assert lue["statut"] == "reussie", lue
    return lue


def test_une_planche_en_miroir_porte_le_signal(client, double):
    lue = _premiere_planche(
        client, double, _planche(_profil(True, sacoche=True, gourde=False), _miroir()), 7
    )

    assert [c["direction"] for c in lue["pliage"]["cases"]] == ["droite", "gauche"]
    assert lue["pliage"]["miroirs"] == [[0, 1]]

    # **Refermé et rouvert** (8septies) : le signal est écrit sur le disque,
    # pas seulement rendu par la réponse.
    atelier = client.app.state.atelier
    relue = atelier.generations._base.lire(lue["identifiant"])
    assert relue.pliage.miroirs == ((0, 1),)


def test_une_planche_qui_montre_l_autre_cote_n_en_porte_aucun(client, double):
    lue = _premiere_planche(
        client, double, _planche(_profil(True, sacoche=True, gourde=False), _autre_cote()), 8
    )

    assert [c["direction"] for c in lue["pliage"]["cases"]] == ["droite", "gauche"]
    assert "miroirs" not in lue["pliage"]
