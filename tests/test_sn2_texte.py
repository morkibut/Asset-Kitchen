"""SN2 : l'univers sonore, et le texte qui part.

La règle de composition est pure (`atelier.audio.texte`) ; le reste passe par
un vrai atelier et le double de ComfyUI de SN1 — aucun calcul réel, rien de
payé."""
import json

import httpx
import pytest

from atelier.audio.texte import NEGATIF_SAO, composer_texte, duree_en_mesures, langue
from atelier.domaine.projet import Univers, UniversSonore
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from tests.test_au14_generation import fermer, lancer
from tests.test_au7_au8 import raccorder
from tests.test_sn1_installation import son  # noqa: F401 — la fixture

PRISE = "one-shot, close-mic'd, dry, no reverb, isolated"
MEDIEVAL = {"champs": [
    {"nom": "epoque", "texte": "medieval fantasy"},
    {"nom": "rendu", "texte": "retro 16-bit game"},
    {"nom": "orchestre", "texte": "acoustic folk ensemble: lute, fiddle, flute"},
    {"nom": "humeur", "texte": "warm, whimsical"},
]}


def univers_medieval(**autres):
    return UniversSonore.depuis_json(None).regle({**MEDIEVAL, **autres})


def positif(envoi):
    """Le texte parti dans le graphe de Stable Audio (KSampler → positif)."""
    graphe = envoi["prompt"]
    ks = next(n for n in graphe.values() if n["class_type"] == "KSampler")
    return graphe[ks["inputs"]["positive"][0]]["inputs"]["text"]


# ── La règle, pure ──────────────────────────────────────────────────────


def test_un_pas_d_un_jeu_medieval_16_bit():
    r = composer_texte("bruitage", "sa3-small-sfx", {"description": "Single footstep of a leather boot on dry grass"},
                       univers_medieval())
    assert r["texte"] == ("TrackType: SFX. Single footstep of a leather boot on dry grass, medieval fantasy, "
                          "retro 16-bit game, " + PRISE + ".")
    assert [m["source"] for m in r["morceaux"]] == ["gabarit", "description", "univers", "univers", "gabarit"]
    assert [m.get("champ") for m in r["morceaux"] if m["source"] == "univers"] == ["epoque", "rendu"]
    # Stable Audio 3 à guidage 1 : pas de texte négatif.
    assert r["texte_negatif"] == "" and r["secondes"] == 2 and not r["langue"]["non_anglais"]


def test_univers_vide_la_description_part_seule_avec_la_prise_de_son():
    r = composer_texte("bruitage", "sa3-small-sfx", {"description": "Wooden door creaks open"}, None)
    assert r["texte"] == "TrackType: SFX. Wooden door creaks open, " + PRISE + "."
    vide = UniversSonore.depuis_json(None)
    assert vide.vide and composer_texte("bruitage", "sa3-small-sfx", {"description": "Wooden door creaks open"}, vide) == r


def test_une_case_relachee_ne_part_pas():
    u = univers_medieval().regle({"champs": [{"nom": "epoque", "actif": False}]})
    r = composer_texte("bruitage", "sa3-small-sfx", {"description": "Coin pickup"}, u)
    assert "medieval" not in r["texte"] and "retro 16-bit game" in r["texte"]
    assert u.champ("epoque").texte == "medieval fantasy"  # relâchée, pas effacée


def test_description_francaise_part_telle_quelle_avec_l_indicateur():
    description = "Un pas de botte sur l'herbe sèche"
    r = composer_texte("bruitage", "sa3-small-sfx", {"description": description}, univers_medieval())
    assert r["morceaux"][1] == {"texte": description, "source": "description"}
    assert description in r["texte"]
    assert r["langue"]["non_anglais"] and r["langue"]["indices"]


@pytest.mark.parametrize("texte, attendu", [
    ("Single footstep on stone", False), ("Heavy club hitting a leather armor, dull thud", False),
    ("Porte qui grince", False),  # un seul mot-outil, sans accent : raté, et c'est documenté
    ("Épée qui frappe", True), ("Bruit d'eau", True), ("Un pas sur la pierre", True),
])
def test_heuristique_de_langue(texte, attendu):
    assert langue(texte)["non_anglais"] is attendu


def test_ambiance_et_open_1_avec_son_negatif():
    r = composer_texte("ambiance", "sa3-small-sfx", {"description": "Calm forest, distant birds"}, univers_medieval())
    assert r["texte"] == ("TrackType: SFX. Calm forest, distant birds, continuous, steady, field recording, "
                          "no music, stereo, medieval fantasy, warm, whimsical.")
    assert r["secondes"] == 30
    o = composer_texte("bruitage", "sa-open-1", {"description": "Door slam"}, None)
    assert o["texte"] == "Door slam, " + PRISE + "." and o["texte_negatif"] == NEGATIF_SAO


def test_musique_16_mesures_a_90_bpm_dure_17_mesures():
    assert duree_en_mesures(16, 90, 4) == 45.33  # 17 × 4 × 60 / 90 = 45,333…
    r = composer_texte("musique", "ace-step-15-turbo", {"description": "exploration", "mesures": 16, "tempo": 90,
                                                         "mesure": 4}, univers_medieval(tonalite="D minor"))
    assert r["secondes"] == 45.33 and r["mesures"]["total"] == 17
    assert r["texte"] == "exploration, acoustic folk ensemble: lute, fiddle, flute, warm, whimsical"
    p = r["parametres"]
    assert p["tempo"] == {"valeur": 90, "source": "demande"} and p["mesure"]["valeur"] == 4
    assert p["tonalite"] == {"valeur": "D minor", "source": "univers"}
    assert p["paroles"]["valeur"] == "[Intro]\n[Instrumental]\n[Outro]"


def test_jingle_se_cale_sur_le_tempo_et_la_tonalite_de_l_univers():
    r = composer_texte("jingle", "ace-step-15-turbo", {"description": "victory fanfare"},
                       univers_medieval(tonalite="C major", tempo=120))
    assert r["parametres"]["tempo"] == {"valeur": 120, "source": "univers"}
    assert r["parametres"]["tonalite"]["source"] == "univers"
    assert r["secondes"] == duree_en_mesures(2, 120) == 6.0


def test_chanson_yue2_style_et_paroles():
    r = composer_texte("chanson", "yue2-int8", {"description": "folk, warm male vocal", "paroles": "[Verse]\nHo"},
                       univers_medieval(tempo=100))
    assert r["texte"] == "English, folk, warm male vocal, acoustic folk ensemble: lute, fiddle, flute, 100 BPM"
    assert r["parametres"] == {"paroles": {"valeur": "[Verse]\nHo", "source": "demande"}}


def test_interface_par_sfxr_ne_compose_rien():
    r = composer_texte("interface", "sfxr", {"description": "click"}, univers_medieval())
    assert r["compose"] is False and "sfxr" in r["raison"]


def test_bloc_sonore_refuse_une_valeur_illisible():
    with pytest.raises(ValueError):
        UniversSonore.depuis_json(None).regle({"tonalite": "Do mineur"})
    with pytest.raises(ValueError):
        UniversSonore.depuis_json(None).regle({"moteurs": {"cuisine": "sa3-medium"}})


# ── L'univers : persistant, relu sans migration ─────────────────────────


def test_univers_d_avant_sn2_se_relit_vide_sans_migration():
    avant = Univers.depuis_json({"cible_px": 32, "bible": [{"nom": "monde", "texte": "Un marais"}]}).en_json()
    avant.pop("son")
    relu = Univers.depuis_json(json.loads(json.dumps(avant)))
    assert relu.son.vide and relu.son == UniversSonore.depuis_json(None)
    assert relu.champ("monde").texte == "Un marais"


async def test_bloc_sonore_se_pose_et_se_rouvre(tmp_path, double):
    atelier = Atelier(racine=tmp_path / "univers", fabrique_fournisseur=lambda: double)
    await atelier.ouvrir()
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, son={**MEDIEVAL, "tempo": 96, "tonalite": "G major",
                                                "moteurs": {"bruitage": "sa-open-1"}})
    # Un réglage partiel ne touche pas au reste.
    atelier.univers.regler_univers(projet, son={"champs": [{"nom": "humeur", "texte": "grim"}]})
    await fermer(atelier)
    autre = Atelier(racine=tmp_path / "univers", fabrique_fournisseur=lambda: double)
    await autre.ouvrir()
    s = autre.univers.univers(projet).son
    assert s.tempo == 96 and s.tonalite == "G major" and s.moteurs == {"bruitage": "sa-open-1"}
    assert s.texte("rendu") == "retro 16-bit game" and s.texte("humeur") == "grim"
    await fermer(autre)


# ── Le chemin entier : relecture, envoi, provenance ─────────────────────


async def installer_et_poser(atelier, **son):
    await atelier.installation_son.installer()
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, son={**MEDIEVAL, **son})
    return projet


async def test_la_route_de_relecture_montre_ce_que_l_envoi_fait_partir(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier)
    from atelier.api.app import creer_application
    corps = {"famille": "bruitage", "prompt": "Single footstep of a leather boot on dry grass"}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=creer_application(atelier)),
                                 base_url="http://atelier") as client:
        vu = await client.post(f"/api/projects/{projet}/audio-jobs/compose", json=corps)
        assert vu.status_code == 200, vu.text
        vu = vu.json()
        lu = (await client.get("/api/universe")).json()["univers"]["son"]
        assert lu["champs"][1] == {"nom": "rendu", "texte": "retro 16-bit game", "actif": True}
        assert (await client.get("/api/sound-templates")).json()["exemples"]["bruitage"]
    assert vu["texte"].startswith("TrackType: SFX. Single footstep") and "retro 16-bit game" in vu["texte"]
    assert vu["texte"].endswith(PRISE + ".") and vu["moteur"] == "sa3-small-sfx" and not comfy.envois
    t = await atelier.travaux_audio.preparer(projet, {"cle": "pas", **corps})
    assert t["composition"]["texte"] == vu["texte"] and t["composition"]["famille"] == "bruitage"
    assert t["snapshot_audio"]["prompt"] == vu["texte"] and t["snapshot_audio"]["secondes"] == 2
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini
    assert positif(comfy.envois[0]) == vu["texte"]
    provenance = atelier.sons.lire(projet, fini["son"])["provenance"]
    assert provenance["famille"] == "bruitage" and provenance["composition"]["texte"] == vu["texte"]
    assert [m["source"] for m in provenance["composition"]["morceaux"]] == [m["source"] for m in vu["morceaux"]]


async def test_texte_relu_part_tel_quel(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier)
    relu = "TrackType: SFX. A boot on grass, crunchy"
    t = await atelier.travaux_audio.preparer(projet, {"cle": "relu", "famille": "bruitage",
        "prompt": "Single footstep", "texte_relu": relu})
    c = t["composition"]
    assert c["relu"] is True and c["texte"] == relu and "retro 16-bit game" in c["texte_compose"]
    assert c["morceaux"] == [{"texte": relu, "source": "relu"}]
    await lancer(atelier, t)
    assert positif(comfy.envois[0]) == relu


async def test_description_francaise_part_telle_quelle_jusqu_au_graphe(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier)
    description = "Un pas de botte sur l'herbe sèche"
    vu = atelier.travaux_audio.ce_qui_partira(projet, {"famille": "bruitage", "prompt": description})
    assert vu["langue"]["non_anglais"] and description in vu["texte"]
    t = await atelier.travaux_audio.preparer(projet, {"cle": "fr", "famille": "bruitage", "prompt": description})
    await lancer(atelier, t)
    assert description in positif(comfy.envois[0])


async def test_moteur_de_l_univers_passe_devant_le_defaut(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier, moteurs={"bruitage": "sa-open-1"})
    vu = atelier.travaux_audio.ce_qui_partira(projet, {"famille": "bruitage", "prompt": "Door slam"})
    assert vu["moteur"] == "sa-open-1" and vu["source_moteur"] == "univers"
    assert vu["texte_negatif"] == NEGATIF_SAO and not vu["texte"].startswith("TrackType")
    t = await atelier.travaux_audio.preparer(projet, {"cle": "porte", "famille": "bruitage", "prompt": "Door slam"})
    assert t["demande"]["modele"].startswith("ComfyUI:sa-open-1@")
    assert t["snapshot_audio"]["prompt_negatif"] == NEGATIF_SAO


async def test_musique_part_avec_sa_duree_en_mesures(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier, tonalite="D minor", tempo=90)
    t = await atelier.travaux_audio.preparer(projet, {"cle": "exploration", "famille": "musique",
        "prompt": "exploration", "mesures": 16})
    envoi = t["snapshot_audio"]
    assert envoi["secondes"] == 45.33 and envoi["tempo"] == 90 and envoi["tonalite"] == "D minor"
    assert envoi["mesure"] == 4 and envoi["paroles"] == "[Intro]\n[Instrumental]\n[Outro]"
    await lancer(atelier, t)
    encodeur = comfy.envois[0]["prompt"]["5"]["inputs"]
    assert encodeur["duration"] == 45.33 and encodeur["bpm"] == 90 and encodeur["keyscale"] == "D minor"


async def test_un_reglage_de_musique_qui_ne_part_nulle_part_est_refuse(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier)
    with pytest.raises(TravailRefuse, match="tempo"):
        atelier.travaux_audio.ce_qui_partira(projet, {"famille": "bruitage", "prompt": "Door", "tempo": 90})


async def test_interface_par_sfxr_est_refusee_ici(son):  # noqa: F811
    atelier, comfy = son
    projet = await installer_et_poser(atelier)
    with pytest.raises(TravailRefuse, match="sfxr"):
        await atelier.travaux_audio.preparer(projet, {"cle": "clic", "famille": "interface", "prompt": "click"})


async def test_les_demandes_au14_gardent_leur_empreinte(son):  # noqa: F811
    """Une demande sans famille part comme avant : même texte, et la même
    empreinte qu'avant SN2 (calculée ici à la main, clé pour clé)."""
    from atelier.services.travaux import _hash, _json
    atelier, comfy = son
    installes = await atelier.installation_son.installer(identifiants=["sa3-small-sfx"])
    modele = installes["sa3-small-sfx"]["profil"]["modele"]
    brut = {"cle": "porte", "modele": modele, "prompt": "Wooden door creaks open", "secondes": 3}
    t = await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, brut)
    avant = {"cle": "porte", "modele": modele, "prompt": "Wooden door creaks open", "prompt_negatif": "",
             "secondes": 3, "options": {}, "nom": "", "livrer_provisoire": False}
    assert t["empreinte"] == _hash(_json({"demande": avant, "acteur": "auteur"}))
    assert "composition" not in t and t["snapshot_audio"]["prompt"] == "Wooden door creaks open"
