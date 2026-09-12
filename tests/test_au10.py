"""Étapes 3D indépendantes, moteur doublé, vrais fichiers et reprise."""
import asyncio
import json
from uuid import UUID

import httpx
import pytest

from atelier.services import Atelier
from tests.conftest import AnimateurMuet, image_sujet
from tests.test_au9 import glb


class PontDouble:
    def __init__(self):
        self.envois = []
        self.perdre = False
        self.termine = True

    def repondre(self, r):
        p = r.url.path
        if p.endswith("/contract"): return httpx.Response(200, json={"version": 1, "etapes": ["modele_3d", "rig", "rendu"]})
        if p.endswith("/occupation"): return httpx.Response(200, json={"etat": "disponible", "travaux": [], "temperature": "inconnue", "raison": "double"})
        if p.endswith("/preview"):
            d = json.loads(r.content)
            assert str(UUID(d["cle"])) == d["cle"]
            return httpx.Response(200, json={"reglages": {**d["reglages"], "moteur_3d": "trellis2", "animation": "marche.fbx"}, "etape": d["etape"], "prerequis": {"disponible": True, "raisons": []}})
        if p.endswith("/stages"):
            self.envois.append(json.loads(r.content))
            if self.perdre: raise httpx.ReadError("réponse perdue")
            return httpx.Response(200, json=self.etat())
        if "/by-key/" in p: return httpx.Response(200, json=self.etat()) if self.envois else httpx.Response(404)
        if p.endswith("modele.glb"): return httpx.Response(200, content=glb())
        if p.endswith("rig.glb"): return httpx.Response(404)
        if "/api/essais/" in p: return httpx.Response(200, json=self.etat())
        raise AssertionError(p)

    def etat(self):
        return {"identifiant": "essai_modele_1", "personnage": "modele_hero", "etat": "termine" if self.termine else "en_cours", "actif": not self.termine, "images": [], "etapes_terminees": ["modele_3d"], "reglages": {"moteur_3d": "trellis2"}}


@pytest.fixture
def scene3d(atelier, client, tmp_path):
    pont = PontDouble()
    atelier.sources_3d.transport = httpx.MockTransport(pont.repondre)
    atelier.sources_3d.configurer("http://127.0.0.1:8498")
    chemin = tmp_path / "personnage.png"; chemin.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(chemin)}).json()["asset"]["identifiant"]
    return pont, atelier.bibliotheque.courant, {"cle": "hero-modele", "etape": "modele_3d", "reference_asset": asset, "reglages": {"steps_forme": 7}}


def test_modele_seul_puis_reouverture_ne_refait_ni_modele_ni_suite(atelier, client, scene3d, double, tmp_path):
    pont, projet, demande = scene3d
    prefixe = f"/api/projects/{projet}"
    r = client.post(prefixe + "/3d/jobs/prepare", json=demande)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["etat"] == "prepare" and not pont.envois
    assert "envoi_3d" not in t  # la liste n’embarque pas le fichier base64
    assert t["apercu_3d"]["reglages"]["steps_forme"] == 7
    numero = t["identifiant"]
    assert client.post(prefixe + f"/production-jobs/{numero}/start").status_code == 200
    t = asyncio.run(atelier.travaux.attendre(projet, numero, 10))
    assert t["etat"] == "termine", t
    assert len(pont.envois) == 1 and pont.envois[0]["etape"] == "modele_3d"
    assert t["bandes"] == [] and t["fichiers_3d"]["modele.glb"]
    assert t["consommations"][0]["unite"] == "secondes"
    rouvert = Atelier(racine=tmp_path, fabrique_fournisseur=lambda: double, fabrique_animateur=AnimateurMuet)
    asyncio.run(rouvert.ouvrir())
    assert rouvert.travaux.lire(projet, numero)["fichiers_3d"] == t["fichiers_3d"]
    assert rouvert.travaux_3d.fichier(projet, numero, "modele.glb").read_bytes() == glb()
    assert asyncio.run(rouvert.travaux.demarrer(projet, numero, reprise=True))["etat"] == "termine"
    assert len(pont.envois) == 1


def test_contrat_http_reel_du_pont_depuis_le_service(atelier, client, scene3d, moteur):
    """La doublure HTTP permissive ne voyait pas une clé UUID mal sérialisée."""
    from fastapi.responses import Response
    _, projet, demande = scene3d
    app = moteur.application()
    @app.get("/api/essais/{identifiant}/modele.glb")
    def fichier(identifiant):
        assert identifiant in moteur.etats
        return Response(glb(), media_type="model/gltf-binary")
    atelier.sources_3d.transport = httpx.ASGITransport(app=app)
    # steps_forme=7 fait partie de la fixture native et passe par sa validation.
    t = client.post(f"/api/projects/{projet}/3d/jobs/prepare", json={**demande, "reglages": {}})
    assert t.status_code == 200, t.text
    numero = t.json()["identifiant"]
    client.post(f"/api/projects/{projet}/production-jobs/{numero}/start")
    t = asyncio.run(atelier.travaux.attendre(projet, numero, 10))
    assert t["etat"] == "termine", t
    assert len(moteur.appels) == 1
    assert atelier.travaux_3d.fichier(projet, numero, "modele.glb").read_bytes() == glb()
    client.post(f"/api/projects/{projet}/production-jobs/{numero}/resume")
    assert len(moteur.appels) == 1


# La fixture double seulement les ports lourds du voisin ; le pont est réel.
from tests.test_pont_asset3d import moteur  # noqa: E402,F401


def test_reponse_perdue_reconcilie_la_cle_sans_second_envoi(atelier, client, scene3d):
    pont, projet, demande = scene3d
    pont.perdre = True
    t = client.post(f"/api/projects/{projet}/3d/jobs/prepare", json=demande).json()
    numero = t["identifiant"]
    client.post(f"/api/projects/{projet}/production-jobs/{numero}/start")
    t = asyncio.run(atelier.travaux.attendre(projet, numero, 10))
    assert t["etat"] == "externe_inconnu", t
    r = client.post(f"/api/projects/{projet}/3d/jobs/{numero}/reconcile")
    assert r.status_code == 200 and r.json()["etat"] == "a_reprendre", r.text
    client.post(f"/api/projects/{projet}/production-jobs/{numero}/resume")
    t = asyncio.run(atelier.travaux.attendre(projet, numero, 10))
    assert t["etat"] == "termine", t
    assert len(pont.envois) == 1
