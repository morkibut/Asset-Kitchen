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
