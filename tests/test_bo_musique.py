"""La bande originale d'un jeu (relevé « Univers musical », 10 octobre 2026).

Trois musiques d'accueil de Cœur de Pierre, demandées en mots de nappe et
rendues par ACE-Step sans compositeur ni structure, sont revenues en nappes.
Ces essais tiennent ce qui a changé : les gabarits par usage (une structure en
sections, un tempo, une carrure), le bloc « bande originale » de l'univers
(mode, leitmotiv, interdits), l'alerte des mots de nappe, et la graine de
départ qui fait tirer trois intensités d'une musique sur les mêmes graines.
Aucun calcul réel : le double de ComfyUI de SN1."""
import numpy as np
import pytest

from atelier.audio.graphes import CONSTRUCTEURS, REPRISES, fichiers_requis
from atelier.audio.texte import USAGES, alertes, composer_texte
from atelier.audio.traitement import encoder
from atelier.domaine.projet import UniversSonore
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.workflow import WorkflowRefuse, composer, normaliser
from atelier.services.travaux_audio import reglage_de_calcul
from tests.test_sn1_installation import son  # noqa: F401 — la fixture

ACE = "ace-step-15-turbo"
BO = {"champs": [
    {"nom": "orchestre", "texte": "deep male choir, cellos, french horn, war drums, bodhran, fiddle, tin whistle"},
    {"nom": "mode", "texte": "modal ancient color"},
    {"nom": "leitmotiv", "texte": "recurring leitmotif D-A-G-F-E-D, a rising fifth call then a stepwise descent"},
    {"nom": "humeur", "texte": "heroic, dwarven, ancient"},
    {"nom": "interdits", "texte": "synth, electric guitar, piano"},
], "tonalite": "D minor"}


def univers_bo():
    return UniversSonore.depuis_json(None).regle(BO)


def graines_envoyees(comfy):
    return [envoi["prompt"]["8"]["inputs"]["seed"] for envoi in comfy.envois]


# ── La règle, pure ──────────────────────────────────────────────────────


def test_un_usage_donne_sa_structure_son_tempo_et_sa_carrure():
    c = composer_texte("musique", ACE, {"description": "title theme", "usage": "titre"})
    p = c["parametres"]
    assert p["paroles"] == {"valeur": USAGES["titre"]["structure"], "source": "usage"}
    assert p["paroles"]["valeur"].count("[") >= 6 and "[Chorus" in p["paroles"]["valeur"]
    assert (p["tempo"], p["mesure"]) == ({"valeur": 76, "source": "usage"}, {"valeur": 4, "source": "usage"})
    assert c["mesures"]["demandees"] == 38 and c["mesures"]["source"] == "usage" and c["usage"] == "titre"
    # Une demande passe devant l'usage ; l'usage devant l'univers.
    c = composer_texte("musique", ACE, {"description": "camp", "usage": "village", "tempo": 110, "paroles": "[Verse]"},
                       UniversSonore.depuis_json(None).regle({"tempo": 70}))
    assert c["parametres"]["tempo"]["valeur"] == 110 and c["parametres"]["paroles"]["valeur"] == "[Verse]"
    assert c["parametres"]["mesure"]["valeur"] == 6
    c = composer_texte("musique", ACE, {"description": "camp", "usage": "village"},
                       UniversSonore.depuis_json(None).regle({"tempo": 70}))
    assert c["parametres"]["tempo"] == {"valeur": 112, "source": "usage"}
    with pytest.raises(ValueError, match="usage"):
        composer_texte("musique", ACE, {"description": "x", "usage": "ascenseur"})


def test_sans_usage_rien_ne_change():
    c = composer_texte("musique", ACE, {"description": "exploration"})
    assert c["parametres"]["paroles"]["source"] == "gabarit" and "usage" not in c


def test_la_bande_originale_part_avec_chaque_piste_sauf_ses_interdits():
    c = composer_texte("musique", ACE, {"description": "warm folk tune", "usage": "village"}, univers_bo())
    assert [m.get("champ") for m in c["morceaux"]] == [None, "orchestre", "mode", "leitmotiv", "humeur"]
    assert "modal ancient color" in c["texte"] and "D-A-G-F-E-D" in c["texte"]
    assert "piano" not in c["texte"] and c["parametres"]["tonalite"]["valeur"] == "D minor"
    assert c["alertes"] == []
    # Un jingle les reçoit aussi ; une chanson garde l'orchestre et le mode.
    assert "D-A-G-F-E-D" in composer_texte("jingle", ACE, {"description": "fanfare"}, univers_bo())["texte"]
    chanson = composer_texte("chanson", "yue2-int8", {"description": "drinking song"}, univers_bo())
    assert "modal ancient color" in chanson["texte"] and "D-A-G-F-E-D" not in chanson["texte"]
    # Une ambiance ou un bruitage n'en reçoit rien.
    assert "modal" not in composer_texte("ambiance", "sa3-small-sfx", {"description": "cave"}, univers_bo())["texte"]


def test_un_interdit_de_la_bande_originale_est_signale_jamais_retire():
    c = composer_texte("musique", ACE, {"description": "gentle piano theme with synth"}, univers_bo())
    assert "piano" in c["texte"] and len(c["alertes"]) == 1
    assert "« synth », « piano »" in c["alertes"][0]
    # « pianissimo » n'est pas « piano » : un mot entier, pas un morceau de mot.
    assert alertes("musique", "pianissimo strings", univers_bo()) == []


@pytest.mark.parametrize("texte", [
    "dark ambient instrumental, slow deep low drones, minimal",
    "soft pads and atmospheric textures",
])
def test_les_mots_de_nappe_alertent_une_musique(texte):
    dites = alertes("musique", texte)
    assert len(dites) == 1 and "nappe" in dites[0]


def test_une_negation_et_un_mode_rare_alertent_sans_rien_retirer():
    """Le guide officiel d'ACE-Step 1.5 : « no drums » appelle les tambours, et
    « D dorian » est ignoré. Le texte part tel quel ; l'écran le dit."""
    dites = alertes("musique", "solo fiddle, no percussion, without ensemble, D dorian mode")
    assert len(dites) == 2
    assert "« no percussion », « without ensemble »" in dites[0] and "négation" in dites[0]
    assert "« dorian »" in dites[1] and "majeure ou mineure" in dites[1]
    assert alertes("musique", "noble horns, nostalgic harp, modal ancient color") == []
    c = composer_texte("musique", ACE, {"description": "camp, no drums"})
    assert "no drums" in c["texte"] and any("négation" in a for a in c["alertes"])


def test_les_gabarits_d_usage_suivent_le_guide_officiel():
    """Une section, un descripteur court, puis [Instrumental] ; une légende sans
    tempo ni tonalité, sans négation ni mode rare."""
    for cle, usage in USAGES.items():
        assert alertes("musique", usage["description"]) == [], cle
        if cle in ("jingle", "chanson"):
            continue
        blocs = usage["structure"].split("\n\n")
        assert len(blocs) >= 6, cle
        for bloc in blocs:
            balise, instrumental = bloc.split("\n")
            assert instrumental == "[Instrumental]" and balise.count(" - ") <= 1, (cle, bloc)
        assert "bpm" not in usage["description"].lower() and " minor" not in usage["description"], cle


def test_l_alerte_ne_vise_que_la_musique():
    assert alertes("ambiance", "dark ambient drones") == []
    assert composer_texte("ambiance", "sa3-small-sfx", {"description": "dark ambient drones"})["alertes"] == []
    assert composer_texte("musique", ACE, {"description": "dark ambient drones"})["alertes"]


def test_le_bloc_bande_originale_se_garde_et_se_relit():
    """8septies : refermé et rouvert, avec des valeurs qui ne sont pas celles du défaut."""
    relu = UniversSonore.depuis_json(univers_bo().en_json())
    assert relu.texte("mode") == "modal ancient color" and relu.texte("interdits") == "synth, electric guitar, piano"
    assert relu.texte("leitmotiv").startswith("recurring leitmotif")
    # Un univers d'avant (quatre cases) se relit sans perte, les nouvelles vides.
    ancien = UniversSonore.depuis_json({"champs": [{"nom": "orchestre", "texte": "lute", "actif": True}]})
    assert ancien.texte("orchestre") == "lute" and ancien.texte("mode") == ""


# ── Le chemin entier ────────────────────────────────────────────────────


async def test_la_relecture_dit_l_alerte_et_le_texte_relu_aussi(son):  # noqa: F811
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, son=BO)
    vu = atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "epic theme", "usage": "titre",
                                                       "options": {"compositeur": False}, "graine": 4})
    assert vu["alertes"] == [] and "modal ancient color" in vu["texte"] and vu["parametres"]["paroles"]["source"] == "usage"
    relu = atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "x", "texte_relu": "ambient drones"})
    assert relu["alertes"] and "nappe" in relu["alertes"][0]


def test_le_reglage_de_calcul_ne_nomme_que_ce_qui_change_le_temps():
    assert reglage_de_calcul(None) is None and reglage_de_calcul({"compositeur": True, "temperature": 0.7}) is None
    assert reglage_de_calcul({"compositeur": False}) == "sans-compositeur"
    assert reglage_de_calcul({"compositeur": False, "pas": 16}) == "sans-compositeur,pas-16"
    assert reglage_de_calcul({"pas": True}) is None


async def test_le_temps_annonce_ne_mele_pas_le_mode_rapide_et_le_compositeur(son):  # noqa: F811
    """Relevé du 10 octobre 2026 : 305 s annoncées pour quatre tirages
    compositeur, 550 réelles — la médiane mêlait les tirages rapides."""
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    rapide = {"famille": "musique", "usage": "jingle", "prompt": "fanfare", "options": {"compositeur": False}}
    s = await atelier.series_son.preparer(projet, {**rapide, "cle": "rapide", "nombre": 2})
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    etapes = [e for e in atelier.file_locale.lister()["etapes"] if e["nature"] == "audio"]
    assert etapes and all(e["reglage"] == "sans-compositeur" for e in etapes)
    assert atelier.series_son.temps(s["modele"], 4, {"compositeur": False})["temps_s"] is not None
    compositeur = atelier.series_son.temps(s["modele"], 4, {"compositeur": True})
    assert compositeur["temps_s"] is None and compositeur["mesures"] == 0


async def test_trois_intensites_tirent_sur_les_memes_graines_avec_leurs_reglages(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, son=BO)
    commun = {"famille": "musique", "usage": "village", "graine": 1000, "nombre": 2, "mesures": 8,
              "options": {"compositeur": False, "temperature": 0.7}}
    series = []
    for cle, texte in (("desert", "solo fiddle"), ("revit", "fiddle and flute"), ("fete", "full folk band")):
        s = await atelier.series_son.preparer(projet, {**commun, "cle": cle, "prompt": texte})
        assert [t["graine"] for t in s["tirages"]] == [1000, 1001]
        series.append(s)
        await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    assert sorted(graines_envoyees(comfy)) == [1000, 1000, 1000, 1001, 1001, 1001]
    encodeur = comfy.envois[0]["prompt"]["5"]["inputs"]
    assert encodeur["generate_audio_codes"] is False and encodeur["temperature"] == 0.7
    assert encodeur["lyrics"] == USAGES["village"]["structure"] and encodeur["timesignature"] == "6"
    assert "modal ancient color" in encodeur["tags"] and encodeur["keyscale"] == "D minor"
    with pytest.raises(TravailRefuse, match="usage"):
        await atelier.travaux_audio.preparer(projet, {"cle": "sans", "modele": series[0]["modele"], "prompt": "x",
                                                      "secondes": 30, "usage": "titre"})


# ── La reprise d'un son ─────────────────────────────────────────────────
#
# Un air de fête du camp, rejoué plus calme (« qui revit », « désert ») en
# gardant sa mélodie : le son de départ passe en latent à la place du latent
# vide, et la force dit à quel point le suivre (débruitage = 1 − force).


def air_de_fete(secondes=4, taux=16000):
    t = np.arange(int(secondes * taux)) / taux
    note = .25 * np.sin(2 * np.pi * 330 * t)
    return encoder(np.column_stack((note, note * .8)), taux)


def test_le_profil_de_reprise_part_du_son_et_non_d_un_latent_vide():
    profil = normaliser(CONSTRUCTEURS["ace-step-15-reprise"]())
    assert REPRISES["ace-step-15-turbo"] == "ace-step-15-reprise"
    # Les mêmes fichiers que le turbo : l'installation n'en demande aucun de plus.
    assert {r["fichier"] for r in fichiers_requis(profil)} == {
        r["fichier"] for r in fichiers_requis(normaliser(CONSTRUCTEURS[ACE]()))}
    graphe = composer(profil, prompt="sparse fiddle, desert dusk", secondes=42.5, graine=9, source="atelier-son-abc.wav",
                      force=0.6, tempo=96)
    par_classe = {n["class_type"]: (cle, n) for cle, n in graphe.items()}
    assert "EmptyAceStep1.5LatentAudio" not in par_classe
    cle_charge, charge = par_classe["LoadAudio"]
    cle_latent, latent = par_classe["VAEEncodeAudio"]
    _, echantillonneur = par_classe["KSampler"]
    cle_timbre, timbre = par_classe["ReferenceTimbreAudio"]
    assert charge["inputs"]["audio"] == "atelier-son-abc.wav" and latent["inputs"]["audio"] == [cle_charge, 0]
    assert echantillonneur["inputs"]["latent_image"] == [cle_latent, 0]
    assert echantillonneur["inputs"]["positive"] == [cle_timbre, 0] and timbre["inputs"]["latent"] == [cle_latent, 0]
    assert echantillonneur["inputs"]["denoise"] == 0.4 and echantillonneur["inputs"]["seed"] == 9
    encodeur = par_classe["TextEncodeAceStepAudio1.5"][1]["inputs"]
    assert encodeur["generate_audio_codes"] is False and encodeur["duration"] == 42.5 and encodeur["bpm"] == 96
    assert set(profil["parametres"]) == {"langue", "pas"}  # température et guidage ne servent qu'au compositeur
    # La force par défaut, ses bornes, et le son de départ obligatoire.
    assert composer(profil, prompt="x", secondes=10, source="s.wav")[cle_charge]["inputs"]["audio"] == "s.wav"
    assert composer(profil, prompt="x", secondes=10, source="s.wav", force=0.9)["10"]["inputs"]["denoise"] == 0.1
    for force in (0.05, 0.99, True, "0.6"):
        with pytest.raises(WorkflowRefuse, match="fidélité"):
            composer(profil, prompt="x", secondes=10, source="s.wav", force=force)
    with pytest.raises(WorkflowRefuse, match="son de départ"):
        composer(profil, prompt="x", secondes=10)
    # Le turbo, lui, ne sait pas partir d'un son.
    with pytest.raises(WorkflowRefuse, match="ne sait pas partir d'un son existant"):
        composer(normaliser(CONSTRUCTEURS[ACE]()), prompt="x", secondes=10, source="s.wav")


def test_seul_un_profil_sonore_relie_un_son_de_depart_et_toujours_avec_sa_force():
    brut = CONSTRUCTEURS["ace-step-15-reprise"]()
    del brut["liaisons"]["force"]
    with pytest.raises(WorkflowRefuse, match="toujours avec sa force"):
        normaliser(brut)


async def test_une_serie_reprend_le_son_depose_avec_sa_duree_et_ses_graines(son):  # noqa: F811
    atelier, comfy = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    fete = atelier.sons.importer_octets(projet, air_de_fete(), nom="Fête du camp.wav")
    assert fete["pret"]
    demande = {"famille": "musique", "prompt": "camp revives, sparse fiddle", "source": fete["identifiant"], "force": 0.7,
               "texte_relu": "folk, fiddle and flute, calm", "tempo": 112, "mesure": 6, "tonalite": "D minor",
               "graine": 500, "mesures": 16}
    vu = atelier.travaux_audio.ce_qui_partira(projet, demande)
    assert vu["secondes"] == 4.0 and vu["source_secondes"] == "source" and vu["source"]["nom"] == "Fête du camp.wav"
    assert vu["force"] == 0.7 and "mesures" not in vu and "reprise" in vu["modele"]
    s = await atelier.series_son.preparer(projet, {**demande, "cle": "revit", "nombre": 2})
    assert "ace-step-15-reprise" in s["modele"] and [t["graine"] for t in s["tirages"]] == [500, 501]
    # Retoucher le son de départ après la préparation ne change pas ce qui part.
    rendu = atelier.sons.rendu(projet, fete["identifiant"]).read_bytes()
    atelier.sons.regler(projet, fete["identifiant"], fete["revision"], {"gain_db": -6})
    assert atelier.sons.rendu(projet, fete["identifiant"]).read_bytes() != rendu
    await atelier.series_son.demarrer(projet, s["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.series_son.lire(projet, s["identifiant"])
    assert fini["etat"] == "terminee", fini
    assert len(comfy.envois) == 2 and len(comfy.fichiers) == 2
    assert all(b"atelier-son-" in f and b"audio/wav" in f for f in comfy.fichiers)
    assert all(rendu in f for f in comfy.fichiers)  # le rendu d'avant la retouche, octet pour octet
    for envoi, graine in zip(sorted(comfy.envois, key=lambda e: e["prompt"]["10"]["inputs"]["seed"]), (500, 501)):
        graphe = envoi["prompt"]
        assert graphe["7"]["class_type"] == "LoadAudio" and graphe["7"]["inputs"]["audio"] == "reference-enregistree.png"
        assert graphe["10"]["inputs"]["denoise"] == 0.3 and graphe["10"]["inputs"]["seed"] == graine
        assert graphe["5"]["inputs"]["duration"] == 4.0 and graphe["5"]["inputs"]["tags"] == "folk, fiddle and flute, calm"
        assert graphe["5"]["inputs"]["bpm"] == 112 and graphe["5"]["inputs"]["timesignature"] == "6"


async def test_une_reprise_impossible_est_refusee_en_clair(son):  # noqa: F811
    atelier, _ = son
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    with pytest.raises(TravailRefuse, match="n'existe pas"):
        atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "x", "source": "0" * 32})
    fete = atelier.sons.importer_octets(projet, air_de_fete(), nom="Fête.wav")
    # Un moteur sans profil de reprise (Stable Audio) ne sait pas partir d'un son.
    medium = next(p for p in atelier.profils_workflow.lister() if p["identifiant"] == "sa3-medium")
    with pytest.raises(TravailRefuse, match="ne sait pas partir d'un son existant"):
        atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "x", "modele": medium["modele"],
                                                      "source": fete["identifiant"]})
    with pytest.raises(TravailRefuse, match="fidélité"):
        atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "x", "force": 0.5})
    with pytest.raises(TravailRefuse, match="fidélité"):
        atelier.travaux_audio.ce_qui_partira(projet, {"famille": "musique", "prompt": "x", "source": fete["identifiant"],
                                                      "force": 2})
    with pytest.raises(TravailRefuse, match="famille"):
        await atelier.travaux_audio.preparer(projet, {"cle": "k", "modele": medium["modele"], "prompt": "x", "secondes": 30,
                                                      "source": fete["identifiant"]})


def test_les_trois_modeles_d_ace_step_ne_different_que_par_le_poids_les_pas_et_le_guidage():
    """Base et XL turbo (10 octobre 2026) : même texte, même graphe que le
    turbo ; seuls le fichier de poids, les pas et le cfg du rendu changent —
    réglages des gabarits officiels de ComfyUI. Le turbo reste le défaut."""
    from atelier.audio.graphes import FAMILLES
    from atelier.audio.texte import gabarit_de
    attendus = {"ace-step-15-turbo": ("acestep_v1.5_turbo.safetensors", 8, 1),
                "ace-step-15-base": ("acestep_v1.5_base.safetensors", 50, 6),
                "ace-step-15-xl-turbo": ("acestep_v1.5_xl_turbo_bf16.safetensors", 8, 1)}
    turbo = CONSTRUCTEURS[ACE]()
    for identifiant, (poids, pas, cfg) in attendus.items():
        profil = CONSTRUCTEURS[identifiant]()
        assert profil["identifiant"] == identifiant and gabarit_de("musique", identifiant) == "ace-musique"
        assert profil["graphe"]["1"]["inputs"]["unet_name"] == poids
        assert (profil["graphe"]["8"]["inputs"]["steps"], profil["graphe"]["8"]["inputs"]["cfg"]) == (pas, cfg)
        assert profil["parametres"]["pas"]["defaut"] == pas
        assert profil["liaisons"] == turbo["liaisons"]
        assert any(f["fichier"] == poids and f.get("source") for f in fichiers_requis(normaliser(profil)))
        graphe = composer(normaliser(profil), prompt="dwarven work song", secondes=30)
        assert graphe["8"]["inputs"]["steps"] == pas
    # Le XL turbo passe devant (jugé à l'oreille, 10 octobre 2026) ; le turbo
    # reste juste derrière, pour reprendre quand le XL n'est pas installé.
    assert FAMILLES["musique"][:3] == ("ace-step-15-xl-turbo", ACE, "ace-step-15-base")
    assert FAMILLES["jingle"][:2] == ("ace-step-15-xl-turbo", ACE)
    assert REPRISES["ace-step-15-xl-turbo"] == REPRISES[ACE]


# ── La saturation des musiques (10 octobre 2026) ───────────────────────
#
# Quatre rendus ACE-Step de 150 s sortaient à +0,5 à +1 dBTP, 3 à 18
# échantillons écrêtés, ≈ −12 LUFS : le décodeur rend au-delà de 1,0 et
# `SaveAudio` (FLAC entier) coupe à l'écriture. Deux parades : une marge de
# −4 dB dans le graphe, avant le fichier brut ; et, dans la recette, un niveau
# visé tenu par un limiteur à crête vraie plutôt que par un gain plafonné.

ACE_ET_REPRISE = ("ace-step-15-turbo", "ace-step-15-base", "ace-step-15-xl-turbo", "ace-step-15-reprise")


@pytest.mark.parametrize("identifiant", ACE_ET_REPRISE)
def test_le_graphe_ace_baisse_de_4_db_avant_d_ecrire_le_flac(identifiant):
    profil = normaliser(CONSTRUCTEURS[identifiant]())
    graphe = profil["graphe"]
    sortie = graphe[profil["sortie"]["noeud"]]
    assert sortie["class_type"] == "SaveAudio"
    marge = graphe[sortie["inputs"]["audio"][0]]
    assert marge["class_type"] == "AudioAdjustVolume" and marge["inputs"]["volume"] == -4
    assert graphe[marge["inputs"]["audio"][0]]["class_type"] == "VAEDecodeAudio"
    # Un seul chemin du décodeur au fichier : rien ne contourne la marge.
    assert sum(1 for n in graphe.values() if n["class_type"] == "SaveAudio") == 1
    # La marge part telle quelle : aucune liaison ne la touche.
    compose = composer(profil, prompt="x", secondes=10, **({"source": "s.wav"} if "reprise" in identifiant else {}))
    assert compose[sortie["inputs"]["audio"][0]]["inputs"]["volume"] == -4


def _stereo_fort(secondes=10, taux=44100):
    """≈ −10 LUFS, crêtes à 0 dBFS : deux notes tenues, un souffle, et un
    coup de 10 ms toutes les 250 ms qui monte à la pleine échelle."""
    t = np.arange(int(secondes * taux)) / taux
    bruit = np.random.default_rng(7).standard_normal((len(t), 2))
    signal = np.column_stack((np.sin(2 * np.pi * 220 * t), np.sin(2 * np.pi * 330 * t))) * .33 + bruit * .03
    for i in range(0, len(t) - 441, taux // 4):
        signal[i:i + 441] += .57 * np.hanning(441)[:, None]
    return signal / np.max(np.abs(signal))


def _stereo_pointu(secondes=10, taux=44100):
    """Deux notes faibles et un claquement bref toutes les 250 ms : la crête
    est loin au-dessus du niveau perçu."""
    t = np.arange(int(secondes * taux)) / taux
    signal = np.column_stack((np.sin(2 * np.pi * 440 * t), np.sin(2 * np.pi * 550 * t))) * .05
    for i in range(0, len(t) - 44, taux // 4):
        signal[i:i + 44] += .9 * np.hanning(44)[:, None]
    return signal


def test_le_limiteur_amene_une_musique_forte_a_moins_16_lufs_sans_ecreter():
    from atelier.audio.traitement import mesurer, traiter
    from atelier.domaine.son import RecetteSon
    taux = 44100
    signal = _stereo_fort(taux=taux)
    avant = mesurer(signal, taux)
    assert -12 <= avant["lufs"] <= -8 and avant["crete_vraie_db"] >= -.1
    rendu, taux_rendu, mesure = traiter(signal, taux, RecetteSon(cible_lufs=-16, limiteur=True))
    relu = mesurer(rendu, taux_rendu)
    assert abs(relu["lufs"] - (-16)) <= .5
    assert relu["crete_vraie_db"] <= -1 and relu["ecretes"] == 0
    assert mesure["niveau"]["limiteur"] is True and mesure["niveau"]["applique"] and not mesure["niveau"]["plafonne"]


def test_le_limiteur_atteint_la_cible_la_ou_le_gain_plafonne_s_arretait():
    from atelier.audio.traitement import CRETE_VRAIE_MAX_DB, mesurer, traiter
    from atelier.domaine.son import RecetteSon
    taux = 44100
    signal = _stereo_pointu(taux=taux)
    avant = mesurer(signal, taux)
    # La cible demanderait de monter la crête vraie à 8 dB au-dessus de −1 dBTP.
    assert (-16 - avant["lufs"]) + avant["crete_vraie_db"] - CRETE_VRAIE_MAX_DB >= 8
    reglages = {"cible_lufs": -16, "fondu_entree_ms": 0, "fondu_sortie_ms": 0}
    rendu, _, avec = traiter(signal, taux, RecetteSon(**reglages, limiteur=True))
    relu = mesurer(rendu, taux)
    assert abs(relu["lufs"] - (-16)) <= .5 and relu["crete_vraie_db"] <= -1 and relu["ecretes"] == 0
    assert avec["niveau"]["limiteur"] and not avec["niveau"]["plafonne"] and avec["niveau"]["reduction_max_db"] >= 7.5
    # Non-régression : sans limiteur, le gain s'arrête à −1 dBTP comme avant.
    _, _, sans = traiter(signal, taux, RecetteSon(**reglages, limiteur=False))
    assert sans["niveau"]["plafonne"] and sans["niveau"]["limiteur"] is False
    assert sans["niveau"]["gain_db"] == pytest.approx(CRETE_VRAIE_MAX_DB - avant["crete_vraie_db"])
    assert sans["lufs"] < -22 and sans["crete_vraie_db"] <= -.9


def test_une_recette_sans_limiteur_rend_les_memes_octets():
    from atelier.audio.traitement import traiter
    from atelier.domaine.son import FAMILLES, RecetteSon, recette_proposee
    taux = 22050
    signal = _stereo_pointu(3, taux)
    ancienne = {"cible_lufs": -17, "gain_db": -1, "fondu_entree_ms": 20}
    recette = RecetteSon.depuis_json(ancienne)
    assert recette.limiteur is False
    rendu, t1, mesure = traiter(signal, taux, recette)
    explicite, t2, _ = traiter(signal, taux, RecetteSon.depuis_json({**ancienne, "limiteur": False}))
    assert encoder(rendu, t1) == encoder(explicite, t2)
    assert mesure["niveau"]["plafonne"] and "reduction_max_db" not in mesure["niveau"]
    with pytest.raises(Exception, match="limiteur"):
        RecetteSon.depuis_json({"limiteur": 1})
    # La recette proposée aux musiques ; ambiance et voix ne bougent pas.
    for famille in ("musique", "chanson", "jingle"):
        assert {k: recette_proposee({}, famille)[k] for k in ("cible_lufs", "limiteur")} == {"cible_lufs": -16, "limiteur": True}
    assert "limiteur" not in FAMILLES["ambiance"].reglages and "limiteur" not in FAMILLES["voix"].reglages
    assert recette_proposee({}, "ambiance")["cible_lufs"] == -26 and recette_proposee({}, "voix")["cible_lufs"] == -17
