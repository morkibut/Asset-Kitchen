"""Le pont arrête chaque étape et retrouve les appels, sans aucun calcul IA."""
from dataclasses import asdict, dataclass
from enum import Enum
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from atelier.pont_asset3d import creer_application


class Etape(str, Enum):
    MODELE_3D = "modele_3d"
    RIG = "rig"
    RENDU = "rendu"


@dataclass
class Reglages:
    animation: str = "marche.fbx"
    nombre_images: int = 8
    angle: str = "face"
    moteur_3d: str = "local"

    def vers_json(self):
        return asdict(self)

    @staticmethod
    def depuis_formulaire(valeurs):
        return Reglages(**valeurs)


class Invalide(ValueError):
    pass


@pytest.fixture
def moteur(tmp_path):
    """Les deux ports natifs sont doublés ; les JSON du pont sont réels."""
    fichiers = tmp_path / "programmes"
    fichiers.mkdir()
    script = fichiers / "programme.py"
    script.write_text("# aucun programme ne sera lancé", encoding="utf-8")
    (fichiers / "marche.fbx").write_bytes(b"animation")
    config = SimpleNamespace(**{cle: script for cle in (
        "PYTHON_LABO", "SCRIPT_TRELLIS", "SCRIPT_DETOURAGE", "SCRIPT_RIG", "BLENDER_EXE", "SCRIPT_ATTACHE_ANIMATION", "SCRIPT_RENDU")}, DOSSIER_ANIMATIONS=fichiers)
    donnees = tmp_path / "pont"
    individus, etats, appels = {}, {}, []
    corrections = {"Spine": {"x": 7}}

    def creer_personnage(contenu=b"photo"):
        id = str(uuid4())
        dossier = donnees / "personnages" / id
        dossier.mkdir(parents=True)
        (dossier / "photo.png").write_bytes(contenu)
        fiche = SimpleNamespace(identifiant=id, photo="photo.png", chemin_photo=dossier / "photo.png", chemin_modele=dossier / "modele.glb", exiger_disponible=lambda: None)
        individus[id] = fiche
        return fiche

    def lire_personnage(id):
        if id not in individus:
            raise Invalide("Personnage inconnu")
        return individus[id]

    def chemin_rig(id, reglages):
        chemin = individus[id].chemin_photo.parent / f"rig-{reglages.animation}"
        return chemin if chemin.is_file() else None

    personnages = SimpleNamespace(lire=lire_personnage, PersonnageIndisponible=Invalide, PhotoInvalide=Invalide,
        apercu_du_rig=chemin_rig,
        verifier_la_photo=lambda nom, contenu: None,
        squelette=lambda id: next(iter(individus[id].chemin_photo.parent.glob("rig-*")), None),
        animation_resolue=lambda reglages: reglages.animation,
        lire_corrections=lambda id: corrections.copy(),
        fichiers_herites=lambda fiche, reg, etapes: {} if fiche is None else {
            **({Etape.MODELE_3D: fiche.chemin_modele} if Etape.MODELE_3D not in etapes else {}),
            **({Etape.RIG: chemin_rig(fiche.identifiant, reg)} if Etape.RIG not in etapes and chemin_rig(fiche.identifiant, reg) else {})},
        etapes_sur_la_carte=lambda fiche, etapes: tuple(e for e in etapes if e == Etape.MODELE_3D or (e == Etape.RIG and personnages.squelette(fiche.identifiant) is None)))

    class Essai:
        def __init__(self, reg, fiche, id=None):
            self.identifiant, self.personnage, self.reglages = id or str(uuid4()), fiche.identifiant, reg
            self.etapes_reutilisees, self.etapes_terminees, self.etat = [], [], "en_cours"

        def pour_page(self):
            return {"identifiant": self.identifiant, "personnage": self.personnage, "reglages": self.reglages.vers_json(), "etat": self.etat,
                    "etapes_reutilisees": [e.value for e in self.etapes_reutilisees], "etapes_terminees": [e.value for e in self.etapes_terminees]}

    def dossier_essai(id):
        return donnees / "essais" / id

    def ecrire(essai):
        dossier_essai(essai.identifiant).mkdir(parents=True, exist_ok=True)
        (dossier_essai(essai.identifiant) / "etat.json").write_text(json.dumps(essai.pour_page()), encoding="utf-8")

    def lire_essai(id):
        chemin = dossier_essai(id) / "etat.json"
        if not chemin.is_file():
            return None
        d = json.loads(chemin.read_text(encoding="utf-8"))
        essai = Essai(Reglages(**d["reglages"]), individus[d["personnage"]], id)
        essai.etat = d["etat"]
        essai.etapes_reutilisees = [Etape(e) for e in d["etapes_reutilisees"]]
        essai.etapes_terminees = [Etape(e) for e in d["etapes_terminees"]]
        return essai

    def creer(reglages, etapes, personnage=None, nom_depose="", contenu=b""):
        essai = Essai(reglages, personnage or creer_personnage(contenu))
        ecrire(essai)
        return essai

    class Executeur:
        def __init__(self):
            self.actif = None
            self.finir = True
            self.voie_carte = SimpleNamespace(nom="carte", occupee=lambda: self.actif is not None, occupant=lambda: self.actif)
            self.voie_rendu = SimpleNamespace(nom="rendu", occupee=lambda: False, occupant=lambda: None)

        def essai_en_memoire(self, id):
            return etats.get(id)

        def demarrer(self, fabrique, etapes, fichiers_herites, etapes_carte):
            essai = fabrique()
            # Ce test précède le « démarrage du fil », pas seulement la réponse.
            cles = [json.loads(p.read_text(encoding="utf-8")) for p in (donnees / "cles").glob("*.json")]
            assert any(c["identifiant"] == essai.identifiant for c in cles)
            appels.append((etapes, fichiers_herites, etapes_carte))
            etats[essai.identifiant] = essai
            self.actif = essai
            if self.finir:
                fiche = individus[essai.personnage]
                for etape in etapes:
                    if etape == Etape.MODELE_3D:
                        fiche.chemin_modele.write_bytes(b"modele")
                    elif etape == Etape.RIG:
                        (fiche.chemin_photo.parent / f"rig-{essai.reglages.animation}").write_bytes(b"rig")
                essai.etapes_terminees = list(etapes)
                essai.etat = "termine"
                self.actif = None
                ecrire(essai)
            return essai

    natif = SimpleNamespace(config=config, personnages=personnages,
        modeles=SimpleNamespace(Reglages=Reglages, ReglagesInvalides=Invalide, Etape=Etape),
        depot=SimpleNamespace(creer_essai=creer, dossier_essai=dossier_essai, ecrire_etat=ecrire, lire_essai=lire_essai),
        executeur=SimpleNamespace(VoieOccupee=Invalide))
    natif.main = SimpleNamespace(app=FastAPI(), executeur=Executeur(), ranger=lambda: None)

    def preparer():
        for chemin in (donnees / "essais").glob("*/etat.json"):
            essai = lire_essai(chemin.parent.name)
            if essai.etat == "en_cours":
                essai.etat = "echec"
                ecrire(essai)

    natif.main.preparer = preparer

    @natif.main.app.get("/api/reglages")
    def catalogue():
        return {"moteurs_3d": [{"valeur": "local"}]}

    @natif.main.app.get("/api/essais/{id}")
    def essai(id: str):
        return lire_essai(id).pour_page()

    @natif.main.app.post("/api/essais")
    def interdit():
        raise AssertionError("Le pipeline complet ne doit jamais être exposé")

    def application():
        return creer_application(tmp_path / "source", donnees, natif=natif)

    return SimpleNamespace(natif=natif, donnees=donnees, appels=appels, application=application, corrections=corrections, etats=etats, Executeur=Executeur)


def demande(**champs):
    return {"cle": str(uuid4()), "etape": "modele_3d", "photo_base64": "cGhvdG8=", "nom_photo": "reference.png", "reglages": {}, **champs}


def test_preview_ne_cree_rien_et_refuse_les_parametres_ignores(moteur):
    with TestClient(moteur.application(), base_url="http://127.0.0.1") as client:
        avant = set(moteur.donnees.rglob("*"))
        r = client.post("/api/atelier/stages/preview", json=demande())
        assert r.status_code == 200 and r.json()["prerequis"]["disponible"]
        assert r.json()["prerequis"]["poids_verifies"] is False
        assert r.json()["reglages"]["nombre_images"] == 8
        assert set(moteur.donnees.rglob("*")) == avant
        assert not moteur.appels
        assert client.post("/api/atelier/stages/preview", json=demande(reglages={"prompt_3d": "inconnu"})).status_code == 400
        assert client.get("/api/reglages").json()["moteurs_3d"]
        assert client.post("/api/essais", json={}).status_code == 404


def test_correction_relue_figee_et_apercu_du_rendu_independant_du_suivant(moteur):
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        modele = client.post("/api/atelier/stages", json=demande()).json()
        porteur = modele["personnage"]
        client.post("/api/atelier/stages", json=demande(etape="rig", personnage=porteur, photo_base64=None))
        corps = demande(etape="rendu", personnage=porteur, photo_base64=None)
        apercu = client.post("/api/atelier/stages/preview", json=corps).json()
        corps["empreinte_corrections"] = apercu["empreinte_corrections"]
        moteur.corrections["Spine"] = {"x": 50}
        compte = len(moteur.appels)
        refuse = client.post("/api/atelier/stages", json=corps)
        assert refuse.status_code == 409 and "changé" in refuse.json()["message"]
        assert len(moteur.appels) == compte
        assert client.get(f'/api/atelier/stages/by-key/{corps["cle"]}').status_code == 404
        corps["empreinte_corrections"] = client.post("/api/atelier/stages/preview", json=corps).json()["empreinte_corrections"]
        rendu = client.post("/api/atelier/stages", json=corps).json()
        dossier = moteur.natif.depot.dossier_essai(rendu["identifiant"])
        assert (dossier / "rig-atelier.glb").read_bytes() == b"rig"
        moteur.natif.personnages.apercu_du_rig(porteur, Reglages()).write_bytes(b"nouvel-apercu")
        moteur.corrections["Spine"] = {"x": 80}
        assert (dossier / "rig-atelier.glb").read_bytes() == b"rig"
        assert json.loads((dossier / "corrections-atelier.json").read_text())["Spine"] == {"x": 50}
        assert client.post("/api/atelier/stages", json=corps).json()["identifiant"] == rendu["identifiant"]


def test_corriger_ne_change_pas_un_personnage_utilise_par_un_calcul(moteur):
    appels = []
    async def poser(identifiant, request):
        appels.append(identifiant)
        return {"corrections": (await request.json())["corrections"]}
    moteur.natif.main.poser_les_corrections = poser
    moteur.natif.main.executeur.finir = False
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        modele = client.post("/api/atelier/stages", json=demande()).json()
        rep = client.put(f'/api/personnages/{modele["personnage"]}/corrections', json={"corrections": {}})
        assert rep.status_code == 409
        assert not appels
        moteur.natif.main.executeur.actif = None
        assert client.put(f'/api/personnages/{modele["personnage"]}/corrections', json={"corrections": {}}).status_code == 200
        assert appels == [modele["personnage"]]


def test_une_cle_retrouve_le_meme_appel_et_un_contenu_different_est_refuse(moteur):
    corps = demande()
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        premier = client.post("/api/atelier/stages", json=corps)
        assert premier.status_code == 200
        suite = client.post("/api/atelier/stages", json=corps).json()
        assert suite["identifiant"] == premier.json()["identifiant"]
        assert len(moteur.appels) == 1
        assert suite["etapes_terminees"] == ["modele_3d"]
        assert suite["etapes_reutilisees"] == []
        assert client.post("/api/atelier/stages", json={**corps, "nom_photo": "autre.png"}).status_code == 409
        assert client.get(f'/api/atelier/stages/by-key/{corps["cle"]}').json()["identifiant"] == suite["identifiant"]


def test_rig_et_rendu_sont_des_etapes_independantes_et_gardent_les_corrections(moteur):
    with TestClient(moteur.application(), base_url="http://127.0.0.1") as client:
        modele = client.post("/api/atelier/stages", json=demande()).json()
        cible = {"photo_base64": None, "personnage": modele["personnage"]}
        r = client.post("/api/atelier/stages/preview", json=demande(etape="rendu", **cible))
        assert not r.json()["prerequis"]["disponible"]
        assert client.post("/api/atelier/stages", json=demande(etape="rendu", **cible)).status_code == 409
        rig = client.post("/api/atelier/stages", json=demande(etape="rig", **cible)).json()
        assert rig["etapes_terminees"] == ["rig"]
        rendu = client.post("/api/atelier/stages", json=demande(etape="rendu", reglages={"nombre_images": 13}, **cible)).json()
        assert rendu["etapes_terminees"] == ["rendu"]
        assert rendu["etapes_reutilisees"] == ["modele_3d", "rig"]
        moteur.corrections.clear()
        copie = moteur.donnees / "essais" / rendu["identifiant"] / "corrections-atelier.json"
        assert json.loads(copie.read_text(encoding="utf-8")) == {"Spine": {"x": 7}}
        assert [a[0] for a in moteur.appels] == [(Etape.MODELE_3D,), (Etape.RIG,), (Etape.RENDU,)]


def test_apres_crash_la_cle_rend_un_echec_sans_relancer_le_calcul(moteur):
    moteur.natif.main.executeur.finir = False
    corps = demande()
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        premier = client.post("/api/atelier/stages", json=corps).json()
        assert client.get("/api/atelier/occupation").json()["etat"] == "occupe"
    moteur.etats.clear()
    moteur.natif.main.executeur = moteur.Executeur()
    with TestClient(moteur.application(), base_url="http://localhost") as client:
        retrouve = client.post("/api/atelier/stages", json=corps).json()
        assert retrouve["identifiant"] == premier["identifiant"]
        assert retrouve["etat"] == "echec"
        assert len(moteur.appels) == 1


def test_programme_absent_et_origine_distante_ne_lancent_rien(moteur):
    moteur.natif.config.SCRIPT_RIG = moteur.donnees / "absent.py"
    with TestClient(moteur.application(), base_url="http://127.0.0.1") as client:
        modele = client.post("/api/atelier/stages", json=demande()).json()
        corps = demande(etape="rig", personnage=modele["personnage"], photo_base64=None)
        assert not client.post("/api/atelier/stages/preview", json=corps).json()["prerequis"]["disponible"]
        assert client.post("/api/atelier/stages", json=corps).status_code == 409
        assert client.post("/api/atelier/stages", json=demande(), headers={"Origin": "https://exemple.com"}).status_code == 403
        assert len(moteur.appels) == 1


def test_executeur_natif_separe_sans_gpu_et_sans_ecriture_chez_le_voisin(tmp_path, monkeypatch):
    """Le vrai Executeur est utilisé, seule la brique de calcul est doublée."""
    import base64
    import io
    import os
    import threading
    from PIL import Image
    from atelier.pont_asset3d import charger_asset3d
    source = Path(__file__).resolve().parents[2] / "asset3d"
    if not (source / "serveur" / "main.py").is_file():
        pytest.skip("Le projet asset3d voisin n’est pas présent sur cette machine.")
    donnees = tmp_path / "natif"
    # Même garde que dans `tests/test_au10_environnement.py` : le voisin peut
    # être cloné à côté sans que son propre environnement soit installé ici.
    try:
        n = charger_asset3d(source, donnees)
    except ModuleNotFoundError as manque:
        pytest.skip(
            "Le voisin asset3d est présent, mais son environnement n’est pas"
            f" installé ici — il lui manque « {manque.name} »."
        )
    monkeypatch.setattr(n.main, "executeur", n.executeur.Executeur())
    programme = tmp_path / "programme.py"
    programme.write_text("# jamais exécuté", encoding="utf-8")
    for nom in ("PYTHON_LABO", "SCRIPT_TRELLIS", "SCRIPT_DETOURAGE"):
        monkeypatch.setattr(n.config, nom, programme)
    from serveur.etapes.contrat import ResultatEtape
    from serveur.etapes import rendu
    entre, termine = threading.Event(), threading.Event()
    appels = []

    def modele(contexte):
        cles = list((donnees / "cles").glob("*.json"))
        assert len(cles) == 1  # présent avant que la brique ne puisse calculer
        appels.append(contexte.essai.identifiant)
        entre.set()
        assert termine.wait(5)
        produit = contexte.dossier_sortie / "modele.glb"
        produit.write_bytes(b"modele-double")
        return ResultatEtape(fichier=produit)

    monkeypatch.setitem(n.executeur.REGISTRE, n.modeles.Etape.MODELE_3D, modele)
    image = io.BytesIO()
    Image.new("RGBA", (2, 2), (20, 30, 40, 255)).save(image, "PNG")
    corps = demande(photo_base64=base64.b64encode(image.getvalue()).decode())
    with TestClient(creer_application(source, donnees, natif=n), base_url="http://127.0.0.1") as client:
        premier = client.post("/api/atelier/stages", json=corps)
        assert premier.status_code == 200, premier.text
        assert entre.wait(2)
        assert client.get("/api/atelier/occupation").json()["etat"] == "occupe"
        assert client.post("/api/atelier/stages", json=corps).json()["identifiant"] == premier.json()["identifiant"]
        termine.set()
        n.main.executeur.attendre(5)
        recu = client.get(f'/api/atelier/stages/by-key/{corps["cle"]}').json()
        assert recu["etat"] == "termine", recu
        assert recu["etapes_terminees"] == ["modele_3d"]
        assert recu["etapes_reutilisees"] == []
        assert len(appels) == 1
        id = recu["identifiant"]
        assert client.get(f"/api/essais/{id}").json()["etat"] == "termine"
        assert client.get(f"/api/essais/{id}/modele.glb").content == b"modele-double"
        assert n.config.DOSSIER_PERSONNAGES.is_relative_to(donnees)
        assert n.config.DOSSIER_R2.is_relative_to(donnees)
        assert os.environ["HF_HUB_OFFLINE"] == "1"
        assert os.environ["TRANSFORMERS_OFFLINE"] == "1"
        # Une correction modifiée ensuite ne change pas le rendu historique.
        essai = n.depot.lire_essai(id)
        (n.depot.dossier_essai(id) / "corrections-atelier.json").write_text('{"Spine":{"x":7}}', encoding="utf-8")
        monkeypatch.setattr(n.personnages, "lire_corrections", lambda _id: {"Spine": {"x": 50}})
        assert rendu._corrections_du_personnage(SimpleNamespace(essai=essai)) == {"Spine": {"x": 7}}
        # Le lecteur natif ne doit plus rattacher le rig courant à un ancien
        # travail qui n’avait produit qu’un modèle.
        rig_tardif = tmp_path / "rig-apres-modele.glb"
        rig_tardif.write_bytes(b"rig-cree-plus-tard")
        monkeypatch.setattr(n.personnages, "apercu_du_rig", lambda *_: rig_tardif)
        assert client.get(f"/api/essais/{id}/rig.glb").status_code == 404
