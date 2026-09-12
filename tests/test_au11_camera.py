"""Caméra de production et plage réelles, sans démarrer Blender."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import pytest
import httpx
from atelier.blender_rendu_asset3d import adapter_script, executer_commande, images_de_la_plage
from tests.test_pont_asset3d import moteur, demande  # noqa: F401
from fastapi.testclient import TestClient


def test_wrapper_transmet_camera_et_plage_au_script_sans_changer_le_cadre(tmp_path, monkeypatch):
    source = tmp_path / "natif"
    (source / "blender").mkdir(parents=True)
    script = source / "blender" / "rendu.py"
    script.write_text('''from serveur import modeles
import json
from pathlib import Path
deb, fin, NB_IMAGES = 1, 101, 3
images_a_rendre = [1, 40, 80]
images_mesurees = sorted(set(images_a_rendre) | set(range(deb, fin + 1)))
Path(__file__).with_suffix(".resultat.json").write_text(json.dumps({"camera": modeles.GEOMETRIE_ANGLE["face"], "images": images_a_rendre, "mesure": [min(images_mesurees),max(images_mesurees)]}))
''', encoding="utf-8")
    monkeypatch.setitem(sys.modules, "serveur", SimpleNamespace(modeles=SimpleNamespace(GEOMETRIE_ANGLE={"face": (0, 0)})))
    commande = tmp_path / "commande.json"
    commande.write_text(json.dumps({"reglages": {"angle": "face"}, "atelier": {"source_asset3d": str(source), "camera": {"azimut": 137, "elevation": 22}, "plage": {"debut": 20, "fin": 80}}}))
    original = script.read_bytes()
    executer_commande(commande)
    assert json.loads(script.with_suffix(".resultat.json").read_text()) == {"camera": [137, 22], "images": [21, 51, 81], "mesure": [1, 101]}
    assert script.read_bytes() == original
    assert images_de_la_plage(1, 101, 1, {"debut": 33, "fin": 33}) == [34]


def test_script_natif_est_reconnu_ou_refuse_explicitement():
    source = Path(__file__).resolve().parents[2] / "asset3d" / "blender" / "rendu.py"
    if source.is_file(): adapter_script(source.read_text(encoding="utf-8-sig"), str(source), True)
    with pytest.raises(ValueError, match="changé"):
        adapter_script("frames = []", "nouvelle-version.py", True)


def test_camera_et_plage_restent_sur_le_travail_et_le_cadre_ne_se_regle_pas_par_frame(moteur):
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        modele = client.post("/api/atelier/stages", json=demande()).json()
        client.post("/api/atelier/stages", json=demande(etape="rig", personnage=modele["personnage"], photo_base64=None))
        corps = demande(etape="rendu", personnage=modele["personnage"], photo_base64=None, camera={"azimut": 137, "elevation": 22}, plage={"debut": 20, "fin": 80})
        apercu = client.post("/api/atelier/stages/preview", json=corps).json()
        assert apercu["camera"] == corps["camera"] and apercu["plage"] == corps["plage"]
        assert apercu["sortie"]["cadre"] == "commun"
        recu = client.post("/api/atelier/stages", json=corps).json()
        garde = moteur.natif.depot.dossier_essai(recu["identifiant"]) / "rendu-atelier.json"
        assert json.loads(garde.read_text())["camera"] == corps["camera"]
        for changement in ({"camera": {"azimut": 900, "elevation": 0}}, {"plage": {"debut": 80, "fin": 20}}, {"plage": {"debut": 30, "fin": 30}}, {"reglages": {"cadre": "individuel"}}):
            assert client.post("/api/atelier/stages/preview", json={**corps, **changement}).status_code == 400
        assert client.post("/api/atelier/stages/preview", json={**corps, "plage": {"debut": 30, "fin": 30}, "reglages": {"nombre_images": 1}}).status_code == 200


def test_service_relecture_puis_reouverture_conserve_camera_plage_sans_lancer(client, atelier, moteur):
    app = moteur.application()
    with TestClient(app, base_url="http://localhost") as pont:
        modele = pont.post("/api/atelier/stages", json=demande()).json()
        pont.post("/api/atelier/stages", json=demande(etape="rig", personnage=modele["personnage"], photo_base64=None))
        atelier.sources_3d.configurer("http://127.0.0.1:8498")
        atelier.sources_3d.transport = httpx.ASGITransport(app=app)
        compte = len(moteur.appels)
        projet = atelier.bibliotheque.courant
        corps = {"cle": "rendu-camera", "etape": "rendu", "personnage_externe": modele["personnage"], "camera": {"azimut": 137, "elevation": 22}, "plage": {"debut": 20, "fin": 80}}
        r = client.post(f"/api/projects/{projet}/3d/jobs/prepare", json=corps)
        assert r.status_code == 200, r.text
        lu = client.get(f'/api/projects/{projet}/production-jobs/{r.json()["identifiant"]}').json()
        assert lu["apercu_3d"]["camera"] == corps["camera"]
        assert lu["apercu_3d"]["plage"] == corps["plage"]
        assert lu["demande"]["camera"] == corps["camera"]
        assert len(moteur.appels) == compte
