"""Un clip source libre, sans personnage artificiel et sans dépense réelle."""
import httpx
import pytest

from atelier.api.app import creer_application
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from tests.conftest import image_sujet
from tests.test_a9 import AnimateurDouble, MELE, clip_mp4


@pytest.fixture
async def source(tmp_path, double):
    animateur = AnimateurDouble()
    animateur.octets = clip_mp4()
    double.rendre = image_sujet
    a = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: animateur)
    await a.ouvrir()
    yield a, animateur
    await a.travaux.attendre_tout()
    await a.file_locale.fermer()


async def test_video_libre_reference_importee_arrive_en_galerie_sans_personnage(source):
    a, animateur = source
    projet = a.bibliotheque.courant
    reference = a.generations.importer(image_sujet(), "Référence libre", projet=projet)["asset"]["identifiant"]
    d = {"cle": "clip-libre", "reference_asset": reference, "modele_video": MELE.identifiant, "prompt_video": "Une forêt se balance dans le vent", "options_video": {"seed": 73}}
    t = await a.travaux.preparer(projet, d, source_libre=True)
    assert t["nature"] == "video-libre" and t["objectif"] is None
    assert not animateur.soumissions
    await a.travaux.demarrer(projet, t["identifiant"])
    await a.travaux.attendre_tout()
    fini = a.travaux.lire(projet, t["identifiant"])
    assert fini["etat"] == "termine" and fini["etape"] == "clip" and fini["bandes"] == []
    clip = a.animation.lire(fini["clip"])
    assert clip.personnage is None and clip.pose is None and clip.clip.images == 6
    assert not a.production.personnages(projet)
    await a.travaux.preparer(projet, d, source_libre=True)
    await a.travaux.demarrer(projet, t["identifiant"], reprise=True)
    assert len(animateur.soumissions) == 1


async def test_video_libre_peut_fabriquer_sa_reference_et_observe_budget_agent(source, double):
    a, animateur = source
    projet = a.bibliotheque.courant
    d = {"cle": "clip-avec-reference", "modele_video": MELE.identifiant, "prompt_video": "Le feuillage s’anime", "modele_image": "essai:rend-du-png", "prompt_image": "Une forêt", "plafond_image_usd": 0.1}
    t = await a.travaux.preparer(projet, d, "agent", source_libre=True)
    with pytest.raises(TravailRefuse):
        await a.travaux.demarrer(projet, t["identifiant"], "agent")
    a.travaux.regler_cadre(projet, {"autoriser_payant": True, "plafond_appels": 2, "plafond_usd": 10})
    await a.travaux.demarrer(projet, t["identifiant"], "agent")
    await a.travaux.attendre_tout()
    fini = a.travaux.lire(projet, t["identifiant"])
    assert fini["etat"] == "termine", fini
    assert fini["reference_asset"] and fini["clip"] and double.appels == len(animateur.soumissions) == 1
    assert not a.production.personnages(projet)


async def test_video_libre_refuse_absence_reference_et_livraison_directe(source):
    a, animateur = source
    p = a.bibliotheque.courant
    d = {"cle": "vide", "modele_video": MELE.identifiant, "prompt_video": "Un mouvement"}
    with pytest.raises(TravailRefuse, match="image de départ"):
        await a.travaux.preparer(p, d, source_libre=True)
    with pytest.raises(TravailRefuse, match="montée et classée"):
        await a.travaux.preparer(p, {**d, "livrer_provisoire": True}, source_libre=True)
    assert not animateur.soumissions


async def test_http_prepare_clip_libre_meme_registre(source):
    a, _ = source
    p = a.bibliotheque.courant
    reference = a.generations.importer(image_sujet(), "Référence", projet=p)["asset"]["identifiant"]
    app = creer_application(a)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://127.0.0.1:8420") as client:
            r = await client.post(f"/api/projects/{p}/free-video-jobs/prepare", json={"cle": "http", "modele_video": MELE.identifiant, "reference_asset": reference, "prompt_video": "Nuages en mouvement"})
            assert r.status_code == 200, r.text
            t = r.json()
            relu = await client.get(f"/api/projects/{p}/production-jobs/{t['identifiant']}")
            assert relu.json()["nature"] == "video-libre"
            assert "prepare_free_video" in [outil.name for outil in await app.state.mcp.list_tools()]
