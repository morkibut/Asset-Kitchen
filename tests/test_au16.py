"""AU16 : les calques demandés ne se confondent ni avec le corps ni avec ses variantes."""
from atelier.services.couverture_equipement import ServiceCouvertureEquipement
from tests.test_au15 import decor  # noqa: F401 — fixture stockage réel commune
from tests.test_b20 import _clip_ecrit, _poser_une_bande
import asyncio
from dataclasses import replace

import pytest

from atelier.domaine.recette import Recette, Main, Trait
from atelier.domaine.travail import TravailRefuse
from atelier.services.travaux_equipement import ServiceTravauxEquipement
from atelier.services import Atelier
from atelier.api.app import creer_application
from fastapi.testclient import TestClient
from tests.conftest import AnimateurMuet


def demande(corps, **options):
    return {"cle": "casque-repos", "modele": "essai:rend-du-png", "reservation_par_appel_usd": .12,
            "cibles": [{"nature": "image", "resultat": corps}], **options}


@pytest.mark.asyncio
async def test_envoi_reouvert_fige_textes_references_bases_et_parametres(decor, atelier, double, tmp_path):
    _, chemin, _, corps, source = decor
    svc = ServiceTravauxEquipement(atelier)
    d = demande(corps, prompt="Mon casque exact", prompt_negatif="sans cornes", repris=True,
                references=[source], options={"quality": "high"}, occupation=.63)
    t = await svc.preparer(*chemin, d)
    assert double.appels == 0
    assert t["annonce"]["images_ciblees"] == t["annonce"]["planches"] == t["annonce"]["appels"] == 1
    assert t["appels"][0]["snapshot"]["prompt"] == "Mon casque exact"
    assert t["catalogue"]["capacite_cases_max"] is None
    envoyee = svc.fichier(*chemin, t["identifiant"], "references", 0, 1)
    objet = atelier.assets.lire(source)
    objet.recette = Recette(main=Main(opacite=(Trait(garde=False, rayon=5, points=((30, 19),)),)))
    atelier.assets.sauver(objet)
    autre = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurMuet())
    with TestClient(creer_application(autre)):
        relu = ServiceTravauxEquipement(autre)
        reprise = await relu.preparer(*chemin, d)
        assert reprise["appels"] == t["appels"]
        assert reprise["cibles"] == t["cibles"]
        assert relu.fichier(*chemin, t["identifiant"], "references", 0, 1) == envoyee
        assert reprise["appels"][0]["pliage"]["occupation"] == .63
        double.repondre = lambda d: d.references[0]
        await autre.travaux.demarrer(chemin[0], t["identifiant"])
        await autre.travaux.attendre_tout()
        final = relu.lire(chemin[0], t["identifiant"])
        assert final["etat"] == "termine", final.get("raison", final["appels"])
        assert double.demandes[-1].references[1] == envoyee
        assert double.demandes[-1].options == {"quality": "high"}
        assert len(final["variantes"]) == 1
        assert autre.calques_cibles.lire(*chemin, final["variantes"][0])["etat"] == "a-extraire"
    assert double.appels == 1


@pytest.mark.asyncio
async def test_pliage_de_frames_plusieurs_appels_reprise_sans_achat_et_sans_ecrasement(decor, atelier, double):
    _, chemin, p, _, _ = decor
    _clip_ecrit(atelier)
    bande = _poser_une_bande(atelier, personnage=p, pose="repos")
    svc = ServiceTravauxEquipement(atelier)
    cibles = [c["cible"] for c in atelier.calques_cibles.cibles(*chemin)["cibles"] if c["cible"]["nature"] == "frame"]
    t = await svc.preparer(*chemin, demande("", cibles=cibles, cases_par_planche=2))
    assert t["annonce"]["images_ciblees"] == len(bande.prises)
    assert t["annonce"]["appels"] == (len(bande.prises) + 1) // 2
    double.repondre = lambda d: d.references[0]
    await atelier.travaux.demarrer(chemin[0], t["identifiant"])
    await atelier.travaux.attendre_tout()
    final = svc.lire(chemin[0], t["identifiant"])
    assert final["etat"] == "termine", final["appels"]
    assert len(final["variantes"]) == len(bande.prises)
    v = atelier.calques_cibles.lire(*chemin, final["variantes"][0])
    atelier.calques_cibles.regler(*chemin, v["identifiant"], 1, placement={"dx": 7})
    brut = svc._brut(chemin[0], t["identifiant"])
    # Coupure après écriture de la variante, avant le dernier avancement du travail.
    brut["etat"] = "a_verifier"
    brut["appels"][0]["etat"] = "a-verifier"
    brut["cibles"][0]["variante"] = None
    svc._garder(brut)
    avant = double.appels
    await atelier.travaux.demarrer(chemin[0], t["identifiant"], reprise=True)
    await atelier.travaux.attendre_tout()
    assert double.appels == avant
    assert atelier.calques_cibles.lire(*chemin, v["identifiant"])["placement"]["dx"] == 7
    assert len(svc.lire(chemin[0], t["identifiant"])["variantes"]) == len(bande.prises)


@pytest.mark.asyncio
async def test_base_changee_apres_relecture_ne_valide_pas_le_retour_sur_la_nouvelle_base(decor, atelier, double):
    _, chemin, _, corps, _ = decor
    svc = ServiceTravauxEquipement(atelier)
    t = await svc.preparer(*chemin, demande(corps))
    avant = t["cibles"][0]["base"]["empreinte"]
    a = atelier.assets.lire(corps)
    a.recette = Recette(main=Main(opacite=(Trait(garde=False, rayon=3, points=((20, 15),)),)))
    atelier.assets.sauver(a)
    double.repondre = lambda d: d.references[0]
    await atelier.travaux.demarrer(chemin[0], t["identifiant"])
    await atelier.travaux.attendre_tout()
    final = svc.lire(chemin[0], t["identifiant"])
    assert final["etat"] == "termine", final["appels"]
    v = atelier.calques_cibles.lire(*chemin, final["variantes"][0])
    assert v["base"]["empreinte"] == avant
    assert v["etat"] == "a-revoir"


@pytest.mark.asyncio
async def test_image_par_image_budget_commun_et_annulation_sans_depart(decor, atelier, double):
    _, chemin, _, corps, _ = decor
    svc = ServiceTravauxEquipement(atelier)
    atelier.travaux.regler_cadre(chemin[0], {"autoriser_payant": True, "plafond_appels": 1, "plafond_usd": .15})
    a = await svc.preparer(*chemin, demande(corps, methode="images"), "agent")
    b = await svc.preparer(*chemin, demande(corps, cle="deuxieme", methode="images"), "agent")
    assert a["annonce"]["appels"] == 1
    brut = svc._brut(chemin[0], a["identifiant"])
    atelier.travaux._autoriser(brut, reserver=True)
    svc._garder(brut)
    with pytest.raises(TravailRefuse, match="consommé ou réservé"):
        await atelier.travaux.demarrer(chemin[0], b["identifiant"], "agent")
    svc.annuler(*chemin, a["identifiant"], "agent")
    assert svc.lire(chemin[0], a["identifiant"])["etat"] == "annule"
    assert double.appels == 0
    double.repondre = lambda d: d.references[0]
    await atelier.travaux.demarrer(chemin[0], b["identifiant"], "agent")
    await atelier.travaux.attendre_tout()
    assert double.appels == 1
    relu = atelier.travaux.lire(chemin[0], b["identifiant"])
    assert len(relu["consommations"]) == 1


@pytest.mark.asyncio
async def test_acceptation_incertaine_ne_resoumet_jamais_la_planche(decor, atelier, double):
    _, chemin, _, corps, _ = decor
    svc = ServiceTravauxEquipement(atelier)
    t = await svc.preparer(*chemin, demande(corps))
    brut = svc._brut(chemin[0], t["identifiant"])
    brut["appels"][0]["soumis"] = True
    brut["appels_engages"] = 1
    brut["etat"] = "a_verifier"
    svc._garder(brut)
    await atelier.travaux.demarrer(chemin[0], t["identifiant"], reprise=True)
    await atelier.travaux.attendre_tout()
    assert svc.lire(chemin[0], t["identifiant"])["etat"] == "externe_inconnu"
    with pytest.raises(TravailRefuse, match="inconnue"):
        await atelier.travaux.demarrer(chemin[0], t["identifiant"], reprise=True)
    assert double.appels == 0


def objectif(atelier, projet, personnage, sorties):
    atelier.production.definir_objectif(projet, personnage, {"sorties": sorties,
        "largeur": 64, "hauteur": 64, "cadence": 11, "boucle": False, "repere": {"x": 30, "y": 60}})


def test_animation_absente_n_invente_aucune_frame_et_les_fixes_ne_la_remplissent_pas(decor, atelier):
    _, chemin, p, _, _ = decor
    objectif(atelier, chemin[0], p, [{"nature": "animation", "pose": "repos", "direction": "", "quantite": 1}])
    vue = ServiceCouvertureEquipement(atelier).lire(*chemin)
    assert vue["animations"]["bases_attendues"] == 1
    assert vue["animations"]["bases_absentes"] == 1
    assert vue["animations"]["images_connues"] == 0
    assert vue["animations"]["absente"] == 0
    assert vue["images"]["bases_attendues"] == 0
    assert not vue["prete"]


def test_seule_la_version_choisie_compte_et_les_autres_restent_ouvrables(decor, atelier):
    _, chemin, p, _, _ = decor
    objectif(atelier, chemin[0], p, [{"nature": "animation", "pose": "repos", "direction": "", "quantite": 1}])
    _clip_ecrit(atelier)
    a = _poser_une_bande(atelier, personnage=p, pose="repos")
    b = _poser_une_bande(atelier, personnage=p, pose="repos")
    service = ServiceCouvertureEquipement(atelier)
    sans_choix = service.lire(*chemin)
    assert sans_choix["animations"]["bases_a_choisir"] == 1
    assert sans_choix["animations"]["images_connues"] == 0
    atelier.montage.marquer_favori([a.identifiant], True)
    vue = service.lire(*chemin)
    assert vue["animations"]["images_connues"] == len(a.prises)
    assert vue["animations"]["absente"] == len(a.prises)
    case = next(c for c in vue["cases"] if c["demandee"])
    assert len(case["versions"]) == 2
    assert [v["resultat"] for v in case["versions"] if v["choisie"]] == [a.identifiant]
    autre = service.lire(*chemin, resultats=[b.identifiant])
    case = next(c for c in autre["cases"] if c["demandee"])
    assert [v["resultat"] for v in case["versions"] if v["choisie"]] == [b.identifiant]


def test_source_equipee_puis_calque_corrige_et_retenu_changent_le_bon_etat(decor, atelier):
    calques, chemin, p, corps, source = decor
    objectif(atelier, chemin[0], p, [{"nature": "image", "pose": "repos", "direction": "", "quantite": 1}])
    atelier.bibliotheque.marquer_favori([corps], True)
    service = ServiceCouvertureEquipement(atelier)
    reference = calques.creer(*chemin, {"nature": "image", "resultat": corps}, source, "reference")
    assert service.lire(*chemin)["images"]["absente"] == 1
    v = calques.creer(*chemin, {"nature": "image", "resultat": corps}, source, "source-equipee")
    assert service.lire(*chemin)["images"]["a-extraire"] == 1
    c = calques.extraire(*chemin, v["identifiant"])
    assert service.lire(*chemin)["images"]["a-verifier"] == 1
    calques.valider(*chemin, c["identifiant"], 1)
    assert service.lire(*chemin)["prete"]
    calques.regler(*chemin, c["identifiant"], 1, placement={"dx": 4})
    assert service.lire(*chemin)["images"]["a-verifier"] == 1
    assert not service.lire(*chemin)["prete"]
    assert calques.lire(*chemin, reference["identifiant"])["role"] == "reference"
