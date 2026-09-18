# -*- coding: utf-8 -*-
"""Un atelier jetable pour vérifier au navigateur les écrans **du son**
(chantier SN0-SN12, `docs/PLAN-son.md`), sans toucher à celui de l'auteur.

**Avant de le lancer : construire l'interface.**

    npm --prefix interface run build

Cet atelier sert `interface/dist` telle qu'elle est sur le disque au moment du
lancement — sans ce `build`, on regarde l'ancienne interface.

**L'auteur travaille sur le port 8420, et trois agents écrivent dans
`atelier/` et `interface/` pendant la séance.** Cet atelier-ci vit sur un
dossier temporaire, sur le port **8510**, et ne touche à rien de tout ça.
Modèle : `essais/atelier_jetable_au20.py` (dossier jetable, port à part,
fournisseur double, peuplement par les routes HTTP, uvicorn).

ComfyUI est doublé **en mémoire** — le transport `httpx.MockTransport`, pas un
vrai serveur. Son `/object_info` porte les fichiers de Small-SFX, ACE-Step et
YuE2 ; **pas** ceux de Stable Audio 3 Medium, pour voir un moteur grisé dans
l'assistant d'installation. Chaque tirage rend un son **différent et
audible**, synthétisé en numpy à partir de sa graine (bruit filtré à enveloppe
percussive pour un bruitage, quelques notes en boucle pour une musique), et
« prend » 1 à 2 secondes pour qu'on voie les tirages d'une série arriver un à
un. Une graine sur huit rend un son saturé, pour voir l'avertissement.

Ce que l'atelier peuple, par les vraies routes HTTP :

1. l'univers « Les marais d'ambre », avec son bloc sonore (époque et matière,
   rendu 16-bit, orchestre, humeur, ré mineur, 90 BPM) ;
2. les méthodes sonores installées (Small-SFX, ACE-Step, YuE2 — Stable Audio 3
   Medium reste grisé, poids absents) ;
3. un son importé, **sans famille** (pour voir « poser une famille ») ;
4. une ambiance de 20 s déjà rendue, dont la boucle **claque** (pour « écouter
   le raccord ») ;
5. un son rétro sfxr ;
6. une série de bruitage déjà terminée, et un jeu de quatre variantes gardées.

    py essais/atelier_jetable_son.py

Ctrl-C pour l'arrêter. Le dossier temporaire part avec lui.
"""

from __future__ import annotations

import copy
import json
import socket
import sys
import tempfile
import time
from pathlib import Path

import httpx
import numpy as np
import uvicorn
from fastapi.testclient import TestClient

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "tests"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from atelier.audio.graphes import CONSTRUCTEURS  # noqa: E402
from atelier.audio.traitement import encoder  # noqa: E402
from atelier.domaine.workflow import normaliser  # noqa: E402
from atelier.services import Atelier  # noqa: E402
from atelier.api.app import creer_application  # noqa: E402
from tests.conftest import AnimateurMuet, FournisseurDouble  # noqa: E402
from tests.test_sn1_profils_son import OBJECT_INFO, installe  # noqa: E402

PORT = 8510
TAUX = 22050  # léger : assez pour une écoute nette, des fichiers courts


def _verifier_port_libre(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        if s.connect_ex(("127.0.0.1", port)) == 0:
            raise SystemExit(
                f"Le port {port} est déjà occupé — cet atelier jetable ne "
                f"touche pas à celui de l'auteur (8420) : quelque chose "
                f"d'autre écoute sur {port}."
            )


# ── Le ComfyUI doublé : des sons différents, audibles, selon la graine ──────


def _objet_info_sonore() -> dict:
    """`/object_info` d'une machine qui a posé Small-SFX, ACE-Step et YuE2 —
    **pas** Stable Audio 3 Medium : un moteur à voir grisé dans l'assistant."""
    info = OBJECT_INFO
    for identifiant in ("sa3-small-sfx", "ace-step-15-turbo", "yue2-int8"):
        info = installe(info, normaliser(CONSTRUCTEURS[identifiant]()))
    return info


def _graine_du_graphe(graphe: dict) -> int:
    for noeud in graphe.values():
        if noeud["class_type"] == "KSampler":
            return int(noeud["inputs"]["seed"])
    return 0


def _est_musical(graphe: dict) -> bool:
    return any(
        n["class_type"] in ("TextEncodeAceStepAudio1.5", "YuE2GenerateMusic")
        for n in graphe.values()
    )


def _secondes_du_graphe(graphe: dict) -> float:
    for noeud in graphe.values():
        if noeud["class_type"] in (
            "EmptyLatentAudio", "EmptyAceStep1.5LatentAudio", "EmptyYuE2LatentAudio",
        ):
            try:
                return float(noeud["inputs"].get("seconds", 1.5))
            except (TypeError, ValueError):
                return 1.5
    return 1.5


def _bruitage(graine: int, secondes: float) -> np.ndarray:
    """Un bruit filtré à enveloppe percussive, entre 1 et 2 s : la coupure du
    filtre et la longueur de l'enveloppe varient avec la graine, pour qu'on
    entende deux tirages se distinguer."""
    rng = np.random.default_rng(graine)
    duree = max(1.0, min(2.0, secondes if secondes and secondes > 0 else 1.0 + (graine % 100) / 100))
    n = int(TAUX * duree)
    bruit = rng.standard_normal(n)
    coupure = 400 + (graine % 13) * 250
    alpha = coupure / (coupure + TAUX / (2 * np.pi))
    filtre = np.empty(n)
    valeur = 0.0
    for i in range(n):
        valeur += alpha * (bruit[i] - valeur)
        filtre[i] = valeur
    enveloppe = np.exp(-np.linspace(0, 5 + (graine % 6), n))
    signal = filtre * enveloppe
    pic = np.max(np.abs(signal)) or 1.0
    signal = (signal / pic) * 0.7
    return np.column_stack((signal, signal))


def _motif_musical(graine: int, secondes: float) -> np.ndarray:
    """Quelques notes en boucle : assez pour reconnaître une musique, sans
    fabriquer un vrai morceau."""
    rng = np.random.default_rng(graine)
    duree = max(4.0, min(8.0, secondes if secondes and secondes > 0 else 6.0))
    n = int(TAUX * duree)
    gamme = [220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0]
    notes = rng.choice(gamme, size=4, replace=True)
    t = np.arange(n) / TAUX
    pas = n // 4
    signal = np.zeros(n)
    for i, note in enumerate(notes):
        debut, fin = i * pas, n if i == 3 else (i + 1) * pas
        phase = t[debut:fin] - t[debut]
        enveloppe = np.clip(1 - phase / (pas / TAUX), 0, 1) ** 0.5
        signal[debut:fin] = 0.5 * np.sin(2 * np.pi * note * phase) * enveloppe
    return np.column_stack((signal, signal))


def _rendre_tirage(graphe: dict) -> bytes:
    graine = _graine_du_graphe(graphe)
    secondes = _secondes_du_graphe(graphe)
    signal = _motif_musical(graine, secondes) if _est_musical(graphe) else _bruitage(graine, secondes)
    if graine % 8 == 0:
        signal = signal * 6  # une graine sur huit : saturé, à dessein
    return encoder(signal, TAUX)


class ComfySonDouble:
    """ComfyUI doublé en mémoire (le transport de `tests/test_au7_au8.py`,
    étendu) : chaque travail rend un son différent selon sa graine, et met 1 à
    2 secondes à « calculer » pour que l'arrivée d'une série se voie tirage
    après tirage."""

    def __init__(self):
        self.informations = _objet_info_sonore()
        self.envois: list[dict] = []
        self._jobs: dict[str, dict] = {}
        self._pret_a: dict[str, float] = {}
        self._rendus: dict[str, bytes] = {}

    def repondre(self, requete: httpx.Request) -> httpx.Response:
        chemin = requete.url.path
        if chemin == "/object_info":
            return httpx.Response(200, json=copy.deepcopy(self.informations))
        if chemin == "/queue":
            return httpx.Response(200, json={"queue_running": [], "queue_pending": []})
        if chemin == "/upload/image":
            return httpx.Response(200, json={"name": "reference-enregistree.png"})
        if chemin == "/prompt":
            charge = json.loads(requete.content)
            self.envois.append(charge)
            numero = f"calcul-{len(self.envois)}"
            self._jobs[numero] = charge["prompt"]
            self._pret_a[numero] = time.monotonic() + 1.0 + (len(self.envois) % 5) * 0.2
            return httpx.Response(200, json={"prompt_id": numero})
        if chemin.startswith("/history/"):
            numero = chemin.rsplit("/", 1)[-1]
            if numero not in self._jobs or time.monotonic() < self._pret_a[numero]:
                return httpx.Response(200, json={})  # encore « en calcul »
            graphe = self._jobs[numero]
            noeud_sortie = next(i for i, n in graphe.items() if n["class_type"] == "SaveAudio")
            if numero not in self._rendus:
                self._rendus[numero] = _rendre_tirage(graphe)
            return httpx.Response(200, json={numero: {"status": {"completed": True}, "outputs": {
                noeud_sortie: {"audio": [{"filename": f"{numero}.wav", "subfolder": "asset-kitchen", "type": "output"}]},
            }}})
        if chemin == "/view":
            numero = requete.url.params.get("filename", "").rsplit(".", 1)[0]
            return httpx.Response(200, content=self._rendus.get(numero, b""), headers={"content-type": "audio/wav"})
        raise AssertionError((requete.method, str(requete.url)))


def raccorder(atelier: Atelier, comfy: ComfySonDouble) -> None:
    """La même bascule que `tests/test_au7_au8.raccorder` : tous les
    fournisseurs de workflow de l'atelier parlent au ComfyUI doublé."""
    transport = httpx.MockTransport(comfy.repondre)
    from atelier.fournisseur.workflow import MoteurWorkflow

    fabrique = lambda: MoteurWorkflow("http://comfy.test", transport)
    atelier.profils_workflow.fabrique_moteur = fabrique
    atelier.fournisseur_workflow_image.fabrique_moteur = fabrique
    atelier.fournisseur_workflow_image.intervalle = 0.01
    atelier.travaux_audio.intervalle = 0.05


# ── Le peuplement, par les vraies routes HTTP ───────────────────────────────


def _attendre(client: TestClient, chemin: str, *, jusqua: str, secondes: float = 60.0) -> dict:
    """Interroge `chemin` jusqu'à ce que sa réponse porte `etat == jusqua` —
    ce que l'écran ferait en sondant l'avancement d'une série."""
    fin = time.monotonic() + secondes
    while time.monotonic() < fin:
        reponse = client.get(chemin)
        corps = reponse.json()
        if corps.get("etat") == jusqua:
            return corps
        time.sleep(0.1)
    raise TimeoutError(f"{chemin} n'a pas atteint « {jusqua} » à temps : {corps}")


def peupler(atelier: Atelier) -> None:
    with TestClient(creer_application(atelier)) as client:
        # ── 1 · L'univers, avec son bloc sonore ─────────────────────────────
        cree = client.post("/api/projects", json={"nom": "Les marais d'ambre"})
        assert cree.status_code == 201, cree.text
        projet = cree.json()["projet"]["identifiant"]
        client.put("/api/projects/current", json={"projet": projet})
        reglage = client.put("/api/universe", params={"projet": projet}, json={"son": {
            "champs": [
                {"nom": "epoque", "texte": "Bronze-age salt marsh, sun-bleached amber and tar-caulked wood", "actif": True},
                {"nom": "rendu", "texte": "16-bit chiptune era, warm tape hiss", "actif": True},
                {"nom": "orchestre", "texte": "small folk ensemble: hurdy-gurdy, frame drum, low flute", "actif": True},
                {"nom": "humeur", "texte": "wary, briny, quietly ominous", "actif": True},
            ],
            "tonalite": "D minor", "tempo": 90,
        }})
        assert reglage.status_code == 200, reglage.text
        print(f"  univers « Les marais d'ambre » réglé ({projet}) — bloc sonore : ré mineur, 90 BPM")

        # ── 2 · Les méthodes sonores installées ─────────────────────────────
        installes = client.post("/api/workflow-profiles/install-sound").json()["moteurs"]
        prets = sorted(i for i, r in installes.items() if r["installe"])
        manquants = sorted(i for i, r in installes.items() if not r["installe"])
        print(f"  méthodes sonores posées : {', '.join(prets)}")
        print(f"  restent grisées, poids absents : {', '.join(manquants)}")

        # ── 3 · Un son importé, sans famille ────────────────────────────────
        importe = client.post(
            f"/api/projects/{projet}/sounds/import",
            params={"nom": "Grincement de porte (import).wav"},
            content=encoder(_bruitage(4242, 1.3), TAUX),
        )
        assert importe.status_code == 201, importe.text
        print(f"  son importé « Grincement de porte » sans famille ({importe.json()['identifiant']})")

        # ── 4 · Une ambiance de 20 s déjà rendue, boucle qui claque ─────────
        n = int(TAUX * 20)
        t = np.arange(n) / TAUX
        fond = 0.18 * np.sin(2 * np.pi * 180 * t) + 0.05 * np.random.default_rng(7).standard_normal(n)
        fond[-400:] += 0.5  # la fin ne referme pas sur le début : ça claque
        ambiance_octets = encoder(np.column_stack((fond, fond)), TAUX)
        ambiance = client.post(
            f"/api/projects/{projet}/sounds/import",
            params={"nom": "Marais la nuit, 20 s (ambiance).wav"},
            content=ambiance_octets,
        )
        assert ambiance.status_code == 201, ambiance.text
        ambiance_id = ambiance.json()["identifiant"]
        classee = client.put(f"/api/projects/{projet}/sounds/{ambiance_id}/family",
            json={"revision": 1, "famille": "ambiance"})
        assert classee.status_code == 200, classee.text
        print(f"  ambiance « Marais la nuit » (20 s, raccord qui claque) ({ambiance_id})")

        # ── 5 · Un son rétro sfxr ────────────────────────────────────────────
        depart = sorted(client.get(f"/api/projects/{projet}/sounds/sfxr/starts").json())[0]
        retro = client.post(f"/api/projects/{projet}/sounds/sfxr",
            json={"depart": depart, "graine": 12, "nom": f"Rétro — {depart}"})
        assert retro.status_code == 201, retro.text
        print(f"  son rétro sfxr « {depart} » ({retro.json()['identifiant']})")

        # ── 6 · Une série de bruitage terminée, et un jeu de quatre variantes
        serie = client.post(f"/api/projects/{projet}/audio-series/prepare", json={
            "cle": "pas-sur-la-vase", "famille": "bruitage", "nombre": 4,
            "prompt": "Single footstep of a leather boot sinking into wet mud",
        })
        assert serie.status_code == 200, serie.text
        serie_id = serie.json()["identifiant"]
        demarree = client.post(f"/api/projects/{projet}/audio-series/{serie_id}/start")
        assert demarree.status_code == 200, demarree.text
        print("  série « Pas sur la vase » lancée (4 tirages, ~1 à 2 s chacun)…")
        finie = _attendre(client, f"/api/projects/{projet}/audio-series/{serie_id}", jusqua="terminee")
        jeu = client.post(f"/api/projects/{projet}/audio-series/{serie_id}/keep",
            json={"rangs": [1, 2, 3, 4], "nom": "Pas sur la vase"})
        assert jeu.status_code == 201, jeu.text
        print(f"  série terminée, {finie['compte']} — jeu de variantes « Pas sur la vase » ({jeu.json()['identifiant']})")


def principal() -> int:
    _verifier_port_libre(PORT)
    dossier = Path(tempfile.mkdtemp(prefix="atelier-son-"))
    print(f"Dossier jetable : {dossier}")

    comfy = ComfySonDouble()
    atelier = Atelier(
        racine=dossier,
        fabrique_fournisseur=lambda: FournisseurDouble(),
        fabrique_animateur=lambda: AnimateurMuet(),
    )
    raccorder(atelier, comfy)
    peupler(atelier)

    print(f"\nAtelier jetable sur http://127.0.0.1:{PORT} — Ctrl-C pour arrêter")
    print("(celui de l'auteur, sur 8420, n'a pas été touché ; rien n'a été payé)")
    print("  Rappel : interface/dist doit venir d'un `npm --prefix interface run build` frais.")
    print()
    print("Ce qu'il faut regarder :")
    print("  → L'assistant d'installation des méthodes sonores : Small-SFX, ACE-Step et YuE2")
    print("    sont proposés prêts ; Stable Audio 3 Medium est grisé, avec le fichier qui manque,")
    print("    son dossier et sa page de téléchargement.")
    print("  → L'univers « Les marais d'ambre » : le bloc sonore (époque, rendu, orchestre,")
    print("    humeur, ré mineur, 90 BPM) et le texte composé qui en sort avant de lancer.")
    print("  → Le son « Grincement de porte » : sans famille, l'écran propose « poser une famille ».")
    print("  → L'ambiance « Marais la nuit » : écouter le raccord seul (les deux secondes autour) —")
    print("    il claque, exprès.")
    print("  → Le son rétro sfxr : ses réglages se rouvrent, et il se refait à l'identique.")
    print("  → La série « Pas sur la vase » : quatre tirages, chacun un son différent (écoute au")
    print("    clavier), et le jeu de variantes qui les garde tous les quatre.")
    print("  → Relancer une série neuve depuis l'écran : les tirages arrivent un par un, 1 à 2 s")
    print("    chacun, et une graine sur huit affiche l'avertissement de saturation.")
    uvicorn.run(creer_application(atelier), host="127.0.0.1", port=PORT, log_level="warning")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
