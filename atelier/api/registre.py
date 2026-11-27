"""RC1 : le registre du contenu, vu de l'écran.

`projects/{jeu}/register` : l'accueil (à trancher, nouveautés, par rayon,
dépôts refusés) ; `…/entries` : la liste filtrée ; `…/entries/{entrée}` : une
entrée entière ; les gestes de l'auteur (décider, prendre, remarquer, annuler,
marquer vu) ; le téléversement d'un fichier avant de créer une entrée ; les
médias ; la rétrospective. Les outils MCP miroirs, côté agent, sont dans
`atelier/mcp/registre.py` — sans aucun geste de décision.
"""
from typing import Any

from fastapi import APIRouter, Body, Query, Request
from fastapi.responses import FileResponse, PlainTextResponse

routeur = APIRouter(prefix="/projects/{projet}/register")


def _service(requete: Request):
    return requete.app.state.atelier.registre


@routeur.get("")
def accueil(requete: Request, projet: str):
    return _service(requete).accueil(projet)


@routeur.get("/settings")
def reglages(requete: Request, projet: str):
    return _service(requete).reglages(projet)


@routeur.get("/entries")
def lister(requete: Request, projet: str, etat: str | None = None, type: str | None = None,
           rayon: str | None = None, q: str | None = None, hors_vue: bool = False, limite: int = 200):
    return _service(requete).lister(projet, etat=etat, type_=type, rayon=rayon, texte=q,
                                    hors_vue=hors_vue, limite=limite)


@routeur.post("/entries")
def creer(requete: Request, projet: str, corps: dict[str, Any] = Body(...)):
    """Le parcours manuel : l'auteur crée une entrée, médias déjà téléversés."""
    return _service(requete).deposer_depuis_l_ecran(projet, corps)


@routeur.post("/uploads")
async def televerser(requete: Request, projet: str, nom: str = Query(...)):
    """Un fichier par appel, les octets en corps brut (pas de `multipart`)."""
    return _service(requete).televerser(projet, await requete.body(), nom)


@routeur.get("/entries/{entree}")
def lire(requete: Request, projet: str, entree: str):
    return _service(requete).lire(projet, entree)


@routeur.post("/entries/{entree}/decision")
def decider(requete: Request, projet: str, entree: str, corps: dict[str, Any] = Body(...)):
    """`{geste: valider|reprise|ecarter|pause|relancer, porte?, mot?}` — décider
    deux fois la même chose ne crée rien (`deja`)."""
    return _service(requete).decider(projet, entree, corps.get("geste"), porte=corps.get("porte"), mot=corps.get("mot"))


@routeur.put("/entries/{entree}/choice")
def prendre(requete: Request, projet: str, entree: str, corps: dict[str, Any] = Body(...)):
    """`{codes: [...]}` — une, plusieurs ou aucune proposition."""
    return _service(requete).prendre(projet, entree, corps.get("codes"))


@routeur.post("/entries/{entree}/remarks")
def remarquer(requete: Request, projet: str, entree: str, corps: dict[str, Any] = Body(...)):
    return _service(requete).remarquer(projet, entree, corps.get("texte"), sorte=corps.get("sorte") or "remarque",
                                       cible=corps.get("cible"))


@routeur.post("/events/{repere}/cancel")
def annuler(requete: Request, projet: str, repere: str):
    return _service(requete).annuler(projet, repere)


@routeur.post("/seen")
def vu(requete: Request, projet: str, corps: dict[str, Any] = Body(default={})):
    """`{entrees: [...]}`, ou rien pour « tout marquer vu »."""
    return _service(requete).marquer_vu(projet, corps.get("entrees"))


@routeur.get("/entries/{entree}/media/{fichier}")
def media(requete: Request, projet: str, entree: str, fichier: str):
    return FileResponse(_service(requete).chemin_media(projet, entree, fichier))


@routeur.get("/retrospective.md", response_class=PlainTextResponse)
def retrospective(requete: Request, projet: str):
    return _service(requete).retrospective(projet)
