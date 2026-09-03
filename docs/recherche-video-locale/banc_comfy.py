"""Le banc d'essai vidéo locale — un client ComfyUI minimal, hors du produit.

**Ce fichier ne fait pas partie de l'atelier.** Il vit dans le dossier de
recherche parce qu'il ne sert qu'à répondre à une question : *une carte de 8 Go
sait-elle animer notre nain, et à quel prix en temps ?* Le jour où la réponse est
oui, c'est le produit qui portera le code, pas celui-ci.

Tout ce qu'il sait faire tient en cinq gestes, et chacun est repris de
`MySpriteAi/server/comfyui.ts`, qui les a déjà éprouvés sur cette machine :

1. **demander** — `POST /prompt` avec un montage au **format API** (le
   dictionnaire plat `{"<id>": {class_type, inputs}}`), pas le format d'export
   de l'éditeur, qui est refusé ;
2. **déposer une image** — `POST /upload/image`, toujours sous le même nom :
   `LoadImage` calcule l'empreinte du contenu, jamais du nom, donc écraser est
   sans danger et évite d'accumuler un fichier par essai ;
3. **attendre** — `GET /history/{id}` jusqu'à ce que le travail soit fini ou en
   erreur ; on relit `status.messages` pour dire *pourquoi* quand ça casse ;
4. **récupérer** — `GET /view?filename=…&subfolder=…&type=…`, qui rend aussi
   bien une image qu'une vidéo ;
5. **libérer** — `POST /free`, indispensable ici : sur 8 Go, un modèle resté
   chargé fait échouer le suivant, et l'erreur ressemble alors à un défaut du
   montage alors que c'est un défaut de ménage.

**Le relevé de mémoire, et le piège qu'il évite.** `/system_stats` rend deux
chiffres qui ne disent pas la même chose : `torch_vram_total` ne compte que ce
que PyTorch a réservé — il ignore le bureau, le navigateur et la fenêtre de
ComfyUI —, tandis que `vram_free` compte la carte entière. Relevé sur cette
machine le 26 août 2026 : 64 Mo contre 899 Mo au même instant. **On lit
`vram_free`, jamais l'autre**, sinon on croit avoir de la place qu'on n'a pas.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path

BASE = "http://127.0.0.1:8188"
CLIENT = f"banc-video-{uuid.uuid4().hex[:8]}"

GO = 1024**3


class BancErreur(RuntimeError):
    """Une panne dite en français, avec ce qu'il faut faire ensuite."""


# ── Les cinq gestes ──────────────────────────────────────────────────────────


def _requete(chemin: str, corps: dict | None = None, *, delai: float = 60.0) -> dict:
    url = f"{BASE}{chemin}"
    donnees = json.dumps(corps).encode() if corps is not None else None
    entetes = {"Content-Type": "application/json"} if corps is not None else {}
    requete = urllib.request.Request(url, data=donnees, headers=entetes)
    try:
        with urllib.request.urlopen(requete, timeout=delai) as reponse:
            brut = reponse.read()
            return json.loads(brut) if brut else {}
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode("utf-8", "replace")[:2000]
        raise BancErreur(f"ComfyUI a refusé {chemin} (code {erreur.code}) : {detail}") from erreur
    except OSError as erreur:
        raise BancErreur(
            f"ComfyUI est injoignable sur {BASE}. Vérifie que la fenêtre ComfyUI est "
            f"ouverte et que le serveur a bien démarré (son journal doit dire "
            f"« To see the GUI go to: {BASE} »). Détail : {erreur}"
        ) from erreur


def etat() -> dict:
    """Versions, carte, mémoire. Le premier appel de toute séance."""
    return _requete("/system_stats", delai=10)


def vram_libre_octets() -> int:
    """La mémoire réellement libre sur la carte — pas ce que PyTorch a réservé."""
    appareils = etat().get("devices") or [{}]
    return int(appareils[0].get("vram_free") or 0)


def deposer_image(chemin: Path, nom: str = "banc-entree.png") -> str:
    """Dépose une image dans le dossier d'entrée de ComfyUI, toujours sous le même nom."""
    frontiere = uuid.uuid4().hex
    octets = chemin.read_bytes()
    morceaux = []
    for cle, valeur in (("type", "input"), ("overwrite", "true")):
        morceaux.append(
            f"--{frontiere}\r\nContent-Disposition: form-data; name=\"{cle}\"\r\n\r\n{valeur}\r\n".encode()
        )
    morceaux.append(
        f"--{frontiere}\r\nContent-Disposition: form-data; name=\"image\"; "
        f"filename=\"{nom}\"\r\nContent-Type: image/png\r\n\r\n".encode()
    )
    morceaux.append(octets)
    morceaux.append(f"\r\n--{frontiere}--\r\n".encode())
    corps = b"".join(morceaux)

    requete = urllib.request.Request(
        f"{BASE}/upload/image",
        data=corps,
        headers={"Content-Type": f"multipart/form-data; boundary={frontiere}"},
    )
    with urllib.request.urlopen(requete, timeout=120) as reponse:
        rendu = json.loads(reponse.read())
    if not rendu.get("name"):
        raise BancErreur("ComfyUI a pris l'image mais n'a pas dit sous quel nom il l'a rangée.")
    return rendu["name"]


def liberer() -> None:
    """Décharge les modèles. Sur 8 Go, ce n'est pas du confort, c'est la condition."""
    try:
        _requete("/free", {"unload_models": True, "free_memory": True}, delai=60)
    except BancErreur:
        pass  # une version trop ancienne n'a pas /free ; le banc continue


@dataclass
class Resultat:
    """Ce qu'un tirage a produit, et ce qu'il a coûté en temps et en mémoire."""

    fichiers: list[dict] = field(default_factory=list)
    secondes: float = 0.0
    vram_avant_octets: int = 0
    vram_creux_octets: int = 0
    erreur: str = ""

    @property
    def vram_prise_go(self) -> float:
        return (self.vram_avant_octets - self.vram_creux_octets) / GO


def _pourquoi(statut: dict) -> str:
    """Ce que ComfyUI raconte d'un travail cassé, ramené à une phrase utile."""
    messages = statut.get("messages") or []
    panne = next((m[1] for m in messages if m and m[0] == "execution_error"), {})
    brut = panne.get("exception_message") or ""
    etape = f" (étape {panne['node_type']})" if panne.get("node_type") else ""
    if "out of memory" in brut.lower() or "allocate" in brut.lower():
        return (
            f"MÉMOIRE ÉPUISÉE{etape}. C'est la réponse la plus intéressante du banc : "
            f"note la résolution et le nombre d'images demandés, puis redescends d'un cran. "
            f"Détail : {brut[:400]}"
        )
    return f"ComfyUI a échoué{etape} : {brut[:600]}"


def tirer(montage: dict, *, delai_max: float = 3600.0, pas: float = 2.0) -> Resultat:
    """Un tirage complet : on demande, on surveille la mémoire, on attend, on récupère."""
    resultat = Resultat()
    liberer()
    resultat.vram_avant_octets = vram_libre_octets()
    resultat.vram_creux_octets = resultat.vram_avant_octets

    depart = time.monotonic()
    rendu = _requete("/prompt", {"prompt": montage, "client_id": CLIENT}, delai=60)
    identifiant = rendu.get("prompt_id")
    if not identifiant:
        raise BancErreur("ComfyUI a pris la demande sans rendre d'identifiant de travail.")

    limite = depart + delai_max
    while time.monotonic() < limite:
        # On relève le creux de mémoire pendant le calcul : c'est le chiffre qui
        # dit si le montage tient, et de combien il tient.
        try:
            libre = vram_libre_octets()
            resultat.vram_creux_octets = min(resultat.vram_creux_octets, libre)
        except BancErreur:
            pass

        histoire = _requete(f"/history/{identifiant}", delai=30)
        entree = histoire.get(identifiant)
        if entree:
            statut = entree.get("status") or {}
            if statut.get("status_str") == "error":
                resultat.erreur = _pourquoi(statut)
                resultat.secondes = time.monotonic() - depart
                return resultat
            if statut.get("completed"):
                for sortie in (entree.get("outputs") or {}).values():
                    for genre in ("images", "gifs", "videos", "audio"):
                        for reference in sortie.get(genre) or []:
                            if isinstance(reference, dict) and reference.get("filename"):
                                resultat.fichiers.append({**reference, "genre": genre})
                resultat.secondes = time.monotonic() - depart
                if not resultat.fichiers:
                    resultat.erreur = (
                        "Le montage s'est terminé sans rien produire de récupérable. "
                        "Il lui manque une étape qui enregistre le résultat."
                    )
                return resultat
        time.sleep(pas)

    resultat.secondes = time.monotonic() - depart
    resultat.erreur = f"Rien rendu au bout de {delai_max:.0f} s. Regarde la fenêtre de ComfyUI."
    return resultat


def recuperer(reference: dict, vers: Path) -> Path:
    """Rapatrie un fichier produit — image ou vidéo, c'est la même adresse."""
    question = urllib.parse.urlencode(
        {
            "filename": reference["filename"],
            "subfolder": reference.get("subfolder", ""),
            "type": reference.get("type", "output"),
        }
    )
    with urllib.request.urlopen(f"{BASE}/view?{question}", timeout=300) as reponse:
        octets = reponse.read()
    vers.parent.mkdir(parents=True, exist_ok=True)
    vers.write_bytes(octets)
    return vers


# ── Ce qui est installé, dit en une ligne ────────────────────────────────────


def noeuds_disponibles(motifs: tuple[str, ...]) -> dict[str, list[str]]:
    """Les types de nœuds enregistrés qui contiennent l'un des motifs.

    C'est le relevé qui dit si un chemin est ouvert ou s'il demande une
    installation — et il se refait après chaque installation, jamais de mémoire.
    """
    catalogue = _requete("/object_info", delai=120)
    return {m: sorted(n for n in catalogue if m.lower() in n.lower()) for m in motifs}


def modeles_visibles(classe: str, champ: str) -> list[str]:
    """La liste des fichiers qu'un chargeur voit réellement — la seule preuve d'installation."""
    info = _requete(f"/object_info/{classe}", delai=30)
    entree = (info.get(classe, {}).get("input", {}).get("required", {}) or {}).get(champ)
    if not entree:
        return []
    # ComfyUI décrit ses listes de deux façons, et les deux coexistent ici.
    if isinstance(entree, list) and entree and isinstance(entree[0], list):
        return list(entree[0])
    if isinstance(entree, list) and len(entree) > 1 and isinstance(entree[1], dict):
        return list(entree[1].get("options") or [])
    return []


if __name__ == "__main__":
    stats = etat()
    appareil = (stats.get("devices") or [{}])[0]
    systeme = stats.get("system", {})
    print(f"ComfyUI      : {systeme.get('comfyui_version', '?')}  (python {systeme.get('python_version', '?')[:6]})")
    print(f"carte        : {appareil.get('name', '?')}")
    print(f"mémoire      : {appareil.get('vram_free', 0) / GO:.2f} Go libres sur {appareil.get('vram_total', 0) / GO:.2f} Go")
    print(f"nœuds        : {len(_requete('/object_info', delai=120))} types enregistrés")
    print()
    for motif, trouves in noeuds_disponibles(
        ("Wan", "LTX", "Cog", "Hunyuan", "Mochi", "Cosmos", "AnimateDiff", "SVD", "Video", "GGUF", "Interpolat")
    ).items():
        etiquette = f"{len(trouves):3d}"
        apercu = ", ".join(trouves[:8]) + (" …" if len(trouves) > 8 else "")
        print(f"  {motif:<12} {etiquette}  {apercu}")
