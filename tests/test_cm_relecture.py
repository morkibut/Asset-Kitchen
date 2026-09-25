# -*- coding: utf-8 -*-
"""La relecture croisée du coup de main (`docs/PLAN-assistant.md`, CM1 à CM7).

Sept tranches codées séparément, correctes chacune : ce fichier garde ce qui
cassait **à leurs coutures**, un essai par défaut trouvé, et chacun tombait
sans son correctif (8octies).

1. **La marque promettait ce que l'appel ne tenait pas** (CM6 × CM3) : l'état
   jugeait le plafond sur un appel de zéro signe, alors que tout appel emporte
   la fiche et une consigne. Entre les deux, la marque paraissait et l'appel
   revenait `indisponible`.
2. **La consigne d'« améliorer » disait « image » à un champ de son** (CM7 ×
   CM3) : le contexte du champ disait l'inverse de la consigne.
3. **La fiche du produit contredisait la décision 8, et ignorait le coup de
   main** (CM2 × CM6) : « rien ne part sans que ce que ça coûte soit annoncé »,
   sans un mot du plafond ; et des onglets de Réglages qui n'ont pas ces noms à
   l'écran, alors que la raison du plafond renvoie à « Consommations ».
4. **« Demander » n'était posé que sur un écran** (CM4 × CM5 × CM7) : la liste
   des écrans connus du serveur doit couvrir tous ceux que le guide sait
   nommer, sans quoi la touche posée à l'échelle de l'application renverrait
   422 — et se tairait — partout ailleurs.

Aucun appel payé : le fil est doublé comme en CM6.
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import (
    CHAMPS,
    CONSIGNE_AMELIORER,
    CONSIGNES,
    ECRANS,
    INDISPONIBLE,
    composer,
)
from atelier.services.contexte_coup_de_main import FICHE, fiche_du_produit
from atelier.services.coup_de_main import reserve_pour, signes_du_plus_petit_appel

from test_cm6_plafond import GARDE_S, Fil, _atelier

AIDE_TS = Path(__file__).resolve().parents[1] / "interface" / "src" / "aide.ts"


# ── 1 · La marque ne promet que ce que l'appel tient ─────────────────────────


def _le_plus_court_des_vrais_appels():
    """L'envoi réel le plus court : la plus courte consigne, la fiche, un signe."""
    consigne = min(CONSIGNES.values(), key=len)
    return composer(consigne, fiche_du_produit(), "x", champ="matiere")


def test_le_plancher_est_ce_que_tout_appel_emporte_au_moins():
    envoi = _le_plus_court_des_vrais_appels()
    plancher = signes_du_plus_petit_appel()
    assert plancher <= len(envoi.systeme) + len(envoi.message)
    # Et il n'est pas le zéro qu'il remplace : la fiche seule fait des milliers de signes.
    assert plancher > len(fiche_du_produit().strip())


async def test_quand_la_marque_parait_l_appel_le_plus_court_part(tmp_path):
    """Un reste qui paie un appel vide, pas un vrai : **les deux doivent dire
    la même chose**. Avant le correctif, `etat()` disait disponible et l'appel
    revenait `indisponible` — la marque qui déçoit."""
    fil = Fil(retenu=False)
    atelier = _atelier(tmp_path, fil)
    vrai = reserve_pour(signes_du_plus_petit_appel())
    vide = reserve_pour(0)
    assert vide < vrai
    atelier.coup_de_main.regler_plafond((vide + vrai) / 2)

    etat = atelier.coup_de_main.etat()
    envoi = _le_plus_court_des_vrais_appels()
    morceaux = [
        m
        async for m in atelier.coup_de_main.repondre(
            envoi.systeme, envoi.message, metier="ameliorer"
        )
    ]
    part = morceaux[0].genre != INDISPONIBLE
    assert etat["disponible"] is part
    assert etat["disponible"] is False
    assert fil.requetes == []
    # Le compteur des dépenses le dit avec la même règle.
    assert atelier.coup_de_main.mois()["atteint"] is True


async def test_un_reste_qui_paie_le_plus_court_des_appels_laisse_la_marque(tmp_path):
    fil = Fil(retenu=False)
    atelier = _atelier(tmp_path, fil)
    envoi = _le_plus_court_des_vrais_appels()
    atelier.coup_de_main.regler_plafond(
        reserve_pour(len(envoi.systeme) + len(envoi.message)) * 1.01
    )
    assert atelier.coup_de_main.etat()["disponible"] is True
    morceaux = await asyncio.wait_for(
        _collecter(atelier, envoi.systeme, envoi.message), GARDE_S
    )
    assert morceaux[0].genre != INDISPONIBLE
    assert len(fil.requetes) == 1


async def _collecter(atelier, systeme, message):
    return [m async for m in atelier.coup_de_main.repondre(systeme, message, metier="ameliorer")]


def test_par_la_route_la_marque_se_tait_sous_le_plancher(tmp_path):
    atelier = _atelier(tmp_path, None)
    atelier.coup_de_main.regler_plafond(reserve_pour(0) * 1.5)
    with TestClient(creer_application(atelier)) as client:
        assert client.get("/api/assist").json()["disponible"] is False
        assert client.get("/api/spending").json()["coup_de_main"]["atteint"] is True


# ── 2 · La consigne d'« améliorer » ne contredit pas le champ ─────────────────


def test_la_consigne_ne_dit_pas_image_a_un_champ_de_son_ou_de_clip():
    """CM7 a gardé une seule consigne pour quatre sortes de champs — bien —,
    mais elle affirmait « un modèle de génération d'images » et « un prompt
    d'image » : pour `prompt_son`, le contexte du champ disait l'inverse."""
    assert "modèle de génération d'images" not in CONSIGNE_AMELIORER
    assert "prompt d'image" not in CONSIGNE_AMELIORER
    for support in ("image", "clip", "son"):
        assert support in CONSIGNE_AMELIORER.split("\n", 1)[0]
    # Et chaque champ qu'elle sert dit bien, lui, ce qu'il décrit.
    assert "son" in CHAMPS["prompt_son"]["ecran"] or "son" in CHAMPS["prompt_son"]["attend"]
    assert "clip" in CHAMPS["prompt_video"]["attend"]


# ── 3 · La fiche parle du coup de main, avec les mots de l'écran ─────────────


def _fiche() -> str:
    """La fiche, espaces et retours à la ligne ramenés à un seul espace."""
    return " ".join(FICHE.read_text(encoding="utf-8").split())


def test_la_fiche_dit_l_exception_du_coup_de_main_a_l_annonce_du_prix():
    """« Rien ne part sans que ce que ça coûte soit annoncé » — sauf le coup de
    main, décision 8. Sans cette phrase, « pourquoi le coup de main ne
    m'annonce pas son prix ? » recevait une réponse fausse, tirée de la fiche."""
    fiche = _fiche()
    assert "plafond du mois" in fiche
    assert "Réglages › Consommations" in fiche


def test_la_fiche_nomme_les_onglets_des_reglages_comme_l_ecran():
    """La raison du plafond renvoie à « Réglages › Consommations » ; la fiche
    disait « les dépenses », un onglet qui n'existe pas sous ce nom."""
    source = (AIDE_TS.parent / "composants" / "Reglages.tsx").read_text(encoding="utf-8")
    titres = re.findall(r'\{ clef: "[a-z]+", titre: "([^"]+)" \}', source)
    assert len(titres) == 4
    fiche = _fiche()
    for titre in titres:
        assert f"« {titre} »" in fiche, titre


def _ecrans_du_guide() -> set[str]:
    """Les valeurs de `Explication["ou"]`, lues dans `aide.ts` — la liste des
    écrans que le produit sait nommer, et que `ecranDuGuide` (`App.tsx`) rend.

    **`"partout"` (CM8) n'est l'écran de rien**, et sort donc de cette liste :
    aucun écran ne le calcule pour `ecranDuGuide`, `Ctrl+/` n'envoie donc
    jamais `ecran: "partout"` au serveur, et `ECRANS` n'a pas à le connaître.
    C'est le groupe commun du guide, pas une porte — voir la note dans
    `aide.ts` juste au-dessus de `Explication["ou"]`."""
    source = AIDE_TS.read_text(encoding="utf-8")
    debut = source.index("  ou:\n    |")
    fin = source.index("\n}", debut)
    return set(re.findall(r'\|\s*"([a-z-]+)"', source[debut:fin])) - {"partout"}


def test_chaque_ecran_du_guide_est_connu_du_coup_de_main():
    """`Ctrl+/` est posé à l'échelle de l'application avec l'écran du guide :
    un écran que le serveur ne connaît pas répondrait `ecran_inconnu`, et la
    touche s'y tairait pour rien. CM4 n'en connaissait qu'un, CM5 deux."""
    guide = _ecrans_du_guide()
    assert len(guide) >= 25
    assert guide - set(ECRANS) == set()
    assert set(ECRANS) - guide == set()


def test_la_question_part_depuis_n_importe_quel_ecran_du_guide(tmp_path):
    atelier = _atelier(tmp_path, None)
    with TestClient(creer_application(atelier)) as client:
        for ecran in sorted(_ecrans_du_guide()):
            vu = client.post(
                "/api/assist/question/preview",
                json={"texte": "à quoi sert ce réglage ?", "ecran": ecran, "champ": "Taille"},
            )
            assert vu.status_code == 200, ecran
            assert vu.json()["morceaux"][2]["texte"].startswith(f"Écran : {ECRANS[ecran]}.")


def test_la_fiche_nomme_les_trois_gestes_du_coup_de_main():
    fiche = _fiche()
    for geste in ("« EN »", "Ctrl+/", "« pourquoi › »"):
        assert geste in fiche, geste
