"""Savoir de MySpriteAi audioPipeline, avec canaux conservés et temps explicites.

Le niveau mesure le maximum de tous les canaux : deux canaux en opposition
de phase ne deviennent pas du silence parce que leur moyenne vaut zéro.
"""
from __future__ import annotations

import io
import math
import re
import subprocess
import wave
from pathlib import Path

import numpy as np

from atelier.domaine.son import RecetteSon, SonRefuse

VERSION = 1

_RE_INTEGRE = re.compile(r"Integrated loudness:\s*\n\s*I:\s*(-?\d+\.?\d*|-inf|nan)\s*LUFS")
_RE_CRETE_VRAIE = re.compile(r"True peak:\s*\n\s*Peak:\s*(-?\d+\.?\d*|-inf|nan)\s*dBFS")
_DUREE_MINIMALE_LUFS = 0.4  # ebur128 exige un premier bloc de 400 ms ; en
# dessous il répond -70 LUFS, une valeur de repli du filtre et non une
# mesure — vérifié à la main (voir PLAN-son.md, SN3/SN5) avant d'écrire ce
# seuil : 0,39 s rend -70 LUFS, 0,40 s rend une vraie mesure.


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


_SOUS_FORMAT_PCM = bytes.fromhex("0100000000001000800000aa00389b71")


def _lire_wav_pcm(donnees: bytes):
    # ffmpeg (imageio_ffmpeg 7.1) écrit le PCM 32 bits en WAVE_FORMAT_EXTENSIBLE
    # (étiquette 65534) plutôt qu'en WAVE_FORMAT_PCM (étiquette 1) : le module
    # `wave` de la bibliothèque standard refuse cette étiquette. Les dimensions
    # mesurées ici viennent du fichier rendu, jamais de la ligne de commande.
    if donnees[:4] != b"RIFF" or donnees[8:12] != b"WAVE":
        raise ValueError("en-tête RIFF/WAVE absent")
    position, fin = 12, len(donnees)
    fmt = None
    while position + 8 <= fin:
        identifiant, taille = donnees[position:position + 4], int.from_bytes(donnees[position + 4:position + 8], "little")
        corps = donnees[position + 8:position + 8 + taille]
        if identifiant == b"fmt ":
            if len(corps) < 16:
                raise ValueError("bloc fmt tronqué")
            etiquette = int.from_bytes(corps[0:2], "little")
            canaux = int.from_bytes(corps[2:4], "little")
            taux = int.from_bytes(corps[4:8], "little")
            largeur = int.from_bytes(corps[14:16], "little") // 8
            if etiquette == 65534:
                if len(corps) < 40 or corps[24:40] != _SOUS_FORMAT_PCM:
                    raise ValueError("sous-format WAVE_FORMAT_EXTENSIBLE non PCM")
            elif etiquette != 1:
                raise ValueError(f"étiquette de format {etiquette} non gérée")
            fmt = (canaux, taux, largeur)
        elif identifiant == b"data":
            if fmt is None:
                raise ValueError("bloc data avant le bloc fmt")
            canaux, taux, largeur = fmt
            return canaux, taux, largeur, corps
        position += 8 + taille + (taille & 1)
    raise ValueError("bloc data absent")


def decoder(source: Path):
    # Le plafond borne l'expansion d'un fichier comprimé. Il ne devient jamais
    # une coupe silencieuse : une source plus longue reste à vérifier.
    wav = _ffmpeg(["-i", str(source), "-map", "0:a:0", "-vn", "-t", "601",
        "-acodec", "pcm_s32le", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-f", "wav", "pipe:1"])
    try:
        canaux, taux, largeur, contenu = _lire_wav_pcm(wav)
    except (ValueError, IndexError) as erreur:
        raise SonRefuse("Le décodeur n'a pas rendu un signal PCM lisible.") from erreur
    if canaux not in (1, 2):
        raise SonRefuse("Cette source comporte plus de deux canaux. Importez une version mono ou stéréo ; aucun mixage n'est imposé.")
    if largeur != 4 or taux <= 0 or not contenu or len(contenu) % (4 * canaux):
        raise SonRefuse("Le fichier ne contient aucun signal audio exploitable.")
    signal = np.frombuffer(contenu, dtype="<i4").reshape((-1, canaux)).astype(np.float64) / 2147483648
    if len(signal) / taux > 600:
        raise SonRefuse("La source dépasse dix minutes. Elle est conservée ; importez une séquence de dix minutes au plus pour la travailler.")
    return signal, taux


def _lufs_et_crete_vraie(signal, taux):
    # Niveau perçu intégré (LUFS, EBU R128) et crête vraie (dBTP), par le
    # filtre ebur128 de ffmpeg, en sous-processus comme le décodage. On lui
    # passe le signal brut (float64, non ré-échantillonné) et on relit le
    # résumé qu'il écrit sur sa sortie d'erreur — cette mesure-ci a besoin
    # du texte que `-loglevel error` supprimerait, donc elle n'utilise pas
    # `_ffmpeg()`. Un extrait plus court que 0,4 s n'a pas de LUFS défini :
    # ni erreur, ni « non prêt » ; l'information manque, c'est tout.
    if len(signal) == 0 or len(signal) / taux < _DUREE_MINIMALE_LUFS:
        return None, None
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        execution = subprocess.run([get_ffmpeg_exe(), "-nostdin", "-hide_banner",
            "-f", "f64le", "-ar", str(taux), "-ac", str(signal.shape[1]), "-i", "pipe:0",
            "-af", "ebur128=peak=true", "-f", "null", "-"],
            input=signal.astype("<f8").tobytes(), capture_output=True, timeout=90)
    except (ImportError, OSError, subprocess.TimeoutExpired):
        return None, None
    if execution.returncode:
        return None, None
    sortie = execution.stderr.decode("utf-8", errors="replace")
    resume = sortie[sortie.rfind("Summary:"):]

    def _nombre(motif):
        trouve = motif.search(resume)
        if not trouve or trouve.group(1) in ("-inf", "nan"):
            return None
        return float(trouve.group(1))

    return _nombre(_RE_INTEGRE), _nombre(_RE_CRETE_VRAIE)


def _passage_zero_proche(rendu, index, rayon):
    # Cherche, dans une fenêtre de `rayon` échantillons autour de `index`,
    # le changement de signe le plus proche sur le mélange des canaux (une
    # approximation : un passage par zéro exact et simultané sur tous les
    # canaux n'existe pas toujours). Aucun changement trouvé : l'index de
    # départ est gardé tel quel plutôt que d'inventer un repère.
    mono = rendu.mean(axis=1)
    bas, haut = max(0, index - rayon), min(len(mono) - 1, index + rayon)
    fenetre = mono[bas:haut + 1]
    if len(fenetre) < 2:
        return index
    signes = np.sign(fenetre)
    signes[signes == 0] = 1
    changements = np.flatnonzero(np.diff(signes) != 0)
    if not len(changements):
        return index
    candidats = bas + changements
    return int(candidats[np.argmin(np.abs(candidats - index))])


def _fondre_boucle(rendu, debut, fin, taux, fondu_ms):
    # Fondu enchaîné de la boucle : on mélange la fin dans le début, pas la
    # queue au-delà de la fin dans la tête, parce que rien ne garantit
    # qu'il existe du son après `fin` (une recette peut caler `boucle_fin`
    # sur la toute fin du rendu). Godot rejoue en boucle de `loop_begin` à
    # `loop_end` : au moment du saut, l'échantillon juste avant (`fin - 1`)
    # est immédiatement suivi de l'échantillon `debut`. On prend donc les
    # `n` derniers échantillons avant `fin`, **retournés dans le temps**
    # (le tout dernier, celui qui touche le saut, en premier), et on les
    # fait décroître (fondu croisé à puissance constante) dans les `n`
    # premiers échantillons après `debut`, qui montent en proportion
    # inverse : le tout premier échantillon après le saut colle exactement
    # sur celui qui le précédait (continuité parfaite au point de saut), et
    # le mélange revient au contenu d'origine du début de boucle au bout de
    # `fondu_ms`. Retourner la queue dans le temps n'a pas d'effet audible
    # pour un bruit stationnaire (pluie, vent) : seule l'énergie locale
    # compte pour l'oreille, pas le sens de lecture sur une fenêtre de
    # quelques dizaines de millisecondes.
    n = min(round(fondu_ms * taux / 1000), (fin - debut) // 2)
    if n < 2:
        return
    t = np.linspace(0, np.pi / 2, n)[:, None]
    fondu_sortie, fondu_entree = np.cos(t), np.sin(t)
    queue = rendu[fin - n:fin][::-1].copy()
    tete = rendu[debut:debut + n].copy()
    rendu[debut:debut + n] = queue * fondu_sortie + tete * fondu_entree


def _mesurer_raccord(rendu, taux, debut, fin):
    saut = float(np.max(np.abs(rendu[fin - 1] - rendu[debut])))
    n = min(fin - debut, max(1, round(0.02 * taux)))  # ~20 ms de part et d'autre
    queue, tete = rendu[fin - n:fin], rendu[debut:debut + n]
    rms_queue = float(np.sqrt(np.mean(queue ** 2))) if len(queue) else 0.0
    rms_tete = float(np.sqrt(np.mean(tete ** 2))) if len(tete) else 0.0
    ecart_rms_db = abs(20 * math.log10(max(rms_queue, 1e-9)) - 20 * math.log10(max(rms_tete, 1e-9)))
    # Seuils empiriques (à l'oreille, pas une norme) : un saut d'échantillon
    # au-delà de 5 % de la pleine échelle s'entend comme un clic ; un écart
    # d'énergie de plus de 3 dB entre les deux bords s'entend comme un choc
    # de niveau. L'un ou l'autre suffit à faire claquer le raccord.
    net = saut < 0.05 and ecart_rms_db < 3
    return {"saut": saut, "ecart_rms_db": ecart_rms_db, "verdict": "raccord net" if net else "le raccord claque"}


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
    if recette.mono and rendu.shape[1] > 1:
        rendu = rendu.mean(axis=1, keepdims=True)
    if recette.hauteur_demi_tons:
        rendu = changer_hauteur(rendu, taux, recette.hauteur_demi_tons, garder_duree=recette.hauteur_garde_duree)
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
    niveau = None
    if recette.cible_lufs is not None and recette.limiteur:
        rendu, niveau = _viser_lufs_limite(rendu, taux_sortie, recette.cible_lufs)
    elif recette.cible_lufs is not None:
        niveau = _viser_lufs(rendu, taux_sortie, recette.cible_lufs)
    rendu *= 10 ** (recette.gain_db / 20)
    boucle_debut = round(recette.boucle_debut * taux_sortie)
    boucle_fin = round(recette.boucle_fin * taux_sortie) if recette.boucle_fin is not None else len(rendu)
    if recette.boucle and recette.boucle_zero:
        rayon = max(1, round(0.05 * taux_sortie))  # 50 ms, empirique
        boucle_debut = _passage_zero_proche(rendu, boucle_debut, rayon)
        boucle_fin = _passage_zero_proche(rendu, boucle_fin, rayon)
    if recette.boucle and not 0 <= boucle_debut < boucle_fin <= len(rendu):
        raise SonRefuse("La boucle doit rester dans la durée du son après la coupe et les fondus.")
    if recette.boucle and recette.boucle_fondu_ms:
        _fondre_boucle(rendu, boucle_debut, boucle_fin, taux_sortie, recette.boucle_fondu_ms)
    mesure = mesurer(rendu, taux_sortie)
    mesure["silencieux"] = mesure["silencieux"] or not source_audible
    mesure["coupe_source"] = coupe_silence
    raccord = _mesurer_raccord(rendu, taux_sortie, boucle_debut, boucle_fin) if recette.boucle \
        else {"saut": None, "ecart_rms_db": None, "verdict": None}
    mesure["boucle"] = {"active": recette.boucle, "debut": boucle_debut, "fin": boucle_fin,
        "recale_zero": recette.boucle_zero, "fondu_ms": recette.boucle_fondu_ms,
        "ecart_raccord": raccord["saut"], "ecart_rms_db": raccord["ecart_rms_db"], "verdict": raccord["verdict"]}
    if niveau is not None:
        mesure["niveau"] = niveau
    return rendu, taux_sortie, mesure


CRETE_VRAIE_MAX_DB = -1.0


def _viser_lufs(rendu, taux, cible):
    # Un gain, pas un compresseur : le niveau perçu est amené à la cible,
    # sauf si la crête vraie dépassait alors −1 dBTP — le gain s'arrête là
    # et la mesure le dit. Un extrait sans LUFS défini (moins de 0,4 s, ou
    # silence) n'est pas touché : l'information manque, c'est tout.
    lufs, crete = _lufs_et_crete_vraie(rendu, taux)
    if lufs is None:
        return {"cible_lufs": cible, "applique": False, "gain_db": 0.0, "plafonne": False,
            "raison": "Niveau perçu indéfini (moins de 0,4 s ou silence) : aucun gain appliqué."}
    gain = cible - lufs
    if crete is None:
        pic = float(np.max(np.abs(rendu)))
        crete = 20 * math.log10(pic) if pic > 0 else None
    plafonne = crete is not None and crete + gain > CRETE_VRAIE_MAX_DB
    if plafonne:
        gain = CRETE_VRAIE_MAX_DB - crete
    rendu *= 10 ** (gain / 20)
    return {"cible_lufs": cible, "applique": True, "gain_db": gain, "plafonne": plafonne, "lufs_avant": lufs,
        "limiteur": False,
        "raison": "Crête vraie plafonnée à −1 dBTP : la cible n'est pas atteinte." if plafonne else ""}


# Le seuil du limiteur, un peu sous le plafond : le retour au taux d'origine
# après le sur-échantillonnage peut faire remonter une crête de quelques
# dixièmes de dB (ondulation du filtre).
LIMITE_LIMITEUR_DB = -1.2
_SUR_ECHANTILLONNAGE = 4


def _limiter_crete_vraie(rendu, taux):
    """Limiteur à crête vraie : sur-échantillonné ×4 (les crêtes entre deux
    échantillons y deviennent des échantillons), `alimiter` à −1,2 dBFS —
    niveau automatique coupé, sans quoi il remonterait tout à 0 dBFS ; délai
    d'anticipation compensé —, puis retour au taux d'origine. Un limiteur,
    pas un écrêtage : le gain baisse en douceur autour de la crête au lieu
    de couper l'onde. Déterministe : ffmpeg ne tire rien au sort."""
    limite = 10 ** (LIMITE_LIMITEUR_DB / 20)
    filtre = (f"aresample={_SUR_ECHANTILLONNAGE * taux},"
              f"alimiter=limit={limite:.6f}:level=disabled:attack=5:release=80:latency=enabled,"
              f"aresample={taux}")
    canaux = rendu.shape[1]
    brut = _ffmpeg(["-f", "f64le", "-ar", str(taux), "-ac", str(canaux), "-i", "pipe:0",
        "-af", filtre, "-ar", str(taux), "-acodec", "pcm_f64le", "-f", "f64le", "pipe:1"], rendu.astype("<f8").tobytes())
    limite_rendu = np.frombuffer(brut, dtype="<f8").reshape((-1, canaux))
    # La longueur ne bouge pas : un échantillon de plus ou de moins au retour
    # du ré-échantillonnage décalerait la boucle.
    sortie = np.zeros_like(rendu)
    n = min(len(rendu), len(limite_rendu))
    sortie[:n] = limite_rendu[:n]
    return sortie


def _viser_lufs_limite(rendu, taux, cible):
    """Le niveau visé avec limiteur (recette `limiteur`) : le gain entier vers
    la cible, puis le limiteur à crête vraie à −1 dBTP. Le limiteur rabote
    les crêtes, donc un peu de niveau perçu : une seconde passe corrige le
    gain si l'écart dépasse 0,2 LU. Enfin, une sécurité : si la crête vraie
    remesurée dépasse encore −1 dBTP, tout le son descend de l'excès.
    Rend un nouveau tableau (le limiteur n'agit pas en place)."""
    lufs, crete = _lufs_et_crete_vraie(rendu, taux)
    if lufs is None:
        return rendu, {"cible_lufs": cible, "applique": False, "gain_db": 0.0, "plafonne": False, "limiteur": True,
            "reduction_max_db": 0.0, "securite_db": 0.0,
            "raison": "Niveau perçu indéfini (moins de 0,4 s ou silence) : aucun gain appliqué."}
    if crete is None:
        pic = float(np.max(np.abs(rendu)))
        crete = 20 * math.log10(pic) if pic > 0 else LIMITE_LIMITEUR_DB
    gain = cible - lufs
    for passe in range(2):
        limite = _limiter_crete_vraie(rendu * 10 ** (gain / 20), taux)
        lufs_apres, crete_apres = _lufs_et_crete_vraie(limite, taux)
        if passe or lufs_apres is None or abs(cible - lufs_apres) <= .2:
            break
        gain += cible - lufs_apres
    # La réduction la plus forte du limiteur, estimée simplement : de combien
    # la crête vraie après gain dépassait le seuil du limiteur.
    reduction = max(0.0, crete + gain - LIMITE_LIMITEUR_DB)
    securite = 0.0
    if crete_apres is not None and crete_apres > CRETE_VRAIE_MAX_DB:
        # ebur128 écrit la crête au dixième : 0,1 dB de plus couvre l'arrondi.
        securite = crete_apres - CRETE_VRAIE_MAX_DB + .1
        limite *= 10 ** (-securite / 20)
        lufs_apres, crete_apres = _lufs_et_crete_vraie(limite, taux)
    plafonne = lufs_apres is not None and abs(cible - lufs_apres) > .5
    return limite, {"cible_lufs": cible, "applique": True, "gain_db": gain - securite, "plafonne": plafonne,
        "lufs_avant": lufs, "lufs_apres": lufs_apres, "crete_vraie_apres_db": crete_apres, "limiteur": True,
        "reduction_max_db": reduction, "securite_db": securite,
        "raison": "Limiteur à crête vraie : la cible n'est pas atteinte à 0,5 LU près." if plafonne else ""}


def changer_hauteur(signal, taux, demi_tons, *, garder_duree):
    # Sans garder la durée : on relit le son à une autre fréquence, comme une
    # bande accélérée (plus aigu et plus court). En gardant la durée : le
    # filtre rubberband de ffmpeg (présent dans imageio_ffmpeg 7.1).
    # rubberband ne vide pas sa file à la fin du flux (constaté : +12 demi-tons
    # perdaient 80 ms sur 2 s) : on ajoute une demi-seconde de silence, puis
    # on recoupe à la longueur d'origine.
    rapport = 2 ** (demi_tons / 12)
    entree = np.concatenate([signal, np.zeros((taux // 2, signal.shape[1]))]) if garder_duree else signal
    filtre = f"rubberband=pitch={rapport:.10f}" if garder_duree else f"asetrate={round(taux * rapport)},aresample={taux}"
    rendu = _ffmpeg(["-f", "f64le", "-ar", str(taux), "-ac", str(signal.shape[1]), "-i", "pipe:0",
        "-af", filtre, "-ar", str(taux), "-acodec", "pcm_f64le", "-f", "f64le", "pipe:1"], entree.astype("<f8").tobytes())
    rendu = np.frombuffer(rendu, dtype="<f8").reshape((-1, signal.shape[1])).copy()
    if garder_duree:
        rendu = np.concatenate([rendu, np.zeros((max(0, len(signal) - len(rendu)), signal.shape[1]))])[:len(signal)]
    return rendu


def encoder_ogg(wav: bytes, qualite: int, *, fin_echantillon: int | None = None):
    """OGG Vorbis depuis un WAV 16 bits ; `fin_echantillon` coupe à la fin de
    boucle (un OGG boucle dans Godot de `loop_offset` jusqu'à sa fin)."""
    filtre = ["-af", f"atrim=end_sample={int(fin_echantillon)}"] if fin_echantillon is not None else []
    return _ffmpeg(["-f", "wav", "-i", "pipe:0", *filtre, "-c:a", "libvorbis", "-q:a", str(qualite),
        "-fflags", "+bitexact", "-flags:a", "+bitexact", "-f", "ogg", "pipe:1"], wav)


def _ecretes(signal, seuil=0.999, suite=3):
    """Les échantillons saturés : au-delà de la pleine échelle (un rendu en
    flottants avant encodage), **ou** collés au plafond au moins `suite` fois de
    suite. Un fichier 16 bits décodé ne dépasse jamais 1 : ne compter que
    `> 1` ne voyait aucune saturation dans un son reçu — un sommet aplati,
    lui, se voit à ces paliers. Un sommet isolé à pleine échelle n'en est pas un."""
    if not len(signal):
        return 0
    amplitude = np.abs(signal)
    sature = amplitude > 1
    for canal in range(signal.shape[1]):
        haut = amplitude[:, canal] >= seuil
        bords = np.diff(np.concatenate(([0], haut.astype(np.int8), [0])))
        for debut, fin in zip(np.flatnonzero(bords == 1), np.flatnonzero(bords == -1)):
            if fin - debut >= suite:
                sature[debut:fin, canal] = True
    return int(np.count_nonzero(sature))


def mesurer(signal, taux):
    pic = float(np.max(np.abs(signal))) if len(signal) else 0
    rms = float(np.sqrt(np.mean(signal ** 2))) if len(signal) else 0
    lufs, crete_vraie_db = _lufs_et_crete_vraie(signal, taux) if len(signal) else (None, None)
    return {"duree": len(signal) / taux, "taux": taux, "canaux": signal.shape[1], "echantillons": len(signal),
        "crete": pic, "crete_db": 20 * math.log10(pic) if pic > 0 else None,
        "rms_db": 20 * math.log10(rms) if rms > 0 else None, "silencieux": pic <= 1e-8,
        "ecretes": _ecretes(signal),
        "lufs": lufs, "crete_vraie_db": crete_vraie_db}


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
