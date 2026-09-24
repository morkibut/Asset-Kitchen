# -*- coding: utf-8 -*-
"""CM1 — parler à un modèle de texte (`docs/PLAN-assistant.md` § CM1).

Cinq critères, et ce fichier les mesure dans l'ordre du plan :

1. le service répond **en flux** — la première syllabe arrive avant la fin ;
2. **sans clé**, il dit « indisponible » sans lever, et rien ne casse ailleurs ;
3. le **délai dépassé abandonne l'appel côté serveur** — la liaison est
   refermée, pas seulement oubliée ;
4. ce que l'appel a **coûté est compté**, comme une génération d'image, sans
   rompre *un total en argent ne compte que de l'argent* ;
5. **aucun essai n'appelle le vrai modèle** — le fil est doublé par
   `httpx.MockTransport`, le seul point d'entrée d'essai de l'adaptateur.

⚠️ **Le flux doublé ici ne se contente pas de rendre des octets** : il compte ce
qu'il a déjà envoyé, il sait **attendre** qu'on le relâche, et il note quand on
le referme. C'est ce qui permet de voir la première syllabe arriver *pendant*
que la suite n'existe pas encore (critère 1), et de vérifier qu'un appel coupé
l'est **chez le fournisseur** (critère 3) — un essai qui ne regarderait que ce
que le service rend passerait aussi sur un service qui oublie de raccrocher.

Chaque essai qui attend tourne sous un délai de garde : un correctif défait
(plus de délai, plus d'`aclosing`, lecture d'un bloc) fait **tomber** l'essai au
lieu de le laisser pendre (règle 8octies d'`AGENTS.md`).
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from atelier.api.app import creer_application
from atelier.domaine import coup_de_main as domaine
from atelier.domaine.consommation import JETON, USD
from atelier.domaine.coup_de_main import (
    ABANDONNE,
    ECHOUE,
    FIN,
    INDISPONIBLE,
    INTERROMPU,
    REPONDU,
    TEXTE,
    AppelTexte,
)
from atelier.fournisseur.openrouter_texte import MODELE, OpenRouterTexte
from atelier.services import Atelier

from conftest import AnimateurMuet, FournisseurDouble

# Une valeur qui ne ressemble à aucune clé — même règle que `tests/test_b15.py`.
CLE_FICTIVE = "essai-1234567890"
NOM_COMPLET = "OpenRouter:" + MODELE
GARDE_S = 5.0


class FluxDouble(httpx.AsyncByteStream):
    """Le corps d'une réponse en flux, **qu'on peut retenir et dont on voit la
    fermeture**.

    `retenir_apres` : après ce nombre de lignes, le flux attend `relache` avant
    d'envoyer la suite — `None` n'attend jamais. `jamais_apres` : après ce
    nombre de lignes, il n'envoie plus rien, jamais (le fournisseur qui se tait).
    """

    def __init__(
        self,
        lignes: list[str],
        *,
        retenir_apres: int | None = None,
        jamais_apres: int | None = None,
    ) -> None:
        self.lignes = lignes
        self.retenir_apres = retenir_apres
        self.jamais_apres = jamais_apres
        self.relache = asyncio.Event()
        self.envoyees = 0
        self.ferme = False

    async def __aiter__(self):
        for rang, ligne in enumerate(self.lignes):
            if self.retenir_apres is not None and rang == self.retenir_apres:
                await self.relache.wait()
            if self.jamais_apres is not None and rang == self.jamais_apres:
                await asyncio.Event().wait()
            self.envoyees += 1
            yield ligne.encode("utf-8")

    async def aclose(self) -> None:
        self.ferme = True


def _morceau(texte: str, *, cout: float | None = None) -> str:
    brut: dict = {"id": "gen-essai-1", "choices": [{"index": 0, "delta": {"content": texte}}]}
    if cout is not None:
        brut["choices"][0]["finish_reason"] = "stop"
        brut["usage"] = {"prompt_tokens": 40, "completion_tokens": 9, "cost": cout}
    return "data: " + json.dumps(brut) + "\n\n"


def _reponse_normale(cout: float = 0.00012) -> list[str]:
    return [
        ": OPENROUTER PROCESSING\n\n",
        _morceau("Un "),
        _morceau("coffre "),
        _morceau("en chêne."),
        _morceau("", cout=cout),
        "data: [DONE]\n\n",
    ]


class Fil:
    """Le transport doublé : ce qui est parti, et le flux qu'il rend."""

    def __init__(self, flux: FluxDouble | None = None, reponse: httpx.Response | None = None):
        self.flux = flux
        self.reponse = reponse
        self.requetes: list[httpx.Request] = []

    def __call__(self, requete: httpx.Request) -> httpx.Response:
        self.requetes.append(requete)
        if self.reponse is not None:
            return self.reponse
        return httpx.Response(
            200, headers={"content-type": "text/event-stream"}, stream=self.flux
        )


def _atelier(tmp_path, fil: Fil | None, *, cle: str = CLE_FICTIVE, double=None) -> Atelier:
    transport = httpx.MockTransport(fil) if fil is not None else None
    double = double or FournisseurDouble()
    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: AnimateurMuet(),
        fabrique_texte=lambda: OpenRouterTexte(cle, transport=transport),
    )


async def _tout(atelier: Atelier, **reglages) -> list:
    async def lire():
        return [
            m
            async for m in atelier.coup_de_main.repondre(
                "Réponds en une phrase.", "un coffre", metier="essai-cm1", **reglages
            )
        ]

    return await asyncio.wait_for(lire(), GARDE_S)


# ── 1 · En flux : la première syllabe avant la fin ───────────────────────────


async def test_la_premiere_syllabe_arrive_avant_que_la_suite_existe(tmp_path):
    """Le flux s'arrête après la première ligne utile et **attend qu'on le
    relâche**. Si le service lisait la réponse d'un bloc avant de la rendre, la
    première syllabe n'arriverait jamais : l'essai tombe sur son délai de garde
    au lieu de passer."""
    flux = FluxDouble(_reponse_normale(), retenir_apres=2)
    atelier = _atelier(tmp_path, Fil(flux))

    reponse = atelier.coup_de_main.repondre("Réponds.", "un coffre", metier="essai-cm1")
    premier = await asyncio.wait_for(anext(reponse), GARDE_S)

    assert premier.genre == TEXTE and premier.texte == "Un "
    # La suite n'est pas encore partie de chez le fournisseur.
    assert flux.envoyees == 2 and not flux.relache.is_set()

    flux.relache.set()
    reste = await asyncio.wait_for(_restants(reponse), GARDE_S)
    assert "".join(m.texte for m in [premier, *reste] if m.genre == TEXTE) == "Un coffre en chêne."
    assert reste[-1].genre == FIN and reste[-1].appel.issue == REPONDU


async def _restants(reponse) -> list:
    return [m async for m in reponse]


async def test_ce_qui_part_est_la_consigne_et_le_texte_et_rien_d_autre(tmp_path):
    """Un modèle, en dur ; la clé partagée avec les images ; deux messages ; le
    flux demandé, et le coût demandé avec lui."""
    fil = Fil(FluxDouble(_reponse_normale()))
    await _tout(_atelier(tmp_path, fil))

    (requete,) = fil.requetes
    assert requete.url.path.endswith("/chat/completions")
    assert requete.headers["Authorization"] == f"Bearer {CLE_FICTIVE}"
    corps = json.loads(requete.content)
    assert corps["model"] == MODELE == "deepseek/deepseek-v4-flash"
    assert corps["stream"] is True and corps["usage"] == {"include": True}
    assert corps["messages"] == [
        {"role": "system", "content": "Réponds en une phrase."},
        {"role": "user", "content": "un coffre"},
    ]


# ── 2 · Sans clé : indisponible, et rien ne casse ────────────────────────────


async def test_sans_cle_il_dit_indisponible_sans_lever_et_sans_rien_envoyer(tmp_path):
    def jamais(requete):  # pragma: no cover — c'est ce que l'essai vérifie
        raise AssertionError("rien ne doit partir sans clé")

    atelier = _atelier(tmp_path, jamais, cle="")

    morceaux = await _tout(atelier)

    assert [m.genre for m in morceaux] == [INDISPONIBLE]
    assert morceaux[0].raison == "aucune clé OpenRouter"
    assert atelier.coup_de_main.etat() == {
        "disponible": False,
        "raison": "aucune clé OpenRouter",
        "modele": NOM_COMPLET,
    }
    # Rien n'est parti, donc rien à compter ni à expliquer.
    assert atelier.base.appels_texte() == []
    assert not atelier.fichiers.appels_texte.exists()


def test_sans_cle_l_atelier_s_ouvre_et_les_routes_repondent_sans_erreur(tmp_path, monkeypatch):
    monkeypatch.setitem(domaine.CONSIGNES, "essai", "Réponds.")
    atelier = _atelier(tmp_path, None, cle="")
    with TestClient(creer_application(atelier)) as client:
        assert client.get("/api/assist").json()["disponible"] is False
        reponse = client.post("/api/assist/essai", json={"texte": "un coffre"})
        assert reponse.status_code == 200
        assert [json.loads(l) for l in reponse.text.splitlines()] == [
            {"genre": "indisponible", "raison": "aucune clé OpenRouter"}
        ]
        # Le reste de l'atelier ne sait même pas que le coup de main existe.
        assert client.get("/api/spending").status_code == 200
        assert client.get("/api/spending").json()["texte_usd"] == 0.0


# ── 3 · Le délai dépassé raccroche, et celui qui part aussi ──────────────────


async def test_le_delai_depasse_referme_la_liaison_chez_le_fournisseur(tmp_path):
    """Le fournisseur envoie une syllabe, puis se tait pour toujours. Passé le
    délai, l'appel est **abandonné** et le flux **refermé** : sans la coupure,
    l'essai pend jusqu'à son délai de garde et tombe."""
    flux = FluxDouble(_reponse_normale(), jamais_apres=2)
    atelier = _atelier(tmp_path, Fil(flux))

    morceaux = await _tout(atelier, delai=0.3)

    assert [m.genre for m in morceaux] == [TEXTE, FIN]
    fin = morceaux[-1].appel
    assert fin.issue == ABANDONNE
    assert fin.raison == "le fournisseur n'a pas répondu à temps"
    assert flux.ferme is True
    # Coupé avant le dernier message : le coût n'a pas été rendu, et la ligne
    # ne se lit pas « gratuit ».
    assert fin.consomme == 0.0 and fin.cout_inconnu is True
    (garde,) = atelier.base.appels_texte()
    assert garde.issue == ABANDONNE and garde.chez_lui == "gen-essai-1"


async def test_celui_qui_part_referme_la_liaison_tout_de_suite(tmp_path):
    """Échap, ou l'onglet fermé : le générateur du service est refermé après la
    première syllabe. La liaison doit l'être **dans la foulée** — pas au
    passage du ramasse-miettes —, et l'appel est compté « interrompu »."""
    flux = FluxDouble(_reponse_normale(), retenir_apres=2)
    atelier = _atelier(tmp_path, Fil(flux))

    reponse = atelier.coup_de_main.repondre("Réponds.", "un coffre", metier="essai-cm1")
    premier = await asyncio.wait_for(anext(reponse), GARDE_S)
    assert premier.genre == TEXTE
    # **Sans délai de garde, et sans rien attendre d'autre avant de regarder** :
    # la boucle d'asyncio finit par refermer un générateur abandonné, mais plus
    # tard, dans une tâche à elle. Laisser tourner la boucle ici (un `wait_for`)
    # la laisserait faire, et l'essai passerait sur un service qui oublie de
    # raccrocher — vérifié en défaisant le correctif.
    await reponse.aclose()

    assert flux.ferme is True
    (garde,) = atelier.base.appels_texte()
    assert garde.issue == INTERROMPU and garde.cout_inconnu is True


async def test_un_refus_se_dit_dans_la_fin_et_ne_leve_pas(tmp_path):
    """Les mêmes phrases que l'adaptateur des images — la politesse partagée."""
    fil = Fil(reponse=httpx.Response(401, json={"error": {"message": "No auth"}}))
    atelier = _atelier(tmp_path, fil)

    morceaux = await _tout(atelier)

    assert [m.genre for m in morceaux] == [FIN]
    fin = morceaux[0].appel
    assert fin.issue == ECHOUE and fin.raison == "clé OpenRouter refusée"
    # Refusé d'entrée : rien de consommé, et on le sait.
    assert fin.consomme == 0.0 and fin.cout_inconnu is False


async def test_une_erreur_au_milieu_du_flux_garde_ce_qu_elle_a_coute(tmp_path):
    erreur = "data: " + json.dumps(
        {
            "id": "gen-essai-1",
            "error": {"code": "server_error", "message": "provider crashed"},
            "choices": [{"delta": {"content": ""}, "finish_reason": "error"}],
            "usage": {"cost": 0.00003},
        }
    ) + "\n\n"
    fil = Fil(FluxDouble([_morceau("Un "), erreur]))
    atelier = _atelier(tmp_path, fil)

    morceaux = await _tout(atelier)

    fin = morceaux[-1].appel
    assert fin.issue == ECHOUE and "provider crashed" in fin.raison
    assert fin.consomme == pytest.approx(0.00003) and fin.cout_inconnu is False


# ── 4 · Le coût compté, comme une génération ─────────────────────────────────


def test_le_cout_entre_dans_le_total_de_l_atelier_et_pas_dans_celui_d_un_jeu(tmp_path):
    """Une image et un appel de texte : le total de l'atelier compte les deux,
    la ligne du modèle de texte paraît « par modèle », et le total d'un jeu
    ne compte que l'image — un appel de texte appartient à l'atelier."""
    atelier = _atelier(tmp_path, Fil(FluxDouble(_reponse_normale(cout=0.00012))))
    with TestClient(creer_application(atelier)) as client:
        partie = client.post(
            "/api/generations", json={"modele": "essai:rend-du-png", "prompt": "un coffre"}
        )
        assert partie.status_code == 202, partie.text
        image = client.get(f"/api/generations/{partie.json()['identifiant']}").json()
        prix_image = image["cout_usd"]
        assert prix_image > 0

        asyncio.run(_tout(atelier))

        depenses = client.get("/api/spending").json()
        assert depenses["total_usd"] == pytest.approx(prix_image + 0.00012)
        assert depenses["texte_usd"] == pytest.approx(0.00012)
        ligne = next(m for m in depenses["par_modele"] if m["modele"] == NOM_COMPLET)
        assert ligne == {
            "modele": NOM_COMPLET,
            "cout_usd": pytest.approx(0.00012),
            "consomme": pytest.approx(0.00012),
            "unite": USD,
            "appels": 1,
        }
        # Le jeu, lui, n'a payé que son image.
        assert sum(p["cout_usd"] for p in depenses["par_projet"]) + depenses[
            "sans_projet_usd"
        ] == pytest.approx(prix_image)
        # Et la barre de tête dit la même chose que l'écran des dépenses.
        assert atelier.generations.total_couts() == pytest.approx(prix_image + 0.00012)


def test_un_appel_qui_ne_compte_pas_en_argent_ne_touche_pas_au_total(tmp_path):
    """*Un total en argent ne compte que de l'argent*, tenu par construction :
    `cout_usd` est déduit, jamais écrit à part."""
    atelier = _atelier(tmp_path, None)
    appel = AppelTexte(
        identifiant="jeton-1", modele="essai:texte", metier="essai-cm1",
        issue=REPONDU, consomme=3.0, unite=JETON,
    )
    atelier.coup_de_main._garder(appel)

    assert appel.cout_usd == 0.0
    assert atelier.generations.total_couts() == 0.0
    assert atelier.coup_de_main.depense()["par_modele"] == [
        {"modele": "essai:texte", "cout_usd": 0.0, "consomme": 3.0, "unite": JETON, "appels": 1}
    ]


async def test_la_depense_se_referme_et_se_rouvre_quand_l_index_est_efface(tmp_path):
    """Règle 8septies : un objet gardé **se referme et se rouvre**. L'index est
    jetable ; la dépense vit dans `donnees/appels-texte/`, et un atelier refait
    sur le même dossier la retrouve champ pour champ — avec des valeurs qui ne
    sont pas celles du défaut, pour que la relecture ne passe pas par hasard."""
    atelier = _atelier(tmp_path, Fil(FluxDouble(_reponse_normale(cout=0.00042))))
    (fin,) = [m for m in await _tout(atelier) if m.genre == FIN]
    avant = fin.appel.en_json()
    assert avant["metier"] == "essai-cm1" and avant["chez_lui"] == "gen-essai-1"
    assert avant["signes_recus"] == len("Un coffre en chêne.")

    for suffixe in ("", "-wal", "-shm"):
        (tmp_path / f"atelier.sqlite3{suffixe}").unlink(missing_ok=True)

    refait = _atelier(tmp_path, None)
    assert refait.base.appels_texte() == []
    refait.bibliotheque.ouvrir()

    (relu,) = refait.base.appels_texte()
    assert relu.en_json() == avant
    assert refait.generations.total_couts() == pytest.approx(0.00042)


# ── La route, et le cadre de l'agent ─────────────────────────────────────────


def test_la_route_rend_le_flux_ligne_par_ligne_avec_la_consigne_du_metier(tmp_path, monkeypatch):
    monkeypatch.setitem(domaine.CONSIGNES, "essai", "Consigne du métier.")
    fil = Fil(FluxDouble(_reponse_normale()))
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post(
            "/api/assist/essai",
            json={"texte": "un coffre", "consigne": "consigne venue de l'écran"},
        )

    assert reponse.headers["content-type"].startswith("application/x-ndjson")
    lignes = [json.loads(l) for l in reponse.text.splitlines()]
    assert [l["genre"] for l in lignes] == ["texte", "texte", "texte", "fin"]
    assert lignes[-1]["issue"] == REPONDU and lignes[-1]["cout_usd"] == pytest.approx(0.00012)
    # La consigne est celle du dépôt, jamais celle de l'écran (décision 1).
    corps = json.loads(fil.requetes[0].content)
    assert corps["messages"][0]["content"] == "Consigne du métier."


def test_un_metier_inconnu_est_refuse_et_rien_ne_part(tmp_path):
    """CM1 n'écrit aucune consigne : tant que CM3 n'a pas posé la première, la
    route refuse tout métier — elle attend son écran (règle 8nonies)."""
    fil = Fil(FluxDouble(_reponse_normale()))
    atelier = _atelier(tmp_path, fil)
    with TestClient(creer_application(atelier)) as client:
        reponse = client.post("/api/assist/n-importe-quoi", json={"texte": "salut"})

    assert reponse.status_code == 404
    assert fil.requetes == []


async def test_aucun_outil_de_l_agent_ne_mene_au_coup_de_main(tmp_path):
    """Décision 9 : l'agent ne s'en sert pas. Aucun outil MCP ne porte le coup de
    main, et un appel de texte ne compte pas dans le cadre de l'agent."""
    atelier = _atelier(tmp_path, Fil(FluxDouble(_reponse_normale())))
    application = creer_application(atelier)
    outils = await application.state.mcp.list_tools()
    for outil in outils:
        texte = (outil.name + " " + (outil.description or "")).lower()
        assert "assist" not in texte and "coup de main" not in texte, outil.name

    await _tout(atelier)
    assert atelier.agent._mesurer() == (0, 0.0, {})
