"""Profils nommés et images locales ; le suivi reste celui des travaux AU3."""
from fastapi import APIRouter, Request

routeur = APIRouter()


@routeur.get("/workflow-profiles")
def lister(requete: Request):
    """Chaque profil avec son dernier diagnostic ; un profil sonore
    indisponible y porte aussi `manque`, les fichiers absents nommés en clair
    (l'écran grise le moteur avec cette raison, pas avec un nom de nœud)."""
    atelier = requete.app.state.atelier
    profils = []
    for profil in atelier.profils_workflow.lister():
        diagnostic = profil.get("diagnostic")
        if diagnostic and profil.get("nature") == "audio":
            profil = {**profil, "diagnostic": {**diagnostic, "manque": atelier.installation_son.diagnostic_sonore(profil, diagnostic)}}
        profils.append(profil)
    return {"profils": profils}


@routeur.post("/workflow-profiles")
async def importer(requete: Request):
    atelier = requete.app.state.atelier
    profil = atelier.profils_workflow.importer(await requete.json())
    await atelier.catalogue.rafraichir()
    await atelier.animation.rafraichir()
    return profil


@routeur.get("/workflow-profiles/styles")
async def lister_styles(requete: Request):
    return {"styles": await requete.app.state.atelier.styles_locaux.lister()}


@routeur.post("/workflow-profiles/styles/install")
async def installer_styles_prets(requete: Request):
    atelier = requete.app.state.atelier
    installes = await atelier.styles_locaux.installer_prets()
    await atelier.catalogue.rafraichir()
    return {"installes": installes}


@routeur.post("/workflow-profiles/styles/{identifiant}/install")
async def installer_style(requete: Request, identifiant: str):
    atelier = requete.app.state.atelier
    profil = await atelier.styles_locaux.installer(identifiant)
    await atelier.catalogue.rafraichir()
    return profil


@routeur.get("/workflow-profiles/{identifiant}/versions/{version}")
def lire(requete: Request, identifiant: str, version: str):
    return requete.app.state.atelier.profils_workflow.lire(identifiant, version)


@routeur.post("/workflow-profiles/{identifiant}/versions/{version}/diagnose")
async def diagnostiquer(requete: Request, identifiant: str, version: str):
    atelier = requete.app.state.atelier
    diagnostic = await atelier.profils_workflow.diagnostiquer(identifiant, version)
    profil = atelier.profils_workflow.lire(identifiant, version)
    return {**diagnostic, "manque": atelier.installation_son.diagnostic_sonore(profil, diagnostic)}


@routeur.post("/workflow-profiles/install-sound")
async def installer_sonore(requete: Request):
    try:
        corps = await requete.json()
    except Exception:
        corps = {}
    return {"moteurs": await requete.app.state.atelier.installation_son.installer((corps or {}).get("moteurs"))}


@routeur.get("/workflow-profiles/sound-defaults")
def moteurs_par_famille(requete: Request, projet: str):
    return {"familles": requete.app.state.atelier.installation_son.moteurs_par_famille(projet)}


@routeur.post("/projects/{projet}/workflow-image-jobs/prepare")
async def preparer(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux_workflow.preparer(projet, await requete.json())


@routeur.post("/projects/{projet}/free-video-jobs/prepare")
async def preparer_video(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux.preparer(projet, await requete.json(), source_libre=True)


@routeur.post("/projects/{projet}/audio-jobs/prepare")
async def preparer_audio(requete: Request, projet: str):
    return await requete.app.state.atelier.travaux_audio.preparer(projet, await requete.json())
