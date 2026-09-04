# -*- coding: utf-8 -*-
"""Un atelier jetable pour cliquer A11 au navigateur, sans toucher à celui de l'auteur.

**L'auteur travaille sur le port 8420 pendant la session.** Cet atelier-ci vit
sur un dossier temporaire, sur le port 8433 : rien n'est écrit dans `donnees/`,
et son atelier à lui ne bouge pas d'un pixel.

Ce qu'il monte : un personnage à deux images — un clip ne se commande pas dans
le vide —, un modèle payant doublé, et **le moteur de la maison**, celui qui
tourne sur la carte graphique de cette machine.

## Trois façons de le lancer, une par absence

Les trois absences du moteur ne se ressemblent pas, et c'est très exactement ce
qu'on vient regarder. Chacune se lance à part :

    py essais/atelier_jetable_a11.py
        Le vrai moteur, tel qu'il est sur cette machine. Ce que l'écran dit là
        est la vérité du disque : la carte, sa mémoire libre, ce qui est
        installé, ce qui manque.

    py essais/atelier_jetable_a11.py eteint
        Comme si l'application du moteur n'était pas ouverte. **La seule des
        trois qui grise le modèle** — rien ne peut partir, et l'atelier ne sait
        pas ouvrir une fenêtre à la place de quelqu'un.

    py essais/atelier_jetable_a11.py manque
        Comme s'il manquait deux fichiers. Le modèle **reste choisissable**, la
        liste s'affiche avec les tailles et les licences, et le bouton qui
        rapatrie se clique — ⚠️ sans que rien ne descende pour de vrai : le
        téléchargement passe par un hébergeur doublé qui rend trois octets, et
        les fichiers atterrissent dans le dossier jetable, pas dans le vrai.

    py essais/atelier_jetable_a11.py greffon
        Comme s'il manquait le greffon qui garde les gros pixels. Simple
        avertissement : le clip sortira, il sortira lissé.

## ⚠️ Ce qu'il ne faut pas faire, et pourquoi

**Ne cliquez pas « Télécharger » en mode normal.** Le vrai bouton rapatrie
vingt-six gigaoctets dans le dossier de modèles du vrai ComfyUI — pas dans le
dossier jetable, parce que c'est là qu'ils servent. C'est un geste que l'auteur
décide, pas une vérification. Le mode `manque` est là exactement pour pouvoir
cliquer ce bouton-là sans conséquence.

**Commander un clip en mode normal fait vraiment tourner la carte** : environ
deux minutes, zéro centime, et le reste de l'ordinateur rame pendant ce
temps-là. C'est la seule façon de voir un clip local arriver pour de vrai, et
c'est un choix, pas un effet de bord.

## Ce qu'on vient voir

- **Le modèle local est dans la même liste** que les payants, avec le même geste
  pour le choisir. Une liste à part en aurait fait une option de réglages.
- **Le bouton porte un temps au lieu d'un montant.** L'invariant du produit n'a
  pas changé — rien ne part sans que ce que ça coûte soit annoncé —, il a changé
  d'unité.
- **Un lot n'additionne pas la même attente** : le premier tirage charge le
  modèle en mémoire, les suivants non.
- **Le nombre d'images est le vrai**, pas celui qu'on a demandé : le moteur
  n'accepte que certains comptes et prend celui du dessus.
- **La durée conseillée porte sa raison**, là où l'on choisit.
- **Le panneau de la carte** dit ce qu'elle est et ce qui lui reste — une attente
  sans sa machine ne veut rien dire.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import httpx  # noqa: E402
import uvicorn  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from atelier.api.app import creer_application  # noqa: E402
from atelier.fournisseur.maison import (  # noqa: E402
    BASE_PAR_DEFAUT,
    MoteurDeLaMaison,
)
from atelier.fournisseur.montage_maison import GREFFON_PIXEL  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import FournisseurDouble, image_sujet  # noqa: E402
from test_a9 import MELE, AnimateurDouble  # noqa: E402

# **Un port par mode**, pour que les quatre puissent tourner côte à côte : ce
# qu'on compare est justement ce que chacun affiche, et fermer l'un pour ouvrir
# l'autre obligerait à se souvenir de l'écran qu'on vient de quitter.
PORTS = {"normal": 8433, "eteint": 8434, "manque": 8435, "greffon": 8436}
MODELE = "essai:rend-du-png"

# Les quatre familles et les noms de classe qui les lisent, pour que le double
# puisse mentir sur ce qui est installé **exactement là où le produit regarde**.
CHARGEURS = {
    "diffusion_models": ("UnetLoaderGGUF", "unet_name"),
    "text_encoders": ("CLIPLoader", "clip_name"),
    "vae": ("VAELoader", "vae_name"),
    "loras": ("LoraLoaderModelOnly", "lora_name"),
}


def _sans(cache: set[str]):
    """Un ComfyUI qui répond comme le vrai, **mais à qui il manque des fichiers**.

    Il relaie tout au vrai serveur sauf les listes de fichiers installés, qu'il
    filtre. C'est la seule façon de voir la deuxième et la troisième absence sans
    déplacer quoi que ce soit sur le disque de l'auteur.
    """

    def repondre(requete: httpx.Request) -> httpx.Response:
        chemin = requete.url.path
        if chemin.startswith("/object_info/"):
            classe = chemin.rsplit("/", 1)[-1]
            for famille, (nom_classe, champ) in CHARGEURS.items():
                if nom_classe != classe:
                    continue
                vus = _vraiment_installes(famille, champ, classe)
                garde = [nom for nom in vus if nom not in cache]
                return httpx.Response(
                    200, json={classe: {"input": {"required": {champ: [garde]}}}}
                )
        if requete.method in ("GET", "HEAD") and requete.url.host != "127.0.0.1":
            # L'hébergeur des modèles, doublé : trois octets, et une taille
            # annoncée qui colle. Rien de vrai ne descend.
            return httpx.Response(
                200,
                content=b"abc",
                headers={"content-length": "3"},
            )
        return _relayer(requete)

    return httpx.MockTransport(repondre)


def _relayer(requete: httpx.Request) -> httpx.Response:
    with httpx.Client(timeout=30.0) as client:
        recue = client.request(
            requete.method,
            requete.url,
            content=requete.content,
            headers={k: v for k, v in requete.headers.items() if k != "host"},
        )
    return httpx.Response(recue.status_code, content=recue.content, headers=recue.headers)


def _vraiment_installes(famille: str, champ: str, classe: str) -> list[str]:
    try:
        with httpx.Client(timeout=10.0) as client:
            rendu = client.get(f"{BASE_PAR_DEFAUT}/object_info/{classe}").json()
    except Exception:
        return []
    entree = rendu.get(classe, {}).get("input", {}).get("required", {}).get(champ)
    if not entree:
        return []
    premier = entree[0]
    if isinstance(premier, list):
        return [str(nom) for nom in premier]
    for morceau in entree[1:]:
        if isinstance(morceau, dict) and isinstance(morceau.get("options"), list):
            return [str(nom) for nom in morceau["options"]]
    return []


def _eteint() -> httpx.MockTransport:
    def repondre(requete: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connexion refusée", request=requete)

    return httpx.MockTransport(repondre)


def _attendre(client, identifiant: str) -> dict:
    for _ in range(300):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee", "interrompue"):
            return generation
        client.get("/api/status")
    raise AssertionError("la génération n'a pas fini")


def _une_image(client, double, prompt, personnage, pose) -> str:
    double.rendre = lambda: image_sujet(bloc=4, toile=24)
    faite = client.post(
        "/api/generations",
        json={
            "modele": MODELE,
            "prompt": prompt,
            "personnage": personnage,
            "pose": pose,
            "echelle": "personnage",
        },
    )
    _attendre(client, faite.json()["identifiant"])
    double.rendre = None
    return f"{faite.json()['identifiant']}-0"


def peupler(atelier: Atelier, double: FournisseurDouble) -> str:
    """Un personnage à deux images. **Rien de plus** : ce qui se regarde ici est
    l'écran de commande, pas la galerie."""
    with TestClient(creer_application(atelier)) as client:
        personnage = client.post(
            "/api/characters",
            json={
                "nom": "Le nain",
                "description": "un forgeron nain à la barbe tressée",
            },
        ).json()["personnage"]["identifiant"]
        repos = _une_image(client, double, "le nain, au repos", personnage, "repos")
        client.put(
            f"/api/characters/{personnage}/references",
            json={"asset": repos, "promue": True},
        )
        _une_image(client, double, "le nain, qui marche", personnage, "marche")
        return personnage


def principal(mode: str) -> int:
    dossier = Path(tempfile.mkdtemp(prefix="atelier-a11-"))
    print(f"Dossier jetable : {dossier}")
    print(f"Mode            : {mode}")

    if mode == "eteint":
        transport = _eteint()
    elif mode == "manque":
        transport = _sans(
            {
                "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
                "wan_2.1_vae.safetensors",
            }
        )
    elif mode == "greffon":
        transport = _sans({GREFFON_PIXEL})
    elif mode == "normal":
        transport = None
    else:
        print(f"Mode inconnu : {mode}")
        print(f"Attendus : {', '.join(PORTS)}")
        return 2

    double = FournisseurDouble()
    animateur = AnimateurDouble()
    animateur.modeles = [MELE]
    animateur.facture = 0.067
    local = MoteurDeLaMaison(transport=transport)

    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: double,
        # **Les deux animateurs, et c'est là que la tranche se joue** : une clé
        # absente chez le payant ne doit rien dire du local, et l'inverse aussi.
        fabriques_animateurs=[lambda: animateur, lambda: local],
    )
    if mode == "manque":
        # Les fichiers doivent atterrir dans le dossier jetable, jamais dans le
        # vrai dossier de modèles — c'est ce qui rend le bouton cliquable ici.
        modeles = dossier / "faux-modeles"
        modeles.mkdir(parents=True, exist_ok=True)
        local.dossier_des_modeles = _toujours(modeles)  # type: ignore[method-assign]
        print(f"Faux dossier de modèles : {modeles}")

    personnage = peupler(atelier, double)

    with TestClient(creer_application(atelier)) as client:
        vu = client.get("/api/clips/engine").json()
        modeles = client.get("/api/clips/models?secondes=1").json()["modeles"]

    print()
    print(f"  Le personnage       : {personnage}")
    print("  Le moteur de la maison :")
    print(f"    allumé            : {vu['allume']}")
    print(f"    carte             : {vu['carte'] or '—'}")
    print(f"    mémoire libre     : {vu['memoire_libre_go']} Go")
    print(f"    grise             : {vu['grise'] or '— rien, il est choisissable'}")
    print(f"    à télécharger     : {vu['go_a_telecharger']} Go")
    for fichier in vu["manquants"]:
        print(f"      — {fichier['nom']} · {fichier['go']} Go · {fichier['licence']}")
    print(f"    greffon absent    : {vu['greffon_absent']}")
    print(f"    phrase            : {vu['phrase'] or '— rien à dire est une réponse'}")
    print()
    print("  Ce que la liste des modèles annonce, pour une seconde :")
    for ligne in modeles:
        attente = ligne["attente"]
        cout = (
            f"{attente['secondes']} s d'attente "
            f"(puis {attente['secondes_suivant']} s), {attente['images']} images"
            if attente
            else f"{ligne['prix']['montant']} $"
        )
        print(f"    — {ligne['nom']} : {cout}")
        if ligne["grise"]:
            print(f"        grisé : {ligne['grise']}")
        if ligne["duree_conseillee"]:
            print(f"        conseillé : {ligne['duree_conseillee']} s")
    print()
    print("  À cliquer : Établi › la case « marche » › Animer marche")
    if mode == "manque":
        print("             puis « Télécharger » — rien ne descend pour de vrai")
    if mode == "normal":
        print("  ⚠️  Ne cliquez pas « Télécharger » : ce bouton-là rapatrie 26 Go")
        print("     dans le vrai dossier de modèles. Le mode « manque » est fait")
        print("     pour cliquer ce bouton sans conséquence.")
        print("  ⚠️  « Commander » fait vraiment tourner la carte : ~2 min, 0 centime.")
    print()
    port = PORTS[mode]
    print(f"Atelier jetable sur http://127.0.0.1:{port} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché)")
    sys.stdout.flush()
    uvicorn.run(
        creer_application(atelier), host="127.0.0.1", port=port, log_level="warning"
    )
    return 0


def _toujours(valeur):
    async def rendre():
        return valeur

    return rendre


if __name__ == "__main__":
    raise SystemExit(principal(sys.argv[1] if len(sys.argv) > 1 else "normal"))
