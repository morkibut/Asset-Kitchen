# -*- coding: utf-8 -*-
"""CM6 — le plafond et le compteur (`docs/PLAN-assistant.md` § CM6, décision 8).

Quatre critères, et ce fichier les mesure :

1. le plafond **se règle une fois et se voit** — 1 $ par défaut, et il se
   referme et se rouvre (8septies) ;
2. le **compteur** dit ce qui a été dépensé ce mois-ci, à côté du reste des
   dépenses — et l'effacement de l'index ne le remet pas à zéro ;
3. plafond atteint, **la marque disparaît et dit pourquoi** : `etat()` rend
   `disponible: False` avec une raison, jamais une erreur ;
4. **rien ne dépense au-delà, même en rafale** — dix appels simultanés alors
   qu'il ne reste de quoi en payer qu'un seul.

⚠️ **L'essai de rafale a été écrit avant la réservation, et il tombait sans
elle** (règle 8octies) : avec un plafond qui se contente de lire la dépense
déjà écrite, les dix appels lisent le même reste — aucun n'est encore fini —
et les dix partent. Les appels y sont **retenus en vol** par le fil doublé :
c'est pendant qu'ils tournent que le défaut se produit, et un essai qui les
laisserait finir un par un passerait des deux côtés.

Aucun essai n'appelle le vrai modèle : le fil est doublé par
`httpx.MockTransport`, comme en CM1.
"""

from __future__ import annotations

import asyncio
import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine.coup_de_main import (
    ABANDONNE,
    FIN,
    INDISPONIBLE,
    REPONDU,
    AppelTexte,
)
from atelier.fournisseur.openrouter_texte import OpenRouterTexte
from atelier.services import Atelier
from atelier.services.coup_de_main import (
    PLAFOND_DEFAUT_USD,
    debut_du_mois,
    reserve_pour,
)

from conftest import AnimateurMuet, FournisseurDouble

CLE_FICTIVE = "essai-1234567890"
GARDE_S = 5.0
CONSIGNE = "Réponds en une phrase."
TEXTE = "un coffre"
RESERVE = reserve_pour(len(CONSIGNE) + len(TEXTE))


def _lignes(cout: float) -> list[str]:
    def morceau(texte: str, fin: bool = False) -> str:
        brut: dict = {"id": "gen-essai-6", "choices": [{"index": 0, "delta": {"content": texte}}]}
        if fin:
            brut["choices"][0]["finish_reason"] = "stop"
            brut["usage"] = {"prompt_tokens": 40, "completion_tokens": 9, "cost": cout}
        return "data: " + json.dumps(brut) + "\n\n"

    return [morceau("Un "), morceau("coffre."), morceau("", fin=True), "data: [DONE]\n\n"]


class FluxRetenu(httpx.AsyncByteStream):
    """Un flux qui envoie sa première ligne puis **attend qu'on le relâche** —
    l'appel est en vol, le fournisseur a commencé à répondre, rien n'est fini.
    `muet` : après la première ligne, il ne dit plus jamais rien."""

    def __init__(self, lignes: list[str], relache: asyncio.Event, muet: bool = False):
        self.lignes = lignes
        self.relache = relache
        self.muet = muet

    async def __aiter__(self):
        for rang, ligne in enumerate(self.lignes):
            if rang == 1:
                if self.muet:
                    await asyncio.Event().wait()
                await self.relache.wait()
            yield ligne.encode("utf-8")

    async def aclose(self) -> None:
        pass


class Fil:
    """Le transport doublé : **un flux neuf par requête**, tous retenus par le
    même loquet. Il compte ce qui est parti — c'est ce que l'on paierait."""

    def __init__(self, cout: float = 0.00012, *, muet: bool = False, retenu: bool = True):
        self.cout = cout
        self.muet = muet
        self.relache = asyncio.Event()
        if not retenu:
            self.relache.set()
        self.requetes: list[httpx.Request] = []

    def __call__(self, requete: httpx.Request) -> httpx.Response:
        self.requetes.append(requete)
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            stream=FluxRetenu(_lignes(self.cout), self.relache, self.muet),
        )


def _atelier(tmp_path, fil: Fil | None) -> Atelier:
    transport = httpx.MockTransport(fil) if fil is not None else None
    double = FournisseurDouble()
    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
        fabrique_texte=lambda: OpenRouterTexte(CLE_FICTIVE, transport=transport),
    )


async def _un_appel(atelier: Atelier, **reglages) -> list:
    return [
        m
        async for m in atelier.coup_de_main.repondre(
            CONSIGNE, TEXTE, metier="essai-cm6", **reglages
        )
    ]


def _garder(atelier: Atelier, identifiant: str, cout: float, cree_le: float) -> None:
    atelier.coup_de_main._garder(
        AppelTexte(
            identifiant=identifiant,
            modele="OpenRouter:essai",
            metier="essai-cm6",
            cree_le=cree_le,
            issue=REPONDU,
            consomme=cout,
        )
    )


# ── 1 · Le plafond se règle une fois, et se voit ─────────────────────────────


def test_le_plafond_vaut_un_dollar_tant_qu_on_n_y_a_pas_touche(tmp_path):
    atelier = _atelier(tmp_path, None)
    assert PLAFOND_DEFAUT_USD == 1.0
    mois = atelier.coup_de_main.mois()
    assert mois["plafond_usd"] == 1.0
    assert mois["pese_usd"] == 0.0 and mois["reste_usd"] == 1.0


def test_le_plafond_regle_se_referme_et_se_rouvre(tmp_path):
    """8septies : réglé à une valeur qui n'est pas le défaut, relu par un atelier
    refait sur le même dossier — et l'index effacé entre les deux."""
    atelier = _atelier(tmp_path, None)
    atelier.coup_de_main.regler_plafond(2.35)
    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = _atelier(tmp_path, None)
    assert refait.coup_de_main.mois()["plafond_usd"] == pytest.approx(2.35)


def test_un_plafond_negatif_est_refuse(tmp_path):
    atelier = _atelier(tmp_path, None)
    with pytest.raises(ValueError):
        atelier.coup_de_main.regler_plafond(-0.5)
    assert atelier.coup_de_main.mois()["plafond_usd"] == 1.0


# ── 2 · Le compteur : ce mois-ci, et il survit à l'index ─────────────────────


def test_le_mois_commence_le_premier_a_minuit_heure_locale():
    """Le mois civil **local**, celui qui nomme déjà les fichiers `<AAAA-MM>` :
    un appel parti le 1er à 0 h 30 compte pour le mois qui commence."""
    minuit = time.mktime((2026, 10, 1, 0, 0, 0, 0, 0, -1))
    assert debut_du_mois(minuit + 30 * 60) == minuit
    assert debut_du_mois(minuit - 1) == time.mktime((2026, 9, 1, 0, 0, 0, 0, 0, -1))


def test_le_compteur_ne_compte_que_le_mois_en_cours(tmp_path):
    """Cinq dollars le mois dernier ne ferment rien ce mois-ci ; trois
    centièmes ce mois-ci se lisent au compteur."""
    atelier = _atelier(tmp_path, None)
    debut = debut_du_mois(time.time())
    _garder(atelier, "mois-dernier", 5.0, debut - 3600)
    _garder(atelier, "ce-mois-ci", 0.03, debut + 60)

    mois = atelier.coup_de_main.mois()
    assert mois["pese_usd"] == pytest.approx(0.03)
    assert mois["appels"] == 1
    assert atelier.coup_de_main.etat()["disponible"] is True


def test_la_bascule_de_mois_rouvre_la_marque(tmp_path, monkeypatch):
    """Le plafond atteint en septembre ne l'est plus le 1er octobre."""
    atelier = _atelier(tmp_path, None)
    septembre = time.mktime((2026, 9, 20, 12, 0, 0, 0, 0, -1))
    octobre = time.mktime((2026, 10, 1, 0, 5, 0, 0, 0, -1))
    _garder(atelier, "septembre", 1.5, septembre)

    monkeypatch.setattr(atelier.coup_de_main, "_horloge", lambda: septembre + 60)
    assert atelier.coup_de_main.etat()["disponible"] is False
    monkeypatch.setattr(atelier.coup_de_main, "_horloge", lambda: octobre)
    assert atelier.coup_de_main.etat()["disponible"] is True
    assert atelier.coup_de_main.mois()["pese_usd"] == 0.0


async def test_effacer_l_index_ne_remet_pas_le_compteur_a_zero(tmp_path):
    """8septies : le compteur se lit dans l'index, l'index se refait du journal
    `appels-texte/` — et un appel **au coût inconnu** y revient avec sa
    réservation, pas avec zéro."""
    fil = Fil(0.0004, retenu=False)
    atelier = _atelier(tmp_path, fil)
    await asyncio.wait_for(_un_appel(atelier), GARDE_S)
    # Le même dossier, un fournisseur qui se tait : l'appel suivant est coupé.
    coupe = _atelier(tmp_path, Fil(muet=True))
    (fin,) = [
        m for m in await asyncio.wait_for(_un_appel(coupe, delai=0.05), GARDE_S) if m.genre == FIN
    ]
    assert fin.appel.issue == ABANDONNE and fin.appel.cout_inconnu
    avant = coupe.coup_de_main.mois()
    assert avant["pese_usd"] == pytest.approx(0.0004 + RESERVE)
    assert avant["inconnus"] == 1

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)
    refait = _atelier(tmp_path, None)
    refait.bibliotheque.ouvrir()
    apres = refait.coup_de_main.mois()
    assert apres["pese_usd"] == pytest.approx(avant["pese_usd"])
    assert apres["inconnus"] == 1 and apres["appels"] == 2


# ── 3 · Plafond atteint : la marque se tait, et dit pourquoi ─────────────────


async def test_plafond_atteint_rien_ne_part_et_la_raison_est_dite(tmp_path):
    fil = Fil(retenu=False)
    atelier = _atelier(tmp_path, fil)
    atelier.coup_de_main.regler_plafond(0.10)
    _garder(atelier, "deja", 0.10, time.time())

    etat = atelier.coup_de_main.etat()
    assert etat["disponible"] is False
    assert "plafond" in etat["raison"]

    morceaux = await asyncio.wait_for(_un_appel(atelier), GARDE_S)
    assert [m.genre for m in morceaux] == [INDISPONIBLE]
    assert morceaux[0].raison == etat["raison"]
    assert fil.requetes == []


def test_sans_cle_la_raison_de_la_cle_passe_avant_celle_du_plafond(tmp_path):
    double = FournisseurDouble()
    atelier = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
        fabrique_texte=lambda: OpenRouterTexte(None),
    )
    atelier.coup_de_main.regler_plafond(0.0)
    raison = atelier.coup_de_main.etat()["raison"]
    assert raison and "plafond" not in raison


def test_un_plafond_a_zero_coupe_le_coup_de_main(tmp_path):
    atelier = _atelier(tmp_path, None)
    atelier.coup_de_main.regler_plafond(0.0)
    assert atelier.coup_de_main.etat()["disponible"] is False


# ── 4 · Rien au-delà, même en rafale ─────────────────────────────────────────


async def test_une_rafale_ne_passe_pas_par_le_meme_reste(tmp_path):
    """Dix appels **simultanés**, un reste qui n'en paie qu'un. Chacun est
    retenu en vol par le fil ; sans réservation, les dix lisent le même reste
    et partent tous — c'est ce que l'essai faisait tomber avant le correctif."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    atelier.coup_de_main.regler_plafond(RESERVE * 1.5)

    async def relacher_quand_tous_ont_demande():
        # On laisse chaque appel aller jusqu'au bout de ce qu'il peut faire
        # sans le fournisseur, puis on relâche ceux qui sont partis.
        for _ in range(50):
            await asyncio.sleep(0.01)
        fil.relache.set()

    rafale = [_un_appel(atelier) for _ in range(10)]
    resultats, _ = await asyncio.wait_for(
        asyncio.gather(asyncio.gather(*rafale), relacher_quand_tous_ont_demande()),
        GARDE_S,
    )
    genres = [r[-1].genre for r in resultats]
    assert genres.count(FIN) == 1, genres
    assert genres.count(INDISPONIBLE) == 9
    assert len(fil.requetes) == 1
    assert atelier.coup_de_main.mois()["pese_usd"] <= RESERVE * 1.5


async def test_la_reservation_se_rend_au_cout_reel_a_la_fin(tmp_path):
    """Réservé avant de partir, **régularisé au coût réel** : deux appels qui
    coûtent chacun bien moins que leur réservation passent l'un après l'autre
    sous un plafond qui ne tiendrait pas deux réservations en même temps."""
    fil = Fil(0.0001, retenu=False)
    atelier = _atelier(tmp_path, fil)
    atelier.coup_de_main.regler_plafond(RESERVE * 1.5)

    for _ in range(2):
        morceaux = await asyncio.wait_for(_un_appel(atelier), GARDE_S)
        assert morceaux[-1].genre == FIN
    mois = atelier.coup_de_main.mois()
    assert mois["pese_usd"] == pytest.approx(0.0002)
    assert mois["en_vol_usd"] == 0.0


async def test_un_appel_au_cout_inconnu_garde_sa_reservation(tmp_path):
    """Coupé avant que le coût arrive : il pèse sa réservation, et le plafond
    qui n'en tenait qu'une se ferme derrière lui."""
    fil = Fil(muet=True)
    atelier = _atelier(tmp_path, fil)
    atelier.coup_de_main.regler_plafond(RESERVE * 1.5)

    morceaux = await asyncio.wait_for(_un_appel(atelier, delai=0.05), GARDE_S)
    assert morceaux[-1].appel.cout_inconnu
    assert morceaux[-1].appel.reserve_usd == pytest.approx(RESERVE)
    assert atelier.coup_de_main.mois()["pese_usd"] == pytest.approx(RESERVE)
    assert atelier.coup_de_main.etat()["disponible"] is False


async def test_celui_qui_s_en_va_rend_sa_place_en_vol(tmp_path):
    """Échap pendant que ça répond : l'appel est compté, et la réservation en vol
    ne reste pas accrochée — sinon le plafond se fermerait sur un fantôme."""
    fil = Fil()
    atelier = _atelier(tmp_path, fil)
    flux = atelier.coup_de_main.repondre(CONSIGNE, TEXTE, metier="essai-cm6")
    premier = await asyncio.wait_for(anext(flux), GARDE_S)
    assert premier.genre == "texte"
    assert atelier.coup_de_main.mois()["en_vol_usd"] == pytest.approx(RESERVE)
    await flux.aclose()
    mois = atelier.coup_de_main.mois()
    assert mois["en_vol_usd"] == 0.0
    assert mois["appels"] == 1


# ── Les routes : réglé depuis l'écran, lu dans les dépenses ──────────────────


def test_le_plafond_se_regle_par_la_route_et_se_lit_dans_les_depenses(tmp_path):
    atelier = _atelier(tmp_path, None)
    _garder(atelier, "ce-mois-ci", 0.02, time.time())
    with TestClient(creer_application(atelier)) as client:
        assert client.get("/api/spending").json()["coup_de_main"]["plafond_usd"] == 1.0
        regle = client.put("/api/settings/assist", json={"plafond_usd": 3.5})
        assert regle.status_code == 200
        assert regle.json()["plafond_usd"] == 3.5
        compteur = client.get("/api/spending").json()["coup_de_main"]
        assert compteur["plafond_usd"] == 3.5
        assert compteur["pese_usd"] == pytest.approx(0.02)
        assert compteur["reste_usd"] == pytest.approx(3.48)
        assert client.put("/api/settings/assist", json={"plafond_usd": -1}).status_code == 422


def test_la_marque_se_tait_par_la_route_quand_le_plafond_est_atteint(tmp_path):
    atelier = _atelier(tmp_path, None)
    atelier.coup_de_main.regler_plafond(0.01)
    _garder(atelier, "deja", 0.01, time.time())
    with TestClient(creer_application(atelier)) as client:
        etat = client.get("/api/assist")
        # L'écran des dépenses le dit aussi, avec la même règle que la marque.
        assert client.get("/api/spending").json()["coup_de_main"]["atteint"] is True
    assert etat.status_code == 200
    assert etat.json()["disponible"] is False
    assert "plafond" in etat.json()["raison"]
