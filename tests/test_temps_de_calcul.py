"""L'estimation de repli du temps de calcul d'ACE-Step 1.5 (11 octobre 2026).

Avant le premier tirage d'un moteur, l'écran disait « temps inconnu » et la
veille de la file locale attendait dix minutes. Ces essais tiennent la droite
calée sur les temps relevés le 10 octobre 2026 (RTX 8 Go), qu'elle ne parle
qu'en l'absence de mesure, et qu'elle se dit estimation et non mesure."""
import pytest

from atelier.domaine.temps_de_calcul import FIXE_XL, PENTE_XL, estimation_de_repli
from atelier.services.file_locale import ESTIMATION_PAR_DEFAUT_S, MARGE_REPLI
from tests.test_sn1_installation import son  # noqa: F401 — la fixture

XL, TURBO, BASE = "ComfyUI:ace-step-15-xl-turbo@1", "ComfyUI:ace-step-15-turbo@1", "ComfyUI:ace-step-15-base@2"


def test_la_droite_du_xl_passe_pres_des_trois_releves():
    assert FIXE_XL > 0 and PENTE_XL > 1
    for son_s, calcul_s, ecart in ((10, 35, 10), (60, 80, 15), (150, 215, 10)):
        assert estimation_de_repli(XL, son_s) == pytest.approx(calcul_s, abs=ecart)


def test_turbo_et_base_passent_par_leur_point_avec_la_pente_relative_du_xl():
    assert estimation_de_repli(TURBO, 150) == pytest.approx(185, abs=0.1)
    assert estimation_de_repli(BASE, 150) == pytest.approx(232, abs=0.1)
    # Même forme que le XL : le rapport entre deux durées ne dépend pas du moteur.
    rapport = estimation_de_repli(XL, 600) / estimation_de_repli(XL, 10)
    assert estimation_de_repli(TURBO, 600) / estimation_de_repli(TURBO, 10) == pytest.approx(rapport, rel=0.01)
    assert estimation_de_repli(BASE, 10) < estimation_de_repli(BASE, 60) < estimation_de_repli(BASE, 600)


def test_pas_de_repli_sans_releve_sans_duree_ou_avec_un_autre_reglage():
    assert estimation_de_repli("ComfyUI:sa3-medium@1", 10) is None
    assert estimation_de_repli("ComfyUI:ace-step-15-reprise@1", 10) is None
    assert estimation_de_repli(XL, None) is None and estimation_de_repli(XL, 0) is None
    assert estimation_de_repli(XL, True) is None
    assert estimation_de_repli(XL, 10, "sans-compositeur") is None
    assert estimation_de_repli("ace-step-15-xl-turbo", 10) == estimation_de_repli(XL, 10)


def test_la_veille_prend_le_repli_double_avant_toute_mesure(son):  # noqa: F811
    atelier, _ = son
    file = atelier.file_locale
    etape = {"moteur": "comfyui", "modele": BASE, "temperature": "froid", "secondes": 600}
    assert file.estimation(etape, []) == pytest.approx(estimation_de_repli(BASE, 600) * MARGE_REPLI)
    # Une musique de dix minutes sur le modèle base dépasse les dix minutes par défaut.
    assert file.estimation(etape, []) > ESTIMATION_PAR_DEFAUT_S
    # Sans durée, ou avec un réglage qui change le temps : le défaut, comme avant.
    assert file.estimation({**etape, "secondes": None}, []) == ESTIMATION_PAR_DEFAUT_S
    assert file.estimation({**etape, "reglage": "sans-compositeur"}, []) == ESTIMATION_PAR_DEFAUT_S
    # Une mesure passe devant le repli.
    mesuree = {**etape, "identifiant": "x", "etat": "termine", "duree_s": 42.0}
    assert file.estimation(etape, [mesuree]) == 42.0


async def test_l_annonce_d_une_serie_dit_que_c_est_une_estimation(son):  # noqa: F811
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    demande = {"famille": "musique", "usage": "jingle", "prompt": "fanfare"}
    vu = atelier.series_son.annoncer(projet, {**demande, "nombre": 2})
    secondes = vu["composition"]["secondes"]
    repli = estimation_de_repli(vu["modele"], secondes)
    assert repli is not None, vu["modele"]
    annonce = vu["annonce"]
    assert annonce["repli"] is True and annonce["mesures"] == 0
    assert annonce["temps_s"] == pytest.approx(repli * 2, abs=0.2)
    assert "estimation de repli" in annonce["phrase"] and "Aucun coût" in annonce["phrase"]
    # Le compositeur coupé n'a pas de repli : temps inconnu, comme avant.
    rapide = atelier.series_son.annoncer(projet, {**demande, "nombre": 2, "options": {"compositeur": False}})
    assert rapide["annonce"]["temps_s"] is None and "repli" not in rapide["annonce"]
    # Le travail de chaque tirage porte la durée jusqu'à la file locale.
    s = await atelier.series_son.preparer(projet, {**demande, "cle": "repli", "nombre": 1})
    assert s["annonce"]["repli"] is True
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    etapes = [e for e in atelier.file_locale.lister()["etapes"] if e["nature"] == "audio"]
    assert etapes and etapes[0]["secondes"] == secondes
    # Mesuré une fois : la mesure parle, plus le repli.
    apres = atelier.series_son.annoncer(projet, {**demande, "nombre": 2})["annonce"]
    assert apres["mesures"] >= 1 and "repli" not in apres
