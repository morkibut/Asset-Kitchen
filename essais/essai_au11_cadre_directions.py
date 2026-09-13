# -*- coding: utf-8 -*-
"""AU11 — mesurer le cadre et le pivot entre les directions, sans savoir lire le pont.

**Ce que le plan (`docs/PLAN-atelier-unifie.md`) demande** : « Le rendu conserve
cadre, pivot et dimensions cohérents entre les directions demandées. » La part
« dimensions » est acquise (`atelier/services/sources_3d.py`, `ServiceSources3D.importer`
refuse déjà une direction dont le canevas ne mesure pas la même taille que les
autres). La part « cadre » (l'échelle apparente du personnage) et « pivot »
(où sont ses pieds dans l'image) ne peut **pas** se vérifier sans rendu réel :
asset3d ne renvoie ni l'échelle de caméra ni le point visé par son contrat
HTTP — voir `docs/releves/2026-09-12-au10-au11-cadre-directions.md`. Ce banc ne
ferme donc rien tout seul : il **mesure** un vrai rendu, sur trois directions
au moins d'un même modèle et d'un même mouvement, et rend un verdict lisible.

**Ce qui est mesuré, faute de mieux.** Le contrat d'asset3d ne donne ni
`ortho_scale` ni `centre_vue` : ce banc les approxime depuis les pixels reçus —
la hauteur du personnage (bord haut au bord bas des pixels non transparents)
sert de mesure de cadre, et la position verticale du bas du personnage dans le
canevas sert de mesure de pivot. La largeur n'est **pas** comparée : vu de face
ou de profil, un personnage change légitimement de largeur — ça ne dit rien du
cadrage.

**Le coût.** Un rendu réel appelle Blender sur le GPU de l'auteur, via
l'installation `asset3d` voisine (jamais modifiée : voir `test_au10_environnement.py`).
Aucun argent n'est en jeu — ce chemin n'appelle aucun fournisseur payant, à
aucune étape ; le personnage part d'une silhouette dessinée localement, jamais
générée. Le coût réel est le temps machine et l'électricité : ce script
l'annonce avant de lancer quoi que ce soit et attend un accord explicite.

**Sans GPU, sans asset3d lancé.** Si l'adresse indiquée ne répond pas au
contrat attendu — ou si `--repetition` est donné — ce script joue son parcours
entier contre une doublure locale (aucun réseau, aucun calcul 3D réel) et
l'annonce en toutes lettres : « aucun rendu réel, ceci est une répétition ».
C'est ainsi qu'il se vérifie lui-même dans `tests/test_essai_au11_cadre_directions.py`.

    Répétition, sans rien lancer :
        .venv\\Scripts\\python.exe essais/essai_au11_cadre_directions.py --repetition

    Mesure réelle, contre un asset3d déjà lancé (adresse par défaut http://127.0.0.1:8000) :
        .venv\\Scripts\\python.exe essais/essai_au11_cadre_directions.py

Sortie : `essais/resultats_au11_cadre/atelier/…` (dossier jetable, jamais
`donnees/`, jamais un projet Godot de l'auteur) et `essais/resultats_au11_cadre/mesures.json`
(revient dans Git — voir `.gitignore`, `!essais/resultats_*/mesures.json`).
"""
from __future__ import annotations

import argparse
import asyncio
import io
import json
import struct
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean

import httpx
from fastapi import FastAPI, Response
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

from atelier.api.app import creer_application  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from conftest import AnimateurMuet, FournisseurDouble  # noqa: E402

SORTIE_DEFAUT = RACINE / "essais" / "resultats_au11_cadre"
ADRESSE_DEFAUT = "http://127.0.0.1:8000"
POSE_DEFAUT = "marche"
DIRECTIONS_DEFAUT = ("nord", "est", "sud")

# Seuils de cohérence — arbitraires mais documentés : un personnage vu de face
# est plus large que de profil (largeur non comparée), mais sa hauteur
# apparente et la position verticale de ses pieds doivent rester proches d'une
# direction à l'autre si le cadrage est bien indépendant de la caméra.
SEUIL_HAUTEUR_PCT = 0.05          # 5 % d'écart de hauteur apparente toléré
SEUIL_PIVOT_FRACTION = 0.02       # 2 % de la hauteur du canevas toléré sur la position des pieds


# ── La silhouette de référence, dessinée localement — jamais générée ────────

def silhouette_reference(taille: int = 96) -> bytes:
    """Un petit personnage à fond transparent, pour partir d'une photo qui
    n'a coûté ni argent ni appel réseau à personne."""
    image = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    dessin = ImageDraw.Draw(image)
    dessin.ellipse([taille * 0.35, taille * 0.08, taille * 0.65, taille * 0.32], fill=(210, 180, 140, 255))
    dessin.rectangle([taille * 0.38, taille * 0.32, taille * 0.62, taille * 0.68], fill=(90, 110, 160, 255))
    dessin.rectangle([taille * 0.40, taille * 0.68, taille * 0.48, taille * 0.95], fill=(60, 60, 60, 255))
    dessin.rectangle([taille * 0.52, taille * 0.68, taille * 0.60, taille * 0.95], fill=(60, 60, 60, 255))
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def _glb_minimal() -> bytes:
    """Un GLB 2 valide et vide — juste de quoi passer `verifier_glb`."""
    contenu = json.dumps({"asset": {"version": "2.0"}}).encode()
    contenu += b" " * (-len(contenu) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, len(contenu) + 20, len(contenu), 0x4E4F534A) + contenu


# ── La doublure : joue le contrat d'asset3d, ne calcule jamais rien ─────────

@dataclass
class _EssaiDouble:
    etape: str
    personnage: str
    reglages: dict


@dataclass
class _EtatDouble:
    cles: dict = field(default_factory=dict)          # cle -> identifiant d'essai
    essais: dict = field(default_factory=dict)         # identifiant -> _EssaiDouble
    rendus: dict = field(default_factory=dict)         # personnage -> [rendu, ...]
    images: dict = field(default_factory=dict)         # rendu_id -> [octets, ...]


def construire_double_asset3d(*, silhouettes: dict[str, tuple[int, int, int]] | None = None, nombre_images: int = 4) -> FastAPI:
    """Une doublure d'asset3d : accepte les mêmes appels, ne rend jamais rien.

    `silhouettes` associe une direction à `(largeur_px, hauteur_px, bas_px)` —
    la boîte du personnage dans une image 64×96. Par défaut les trois
    directions du banc sont identiques : la répétition doit se dérouler
    « cohérente » quand rien ne l'a faussée."""
    import uuid

    silhouettes = silhouettes or {}
    etat = _EtatDouble()
    app = FastAPI()
    CANEVAS = (64, 96)

    def _image_pour(direction: str, rang: int) -> bytes:
        largeur_p, hauteur_p, bas_p = silhouettes.get(direction, (28, 60, 88))
        image = Image.new("RGBA", CANEVAS, (0, 0, 0, 0))
        dessin = ImageDraw.Draw(image)
        gauche = (CANEVAS[0] - largeur_p) // 2 + (rang % 2)  # un peu de mouvement entre les images
        dessin.rectangle([gauche, bas_p - hauteur_p, gauche + largeur_p, bas_p], fill=(200, 120, 90, 255))
        tampon = io.BytesIO()
        image.save(tampon, format="PNG")
        return tampon.getvalue()

    @app.get("/api/atelier/contract")
    def contrat():
        return {"version": 1, "etapes": ["modele_3d", "rig", "rendu"]}

    @app.get("/api/atelier/occupation")
    def occupation():
        return {"etat": "disponible", "travaux": []}

    @app.post("/api/atelier/stages/preview")
    async def preview(corps: dict):
        reglages = {"animation": f"{corps.get('reglages', {}).get('animation', 'marche')}.fbx",
                    "nombre_images": nombre_images, "angle": corps.get("reglages", {}).get("angle", "face"),
                    "moteur_3d": "double"}
        return {"prerequis": {"disponible": True, "poids_verifies": False}, "reglages": reglages}

    @app.post("/api/atelier/stages")
    async def stages(corps: dict):
        cle = corps["cle"]
        if cle in etat.cles:
            return {"identifiant": etat.cles[cle]}
        identifiant = str(uuid.uuid4())
        etape = corps["etape"]
        if etape == "modele_3d":
            personnage = str(uuid.uuid4())
        else:
            personnage = corps["personnage"]
        essai = _EssaiDouble(etape=etape, personnage=personnage, reglages=corps.get("reglages", {}))
        if etape == "rendu":
            # L'identifiant de l'essai lui-même sert d'identifiant de rendu :
            # c'est celui que `ServiceSources3D.importer` retrouve ensuite dans
            # `/api/personnages/{id}/rendus`, pas un identifiant à part.
            direction = essai.reglages.get("angle", "face")
            images = [_image_pour(direction, i) for i in range(nombre_images)]
            etat.images[identifiant] = images
            etat.rendus.setdefault(personnage, []).append({
                "identifiant": identifiant, "actif": False, "etat": "termine",
                "images": [f"/api/essais/{identifiant}/images/{i}.png" for i in range(nombre_images)],
                "reglages": essai.reglages,
            })
        etat.essais[identifiant] = essai
        etat.cles[cle] = identifiant
        return {"identifiant": identifiant}

    @app.get("/api/atelier/stages/by-key/{cle}")
    def by_key(cle: str):
        if cle not in etat.cles:
            return Response(status_code=404)
        return {"identifiant": etat.cles[cle]}

    @app.get("/api/essais/{identifiant}")
    def essai(identifiant: str):
        # Forme plate : `identifiant`, `personnage`, `etat` — celle que le vrai
        # contrat rend (voir `tests/test_pont_asset3d.py`, `Essai.pour_page`) et
        # que `interface/src/api-3d.ts` type comme `resultat_3d`.
        e = etat.essais[identifiant]
        return {"identifiant": identifiant, "personnage": e.personnage, "etat": "termine"}

    @app.get("/api/essais/{identifiant}/modele.glb")
    def modele_glb(identifiant: str):
        e = etat.essais.get(identifiant)
        if not e or e.etape != "modele_3d":
            return Response(status_code=404)
        return Response(_glb_minimal(), media_type="model/gltf-binary")

    @app.get("/api/essais/{identifiant}/rig.glb")
    def rig_glb(identifiant: str):
        e = etat.essais.get(identifiant)
        if not e or e.etape != "rig":
            return Response(status_code=404)
        return Response(_glb_minimal(), media_type="model/gltf-binary")

    @app.get("/api/personnages/{personnage}/rendus")
    def rendus(personnage: str):
        return {"rendus": etat.rendus.get(personnage, [])}

    @app.get("/api/essais/{rendu_id}/images/{rang}.png")
    def frame(rendu_id: str, rang: int):
        images = etat.images.get(rendu_id)
        if images is None or rang >= len(images):
            return Response(status_code=404)
        return Response(images[rang], media_type="image/png")

    return app


# ── La mesure, sur des pixels réellement reçus ──────────────────────────────

def mesurer_silhouette(png: bytes) -> dict:
    """Hauteur, largeur et position des pieds du personnage, lues sur l'alpha."""
    with Image.open(io.BytesIO(png)) as image:
        image = image.convert("RGBA")
        largeur_canevas, hauteur_canevas = image.size
        bbox = image.split()[-1].getbbox()
    if bbox is None:
        return {"largeur_canevas": largeur_canevas, "hauteur_canevas": hauteur_canevas, "vide": True}
    gauche, haut, droite, bas = bbox
    return {
        "largeur_canevas": largeur_canevas, "hauteur_canevas": hauteur_canevas, "vide": False,
        "hauteur_apparente_px": bas - haut, "largeur_apparente_px": droite - gauche,
        "pivot_x_frac": round((gauche + (droite - gauche) / 2) / largeur_canevas, 4),
        "pivot_y_frac": round(bas / hauteur_canevas, 4),
    }


def comparer_directions(mesures: dict[str, dict]) -> dict:
    """Le verdict : cadre et pivot cohérents entre les directions, ou pas — avec les écarts chiffrés."""
    valides = {d: m for d, m in mesures.items() if not m.get("vide")}
    raisons = []
    for d, m in mesures.items():
        if m.get("vide"):
            raisons.append(f"« {d} » : aucun pixel non transparent trouvé dans l'image reçue.")
    dimensions = {(m["largeur_canevas"], m["hauteur_canevas"]) for m in valides.values()}
    if len(dimensions) > 1:
        raisons.append(f"les canevas ne mesurent pas la même taille selon la direction : {dimensions}.")
    ecart_hauteur_pct = ecart_pivot = 0.0
    if len(valides) >= 2:
        hauteurs = {d: m["hauteur_apparente_px"] for d, m in valides.items()}
        moyenne_h = mean(hauteurs.values())
        ecart_hauteur_pct = (max(hauteurs.values()) - min(hauteurs.values())) / moyenne_h if moyenne_h else 0.0
        if ecart_hauteur_pct > SEUIL_HAUTEUR_PCT:
            pire = sorted(hauteurs.items(), key=lambda kv: kv[1])
            raisons.append(
                f"la taille apparente du personnage varie de {ecart_hauteur_pct:.0%} entre les directions "
                f"(la plus petite : « {pire[0][0]} » à {pire[0][1]} px, la plus grande : « {pire[-1][0]} » à {pire[-1][1]} px) "
                f"— au-delà du seuil toléré ({SEUIL_HAUTEUR_PCT:.0%}). C'est ce que le cadrage indépendant par direction "
                "peut produire (voir le relevé).")
        pivots = {d: m["pivot_y_frac"] for d, m in valides.items()}
        ecart_pivot = max(pivots.values()) - min(pivots.values())
        if ecart_pivot > SEUIL_PIVOT_FRACTION:
            pire = sorted(pivots.items(), key=lambda kv: kv[1])
            raisons.append(
                f"la position des pieds dans l'image varie de {ecart_pivot:.1%} de la hauteur du canevas entre "
                f"les directions (« {pire[0][0]} » à {pire[0][1]:.1%}, « {pire[-1][0]} » à {pire[-1][1]:.1%}) "
                f"— au-delà du seuil toléré ({SEUIL_PIVOT_FRACTION:.0%}).")
    return {
        "coherent": not raisons,
        "raisons": raisons,
        "ecart_hauteur_pct": round(ecart_hauteur_pct, 4),
        "ecart_pivot_fraction": round(ecart_pivot, 4),
    }


# ── L'orchestration réelle : modèle → squelette → un rendu par direction ───

async def _attendre_travail(client, projet: str, identifiant: str, *, libelle: str) -> dict:
    r = client.post(f"/api/projects/{projet}/production-jobs/{identifiant}/start")
    assert r.status_code == 200, r.text
    while True:
        r = client.get(f"/api/projects/{projet}/production-jobs/{identifiant}", params={"attente": 5})
        assert r.status_code == 200, r.text
        travail = r.json()
        if travail["etat"] == "termine":
            return travail
        if travail["etat"] not in ("en_cours", "prepare", "a_reprendre"):
            raise RuntimeError(f"{libelle} : état inattendu « {travail['etat']} » — {travail.get('raison', '')}")


async def _lancer_etape(client, projet: str, *, cle: str, etape: str, personnage_externe: str,
                         personnage: str, pose: str, direction: str | None, angle: str) -> dict:
    """Lance une étape « rig » ou « rendu », toujours à partir d'un personnage
    externe déjà connu d'asset3d (le modèle 3D n'est fabriqué qu'une fois)."""
    corps = {"cle": cle, "etape": etape, "personnage": personnage, "pose": pose, "direction": direction,
             "reglages": {"animation": pose, "angle": angle}, "personnage_externe": personnage_externe}
    r = client.post(f"/api/projects/{projet}/3d/jobs/prepare", json=corps)
    assert r.status_code == 200, r.text
    return await _attendre_travail(client, projet, r.json()["identifiant"], libelle=f"{etape} ({direction or 'sans direction'})")


async def executer_mesure(*, adresse: str, transport, mode: str, directions: tuple[str, ...], pose: str,
                           reference: Path | None, sortie: Path) -> dict:
    sortie.mkdir(parents=True, exist_ok=True)
    dossier_atelier = sortie / "atelier"

    # Fournisseur et animateur doublés : ce script ne fabrique jamais d'image ni
    # de vidéo payante — seuls les appels HTTP 3D (locaux ou vers asset3d) sont réels.
    atelier = Atelier(racine=dossier_atelier, fabrique_fournisseur=lambda: FournisseurDouble(),
                       fabrique_animateur=lambda: AnimateurMuet())
    atelier.sources_3d.transport = transport
    atelier.sources_3d.configurer(adresse)

    with TestClient(creer_application(atelier), base_url="http://localhost") as client:
        r = client.put("/api/universe", json={"vue": "vue-dessus-34"})
        assert r.status_code == 200, r.text
        objectif = {
            "sorties": [{"nature": "animation", "pose": pose, "direction": d} for d in directions],
            "largeur": 96, "hauteur": 128, "cadence": 8.0, "boucle": True, "repere": {"x": 48.0, "y": 120.0},
        }
        r = client.post("/api/characters", json={"nom": "Mesure AU11", "objectif": objectif})
        assert r.status_code == 201, r.text
        personnage = r.json()["personnage"]["identifiant"]
        projet = atelier.bibliotheque.courant

        octets_reference = reference.read_bytes() if reference else silhouette_reference()
        r = client.post("/api/assets/upload", content=octets_reference,
                         params={"nom": "reference-au11.png", "projet": projet, "traiter": "false"})
        assert r.status_code == 201, r.text
        asset_reference = r.json()["asset"]["identifiant"]

        print("→ étape 1/3 — modèle 3D (une fois pour toutes les directions)…", flush=True)
        corps_modele = {"cle": "au11-cadre-modele", "etape": "modele_3d", "personnage": personnage,
                         "pose": pose, "direction": None, "reference_asset": asset_reference, "reglages": {}}
        r = client.post(f"/api/projects/{projet}/3d/jobs/prepare", json=corps_modele)
        assert r.status_code == 200, r.text
        modele = await _attendre_travail(client, projet, r.json()["identifiant"], libelle="modèle 3D")
        personnage_externe = modele["resultat_3d"]["personnage"]

        print("→ étape 2/3 — squelette (une fois pour toutes les directions)…", flush=True)
        await _lancer_etape(client, projet, cle="au11-cadre-rig", etape="rig", personnage_externe=personnage_externe,
                             personnage=personnage, pose=pose, direction=None, angle="face")

        mesures: dict[str, dict] = {}
        for i, direction in enumerate(directions, start=1):
            print(f"→ étape 3/3 — rendu « {direction} » ({i}/{len(directions)})…", flush=True)
            await _lancer_etape(client, projet, cle=f"au11-cadre-rendu-{direction}", etape="rendu",
                                 personnage_externe=personnage_externe, personnage=personnage, pose=pose,
                                 direction=direction, angle=direction)
            sources = [s for s in atelier.sources_3d.lister(projet, personnage)
                       if s.get("pose") == pose and s.get("direction") == direction]
            if not sources:
                raise RuntimeError(f"Aucune source 3D importée pour la direction « {direction} ».")
            source = sources[0]
            frame = atelier.sources_3d.fichier(projet, source["identifiant"], "frame-0000.png").read_bytes()
            mesures[direction] = {**mesurer_silhouette(frame), "source": source["identifiant"]}

    verdict = comparer_directions(mesures)
    resultat = {
        "date": time.strftime("%Y-%m-%dT%H:%M:%S"), "mode": mode, "adresse_asset3d": adresse,
        "pose": pose, "directions": list(directions), "mesures": mesures, "verdict": verdict,
    }
    (sortie / "mesures.json").write_text(json.dumps(resultat, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return resultat


# ── L'annonce, avant tout calcul réel ────────────────────────────────────────

def _asset3d_reel_disponible(adresse: str) -> bool:
    try:
        r = httpx.get(f"{adresse}/api/atelier/contract", timeout=2.0)
        contrat = r.json()
        return r.status_code == 200 and contrat.get("version") == 1 and \
            {"modele_3d", "rig", "rendu"} <= set(contrat.get("etapes", []))
    except Exception:
        return False


def imprimer_verdict(resultat: dict) -> None:
    print()
    print("─" * 72)
    print(f"Mode : {'RÉPÉTITION — aucun rendu réel' if resultat['mode'] == 'repetition' else 'mesure réelle'}")
    print(f"Personnage « {resultat['pose']} », directions : {', '.join(resultat['directions'])}")
    print()
    print(f"{'direction':<10} {'canevas':<10} {'hauteur px':<12} {'pieds (% hauteur)':<20}")
    for direction, m in resultat["mesures"].items():
        if m.get("vide"):
            print(f"{direction:<10} — rien mesuré dans l'image reçue")
            continue
        canevas = f"{m['largeur_canevas']}×{m['hauteur_canevas']}"
        print(f"{direction:<10} {canevas:<10} {m['hauteur_apparente_px']:<12} {m['pivot_y_frac']:.1%}")
    print()
    verdict = resultat["verdict"]
    if verdict["coherent"]:
        print("Verdict : COHÉRENT — cadre et pivot ne varient pas plus que la marge tolérée entre les directions.")
    else:
        print("Verdict : INCOHÉRENT — au moins un écart dépasse la marge tolérée :")
        for raison in verdict["raisons"]:
            print(f"  - {raison}")
    print("─" * 72)


def arguments(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--adresse", default=ADRESSE_DEFAUT, help=f"Adresse HTTP d'asset3d (défaut {ADRESSE_DEFAUT}).")
    p.add_argument("--pose", default=POSE_DEFAUT, help=f"Mouvement à rendre (défaut « {POSE_DEFAUT} »).")
    p.add_argument("--directions", default=",".join(DIRECTIONS_DEFAUT),
                    help="Directions séparées par des virgules, au moins trois (défaut nord,est,sud).")
    p.add_argument("--reference", type=Path, default=None, help="Image PNG à utiliser comme photo de départ.")
    p.add_argument("--repetition", action="store_true", help="Force la doublure, même si asset3d répond.")
    p.add_argument("--oui", action="store_true", help="Ne pas demander confirmation avant le calcul réel.")
    p.add_argument("--sortie", type=Path, default=SORTIE_DEFAUT, help="Dossier jetable de sortie.")
    return p.parse_args(argv)


def principal(argv=None) -> int:
    args = arguments(argv)
    directions = tuple(d.strip() for d in args.directions.split(",") if d.strip())
    if len(directions) < 3:
        print("[x] Indiquez au moins trois directions séparées par des virgules (--directions).")
        return 1

    if args.repetition:
        reel = False
    else:
        print(f"Vérification d'asset3d à {args.adresse}…")
        reel = _asset3d_reel_disponible(args.adresse)

    if not reel:
        print()
        print("aucun rendu réel, ceci est une répétition")
        print("(pas de GPU sollicité, pas d'appel à asset3d — une doublure locale répond à sa place)")
        resultat = asyncio.run(executer_mesure(
            adresse=args.adresse, transport=httpx.ASGITransport(app=construire_double_asset3d()),
            mode="repetition", directions=directions, pose=args.pose, reference=args.reference, sortie=args.sortie))
        imprimer_verdict(resultat)
        return 0

    n = len(directions)
    print()
    print("─" * 72)
    print("CE SCRIPT VA LANCER UN CALCUL RÉEL SUR VOTRE MACHINE.")
    print(f"Il va demander à asset3d ({args.adresse}) de fabriquer, sur votre carte graphique :")
    print("  1 modèle 3D, 1 squelette, puis 1 rendu par direction demandée")
    print(f"  ({n} directions : {', '.join(directions)}).")
    print("Coût : du temps machine et de l'électricité — aucun argent, aucun appel à un")
    print("fournisseur payant à aucune étape (l'image de départ est dessinée localement).")
    print(f"Durée estimée : quelques minutes pour le modèle et le squelette (une fois), puis")
    print(f"environ 1 à 5 minutes par rendu selon votre carte — soit, pour {n} directions,")
    print(f"grossièrement entre {5 + n} et {15 + 5 * n} minutes au total. Ce n'est qu'une estimation :")
    print("ce script n'a pas encore mesuré votre machine.")
    print("─" * 72)
    if not args.oui:
        reponse = input("Lancer ce calcul réel ? (oui/non) ").strip().lower()
        if reponse not in ("oui", "o", "yes", "y"):
            print("Annulé — rien n'a été lancé.")
            return 1

    resultat = asyncio.run(executer_mesure(
        adresse=args.adresse, transport=None, mode="reel", directions=directions, pose=args.pose,
        reference=args.reference, sortie=args.sortie))
    imprimer_verdict(resultat)
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
