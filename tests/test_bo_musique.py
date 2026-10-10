"""La bande originale d'un jeu (relevé « Univers musical », 10 octobre 2026).

Trois musiques d'accueil de Cœur de Pierre, demandées en mots de nappe et
rendues par ACE-Step sans compositeur ni structure, sont revenues en nappes.
Ces essais tiennent ce qui a changé : les gabarits par usage (une structure en
sections, un tempo, une carrure), le bloc « bande originale » de l'univers
(mode, leitmotiv, interdits), l'alerte des mots de nappe, et la graine de
départ qui fait tirer trois intensités d'une musique sur les mêmes graines.
Aucun calcul réel : le double de ComfyUI de SN1."""
import pytest

from atelier.audio.texte import USAGES, alertes, composer_texte
from atelier.domaine.projet import UniversSonore
from atelier.domaine.travail import TravailRefuse
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
