"""Frontière HTTP d’asset3d, sans importer son serveur dans l’atelier."""
from __future__ import annotations

import json
import math
import re
import struct
from urllib.parse import urlsplit
import httpx
from atelier.domaine.erreurs import ErreurAtelier


class Source3DRefusee(ErreurAtelier):
    code = "source_3d_refusee"

    def __init__(self, message: str, *, statut_http: int | None = None):
        super().__init__(message)
        self.statut_http = statut_http


def adresse_locale(adresse: str) -> str:
    p = urlsplit(adresse.strip())
    if p.scheme != "http" or p.hostname not in ("localhost", "127.0.0.1", "::1") or p.username or p.password or p.path not in ("", "/") or p.query or p.fragment:
        raise Source3DRefusee("Indiquez l’adresse HTTP locale d’asset3d, par exemple http://127.0.0.1:8000.")
    try:
        if p.port is None: raise ValueError()
    except ValueError:
        raise Source3DRefusee("L’adresse d’asset3d doit préciser un port valide.")
    return adresse.strip().rstrip("/")


def identifiant_externe(valeur: str) -> str:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", valeur):
        raise Source3DRefusee("L’identifiant de la source 3D n’est pas valide.")
    return valeur


def verifier_glb(octets: bytes) -> None:
    """Un GLB relisible hors ligne : en-tête, blocs complets, ressources incluses."""
    try:
        if len(octets) < 20: raise ValueError()
        magic, version, longueur = struct.unpack_from("<4sII", octets)
        if magic != b"glTF" or version != 2 or longueur != len(octets): raise ValueError()
        position, document = 12, None
        while position < longueur:
            taille, nature = struct.unpack_from("<II", octets, position)
            if taille % 4 or position + 8 + taille > longueur: raise ValueError()
            if position == 12:
                if nature != 0x4E4F534A: raise ValueError()
                document = json.loads(octets[position + 8:position + 8 + taille])
            position += 8 + taille
        if position != longueur or not isinstance(document, dict) or document.get("asset", {}).get("version") != "2.0": raise ValueError()
        for categorie in ("buffers", "images"):
            for ressource in document.get(categorie, []):
                uri = ressource.get("uri")
                if uri is not None and not str(uri).startswith("data:"):
                    raise Source3DRefusee("Le modèle référence un fichier externe. Exportez un GLB autonome avec ses textures intégrées.")
    except (ValueError, TypeError, AttributeError, struct.error) as e:
        raise Source3DRefusee("Le fichier 3D reçu n’est pas un GLB 2 complet et lisible.") from e


class AdaptateurAsset3D:
    def __init__(self, adresse: str, transport: httpx.AsyncBaseTransport | None = None):
        self.adresse, self.transport = adresse_locale(adresse), transport

    async def demander(self, chemin: str, *, methode="GET", json=None, data=None, files=None, params=None, facultatif=False):
        # Une adresse rendue par le moteur ne peut ni changer d’hôte ni lire
        # une autre partie de la machine. Les liens reçus restent des données.
        if not chemin.startswith("/api/") or ".." in chemin or "\\" in chemin or "?" in chemin or "#" in chemin:
            raise Source3DRefusee("Le moteur a rendu une adresse de fichier inattendue.")
        try:
            async with httpx.AsyncClient(base_url=self.adresse, transport=self.transport, timeout=30, follow_redirects=False) as client:
                async with client.stream(methode, chemin, json=json, data=data, files=files, params=params) as flux:
                    blocs, taille = [], 0
                    async for bloc in flux.aiter_bytes():
                        taille += len(bloc)
                        if taille > 512 * 1024 * 1024:
                            raise Source3DRefusee("Ce fichier 3D dépasse la taille acceptée par l’import (512 Mo).")
                        blocs.append(bloc)
                    r = httpx.Response(flux.status_code, headers=flux.headers, content=b"".join(blocs), request=flux.request)
        except httpx.HTTPError as e:
            raise Source3DRefusee("asset3d ne répond pas à son adresse configurée. Ses copies déjà importées restent disponibles.") from e
        if r.status_code == 404 and facultatif: return None
        if r.status_code >= 300:
            try: raison = r.json().get("message") or r.json().get("detail")
            except (ValueError, AttributeError): raison = None
            raise Source3DRefusee(str(raison or f"asset3d a refusé ce geste (HTTP {r.status_code})."), statut_http=r.status_code)
        return r

    async def json(self, chemin: str):
        r = await self.demander(chemin)
        try: return r.json()
        except ValueError as e: raise Source3DRefusee("Le contrat d’asset3d n’a pas pu être relu : réponse JSON attendue.") from e

    async def catalogue(self) -> dict:
        reglages = await self.json("/api/reglages")
        animations = await self.json("/api/animations")
        if not isinstance(reglages, dict) or not all(k in reglages for k in ("moteurs_3d", "angles", "styles", "bornes")) or not isinstance(animations, dict) or not isinstance(animations.get("animations"), list):
            raise Source3DRefusee("Cette version d’asset3d ne présente pas le contrat attendu. Aucun calcul n’a été lancé.")
        return {**reglages, **animations, "contrat": "asset3d-rendus-v1"}

    async def personnages(self) -> list[dict]:
        r = await self.json("/api/personnages")
        if not isinstance(r, dict) or not isinstance(r.get("personnages"), list):
            raise Source3DRefusee("Le catalogue de personnages d’asset3d est illisible.")
        return r["personnages"]

    async def corrections(self, personnage: str) -> dict:
        r = await self.json(f"/api/personnages/{identifiant_externe(personnage)}/corrections")
        if not isinstance(r, dict) or not isinstance(r.get("os"), list) or not isinstance(r.get("bornes"), dict) or not isinstance(r.get("corrections"), dict):
            raise Source3DRefusee("Le catalogue des corrections du squelette est illisible.")
        return {**r, "adresse": self.adresse}

    async def poser_corrections(self, personnage: str, corrections: dict, animation: str | None = None) -> dict:
        catalogue = await self.corrections(personnage)
        if not isinstance(corrections, dict):
            raise Source3DRefusee("Les corrections doivent indiquer les rotations par os.")
        os = {o["cle"]: {a["nom"] for a in o["axes"]} for o in catalogue["os"]}
        minimum, maximum = catalogue["bornes"]["minimum"], catalogue["bornes"]["maximum"]
        for cle, angles in corrections.items():
            if cle not in os or not isinstance(angles, dict) or set(angles) - os[cle]:
                raise Source3DRefusee("Choisissez un os et des axes présents dans le catalogue du moteur.")
            for valeur in angles.values():
                if isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not math.isfinite(valeur) or not minimum <= valeur <= maximum:
                    raise Source3DRefusee(f"Chaque rotation doit être comprise entre {minimum} et {maximum} degrés.")
        if animation is not None and animation not in (await self.catalogue())["animations"]:
            raise Source3DRefusee("Ce mouvement n’existe pas dans le catalogue du moteur.")
        r = await self.demander(f"/api/personnages/{identifiant_externe(personnage)}/corrections", methode="PUT", json={"corrections": corrections, "animation": animation})
        return {**r.json(), "adresse": self.adresse}

    async def apercu_rig(self, personnage: str, animation: str | None = None):
        if animation is not None and animation not in (await self.catalogue())["animations"]:
            raise Source3DRefusee("Ce mouvement n’existe pas dans le catalogue du moteur.")
        reponse = await self.demander(f"/api/personnages/{identifiant_externe(personnage)}/rig.glb", params={"animation": animation} if animation else None)
        verifier_glb(reponse.content)
        return reponse

    async def rendus(self, personnage: str) -> list[dict]:
        reponse = await self.json(f"/api/personnages/{identifiant_externe(personnage)}/rendus")
        if not isinstance(reponse, dict) or not isinstance(reponse.get("rendus"), list) or not all(isinstance(r, dict) and isinstance(r.get("images"), list) for r in reponse["rendus"]):
            raise Source3DRefusee("Cette version d’asset3d ne présente pas une liste de rendus compatible.")
        return reponse["rendus"]

    async def rendu(self, personnage: str, rendu: str) -> dict:
        identifiant_externe(rendu)
        trouve = next((r for r in await self.rendus(personnage) if r.get("identifiant") == rendu), None)
        if trouve is None: raise Source3DRefusee("Ce rendu n’appartient pas à ce personnage d’asset3d.")
        if trouve.get("actif") or not trouve.get("images"):
            raise Source3DRefusee("Ce rendu ne contient pas encore de frames terminées à importer.")
        return trouve
