# -*- coding: utf-8 -*-
"""Le texte d'avant et le texte d'après, côte à côte — une fois (R7).

**Ce que ce script montre.** Le produit envoyait un pavé : la bible, le sujet,
les consignes de planche, une phrase sur les images, la caméra, séparés par des
lignes vides et rien d'autre. Depuis R7 il envoie le même texte rangé sous trois
titres — `CONTEXT`, `REFERENCES`, `REQUEST` — et chaque image jointe y porte son
rang et son rôle. Ce script prend les prompts **réellement payés** qui dorment
dans `donnees/generations/`, les fait passer par le rangement, et écrit les deux
côte à côte.

**Et il compte les mots.** Sous chaque paire, la liste des mots entrés ou sortis
**hors** des titres et des lignes de nommage. Vide, c'est un rangement ; non
vide, c'est une réécriture, et la tranche s'était interdit d'en faire une. C'est
l'outil du banc — `ecarts_du_rangement` — celui-là même qui refusait de tirer
quand ce n'était pas vrai.

**Ce que la colonne « après » est exactement, et ce qu'elle n'est pas.** C'est le
rangement du **banc** — `socle_essais.ranger`, celui qui a été tiré et mesuré le
2 septembre 2026 —, appliqué à un texte déjà parti. Un texte parti est une suite
de paragraphes : le banc y **retrouve** les morceaux par leurs marqueurs
(`FRAMING —`, `CAMERA —`, la consigne de planche), et il lui arrive donc de
ranger un paragraphe dans la partie voisine. Le produit, lui, ne devine rien : il
range par **groupe de ligne**, avant que le texte n'existe, et ne peut pas se
tromper. Cette page montre donc *le geste*, pas la sortie exacte du produit —
celle-là se lit sur l'écran de confirmation, et `tests/test_r7.py` la vérifie.

    .venv\\Scripts\\python.exe essais/rangement_r7.py

**Gratuit.** Rien ne part chez un fournisseur, rien n'est écrit dans le jeu : il
relit des fichiers déjà là et écrit une page. Entrée :
`donnees/generations/*/generation.json`. Sortie :
`essais/rapport-rangement-r7.html`, qu'on ouvre d'un double-clic.
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from socle_essais import (  # noqa: E402
    TITRES,
    ecarts_du_rangement,
    lignes_de_nommage,
    preparer_sortie,
    ranger,
)

DONNEES = RACINE.parent / "donnees" / "generations"
SORTIE = RACINE / "rapport-rangement-r7.html"

# Combien de paires la page montre. **Assez pour voir, pas assez pour noyer** :
# au-delà, on relit vingt fois la même bible et on cesse de lire.
COMBIEN = 6


def _partis() -> list[dict]:
    """Les prompts payés, du plus récent au plus ancien, avec leurs rôles d'images.

    **Ceux d'avant la tranche seulement** : un prompt déjà rangé n'a rien à
    montrer d'un rangement, et le faire passer une seconde fois écrirait des
    titres en double.
    """
    partis: list[dict] = []
    for fiche in sorted(DONNEES.glob("*/generation.json"), reverse=True):
        try:
            lu = json.loads(fiche.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        texte = str(lu.get("demande", {}).get("prompt", "")).strip()
        if not texte or texte.startswith(TITRES[0]):
            continue
        partis.append(
            {
                "identifiant": lu.get("identifiant", fiche.parent.name),
                "modele": lu.get("modele", ""),
                "cree_le": lu.get("cree_le", 0),
                "texte": texte,
                "roles": [
                    str(r.get("role", "reference"))
                    for r in lu.get("references", [])
                    if r.get("role") in ("style", "reference")
                ],
            }
        )
        if len(partis) >= COMBIEN:
            break
    return partis


def _paire(parti: dict) -> dict:
    """Le texte d'avant, celui d'après, et ce qui a bougé entre les deux."""
    roles = parti["roles"]
    apres = ranger(parti["texte"], roles)
    autorisees = list(TITRES) + lignes_de_nommage(roles)
    return {
        **parti,
        "apres": apres,
        "ecarts": ecarts_du_rangement(parti["texte"], apres, autorisees),
    }


def _page(paires: list[dict]) -> str:
    blocs: list[str] = []
    for paire in paires:
        ecarts = paire["ecarts"]
        verdict = (
            "aucun mot n'est entré ni sorti — c'est un rangement"
            if not ecarts
            else "des mots ont bougé hors des titres et du nommage : "
            + ", ".join(ecarts)
        )
        blocs.append(
            f"""
    <section class="paire">
      <h2>{html.escape(str(paire["identifiant"]))}</h2>
      <p class="meta">{html.escape(str(paire["modele"]))} ·
         {len(paire["roles"])} image{"s" if len(paire["roles"]) > 1 else ""} jointe{"s" if len(paire["roles"]) > 1 else ""} ·
         {len(paire["texte"])} caractères avant, {len(paire["apres"])} après</p>
      <div class="cote">
        <div><h3>avant</h3><pre>{html.escape(paire["texte"])}</pre></div>
        <div><h3>après</h3><pre>{html.escape(paire["apres"])}</pre></div>
      </div>
      <p class="{"ok" if not ecarts else "ecart"}">{html.escape(verdict)}</p>
    </section>"""
        )
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>R7 — le texte d'avant et le texte d'après</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin: 0; padding: 32px; background: #0B0D10; color: #98A2AC;
         font: 14px/1.6 ui-sans-serif, system-ui, sans-serif; }}
  h1 {{ color: #E6EAEE; font-size: 28px; font-weight: 400; margin: 0 0 8px; }}
  .chapeau {{ max-width: 70ch; margin: 0 0 32px; }}
  .paire {{ border-top: 1px solid #252B33; padding-top: 20px; margin-top: 24px; }}
  h2 {{ color: #E6EAEE; font-size: 15px; font-weight: 500; margin: 0 0 4px;
        font-family: ui-monospace, monospace; }}
  h3 {{ color: #5E6771; font-size: 9.5px; letter-spacing: .11em;
        text-transform: uppercase; margin: 0 0 6px; }}
  .meta {{ font-family: ui-monospace, monospace; font-size: 11px;
           color: #5E6771; margin: 0 0 12px; }}
  .cote {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  pre {{ background: #171B21; border: 1px solid #252B33; border-radius: 2px;
         padding: 12px; margin: 0; white-space: pre-wrap; overflow-x: auto;
         font: 11px/1.5 ui-monospace, monospace; color: #98A2AC; }}
  .ok {{ color: #5E6771; font-family: ui-monospace, monospace; font-size: 11px; }}
  .ecart {{ color: #C9A227; font-family: ui-monospace, monospace; font-size: 11px; }}
  @media (max-width: 900px) {{ .cote {{ grid-template-columns: 1fr; }} }}
</style></head>
<body>
  <h1>Le texte d'avant, et le texte d'après</h1>
  <p class="chapeau">Les {len(paires)} derniers textes réellement payés de cet
  atelier, tels qu'ils sont partis, et tels qu'ils partiraient aujourd'hui. Ce
  qui change&nbsp;: trois titres posés dessus, et une ligne par image jointe
  disant ce qu'elle est. Ce qui ne change pas&nbsp;: les mots. Sous chaque paire,
  le compte de ceux qui seraient entrés ou sortis hors des titres et du
  nommage.</p>
  <p class="chapeau">La colonne <em>après</em> est le rangement du banc, celui
  qui a été tiré et mesuré, appliqué à un texte déjà parti. Un texte parti n'est
  plus qu'une suite de paragraphes&nbsp;: le banc y retrouve les morceaux par
  leurs marqueurs, et il lui arrive de ranger un paragraphe dans la partie
  voisine. Le produit, lui, ne devine rien — il range par groupe de ligne, avant
  que le texte n'existe. Cette page montre donc <em>le geste</em>, pas la sortie
  exacte du produit.</p>
  <p class="chapeau">Elle ne promet rien sur la qualité des images&nbsp;: cinq
  façons de ranger ont été tirées le 2 septembre 2026 et aucune n'a battu le
  pavé. La tranche est reprise pour la relisibilité seule.</p>
  {"".join(blocs)}
</body></html>
"""


def principal() -> int:
    # Trois lignes contre le cp1252 de Windows (`docs/PIEGES.md`) : sans elles,
    # une flèche dans un `print` fait planter le script après qu'il a tout fait.
    preparer_sortie()
    if not DONNEES.exists():
        print(f"aucun dossier {DONNEES} — rien à comparer")
        return 1
    partis = _partis()
    if not partis:
        print(
            "aucune génération d'avant R7 sur ce disque — la page a besoin d'un "
            "texte à plat pour montrer ce que le rangement en fait"
        )
        return 1
    paires = [_paire(p) for p in partis]
    SORTIE.write_text(_page(paires), encoding="utf-8")
    ranges = sum(1 for p in paires if not p["ecarts"])
    print(f"{len(paires)} textes comparés · {ranges} rangés sans qu'un mot bouge")
    for paire in paires:
        if paire["ecarts"]:
            print(f"  ⚠ {paire['identifiant']} : {', '.join(paire['ecarts'])}")
    print(f"→ {SORTIE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(principal())
