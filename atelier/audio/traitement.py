"""Savoir de MySpriteAi audioPipeline, avec canaux conservés et temps explicites.

Le niveau mesure le maximum de tous les canaux : deux canaux en opposition
de phase ne deviennent pas du silence parce que leur moyenne vaut zéro.
"""
from __future__ import annotations

import io
import math
import subprocess
import wave
from pathlib import Path

import numpy as np

from atelier.domaine.son import RecetteSon, SonRefuse

VERSION = 1


def _ffmpeg(arguments, entree=None):
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
    except ImportError as erreur:
        raise SonRefuse("Le décodeur audio n'est pas installé. Le module vidéo fournit aussi ffmpeg ; la source reste conservée.") from erreur
    try:
        execution = subprocess.run([get_ffmpeg_exe(), "-nostdin", "-hide_banner", "-loglevel", "error", *arguments],
            input=entree, capture_output=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired) as erreur:
        raise SonRefuse("Le décodage audio n'a pas abouti ; la source reste conservée.") from erreur
    if execution.returncode:
        detail = execution.stderr.decode("utf-8", errors="replace").strip()[:500]
        raise SonRefuse("Ce fichier audio ne peut pas être décodé. " + detail)
    return execution.stdout


def decoder(source: Path):
    # Le plafond borne l'expansion d'un fichier comprimé. Il ne devient jamais
    # une coupe silencieuse : une source plus longue reste à vérifier.
    wav = _ffmpeg(["-i", str(source), "-map", "0:a:0", "-vn", "-t", "601",
        "-acodec", "pcm_s32le", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-f", "wav", "pipe:1"])
    try:
        with wave.open(io.BytesIO(wav), "rb") as fichier:
            canaux, taux, largeur = fichier.getnchannels(), fichier.getframerate(), fichier.getsampwidth()
            contenu = fichier.readframes(fichier.getnframes())
    except (wave.Error, EOFError) as erreur:
        raise SonRefuse("Le décodeur n'a pas rendu un signal PCM lisible.") from erreur
    if canaux not in (1, 2):
        raise SonRefuse("Cette source comporte plus de deux canaux. Importez une version mono ou stéréo ; aucun mixage n'est imposé.")
    if largeur != 4 or taux <= 0 or not contenu or len(contenu) % (4 * canaux):
        raise SonRefuse("Le fichier ne contient aucun signal audio exploitable.")
    signal = np.frombuffer(contenu, dtype="<i4").reshape((-1, canaux)).astype(np.float64) / 2147483648
    if len(signal) / taux > 600:
        raise SonRefuse("La source dépasse dix minutes. Elle est conservée ; importez une séquence de dix minutes au plus pour la travailler.")
    return signal, taux


def reechantillonner(signal, depart, arrivee):
    if depart == arrivee:
        return signal.copy()
    # swresample filtre les fréquences au-dessus de la nouvelle limite. Une
    # interpolation linéaire seule repliait ces fréquences dans MySpriteAi.
    rendu = _ffmpeg(["-f", "f64le", "-ar", str(depart), "-ac", str(signal.shape[1]), "-i", "pipe:0",
        "-ar", str(arrivee), "-acodec", "pcm_f64le", "-f", "f64le", "pipe:1"], signal.astype("<f8").tobytes())
    return np.frombuffer(rendu, dtype="<f8").reshape((-1, signal.shape[1])).copy()


def traiter(signal, taux, recette: RecetteSon):
    duree = len(signal) / taux
    if recette.debut >= duree or recette.fin is not None and recette.fin > duree + 1 / taux:
        raise SonRefuse("La coupe doit rester à l'intérieur du son source.")
    debut = round(recette.debut * taux)
    fin = min(len(signal), round(recette.fin * taux)) if recette.fin is not None else len(signal)
    rendu = signal[debut:fin].copy()
    coupe_silence = {"debut": debut / taux, "fin": fin / taux}
    if recette.rogner_silence:
        utiles = np.flatnonzero(np.max(np.abs(rendu), axis=1) > 10 ** (recette.seuil_silence_db / 20))
        if not len(utiles):
            raise SonRefuse("Toute la sélection est sous le seuil de silence. Baissez le seuil ou désactivez le rognage ; la source reste intacte.")
        marge = round(recette.marge_silence_ms * taux / 1000)
        premier, dernier = max(0, int(utiles[0]) - marge), min(len(rendu), int(utiles[-1]) + 1 + marge)
        coupe_silence = {"debut": (debut + premier) / taux, "fin": (debut + dernier) / taux}
        rendu = rendu[premier:dernier].copy()
    taux_sortie = recette.taux or taux
    rendu = reechantillonner(rendu, taux, taux_sortie)
    if not len(rendu):
        raise SonRefuse("La sélection ne contient aucun échantillon après la coupe.")
    source_audible = float(np.max(np.abs(rendu))) > 1e-8
    for cote, ms in (("entree", recette.fondu_entree_ms), ("sortie", recette.fondu_sortie_ms)):
        n = min(len(rendu), round(ms * taux_sortie / 1000))
        if n:
            rampe = np.linspace(0, 1, n)[:, None]
            if cote == "entree":
                rendu[:n] *= rampe
            else:
                rendu[-n:] *= rampe[::-1]
    pic = float(np.max(np.abs(rendu)))
    if recette.normaliser and pic > 1e-8:
        rendu *= 10 ** (recette.cible_db / 20) / pic
    rendu *= 10 ** (recette.gain_db / 20)
    mesure = mesurer(rendu, taux_sortie)
    mesure["silencieux"] = mesure["silencieux"] or not source_audible
    mesure["coupe_source"] = coupe_silence
    boucle_debut = round(recette.boucle_debut * taux_sortie)
    boucle_fin = round(recette.boucle_fin * taux_sortie) if recette.boucle_fin is not None else len(rendu)
    if recette.boucle and not 0 <= boucle_debut < boucle_fin <= len(rendu):
        raise SonRefuse("La boucle doit rester dans la durée du son après la coupe et les fondus.")
    mesure["boucle"] = {"active": recette.boucle, "debut": boucle_debut, "fin": boucle_fin,
        "ecart_raccord": float(np.max(np.abs(rendu[boucle_fin-1] - rendu[boucle_debut]))) if recette.boucle else None}
    return rendu, taux_sortie, mesure


def mesurer(signal, taux):
    pic = float(np.max(np.abs(signal))) if len(signal) else 0
    rms = float(np.sqrt(np.mean(signal ** 2))) if len(signal) else 0
    return {"duree": len(signal) / taux, "taux": taux, "canaux": signal.shape[1], "echantillons": len(signal),
        "crete": pic, "crete_db": 20 * math.log10(pic) if pic > 0 else None,
        "rms_db": 20 * math.log10(rms) if rms > 0 else None, "silencieux": pic <= 1e-8,
        "ecretes": int(np.count_nonzero(np.abs(signal) > 1))}


def encoder(signal, taux):
    pcm = np.rint(np.clip(signal, -1, 1) * 32767).astype("<i2")
    tampon = io.BytesIO()
    with wave.open(tampon, "wb") as fichier:
        fichier.setnchannels(signal.shape[1]); fichier.setsampwidth(2); fichier.setframerate(taux)
        fichier.writeframes(pcm.tobytes())
    return tampon.getvalue()


def onde(signal, taux, colonnes=512):
    colonnes = max(32, min(int(colonnes), 2048))
    frontieres = np.linspace(0, len(signal), min(colonnes, len(signal)) + 1).astype(int)
    return {"duree": len(signal) / taux, "taux": taux, "canaux": signal.shape[1],
        "canaux_ondes": [{"minimum": [float(signal[a:b, c].min()) for a, b in zip(frontieres, frontieres[1:])],
                           "maximum": [float(signal[a:b, c].max()) for a, b in zip(frontieres, frontieres[1:])]}
                          for c in range(signal.shape[1])]}
