from fastapi import APIRouter, Request, Body
from fastapi.responses import FileResponse, Response

routeur = APIRouter()

@routeur.get("/3d/connection")
def connexion(r: Request): return r.app.state.atelier.sources_3d.connexion()

@routeur.put("/3d/connection")
def configurer(r: Request, corps: dict = Body(...)):
    return r.app.state.atelier.sources_3d.configurer(str(corps.get("adresse", "")))

@routeur.get("/3d/catalogue")
async def catalogue(r: Request): return await r.app.state.atelier.sources_3d.moteur().catalogue()

@routeur.post("/projects/{projet}/3d/jobs/prepare")
async def preparer_etape(r: Request, projet: str, corps: dict = Body(...)):
    return await r.app.state.atelier.travaux_3d.preparer(projet, corps)

@routeur.post("/projects/{projet}/3d/jobs/{travail}/reconcile")
async def reconcilier_etape(r: Request, projet: str, travail: str):
    return await r.app.state.atelier.travaux_3d.reconcilier(projet, travail)

@routeur.get("/projects/{projet}/3d/jobs/{travail}/files/{nom}")
def fichier_etape(r: Request, projet: str, travail: str, nom: str):
    return FileResponse(r.app.state.atelier.travaux_3d.fichier(projet, travail, nom), media_type="model/gltf-binary")

@routeur.get("/3d/characters")
async def personnages(r: Request): return {"personnages": await r.app.state.atelier.sources_3d.moteur().personnages()}

@routeur.get("/3d/characters/{personnage}/renders")
async def rendus(r: Request, personnage: str): return {"rendus": await r.app.state.atelier.sources_3d.moteur().rendus(personnage)}

@routeur.get("/3d/characters/{personnage}/corrections")
async def corrections(r: Request, personnage: str):
    return await r.app.state.atelier.sources_3d.moteur().corrections(personnage)

@routeur.put("/3d/characters/{personnage}/corrections")
async def poser_corrections(r: Request, personnage: str, corps: dict = Body(...)):
    from atelier.fournisseur.asset3d import Source3DRefusee
    if set(corps) - {"corrections", "animation"} or "corrections" not in corps:
        raise Source3DRefusee("Indiquez les corrections du squelette et le mouvement à vérifier.")
    return await r.app.state.atelier.sources_3d.moteur().poser_corrections(personnage, corps["corrections"], corps.get("animation"))

@routeur.get("/3d/characters/{personnage}/rig")
async def apercu_rig(r: Request, personnage: str, animation: str | None = None):
    reponse = await r.app.state.atelier.sources_3d.moteur().apercu_rig(personnage, animation)
    return Response(reponse.content, media_type="model/gltf-binary", headers={"Cache-Control": "no-store"})

@routeur.get("/3d/characters/{personnage}/preview")
async def apercu(r: Request, personnage: str):
    from atelier.fournisseur.asset3d import identifiant_externe
    reponse = await r.app.state.atelier.sources_3d.moteur().demander(f"/api/personnages/{identifiant_externe(personnage)}/photo")
    return Response(reponse.content, media_type=reponse.headers.get("content-type", "image/png"))

@routeur.get("/projects/{projet}/3d/sources")
def sources(r: Request, projet: str, personnage: str | None = None):
    return {"sources": r.app.state.atelier.sources_3d.lister(projet, personnage)}

@routeur.post("/projects/{projet}/3d/import")
async def importer(r: Request, projet: str, corps: dict = Body(...)):
    return await r.app.state.atelier.sources_3d.importer(projet, corps)

@routeur.get("/projects/{projet}/3d/sources/{source}/files/{nom}")
def fichier(r: Request, projet: str, source: str, nom: str):
    chemin = r.app.state.atelier.sources_3d.fichier(projet, source, nom)
    return FileResponse(chemin, media_type="model/gltf-binary" if chemin.suffix == ".glb" else "image/png")
