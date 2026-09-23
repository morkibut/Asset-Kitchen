"""RV5, étapes 1 à 3 : le texte composé par le serveur, la durée réelle, la série.

Une fabrication suivie qui nomme un **mouvement** voit son texte composé par le
même chemin que la route qui le montre (`services/texte_clip.composer`), écrit
dans la demande conservée avant l'empreinte (E14). Un geste de la fenêtre
« Animer » prépare une **série** : un travail par clip, clés déterministes,
lancée tout ou rien pour l'agent. Fournisseurs doublés : aucun essai ne coûte.
"""

from dataclasses import replace

import pytest

from atelier.domaine.animation import ModeleVideo, Tarification
from atelier.domaine.style import LIVRES as STYLES_LIVRES
from atelier.domaine.travail import TravailRefuse, demande_normalisee, pour_l_empreinte
from atelier.services.animation import _modele_en_json
from atelier.services.texte_clip import composer, phrase_de_direction
from tests.conftest import image_sujet
from tests.test_a9 import MELE
from tests.test_au3 import production  # noqa: F401

_BATON = next(s for s in STYLES_LIVRES if s.identifiant == "baton")


def _deux_directions(atelier, projet):
    directions = [d.identifiant for d in atelier.production.directions_du_jeu(projet)]
    assert len(directions) >= 2, directions
    return directions[:2]


def _sujet(atelier, projet, pose, directions, nom="La gardienne"):
    return atelier.production.creer_personnage(projet, nom, "Une gardienne en armure", objectif={
        "sorties": [{"nature": "animation", "pose": pose, "direction": d} for d in directions],
        "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": True, "repere": {"x": 32, "y": 64},
    }).identifiant


def _reference(atelier, projet):
    return atelier.generations.importer(image_sujet(), "référence", projet=projet)["asset"]["identifiant"]


def _commune(demande, personnage, reference=None, **plus):
    commune = {k: v for k, v in demande.items() if k not in ("pose", "direction", "prompt_video",
                                                              "modele_image", "plafond_image_usd")}
    commune.update(personnage=personnage, mouvement="attaque", **plus)
    if reference:
        commune["reference_asset"] = reference
    return commune


# ── Étape 1 : un seul compositeur ────────────────────────────────────────────


async def test_le_compositeur_du_service_est_celui_de_la_route(production):
    atelier, projet, _, _ = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    atelier.styles.choisir_pour_le_personnage(projet, gardienne, "baton")
    recu = composer(atelier, projet, gardienne, ouest, "attaque", style="baton")
    phrase = phrase_de_direction(atelier, projet, ouest)
    assert phrase, "la vue du jeu d'essai donne une phrase à l'ouest"
    assert recu["texte"] == f"{phrase} {_BATON.texte('attaque')}"
    assert recu["origine"] == "mouvement" and recu["style"]["identifiant"] == "baton"
    corrige = composer(atelier, projet, gardienne, ouest, "attaque", correction="  swing the staff low  ", style="baton")
    assert corrige["texte"] == f"{phrase} swing the staff low" and corrige["geste"] == "swing the staff low"


# ── Étape 2 : le texte qui part, la durée réelle ─────────────────────────────


async def test_le_mouvement_compose_le_texte_qui_part_avec_style_et_direction(production):
    atelier, projet, demande, animateur = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    atelier.styles.choisir_pour_le_personnage(projet, gardienne, "baton")
    travail = await atelier.travaux.preparer(projet, {**_commune(demande, gardienne, _reference(atelier, projet),
                                                                 style_combat="baton"),
                                                      "pose": "attaque", "direction": ouest})
    attendu = f"{phrase_de_direction(atelier, projet, ouest)} {_BATON.texte('attaque')}"
    # **E14** : la relecture montre ce champ, et c'est celui qui part.
    assert travail["demande"]["prompt_video"] == attendu
    await atelier.travaux.demarrer(projet, travail["identifiant"])
    await atelier.travaux.attendre_tout()
    fini = atelier.travaux.lire(projet, travail["identifiant"])
    assert fini["etat"] == "termine", fini
    assert animateur.soumissions[0][1].texte == attendu
    clip = atelier.animation.lire(fini["clip"])
    assert clip.demande["mouvement"] == "attaque", "le mouvement part avec le clip"
    assert clip.clip.lot == travail["identifiant"], "seul, le lot reste l'identifiant du travail"


async def test_la_correction_porte_sur_le_geste_et_la_direction_reste_en_tete(production):
    atelier, projet, demande, _ = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    avant = atelier.mouvements.lire("attaque", projet).texte
    travail = await atelier.travaux.preparer(projet, {**_commune(demande, gardienne, _reference(atelier, projet),
        correction_geste="a slow overhead swing"), "pose": "attaque", "direction": ouest})
    assert travail["demande"]["prompt_video"] == f"{phrase_de_direction(atelier, projet, ouest)} a slow overhead swing"
    assert atelier.mouvements.lire("attaque", projet).texte == avant, "garder la correction est un second geste"


async def test_les_refus_du_texte(production):
    atelier, projet, demande, _ = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    reference = _reference(atelier, projet)
    base = {**_commune(demande, gardienne, reference), "pose": "attaque", "direction": ouest}
    with pytest.raises(TravailRefuse, match="Aucun mouvement"):
        await atelier.travaux.preparer(projet, {**base, "mouvement": "inconnu"})
    with pytest.raises(TravailRefuse, match="correction_geste"):
        await atelier.travaux.preparer(projet, {**base, "prompt_video": "my own words"})
    with pytest.raises(TravailRefuse, match="corrige un mouvement"):
        await atelier.travaux.preparer(projet, {**demande, "correction_geste": "swing"})
    # Une demande relue puis renvoyée telle quelle se relit.
    premier = await atelier.travaux.preparer(projet, base)
    relu = await atelier.travaux.preparer(projet, {**base, "prompt_video": premier["demande"]["prompt_video"]})
    assert relu["identifiant"] == premier["identifiant"]


def test_les_secondes_sont_un_reel_de_0_a_60():
    brute = {"cle": "k", "personnage": "p", "pose": "marche", "direction": "", "modele_video": "m", "prompt_video": "t"}
    assert demande_normalisee({**brute, "secondes": 1.5})["secondes"] == 1.5
    assert demande_normalisee({**brute, "secondes": 60})["secondes"] == 60
    for mauvaise in (0, -1, 60.5, True, "2", float("nan")):
        with pytest.raises(TravailRefuse, match="secondes"):
            demande_normalisee({**brute, "secondes": mauvaise})


def test_une_demande_d_avant_rv5_garde_son_empreinte():
    brute = {"cle": "k", "personnage": "p", "pose": "marche", "direction": "", "modele_video": "m", "prompt_video": "t"}
    assert set(pour_l_empreinte(demande_normalisee(brute))) == set(demande_normalisee(brute)) - {"mouvement", "correction_geste", "style_combat"}


def test_la_duree_par_defaut_est_toujours_acceptee():
    maison = ModeleVideo("m:maison", "Maison", durees=(1, 1.5, 2, 3), duree_conseillee=1)
    assert maison.duree_par_defaut == 1
    assert ModeleVideo("m:a", "A", durees=(1, 1.5, 2)).duree_par_defaut == 1.5
    assert ModeleVideo("m:b", "B", durees=(4, 5, 6)).duree_par_defaut == 4
    assert ModeleVideo("m:c", "C").duree_par_defaut == 1.5
    assert _modele_en_json(maison)["duree_par_defaut"] == 1
    assert _modele_en_json(MELE)["duree_par_defaut"] in MELE.durees


# ── Étape 3 : la série ───────────────────────────────────────────────────────


async def test_une_case_et_un_clip_c_est_exactement_preparer(production):
    atelier, projet, demande, _ = production
    serie = await atelier.travaux.preparer_serie(projet, {k: v for k, v in demande.items() if k not in ("pose", "direction")},
                                                 [{"pose": demande["pose"], "direction": demande["direction"]}], 1)
    [travail] = serie["travaux"]
    seul = await atelier.travaux.preparer(projet, demande)
    assert travail == seul and "serie" not in travail
    assert serie["serie"]["identifiant"] == travail["identifiant"] and serie["serie"]["total"] == 1
    assert serie["annonce_serie"]["reservation_usd"] == travail["annonce"]["reservation_usd"]
    assert serie["annonce_serie"]["appels"] == travail["annonce"]["appels"] == 2


async def test_deux_directions_deux_clips_quatre_travaux_idempotents(production):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="geste-1")
    cases = [{"pose": "attaque", "direction": ouest}, {"pose": "attaque", "direction": est}]
    serie = await atelier.travaux.preparer_serie(projet, commune, cases, 2)
    travaux = serie["travaux"]
    assert [t["cle"] for t in travaux] == [f"geste-1:{ouest}:0", f"geste-1:{ouest}:1", f"geste-1:{est}:0", f"geste-1:{est}:1"]
    assert [t["serie"] for t in travaux] == [{"cle": "geste-1", "rang": r, "total": 4} for r in range(4)]
    # Chaque case a sa phrase ; les deux clips d'une case ont le même texte.
    textes = [t["demande"]["prompt_video"] for t in travaux]
    assert textes[0] == textes[1] != textes[2] == textes[3]
    assert textes[2].startswith(phrase_de_direction(atelier, projet, est))
    annonce = serie["annonce_serie"]
    assert annonce["appels"] == 4 and not annonce["locale"]
    assert annonce["reservation_usd"] == pytest.approx(sum(t["annonce"]["reservation_usd"] for t in travaux))
    # Répétée, la série se relit ; changée sous la même clé, elle se refuse.
    relue = await atelier.travaux.preparer_serie(projet, commune, cases, 2)
    assert [t["identifiant"] for t in relue["travaux"]] == [t["identifiant"] for t in travaux]
    with pytest.raises(TravailRefuse, match="autre série"):
        await atelier.travaux.preparer_serie(projet, commune, cases, 1)
    assert len(atelier.travaux.lister(projet)) == 4
    assert not animateur.soumissions


async def test_plusieurs_clips_sans_image_de_depart_se_refusent(production, double):
    atelier, projet, demande, animateur = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    commune = {**_commune(demande, gardienne), "modele_image": demande["modele_image"], "plafond_image_usd": 0.1}
    with pytest.raises(TravailRefuse, match="image de départ"):
        await atelier.travaux.preparer_serie(projet, commune, [{"pose": "attaque", "direction": ouest}], 2)
    assert atelier.travaux.lister(projet) == [] and double.appels == 0
    # Un seul clip, la référence se fabrique une fois : permis.
    seul = await atelier.travaux.preparer_serie(projet, commune, [{"pose": "attaque", "direction": ouest}], 1)
    assert seul["travaux"][0]["generation_image"]


async def test_la_livraison_provisoire_d_une_serie_se_refuse(production):
    atelier, projet, demande, _ = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), livrer_provisoire=True)
    with pytest.raises(TravailRefuse, match="livraison provisoire"):
        await atelier.travaux.preparer_serie(projet, commune, [{"pose": "attaque", "direction": ouest},
                                                               {"pose": "attaque", "direction": est}], 1)
    assert atelier.travaux.lister(projet) == []


async def test_pour_l_agent_la_serie_part_tout_ou_rien(production, double):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="agent-1")
    cases = [{"pose": "attaque", "direction": ouest}, {"pose": "attaque", "direction": est}]
    serie = await atelier.travaux.preparer_serie(projet, commune, cases, 2, "agent")
    prix = serie["travaux"][0]["annonce"]["reservation_usd"]
    assert prix > 0
    # De quoi payer trois clips, pas quatre : rien ne part.
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 20, "plafond_usd": 3.5 * prix})
    with pytest.raises(TravailRefuse, match="budget"):
        await atelier.travaux.demarrer_serie(projet, "agent-1", "agent")
    for travail in atelier.travaux.lister(projet):
        brut = atelier.travaux._brut(projet, travail["identifiant"])
        assert brut["etat"] == "prepare" and not brut["demarrage_recu"] and brut["reserve"] is None, brut
    # Trois appels permis, quatre demandés : rien ne part non plus.
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 3, "plafond_usd": 10 * prix})
    with pytest.raises(TravailRefuse, match="appels"):
        await atelier.travaux.demarrer_serie(projet, "agent-1", "agent")
    assert not animateur.soumissions
    # Le cadre relevé : les quatre partent, d'un geste.
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 4, "plafond_usd": 4.5 * prix})
    lancee = await atelier.travaux.demarrer_serie(projet, "agent-1", "agent")
    assert all(t["etat"] == "en_cours" for t in lancee["travaux"])
    await atelier.travaux.attendre_tout()
    finis = [atelier.travaux.lire(projet, t["identifiant"]) for t in serie["travaux"]]
    assert all(f["etat"] == "termine" for f in finis), finis
    assert len(animateur.soumissions) == 4
    lots = {atelier.animation.lire(f["clip"]).clip.lot for f in finis}
    assert lots == {serie["serie"]["identifiant"]}, "le lot des clips est la série"
    # Relancer la série ne relance rien.
    await atelier.travaux.demarrer_serie(projet, "agent-1", "agent")
    await atelier.travaux.attendre_tout()
    assert len(animateur.soumissions) == 4


async def test_pour_l_auteur_le_cadre_de_l_agent_ne_bride_pas_la_serie(production):
    atelier, projet, demande, animateur = production
    ouest, est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest, est])
    atelier.travaux.regler_cadre(projet, {"autoriser_payant": False, "plafond_appels": 0, "plafond_usd": 0})
    await atelier.travaux.preparer_serie(projet, _commune(demande, gardienne, _reference(atelier, projet), cle="auteur-1"),
                                         [{"pose": "attaque", "direction": ouest}, {"pose": "attaque", "direction": est}], 1)
    await atelier.travaux.demarrer_serie(projet, "auteur-1")
    await atelier.travaux.attendre_tout()
    assert len(animateur.soumissions) == 2


async def test_une_serie_locale_de_l_agent_retrouve_son_travail_par_le_clip(production):
    """Le lot des clips est la série : le cadre relu au tour de la carte
    graphique retrouve le travail par l'identifiant du clip, pas par le lot."""
    atelier, projet, demande, animateur = production
    ouest, _est = _deux_directions(atelier, projet)
    gardienne = _sujet(atelier, projet, "attaque", [ouest])
    local = replace(MELE, identifiant="essai:local", tarification=Tarification("maison", 0))
    animateur.modeles = [local]
    animateur.facture = 0
    await atelier.animation.rafraichir()
    commune = _commune(demande, gardienne, _reference(atelier, projet), cle="local-1", modele_video=local.identifiant)
    serie = await atelier.travaux.preparer_serie(projet, commune, [{"pose": "attaque", "direction": ouest}], 2, "agent")
    assert serie["annonce_serie"]["locale"] and serie["annonce_serie"]["reservation_usd"] == 0
    relus = []
    autoriser = atelier.animation.avant_soumission_locale

    def espion(generation):
        relus.append(generation.clip.lot)
        autoriser(generation)

    atelier.animation.avant_soumission_locale = espion
    await atelier.travaux.demarrer_serie(projet, "local-1", "agent")
    await atelier.travaux.attendre_tout()
    finis = [atelier.travaux.lire(projet, t["identifiant"]) for t in serie["travaux"]]
    assert all(f["etat"] == "termine" for f in finis), finis
    assert len(animateur.soumissions) == 2
    assert relus == [serie["serie"]["identifiant"]] * 2, "le cadre a été relu, par le clip et non par le lot"
