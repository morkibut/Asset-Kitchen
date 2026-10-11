"""La coupe automatique des jingles (11 octobre 2026).

ACE-Step rend 10 s ; un jingle utile en fait 2 à 5. La recette faite à la
main ce soir-là — silence du début à −45 dB, fin quand le son retombe à plus
de 30 dB sous son sommet, fondus de 10 ms et de 0,3 à 0,8 s — devient un
réglage, proposé par la famille jingle, posé avant le niveau."""
import numpy as np
import pytest

from atelier.audio.traitement import couper_jingle, mesurer, traiter
from atelier.domaine.son import FAMILLES, RecetteSon, SonRefuse, recette_proposee

TAUX = 44100


def _rendu_ace(silence=1.0, note=3.0, traine=6.0):
    """Comme un rendu de 10 s : un silence, une fanfare, puis une longue
    traîne qui retombe sous −40 dB du sommet et y reste."""
    t = np.arange(int(note * TAUX)) / TAUX
    fanfare = np.sin(2 * np.pi * 523 * t) * .5
    queue_t = np.arange(int(traine * TAUX)) / TAUX
    queue = np.sin(2 * np.pi * 523 * queue_t) * .5 * 10 ** (-60 * queue_t / 20)  # −60 dB par seconde
    mono = np.concatenate([np.zeros(int(silence * TAUX)), fanfare, queue])
    return np.column_stack([mono, mono])


def test_la_coupe_retire_le_silence_du_debut_et_la_traine_de_la_fin():
    rendu, fait = couper_jingle(_rendu_ace(), TAUX)
    assert fait["debut"] == pytest.approx(1.0, abs=.01)
    # La traîne passe 30 dB sous le sommet une demi-seconde après la fanfare.
    assert 4.3 <= fait["fin"] <= 4.6
    assert len(rendu) / TAUX == pytest.approx(fait["duree"]) and 3.3 <= fait["duree"] <= 3.6
    assert fait["fondu_sortie_ms"] == 500
    # Fondu d'entrée de 10 ms et fondu de sortie jusqu'au zéro.
    assert np.max(np.abs(rendu[:int(.002 * TAUX)])) < .2 * np.max(np.abs(rendu))
    assert np.max(np.abs(rendu[-10:])) < 1e-3


@pytest.mark.parametrize(("note", "fondu"), [(1.5, 300), (3.0, 500), (4.5, 800)])
def test_le_fondu_de_sortie_suit_la_longueur(note, fondu):
    _, fait = couper_jingle(_rendu_ace(note=note), TAUX)
    assert fait["fondu_sortie_ms"] == fondu


def test_un_son_tout_sous_le_seuil_n_est_pas_touche():
    calme = _rendu_ace() * 1e-4
    rendu, fait = couper_jingle(calme, TAUX)
    assert np.array_equal(rendu, calme) and fait["fondu_sortie_ms"] == 0


def test_la_famille_jingle_la_propose_et_elle_passe_avant_le_niveau():
    assert recette_proposee({}, "jingle")["coupe_jingle"] is True
    assert "coupe_jingle" not in FAMILLES["musique"].reglages and RecetteSon().coupe_jingle is False
    with pytest.raises(SonRefuse, match="coupe_jingle"):
        RecetteSon.depuis_json({"coupe_jingle": 1})
    recette = RecetteSon.depuis_json(recette_proposee({}, "jingle"))
    rendu, taux, mesure = traiter(_rendu_ace(), TAUX, recette)
    assert 2 <= mesure["duree"] <= 5 and mesure["coupe_jingle"]["duree"] == pytest.approx(mesure["duree"])
    # Le niveau est mesuré sur le jingle coupé : la traîne ne le tire plus vers le bas.
    assert mesure["lufs"] == pytest.approx(-16, abs=.2) and mesure["crete_vraie_db"] <= -1
    assert mesurer(rendu, taux)["lufs"] == pytest.approx(-16, abs=.2)
    # Sans le réglage, rien ne change et la mesure n'en dit rien.
    _, _, sans = traiter(_rendu_ace(), TAUX, RecetteSon())
    assert "coupe_jingle" not in sans and sans["duree"] == pytest.approx(10.0, abs=.01)
