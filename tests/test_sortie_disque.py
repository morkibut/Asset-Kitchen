"""Lecture de la sortie de ComfyUI (10 octobre 2026).

Relevé sur Cœur de pierre : `/view` a mis 60 s, puis plus rien, à rendre un
FLAC de 2 s qu'il venait d'écrire, alors que `/queue` répondait. Sur la même
machine, la sortie se lit dans le dossier que ComfyUI déclare
(`--output-directory`, dans `/system_stats`) : le fichier doit exister, être
stable (deux relevés identiques) et avoir la taille relevée. Sinon `/view`,
mais jamais plus de 10 s de silence, et un message qui dit quoi faire."""
import asyncio

import httpx
import pytest

from atelier.domaine.erreurs import FournisseurIndisponible
from atelier.fournisseur import maison
from atelier.fournisseur.maison import MoteurDeLaMaison, dossier_de_sortie


def moteur(base, repondre):
    return MoteurDeLaMaison(base, httpx.MockTransport(repondre))


def stats(dossier):
    return {"system": {"argv": ["ComfyUI/main.py", "--port", "8188", "--output-directory", str(dossier)]}}


def test_le_dossier_de_sortie_se_lit_dans_la_ligne_de_commande(tmp_path):
    assert dossier_de_sortie(stats(tmp_path)) == tmp_path
    assert dossier_de_sortie({"system": {"argv": [f"--output-directory={tmp_path}"]}}) == tmp_path
    assert dossier_de_sortie({"system": {"argv": ["ComfyUI/main.py"]}}) is None  # jamais deviné
    assert dossier_de_sortie(None) is None


async def test_comfyui_local_la_sortie_se_lit_sur_le_disque_sans_view(tmp_path):
    (tmp_path / "asset-kitchen").mkdir()
    (tmp_path / "asset-kitchen" / "son_00001.flac").write_bytes(b"fLaC" + b"\0" * 1000)
    vues = []

    def repondre(requete):
        if requete.url.path == "/system_stats":
            return httpx.Response(200, json=stats(tmp_path))
        vues.append(requete.url.path)
        return httpx.Response(500)

    m = moteur("http://127.0.0.1:8188", repondre)
    octets = await m._telecharger_sortie({"filename": "son_00001.flac", "subfolder": "asset-kitchen", "type": "output"})
    assert octets == b"fLaC" + b"\0" * 1000
    assert vues == []  # /view n'a pas été appelé


async def test_un_nom_qui_sort_du_dossier_n_est_jamais_lu_sur_le_disque(tmp_path):
    sortie = tmp_path / "output"
    sortie.mkdir()
    (tmp_path / "secret.txt").write_bytes(b"hors du dossier")
    vues = []

    def repondre(requete):
        if requete.url.path == "/system_stats":
            return httpx.Response(200, json=stats(sortie))
        vues.append(requete.url.params.get("filename"))
        return httpx.Response(200, content=b"par view")

    m = moteur("http://127.0.0.1:8188", repondre)
    assert await m._telecharger_sortie({"filename": "../secret.txt", "subfolder": "", "type": "output"}) == b"par view"
    assert vues == ["../secret.txt"]


async def test_comfyui_distant_ou_fichier_absent_passe_par_view(tmp_path, monkeypatch):
    monkeypatch.setattr(maison, "PAS_STABILITE_S", 0.01)
    def repondre(requete):
        if requete.url.path == "/system_stats":
            return httpx.Response(200, json=stats(tmp_path))
        return httpx.Response(200, content=b"par view")

    distant = moteur("http://192.168.1.20:8188", repondre)
    assert await distant._telecharger_sortie({"filename": "a.flac", "type": "output"}) == b"par view"
    local = moteur("http://127.0.0.1:8188", repondre)
    assert await local._telecharger_sortie({"filename": "absent.flac", "type": "output"}) == b"par view"


async def test_un_fichier_encore_en_ecriture_attend_d_etre_stable(tmp_path, monkeypatch):
    monkeypatch.setattr(maison, "PAS_STABILITE_S", 0.05)
    chemin = tmp_path / "long.flac"
    chemin.write_bytes(b"debut")

    async def finir_d_ecrire():
        await asyncio.sleep(0.03)
        chemin.write_bytes(b"debut-et-fin-du-fichier")

    def repondre(requete):
        if requete.url.path == "/system_stats":
            return httpx.Response(200, json=stats(tmp_path))
        return httpx.Response(500)

    m = moteur("http://127.0.0.1:8188", repondre)
    ecriture = asyncio.create_task(finir_d_ecrire())
    octets = await m._telecharger_sortie({"filename": "long.flac", "type": "output"})
    await ecriture
    assert octets == b"debut-et-fin-du-fichier"


async def test_view_muet_echoue_vite_avec_un_message_qui_dit_quoi_faire(monkeypatch):
    monkeypatch.setattr(maison, "DELAI_VIEW", 0.2)

    def repondre(requete):
        if requete.url.path == "/system_stats":
            return httpx.Response(200, json={"system": {"argv": []}})
        raise httpx.ReadTimeout("muet", request=requete)

    m = moteur("http://127.0.0.1:8188", repondre)
    with pytest.raises(FournisseurIndisponible) as erreur:
        await asyncio.wait_for(m._telecharger_sortie({"filename": "son.flac", "type": "output"}), 5)
    assert "son.flac" in str(erreur.value) and "relancez ComfyUI" in str(erreur.value)
