# -*- coding: utf-8 -*-
"""Le garde-fou d'import — **celui qui aurait évité tout le chantier `B23`-`B27`.**

`Retouche.tsx` a emprunté quatorze symboles à `Places.tsx` et sept à
`Tables.tsx` depuis `B16`, sans qu'aucune ligne du dépôt ne le signale : deux
écrans qui prétendaient l'un migré, l'autre en sursis, partageaient en réalité
la même logique par un import ordinaire. Rien ne l'interdisait, et rien ne le
comptait — jusqu'à ce qu'un relevé au grep le trouve, quatre tranches trop
tard (`docs/PLAN-carnet.md` § `B27`).

**Ce que ce banc refuse.** Un fichier d'`interface/src/composants/` qui n'est
pas dans `LES_FICHIERS_DU_CARNET` (`essai_jetons.py`) et qui n'est pas une
exception nommée ci-dessous ne doit fournir aucune **fonction, constante ou
crochet** à un fichier qui, lui, y est. Monter un **composant** d'un tel
fichier reste permis : `Retouche.tsx` ouvre `EcranSuperposition` comme une
fabrique, `PageDuSujet.tsx` ouvre `EcranEtabli` comme une profondeur de plus —
deux écrans qui s'emboîtent, pas un vocabulaire qui se duplique. La différence
tient à un seul trait : un composant qu'on monte prend une majuscule
(`EcranSuperposition`), une fonction qu'on emprunte n'en prend pas
(`valeur`, `useRecette`). C'est exactement la forme du défaut d'origine —
`Places.tsx` ne prêtait aucun composant à `Retouche.tsx`, seulement des faits.

**Ce que ce banc ne regarde pas.** Les paquets npm (`react`, tout ce qui ne
commence pas par `.`), les imports entièrement de type (`import type { … }` —
aucune trace au run, donc aucune logique dupliquée possible), et tout ce qui
vit hors d'`interface/src/composants/` — `api.ts`, `aide.ts`, `lieux.ts`,
`recette.ts` sont le domaine partagé, pas des écrans concurrents.

    Lancer :  py essais/essai_imports.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "interface" / "src"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from essai_jetons import LES_FICHIERS_DU_CARNET  # noqa: E402

# ── Les exceptions, nommées et justifiées ───────────────────────────────────
#
# Une entrée n'arrive ici que par décision explicite, jamais par confort —
# c'est la règle que `B27` se donne pour ne pas refaire l'erreur qu'il corrige.
# Chacune dit ce qu'elle porte et pourquoi ce n'est pas un second écran.
EXCEPTIONS: dict[str, str] = {
    # Le vocabulaire de la recette (`B26`) : des faits du domaine — la liste
    # des cibles, le nom d'un moteur, les deux crochets `useRecette` et
    # `useMesures` — pas un écran. Il vit d'ailleurs hors de `composants/`
    # pour cette raison même ; nommé ici pour que la règle soit écrite, pas
    # seulement déduite de son adresse.
    "interface/src/recette.ts":
        "le vocabulaire du domaine, pas un écran (B26)",
    # Les pièces communes de tous les écrans, anciens et neufs : le libellé
    # qui porte son explication, la fente des refus, le curseur, l'échantillon
    # de hauteur (fondu en une seule pièce en `B27`). Des fonctions et des
    # composants partagés par construction, jamais un écran à eux seuls.
    "interface/src/composants/chassis.tsx":
        "fonctions et composants partagés par tous les écrans",
    # Le lecteur d'image partagé : `sujetAsset`, `useVisee`, `imageAsset`,
    # `vignetteAsset`, `rangDeLaBande`. Même rôle que `chassis.tsx`, pour
    # l'image plutôt que pour le contrôle — sept écrans du carnet l'empruntent
    # déjà, dont `Retouche.tsx`.
    "interface/src/composants/Apercu.tsx":
        "fonctions pures de lecture d'image, même rôle que chassis.tsx",
    # Dette assumée, pas cachée. `comptes` et `portraitDe` sont deux fonctions
    # pures de la fiche d'une chose du jeu, empruntées par deux écrans du
    # carnet (`PageDuSujet.tsx`, `GrilleDuJeu.tsx`) sans être passées par un
    # module de vocabulaire. Les extraire est un vrai travail, hors du
    # périmètre de `B27` — qui traite le déménagement de la retouche, pas la
    # fiche d'une chose. Le dire ici vaut mieux que de le laisser filer sous
    # un garde-fou qui se tairait.
    "interface/src/composants/FicheChose.tsx":
        "deux fonctions pures empruntées, dette notée et non traitée par B27",
}

# ── Lire un import relatif, sans construire un compilateur TypeScript ───────
#
# Une ligne `import …` peut porter un défaut, des noms entre accolades, ou les
# deux — jamais un import `* as` ou un défaut nu dans ce dépôt (vérifié au
# grep le 9 septembre 2026) : les deux formes ne sont donc pas reconnues, par
# le même choix qu'`essai_jetons.py` fait pour un nom de jeton calculé.
IMPORT = re.compile(
    r'^import\s+(type\s+)?(?:(\w+)\s*,\s*)?(?:\{([^}]*)\})?\s*from\s+"([^"]+)"',
    re.M,
)


def resoudre(depuis: Path, specification: str) -> Path | None:
    """Le fichier réel derrière un `from "./Quelque chose"`, ou `None` pour un
    paquet npm ou une adresse qui ne mène nulle part."""
    if not specification.startswith("."):
        return None
    base = (depuis.parent / specification).resolve()
    for suffixe in (".tsx", ".ts"):
        candidat = base.with_suffix(suffixe)
        if candidat.exists():
            return candidat
    return None


def noms_importes(defaut: str | None, membres: str | None) -> list[str]:
    """Les noms qu'un import fait entrer — le défaut, puis chaque membre,
    un alias `as` ramené à son nom local, un membre `type X` individuel
    retiré (il ne laisse aucune trace au run)."""
    noms = [defaut] if defaut else []
    if membres:
        for morceau in membres.split(","):
            morceau = morceau.strip()
            if not morceau or morceau.startswith("type "):
                continue
            noms.append(morceau.split(" as ")[0].strip())
    return [n for n in noms if n]


COMPOSANT = re.compile(r"^[A-Z][a-z]")


def est_un_composant(nom: str) -> bool:
    """PascalCase : on le monte (`<Foo />`), on ne l'emprunte pas.

    Une majuscule seule ne suffit pas — `TROUS`, `SENS_LIVRES`, `ZOOM_MIN`
    sont des constantes en SCREAMING_CASE, pas des composants, et elles
    doivent rester refusables. Un composant React commence par une
    majuscule *suivie d'une minuscule* (`EcranEtabli`, `BandeQuiTourne`) ;
    une constante reste entièrement en majuscules."""
    return bool(nom) and bool(COMPOSANT.match(nom))


def emprunts_hors_carnet(texte: str, depuis: Path) -> list[str]:
    """Ce qu'un fichier du carnet emprunte à un fichier qui n'y est pas, hors
    des exceptions nommées et des imports entièrement de type — une liste de
    phrases prêtes à afficher, vide si rien ne cloche."""
    fautes = []
    for est_type, defaut, membres, specification in IMPORT.findall(texte):
        if est_type:
            continue
        cible = resoudre(depuis, specification)
        if cible is None:
            continue
        relatif_cible = cible.relative_to(RACINE).as_posix()
        if relatif_cible in LES_FICHIERS_DU_CARNET:
            continue
        if "interface/src/composants/" not in relatif_cible:
            continue  # le domaine partagé (api.ts, aide.ts, lieux.ts…), pas un écran
        if relatif_cible in EXCEPTIONS:
            continue
        empruntes = [n for n in noms_importes(defaut, membres) if not est_un_composant(n)]
        if empruntes:
            fautes.append(
                f"emprunte {', '.join(empruntes)} à `{relatif_cible}`, "
                "hors du carnet et hors des exceptions"
            )
    return fautes


# ── L'auto-essai — le garde-fou refuse-t-il vraiment ? ──────────────────────
#
# Fabriqué dans le banc lui-même, jamais dans le vrai code : la régression est
# une chaîne de caractères, pas un fichier écrit sur le disque, pour que ce
# banc ne dépende d'aucune retouche future du dépôt.


def auto_essai() -> list[str]:
    """Trois cas fabriqués, deux refus attendus et un laissez-passer attendu.
    Retourne les phrases d'échec de l'auto-essai — vide si le garde-fou se
    comporte comme annoncé."""
    fautes = []
    # `Montage.tsx` existe, n'est pas dans le carnet, n'est pas une exception :
    # emprunter une fonction à ce fichier doit être refusé.
    depuis = RACINE / "interface" / "src" / "composants" / "Retouche.tsx"
    regression = 'import { unReglageEmprunte } from "./Montage"\n'
    trouve = emprunts_hors_carnet(regression, depuis)
    if not trouve:
        fautes.append(
            "l'auto-essai : un import fabriqué de `Montage.tsx` (hors carnet, hors "
            "exceptions) n'a pas été refusé — le garde-fou ne garde rien"
        )
    # Une constante en SCREAMING_CASE commence aussi par une majuscule, mais ce
    # n'est pas un composant qu'on monte — c'est exactement le genre de symbole
    # que l'import réel de `B16` empruntait à `Places.tsx` (`TROUS`,
    # `SENS_LIVRES`), et il doit être refusé comme n'importe quelle fonction.
    constante = 'import { TROUS, SENS_LIVRES } from "./Montage"\n'
    trouve = emprunts_hors_carnet(constante, depuis)
    if not trouve:
        fautes.append(
            "l'auto-essai : une constante SCREAMING_CASE (`TROUS`, `SENS_LIVRES`) "
            "empruntée à `Montage.tsx` n'a pas été refusée — elle passe pour un "
            "composant alors qu'elle n'en est pas un"
        )
    # Monter un composant du même fichier hors-carnet reste un geste normal —
    # une majuscule dit qu'on l'affiche, pas qu'on lui emprunte une logique.
    composition = 'import { EcranDeMontage } from "./Montage"\n'
    trouve = emprunts_hors_carnet(composition, depuis)
    if trouve:
        fautes.append(
            "l'auto-essai : monter un composant (`EcranDeMontage`) d'un fichier "
            f"hors carnet a été refusé à tort — {trouve}"
        )
    # Une exception nommée reste un laissez-passer, quel que soit ce qu'on lui
    # emprunte : c'est tout le sens de la lister.
    exception = 'import { part } from "./chassis"\n'
    trouve = emprunts_hors_carnet(exception, depuis)
    if trouve:
        fautes.append(
            f"l'auto-essai : `chassis.tsx` est une exception nommée, et a pourtant "
            f"été refusé — {trouve}"
        )
    return fautes


# ── Le journal ───────────────────────────────────────────────────────────────


def main() -> int:
    lignes: list[str] = []
    lignes.append("Le garde-fou d'import — un fichier du carnet, ses vraies dépendances")
    lignes.append("=" * 74)
    lignes.append("")

    fautes_auto = auto_essai()
    lignes.append("L'auto-essai · le garde-fou refuse-t-il une régression fabriquée ?")
    lignes.append("-" * 66)
    if fautes_auto:
        for faute in fautes_auto:
            lignes.append(f"  CASSE  {faute}")
    else:
        lignes.append(
            "  Le refus fabriqué est refusé, la composition fabriquée passe, et"
        )
        lignes.append("  l'exception nommée passe aussi.")
    lignes.append("")

    lignes.append(f"Le dépôt · {len(LES_FICHIERS_DU_CARNET)} fichiers du carnet, "
                   f"{len(EXCEPTIONS)} exceptions nommées")
    lignes.append("-" * 66)
    fautes_reelles: list[str] = []
    for relatif in LES_FICHIERS_DU_CARNET:
        chemin = RACINE / relatif
        if not chemin.exists():
            fautes_reelles.append(f"{relatif} — le fichier n'existe pas")
            continue
        for faute in emprunts_hors_carnet(chemin.read_text(encoding="utf-8"), chemin):
            fautes_reelles.append(f"{relatif} {faute}")
    if fautes_reelles:
        for faute in fautes_reelles:
            lignes.append(f"  REFUS  {faute}")
    else:
        lignes.append(
            "  Aucun fichier du carnet n'emprunte de logique à un écran qui n'y est"
        )
        lignes.append("  pas, sauf par les exceptions nommées et justifiées ci-dessus.")
    lignes.append("")

    lignes.append("Verdict")
    lignes.append("-------")
    total = len(fautes_auto) + len(fautes_reelles)
    if total:
        lignes.append(f"  {total} manquement(s).")
    else:
        lignes.append("  Rien à refuser : le garde-fou fonctionne, et le dépôt le tient.")

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(lignes))
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main())
