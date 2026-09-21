# -*- coding: utf-8 -*-
"""Le garde-fou du tutoiement — **écrit le 21 septembre 2026, tranche RV4.**

La revue du 21 septembre l'a mesuré : le guide tutoie 153 fois pour 1, et les
écrans 118 fois contre 64. La décision d'architecture du plan de la revue
tranche dans ce sens-là — *« tu » partout* — parce que c'est le tutoiement qui
coûte le moins à généraliser.

Ce banc lit le texte affiché — JSX et chaînes de caractères, commentaires
retirés — dans `interface/src/composants/*.tsx`, `interface/src/*.ts` et
`interface/src/aide.ts`, et refuse deux choses :

1. **« vous », « votre », « vos »** — le vouvoiement, en toutes lettres.
2. **Un des impératifs en -ez de la liste ci-dessous**, en tête de phrase
   (majuscule). La liste est fermée à dessein : un « -ez » générique
   attraperait aussi « chez », « assez », « nez » — des mots français
   ordinaires qui ne sont pas des impératifs — et ferait un banc qui crie
   sur des phrases correctes. Le jour où un nouvel impératif entre dans
   l'atelier, cette liste s'allonge d'une ligne.

**Exceptions.** Un commentaire de code n'est pas un texte affiché — il est
retiré avant toute mesure, comme dans `essai_vocabulaire.py`. Au-delà, ce
banc n'a aujourd'hui aucune exception à porter : la tranche RV4 a tutoyé
tout ce qu'elle a trouvé. Si un vouvoiement délibéré devait un jour exister
(citer mot pour mot le tutoiement d'un tiers, par exemple), l'ajouter à
`EXCEPTIONS` ci-dessous, avec la raison en commentaire — jamais en silence.

    Lancer :  py essais/essai_tutoiement.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "interface" / "src"

# ── Ce qui n'est pas mesuré, et pourquoi ────────────────────────────────────
#
# Chaque entrée est une sous-chaîne exacte à ignorer, avec sa raison. Vide
# aujourd'hui : voir la note ci-dessus.
EXCEPTIONS: tuple[str, ...] = ()

# Les impératifs en -ez que l'atelier a écrits, un par un — jamais un motif
# générique. Les deux graphies (majuscule en tête de phrase, minuscule au
# milieu) comptent : un impératif reste un impératif où qu'il tombe.
IMPERATIFS = [
    "choisissez", "décrivez", "ajoutez", "cliquez", "cochez", "réglez",
    "sélectionnez", "indiquez", "nommez", "vérifiez", "entrez", "saisissez",
    "activez", "désactivez", "corrigez", "confirmez", "validez", "terminez",
    "fermez", "ouvrez", "lancez", "essayez", "attendez", "patientez",
    "gardez", "retirez", "supprimez", "modifiez", "changez", "notez",
    "pensez", "veillez", "utilisez", "consultez", "relisez", "précisez",
    "donnez", "écrivez", "tapez", "placez", "posez", "déposez", "chargez",
    "téléchargez", "copiez", "collez", "déplacez", "glissez",
]

MOT_INTERDIT = re.compile(
    r"\b(vous|votre|vos|" + "|".join(IMPERATIFS) + r")\b", re.IGNORECASE
)

BLOC_DE_COMMENTAIRE = re.compile(r"/\*.*?\*/", re.S)
FIN_DE_LIGNE = re.compile(r"(?<!:)//[^\n]*")


def sans_commentaires(texte: str) -> str:
    def blanchir(trouve: re.Match[str]) -> str:
        return re.sub(r"[^\n]", " ", trouve.group(0))

    return FIN_DE_LIGNE.sub(blanchir, BLOC_DE_COMMENTAIRE.sub(blanchir, texte))


def ligne_de(texte: str, position: int) -> int:
    return texte.count("\n", 0, position) + 1


def fichiers() -> list[Path]:
    trouves = sorted((SRC / "composants").glob("*.tsx")) + sorted(SRC.glob("*.ts"))
    return [f for f in trouves if not f.name.endswith(".test.tsx") and not f.name.endswith(".test.ts")]


def main() -> int:
    fautes: list[str] = []
    comptes = 0

    for chemin in fichiers():
        texte = chemin.read_text(encoding="utf-8")
        propre = sans_commentaires(texte)
        for exception in EXCEPTIONS:
            propre = propre.replace(exception, " " * len(exception))
        relatif = str(chemin.relative_to(RACINE)).replace("\\", "/")
        for trouve in MOT_INTERDIT.finditer(propre):
            comptes += 1
            mot = trouve.group(1)
            no = ligne_de(propre, trouve.start())
            debut = propre.rfind("\n", 0, trouve.start()) + 1
            fin = propre.find("\n", trouve.end())
            contexte = propre[debut : fin if fin > 0 else len(propre)].strip()
            if len(contexte) > 140:
                contexte = contexte[: trouve.start() - debut + 60].strip() + "…"
            fautes.append(f"{relatif}:{no} — « {mot} » : {contexte}")

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Le tutoiement, contre le vouvoiement et les impératifs en -ez")
    print("=" * 62)
    print()
    print(f"  {len(fichiers())} fichiers lus dans interface/src (composants/*.tsx, *.ts).")
    print(f"  {comptes} mot(s) interdit(s) trouvé(s).")
    print()

    if fautes:
        print("Les écarts, un par un")
        print("-" * 62)
        for faute in fautes:
            print(f"  ÉCART  {faute}")
        print()
        print("Verdict")
        print("-------")
        print(f"  {len(fautes)} écart(s) : « tu » partout, décidé par le plan de la revue")
        print("  du 21 septembre 2026, n'est pas encore tenu.")
        return 1

    print("Verdict")
    print("-------")
    print("  Aucun vouvoiement, aucun impératif en -ez : « tu » partout.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
