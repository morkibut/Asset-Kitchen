# -*- coding: utf-8 -*-
"""Le banc de l'export — l'archive ouverte, et chaque fiche confrontée à son fichier.

**Il ne coûte rien, et il ne demande rien au réseau.** Exporter est du disque et
du processeur : ce banc lit ce que l'atelier a déjà, fabrique une archive par la
route, et la rouvre. Aucun appel, aucune clé.

Il existe parce que l'export est **le seul geste du produit dont personne ne voit
le résultat au moment où il le fait.** Une génération se regarde dans la grille,
une retouche se regarde dans la fiche ; une archive, on la découvre une semaine
plus tard, dans un moteur de jeu, sur une autre machine. `tests/test_t6.py`
vérifie la chaîne sur des images fabriquées pour l'occasion — celui-ci la vérifie
sur **ce que l'atelier contient vraiment** : des sprites de 64 px détourés et
quantifiés, des assets qu'on n'a jamais traités, des labels qui sont des prompts
tronqués, des découpes filiées sur leur planche.

Quatre questions, dans cet ordre :

1. **L'archive s'ouvre-t-elle ?** `zipfile` la relit, `json` relit le descriptif.
2. **Chaque fiche dit-elle la vérité sur son fichier ?** Les dimensions annoncées
   sont remesurées par Pillow sur les octets qui partent, jamais crues.
3. **Reste-t-il de quoi rejouer ?** Prompt, réglages résolus, recette, filiation.
4. **Deux images ne se recouvrent-elles pas ?** Un lot de variations porte
   plusieurs fois le même label, et `zipfile` accepte les doublons sans broncher.

    Lancer :  py -m atelier --sans-navigateur   (dans un autre terminal)
              py essais/essai_export.py
              py essais/essai_export.py --port 8421

Sortie : ce journal, et `essais/mesures_export.json`.
"""

from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.request
import zipfile
from email.message import Message
from pathlib import Path
from typing import Any

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from PIL import Image  # noqa: E402

MESURES = RACINE / "mesures_export.json"


def _appeler(port: int, chemin: str, corps: Any = None) -> tuple[Message, bytes]:
    donnees = json.dumps(corps).encode("utf-8") if corps is not None else None
    requete = urllib.request.Request(
        f"http://localhost:{port}{chemin}",
        data=donnees,
        headers={"Content-Type": "application/json"},
        method="POST" if corps is not None else "GET",
    )
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        # **Les en-têtes, pas un `dict` d'en-têtes.** Starlette les envoie en
        # minuscules ; `dict(...)` perd l'insensibilité à la casse d'un
        # `HTTPMessage`, et « Content-Disposition » ressort vide.
        return reponse.headers, reponse.read()


def main() -> int:
    # Windows encode la sortie redirigée en cp1252 : un simple « ── » lève.
    # Trois lignes, jamais « on verra si ça pose problème » (`AGENTS.md`).
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    port = 8420
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])

    print("Banc de l'export — l'archive, ouverte")
    print(f"atelier sur le port {port} · aucun appel au fournisseur, aucun coût\n")

    try:
        _, brut = _appeler(port, "/api/assets?tous=true&limite=1000")
    except (urllib.error.URLError, OSError) as erreur:
        print(f"l'atelier ne répond pas sur {port} — {erreur}")
        print("lancer d'abord :  py -m atelier --sans-navigateur")
        return 1

    assets = json.loads(brut)["assets"]
    if not assets:
        print("la bibliothèque est vide — rien à exporter, et c'est un état, pas un échec")
        return 0

    identifiants = [a["identifiant"] for a in assets]
    print(f"{len(identifiants)} assets dans la bibliothèque")

    entetes, octets = _appeler(port, "/api/exports", {"identifiants": identifiants})
    nom = entetes.get("Content-Disposition", "")
    print(f"archive : {nom}")
    print(f"          {len(octets) / 1024:.1f} Ko · {entetes.get('Content-Type')}\n")

    archive = zipfile.ZipFile(io.BytesIO(octets))
    descriptif = json.loads(archive.read("descriptif.json").decode("utf-8"))
    fiches = descriptif["assets"]

    # ── Chaque fiche, confrontée à son fichier ───────────────────────────────
    #
    # Les dimensions annoncées sont **remesurées** sur les octets qui partent.
    # C'est l'invariant de T1 poussé jusqu'à l'archive : on ne croit pas ce qui
    # est écrit, on regarde le fichier.
    ecarts: list[str] = []
    releve: list[dict[str, Any]] = []
    print(f"{'':4}{'dimensions':>12}  {'octets':>9}  {'prompt':<7}{'filiation':<10} nom")
    for fiche in fiches:
        try:
            contenu = archive.read(fiche["fichier"])
        except KeyError:
            ecarts.append(f"{fiche['identifiant']} : « {fiche['fichier']} » absent de l'archive")
            continue
        with Image.open(io.BytesIO(contenu)) as image:
            mesure = image.size
            format_ = image.format
        annonce = (fiche["dimensions"]["largeur"], fiche["dimensions"]["hauteur"])
        accord = mesure == annonce
        if not accord:
            ecarts.append(
                f"{fiche['identifiant']} : annoncé {annonce[0]}×{annonce[1]}, mesuré {mesure[0]}×{mesure[1]}"
            )
        if format_ != "PNG":
            ecarts.append(f"{fiche['identifiant']} : {format_} au lieu de PNG")
        appel = fiche.get("generation")
        filiation = fiche["filiation"]
        lien = (
            "parent" + (" ✗" if filiation["parent_supprime"] else "")
            if filiation["parent"]
            else (f"{len(filiation['enfants'])} enf." if filiation["enfants"] else "—")
        )
        print(
            f"{'OK ' if accord else 'NON':4}"
            f"{mesure[0]:>5}×{mesure[1]:<6}  {len(contenu) / 1024:>7.1f} Ko  "
            f"{'oui' if appel and appel['prompt'] else 'NON':<7}{lien:<10} "
            f"{fiche['fichier'][:52]}"
        )
        releve.append(
            {
                "identifiant": fiche["identifiant"],
                "fichier": fiche["fichier"],
                "dimensions": list(mesure),
                "brut": [fiche["brut"]["largeur"], fiche["brut"]["hauteur"]],
                "octets": len(contenu),
                "traite": not _recette_vide(fiche["recette"]),
                "prompt": bool(appel and appel["prompt"]),
                "reglages_resolus": bool(appel and appel["reglages_resolus"]),
                "parent": filiation["parent"],
                "enfants": len(filiation["enfants"]),
            }
        )

    # ── Ce que le lot dit de lui-même ────────────────────────────────────────
    noms = [f["fichier"] for f in fiches]
    if len(set(noms)) != len(noms):
        ecarts.append(f"{len(noms) - len(set(noms))} noms de fichier en double")
    dans_archive = {n for n in archive.namelist() if n != "descriptif.json"}
    if dans_archive != set(noms):
        ecarts.append("le descriptif et l'archive ne portent pas les mêmes fichiers")
    sans_prompt = [r["identifiant"] for r in releve if not r["prompt"]]
    non_traites = [r for r in releve if not r["traite"]]

    print()
    print(f"noms uniques         : {len(set(noms))}/{len(noms)}")
    print(f"prompt retrouvé      : {len(releve) - len(sans_prompt)}/{len(releve)}")
    print(f"jamais traités       : {len(non_traites)} — ils sortent tels qu'ils sont arrivés")
    if non_traites:
        plus_gros = max(non_traites, key=lambda r: r["octets"])
        print(
            f"                       le plus lourd : {plus_gros['dimensions'][0]}×"
            f"{plus_gros['dimensions'][1]}, {plus_gros['octets'] / 1024:.0f} Ko"
        )

    # ── Le refus d'une sélection vide, par la même route ─────────────────────
    try:
        _appeler(port, "/api/exports", {"identifiants": []})
        ecarts.append("une sélection vide n'a pas été refusée")
    except urllib.error.HTTPError as refus:
        charge = json.loads(refus.read().decode("utf-8"))
        print(f"sélection vide       : {refus.code} · {charge['code']} · « {charge['raison']} »")
        if charge["code"] != "export_refuse":
            ecarts.append(f"refus inattendu : {charge['code']}")

    MESURES.write_text(
        json.dumps(
            {"archive": nom, "octets": len(octets), "assets": releve, "ecarts": ecarts},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nrelevé écrit dans {MESURES.relative_to(RACINE.parent)}")

    if ecarts:
        print(f"\n{len(ecarts)} écart(s) :")
        for ecart in ecarts:
            print(f"  · {ecart}")
        return 1
    print("\nl'archive dit la vérité sur chacun de ses fichiers.")
    return 0


def _recette_vide(recette: dict[str, Any]) -> bool:
    """Une recette vide veut dire « au brut » — et le brut est alors ce qui part."""
    return not recette.get("passes") and not any(
        recette.get(place) for place in ("recadrage", "grille", "quantification", "bords")
    )


if __name__ == "__main__":
    raise SystemExit(main())
