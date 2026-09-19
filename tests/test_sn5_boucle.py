"""Boucles sans couture (SN5) : passage par zéro, fondu enchaîné, LUFS.

Les défauts d'une recette (boucle_zero=False, boucle_fondu_ms=0) ne changent
rien à une ancienne recette ; test_au14_sons.py le prouve déjà pour le jeu
de champs d'avant SN5 (une recette qui n'écrit ni boucle_zero ni
boucle_fondu_ms se relit et se rend à l'identique). Ce fichier-ci couvre ce
que SN5 ajoute : le raccord qui claque ou pas, et le niveau perçu.
"""
import io
import wave

import numpy as np
import pytest

from atelier.audio.traitement import encoder, mesurer, traiter
from atelier.domaine.son import RecetteSon, SonRefuse


def _pluie(duree, taux, graine=7):
    # Un bruit filtré (moyenne glissante ~3 ms), pas du bruit blanc : les
    # échantillons voisins sont corrélés, comme une vraie pluie enregistrée.
    # Couper cette texture n'importe où laisse un saut d'amplitude, parce
    # que le signal n'est pas périodique : c'est le cas qui doit claquer.
    rng = np.random.default_rng(graine)
    brut = rng.normal(0, 1, int(duree * taux))
    noyau = np.ones(max(1, round(taux * 0.003)))
    noyau /= noyau.sum()
    filtre = np.convolve(brut, noyau, mode="same")
    filtre /= np.max(np.abs(filtre)) * 1.3
    return np.column_stack([filtre, filtre])


def _sinus(duree, taux, frequence):
    t = np.arange(round(duree * taux)) / taux
    onde = 0.3 * np.sin(2 * np.pi * frequence * t)
    return np.column_stack([onde, onde])


def test_pluie_coupee_claque_puis_fondu_et_zero_la_rendent_nette():
    taux = 16000
    signal = _pluie(30, taux)
    brute = RecetteSon(boucle=True, boucle_debut=1.0, boucle_fin=29.3)
    _, _, mesure_brute = traiter(signal, taux, brute)
    assert mesure_brute["boucle"]["verdict"] == "le raccord claque"
    assert mesure_brute["boucle"]["ecart_raccord"] > 0.05

    soignee = RecetteSon(boucle=True, boucle_debut=1.0, boucle_fin=29.3, boucle_zero=True, boucle_fondu_ms=40)
    rendu, taux_sortie, mesure_soignee = traiter(signal, taux, soignee)
    assert mesure_soignee["boucle"]["verdict"] == "raccord net"
    # Continuité exacte au point de saut : c'est la propriété que le fondu
    # enchaîné garantit par construction (voir _fondre_boucle).
    debut, fin = mesure_soignee["boucle"]["debut"], mesure_soignee["boucle"]["fin"]
    assert np.array_equal(rendu[debut], rendu[fin - 1])
    # Jouée dix fois de suite bout à bout, chacun des neuf raccords reste
    # sous le seuil qui fait dire « ça claque » — pas seulement le premier.
    boucle_seule = rendu[debut:fin]
    longueur = len(boucle_seule)
    dix_tours = np.concatenate([boucle_seule] * 10)
    for tour in range(1, 10):
        jonction = tour * longueur
        saut = np.max(np.abs(dix_tours[jonction] - dix_tours[jonction - 1]))
        assert saut < 0.05, f"raccord {tour} claque : {saut}"


def test_sinus_boucle_sur_periode_entiere_est_nette():
    taux = 22050
    # 100 Hz sur 2 s = 200 périodes entières : la fin et le début coïncident
    # déjà, sans aucun réglage de boucle SN5.
    signal = _sinus(2.0, taux, 100)
    recette = RecetteSon(boucle=True, boucle_debut=0, boucle_fin=2.0)
    _, _, mesure = traiter(signal, taux, recette)
    assert mesure["boucle"]["verdict"] == "raccord net"
    assert mesure["boucle"]["ecart_raccord"] < 1e-3


def test_recette_ancienne_sans_champs_sn5_rend_les_memes_octets():
    taux = 16000
    signal = _pluie(5, taux, graine=3)
    ancienne = {"debut": .2, "fin": 4.5, "normaliser": True, "cible_db": -3,
        "fondu_entree_ms": 10, "fondu_sortie_ms": 10, "boucle": True, "boucle_debut": .3, "boucle_fin": 4.0}
    recette = RecetteSon.depuis_json(ancienne)
    assert recette.boucle_zero is False and recette.boucle_fondu_ms == 0
    rendu1, taux1, mesure1 = traiter(signal, taux, recette)
    octets1 = encoder(rendu1, taux1)
    # Rejouer exactement la même recette (donc les mêmes défauts SN5) doit
    # rendre exactement les mêmes octets : rien n'y est aléatoire ni daté.
    rendu2, taux2, mesure2 = traiter(signal, taux, RecetteSon.depuis_json(ancienne))
    assert encoder(rendu2, taux2) == octets1
    assert mesure1["boucle"]["recale_zero"] is False and mesure1["boucle"]["fondu_ms"] == 0
    # Le raccord d'une recette ancienne se mesure toujours (verdict et écart
    # RMS sont nouveaux), sans que rien de l'ancien calcul n'ait bougé.
    assert mesure1["boucle"]["ecart_raccord"] == mesure2["boucle"]["ecart_raccord"]


def test_lufs_sinus_1khz_moins_20dbfs_pres_de_moins_23_lufs():
    # Référence BS.1770/EBU R128 vérifiée à la main avec le ffmpeg du dépôt
    # (imageio_ffmpeg 7.1, filtre ebur128) avant d'écrire cet essai : un
    # sinus 1 kHz à -20 dBFS pleine échelle, mono, mesure -23,0 LUFS pile.
    taux = 44100
    t = np.arange(round(3 * taux)) / taux
    amplitude = 10 ** (-20 / 20)
    signal = (amplitude * np.sin(2 * np.pi * 1000 * t))[:, None]
    mesure = mesurer(signal, taux)
    assert mesure["lufs"] is not None
    assert abs(mesure["lufs"] - (-23.0)) <= 1.0
    assert mesure["crete_vraie_db"] is not None and mesure["crete_vraie_db"] <= -19.5


def test_lufs_indefini_sous_0_4_seconde_mais_pas_bloquant():
    taux = 16000
    signal = _sinus(0.2, taux, 440)
    mesure = mesurer(signal, taux)
    assert mesure["lufs"] is None
    # Une mesure absente n'empêche jamais le son d'être prêt : seule
    # l'absence de signal ou la saturation le font (règle du produit).
    assert not mesure["silencieux"]


@pytest.fixture
def audio(atelier, client):
    return atelier, atelier.bibliotheque.courant


def test_ecouter_le_raccord_rend_deux_secondes_fin_vers_debut(audio):
    atelier, projet = audio
    taux = 16000
    signal = _pluie(10, taux, graine=11)
    octets = encoder(signal, taux)
    son = atelier.sons.importer_octets(projet, octets, nom="Pluie.wav", cle="pluie-raccord")
    with pytest.raises(SonRefuse, match="boucle active"):
        atelier.sons.raccord(projet, son["identifiant"])
    regle = atelier.sons.regler(projet, son["identifiant"], 1,
        {"boucle": True, "boucle_debut": 1.0, "boucle_fin": 9.0, "boucle_zero": True, "boucle_fondu_ms": 30}, nom="Pluie")
    extrait = atelier.sons.raccord(projet, son["identifiant"])
    with wave.open(io.BytesIO(extrait)) as wav:
        assert wav.getnchannels() == 2 and wav.getframerate() == taux
        duree = wav.getnframes() / taux
    assert 0 < duree <= 2.01
    assert regle["mesures"]["boucle"]["verdict"] in ("raccord net", "le raccord claque")


def test_un_sommet_aplati_dans_un_fichier_16_bits_se_dit_sature():
    # Un fichier reçu décodé ne dépasse jamais 1 : la saturation s'y voit aux
    # paliers collés au plafond, pas à des valeurs impossibles. Un sommet
    # isolé à pleine échelle, lui, n'est pas une saturation.
    from atelier.audio.traitement import decoder
    taux = 16000
    t = np.arange(taux) / taux
    ecrete = np.clip(1.6 * np.sin(2 * np.pi * 220 * t), -1, 1)[:, None]
    net = np.sin(2 * np.pi * 220 * t)[:, None] * 0.5
    net[100, 0] = 1.0
    for signal, attendu in ((ecrete, True), (net, False)):
        chemin = __import__("pathlib").Path(__import__("tempfile").mkdtemp()) / "s.wav"
        chemin.write_bytes(encoder(signal, taux))
        relu, _ = decoder(chemin)
        assert (mesurer(relu, taux)["ecretes"] > 0) is attendu
