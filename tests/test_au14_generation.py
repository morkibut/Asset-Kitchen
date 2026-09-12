"""Le calcul sonore est doublé ; ses octets, sa reprise et son montage sont réels."""
import httpx
import numpy as np
import pytest

from atelier.audio.traitement import encoder
from atelier.domaine.travail import TravailRefuse
from atelier.services import Atelier
from tests.test_au7_au8 import ComfyDouble, profil, raccorder
from tests.test_au14_sons import signal


def profil_son():
    p = profil()
    p.update(identifiant="bruitage", nom="Bruitages", nature="audio", formats=[], durees=[1, 2.5], cadence=0,
             sortie={"noeud": "5", "champ": "audio"})
    p["graphe"]["2"]["inputs"] = {"seconds": 1}
    p["graphe"]["5"]["class_type"] = "SaveAudio"
    p["liaisons"].pop("largeur"); p["liaisons"].pop("hauteur")
    p["liaisons"]["secondes"] = [{"noeud": "2", "champ": "seconds"}]
    return p


class ComfySon(ComfyDouble):
    def __init__(self):
        super().__init__()
        self.audio = signal()

    def repondre(self, requete):
        if requete.url.path.startswith("/history/") and self.termine:
            numero = requete.url.path.split("/")[-1]
            if numero in self.jobs:
                self.requetes.append((requete.method, requete.url.path))
                return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                    "5": {"audio": [{"filename": "bruitage.wav", "subfolder": "sons", "type": "output"}]}}}})
        if requete.url.path == "/view":
            self.requetes.append((requete.method, requete.url.path))
            return httpx.Response(200, content=self.audio, headers={"content-type": "audio/wav"})
        return super().repondre(requete)


async def fermer(atelier):
    await atelier.file_locale.fermer()
    for t in atelier.travaux._taches.values():
        if not t.done(): t.cancel()
    await atelier.travaux.attendre_tout()


@pytest.fixture
async def sonore(tmp_path, double):
    comfy = ComfySon()
    atelier = Atelier(racine=tmp_path / "sons", fabrique_fournisseur=lambda: double)
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    p = profil_son(); comfy.declarer(p)
    garde = atelier.profils_workflow.importer(p)
    atelier.travaux_audio.intervalle = .01
    yield atelier, comfy, garde
    await fermer(atelier)


async def preparer(atelier, p, cle="son", acteur="auteur"):
    return await atelier.travaux_audio.preparer(atelier.bibliotheque.courant, {
        "cle": cle, "modele": p["modele"], "nom": "Épée divine", "prompt": "Une lame quitte le cuir.",
        "secondes": 2.5, "options": {"seed": 357}}, acteur)


async def lancer(atelier, t, reprise=False):
    await atelier.travaux.demarrer(t["projet"], t["identifiant"], t["acteur"], reprise=reprise)
    await atelier.travaux.attendre_tout()
    return atelier.travaux.lire(t["projet"], t["identifiant"])


async def test_son_fige_envoi_et_version_se_reouvre_sans_nouvelle_generation(sonore, double):
    atelier, comfy, p = sonore
    t = await preparer(atelier, p)
    assert not comfy.envois and t["snapshot_audio"]["options"] == {"seed": 357}
    nouveau = profil_son(); nouveau["parametres"]["seed"]["defaut"] = 900
    atelier.profils_workflow.importer(nouveau)
    fini = await lancer(atelier, t)
    assert fini["etat"] == "termine", fini
    assert len(comfy.envois) == 1 and not comfy.fichiers
    envoye = comfy.envois[0]
    assert envoye["prompt"]["3"]["inputs"]["seed"] == 357
    assert envoye["prompt"]["2"]["inputs"]["seconds"] == 2.5
    assert envoye["extra_data"]["asset_kitchen"]["version"] == p["version"]
    assert fini["consommations"][0]["unite"] == "secondes" and fini["consommations"][0]["cout_usd"] == 0
    son = atelier.sons.lire(t["projet"], fini["son"])
    assert son["pret"] and son["mesures"]["canaux"] == 2
    assert atelier.sons.source(t["projet"], fini["son"]).read_bytes() == comfy.audio
    atelier.sons.regler(t["projet"], fini["son"], 1, {"debut": .1, "fin": .8, "fondu_entree_ms": 27})
    await fermer(atelier)
    autre = Atelier(racine=atelier.fichiers.racine, fabrique_fournisseur=lambda: double)
    raccorder(autre, comfy); autre.bibliotheque.ouvrir()
    # Le profil rouvert peut changer d'adresse dans ce double ; aucun calcul
    # ne démarre pour lire un travail déjà acquis et son montage personnel.
    lu = autre.travaux.lire(t["projet"], t["identifiant"])
    assert lu["son"] == fini["son"] and lu["snapshot_audio"] == t["snapshot_audio"]
    assert autre.sons.lire(t["projet"], lu["son"])["recette"]["fondu_entree_ms"] == 27
    assert (await lancer(autre, lu, True))["son"] == fini["son"]
    assert len(comfy.envois) == 1 and double.appels == 0
    await fermer(autre)


@pytest.mark.parametrize("octets", [b"source sonore illisible", encoder(np.zeros((8000, 2)), 8000)], ids=["invalide", "silence"])
async def test_retour_invalide_ou_silencieux_reste_acquis_a_verifier(sonore, octets):
    atelier, comfy, p = sonore
    comfy.audio = octets
    t = await preparer(atelier, p)
    fini = await lancer(atelier, t)
    assert fini["etat"] == "a_verifier" and fini["son"], fini
    assert atelier.sons.source(t["projet"], fini["son"]).read_bytes() == octets
    assert not atelier.sons.lire(t["projet"], fini["son"])["pret"]
    assert fini["consommations"] and fini["consommations"][0]["unite"] == "secondes"
    repris = await lancer(atelier, fini, True)
    assert repris["son"] == fini["son"] and len(comfy.envois) == 1


async def test_coupure_apres_import_ne_cree_pas_deux_sons_et_garde_les_corrections(sonore, monkeypatch):
    atelier, comfy, p = sonore
    importer = atelier.sons.importer_octets
    def coupe(*args, **kw):
        son = importer(*args, **kw)
        atelier.sons.regler(args[0], son["identifiant"], 1, {"debut": .13, "fin": .83, "fondu_entree_ms": 31})
        raise OSError("Fermeture après acquisition, avant lien du travail")
    monkeypatch.setattr(atelier.sons, "importer_octets", coupe)
    t = await preparer(atelier, p)
    interrompu = await lancer(atelier, t)
    assert interrompu["etat"] == "a_verifier" and not interrompu["son"]
    monkeypatch.setattr(atelier.sons, "importer_octets", importer)
    fini = await lancer(atelier, interrompu, True)
    assert fini["etat"] == "termine", fini
    assert len(atelier.sons.lister(t["projet"])) == 1 and len(comfy.envois) == 1
    assert atelier.sons.lire(t["projet"], fini["son"])["recette"]["fondu_entree_ms"] == 31


async def test_reprise_suit_le_numero_connu_et_acceptation_inconnue_ne_renvoie_rien(sonore):
    atelier, comfy, p = sonore
    comfy.termine = False
    atelier.travaux_audio.delai = .03
    t = await preparer(atelier, p)
    interrompu = await lancer(atelier, t)
    assert interrompu["etat"] == "a_verifier", interrompu
    e = atelier.file_locale.lire(interrompu["etape_locale"])
    assert e["travail_externe"] == "calcul-1"
    comfy.termine = True
    fini = await lancer(atelier, interrompu, True)
    assert fini["etat"] == "termine" and len(comfy.envois) == 1
    comfy.perdre_acceptation = True
    inconnu = await lancer(atelier, await preparer(atelier, p, "acceptation-perdue"))
    assert inconnu["etat"] == "externe_inconnu", inconnu
    with pytest.raises(TravailRefuse, match="inconnue"):
        await lancer(atelier, inconnu, True)
    assert len(comfy.envois) == 2


async def test_agent_relit_autorisation_audio_avant_le_calcul(sonore):
    atelier, comfy, p = sonore
    t = await preparer(atelier, p, acteur="agent")
    atelier.travaux.regler_cadre(t["projet"], {"autoriser_local": False, "plafond_appels": 1})
    with pytest.raises(TravailRefuse, match="locale"):
        await lancer(atelier, t)
    atelier.travaux.regler_cadre(t["projet"], {"autoriser_local": True, "modeles_audio": ["Autre:son"], "plafond_appels": 1})
    with pytest.raises(TravailRefuse):
        await lancer(atelier, t)
    assert not comfy.envois
    atelier.travaux.regler_cadre(t["projet"], {"autoriser_local": True, "modeles_audio": [p["modele"]], "plafond_appels": 1})
    assert (await lancer(atelier, t))["etat"] == "termine"
    assert len(comfy.envois) == 1
