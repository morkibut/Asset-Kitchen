"""La vérification du niveau après coup (11 octobre 2026).

Un gain en une passe peut manquer la cible de 1 à 2 dB, et le fondu croisé
d'une boucle change le niveau. Le son final est donc remesuré après tout le
traitement, et corrigé au-delà de 0,2 LU, sans dépasser −1 dBTP. Ces essais
tiennent la correction, son plafond, et qu'une recette sans niveau visé n'en
voit rien."""
import numpy as np
import pytest

from atelier.audio.traitement import (CRETE_VRAIE_MAX_DB, TOLERANCE_LUFS, _verifier_niveau, encoder, mesurer,
                                      traiter)
from atelier.domaine.son import RecetteSon

TAUX = 44100


def _sinus(secondes, amplitude, frequence=440):
    t = np.arange(int(secondes * TAUX)) / TAUX
    return np.column_stack([np.sin(2 * np.pi * frequence * t)] * 2) * amplitude


def _calme_puis_fort(secondes=4):
    """Un début calme et une fin forte : le fondu croisé de boucle mêle la fin
    au début, et le niveau perçu du tout monte."""
    moitie = int(secondes * TAUX / 2)
    signal = _sinus(secondes, .02)
    signal[moitie:] *= 12
    return signal


def test_un_ecart_au_dela_de_0_2_lu_se_corrige_d_un_gain():
    signal = _sinus(3, .05)
    lufs = mesurer(signal, TAUX)["lufs"]
    niveau = {"limiteur": False}
    rendu = _verifier_niveau(signal.copy(), TAUX, lufs + 1.5, niveau)
    assert niveau["correction_db"] == pytest.approx(1.5, abs=.01)
    assert niveau["lufs_final"] == pytest.approx(lufs + 1.5, abs=TOLERANCE_LUFS)
    assert mesurer(rendu, TAUX)["lufs"] == pytest.approx(lufs + 1.5, abs=TOLERANCE_LUFS)
    # Dans la tolérance : rien ne bouge, pas même un octet.
    niveau = {"limiteur": False}
    intact = _verifier_niveau(signal.copy(), TAUX, lufs + .1, niveau)
    assert niveau["correction_db"] == 0 and np.array_equal(intact, signal)


def test_la_correction_ne_depasse_jamais_moins_un_dbtp():
    signal = _sinus(3, .5)
    avant = mesurer(signal, TAUX)
    niveau = {"limiteur": False}
    rendu = _verifier_niveau(signal.copy(), TAUX, avant["lufs"] + 10, niveau)
    assert niveau["correction_db"] == pytest.approx(CRETE_VRAIE_MAX_DB - avant["crete_vraie_db"], abs=.11)
    assert mesurer(rendu, TAUX)["crete_vraie_db"] <= CRETE_VRAIE_MAX_DB
    # Une crête déjà au-dessus de −1 dBTP redescend, même à la bonne cible.
    fort = _sinus(3, .99)
    niveau = {"limiteur": False}
    rendu = _verifier_niveau(fort.copy(), TAUX, mesurer(fort, TAUX)["lufs"], niveau)
    assert niveau["correction_db"] < 0 and mesurer(rendu, TAUX)["crete_vraie_db"] <= CRETE_VRAIE_MAX_DB


@pytest.mark.parametrize("limiteur", [False, True])
def test_le_fondu_de_boucle_ne_fait_plus_manquer_la_cible(limiteur):
    signal = _calme_puis_fort()
    reglages = {"cible_lufs": -20, "boucle": True, "boucle_fondu_ms": 2000, "fondu_entree_ms": 0,
                "fondu_sortie_ms": 0, "limiteur": limiteur}
    rendu, taux, mesure = traiter(signal, TAUX, RecetteSon(**reglages))
    niveau = mesure["niveau"]
    # Le fondu croisé avait déplacé le niveau : la vérification l'a vu et corrigé.
    assert abs(niveau["correction_db"]) > TOLERANCE_LUFS
    assert mesure["lufs"] == pytest.approx(-20, abs=TOLERANCE_LUFS)
    assert niveau["lufs_final"] == pytest.approx(mesure["lufs"], abs=.05)
    assert mesure["crete_vraie_db"] <= CRETE_VRAIE_MAX_DB and mesure["ecretes"] == 0
    assert mesurer(rendu, taux)["lufs"] == pytest.approx(-20, abs=TOLERANCE_LUFS)


def test_le_gain_de_la_recette_s_ajoute_a_la_cible():
    _, _, mesure = traiter(_sinus(3, .05), TAUX, RecetteSon(cible_lufs=-20, gain_db=-3))
    assert mesure["niveau"]["visee_lufs"] == -23 and mesure["lufs"] == pytest.approx(-23, abs=TOLERANCE_LUFS)


def test_sans_niveau_vise_rien_n_est_remesure_ni_change():
    signal = _calme_puis_fort()
    recette = {"boucle": True, "boucle_fondu_ms": 2000, "gain_db": -2}
    rendu, taux, mesure = traiter(signal, TAUX, RecetteSon(**recette))
    assert "niveau" not in mesure
    # Le même calcul, fait à la main : gain, fondus de 5 ms, fondu de boucle.
    attendu = signal.copy() * 10 ** (-2 / 20)
    n = round(5 * TAUX / 1000)
    attendu[:n] *= np.linspace(0, 1, n)[:, None]
    attendu[-n:] *= np.linspace(0, 1, n)[::-1, None]
    from atelier.audio.traitement import _fondre_boucle
    _fondre_boucle(attendu, 0, len(attendu), TAUX, 2000)
    assert encoder(rendu, taux) == encoder(attendu, TAUX)
