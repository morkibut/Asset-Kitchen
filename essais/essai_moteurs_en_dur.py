# -*- coding: utf-8 -*-
"""MO7 : plus aucun nom de moteur ni de famille écrit en dur dans l'écran.

**Le catalogue décide, jamais une liste en dur** (`AGENTS.md` § Règles durables)
— étendu par le chantier « Le catalogue des moteurs » aux moteurs de la
machine. MO4 avait laissé deux tables de ce genre debout à dessein
(`NOM_MOTEUR_LOCAL`, `MOTEURS_SONORES`, dans `interface/src/api-workflows.ts`
et `interface/src/composants/WorkflowsLocaux.tsx`), en promettant que MO7
tranchrait si elles devaient disparaître. Ce banc est ce qui empêche qu'une
troisième reparaisse un jour, sous un autre nom, sans que personne ne le voie
— exactement la panne que MO7 corrige : un écran qui recopie à la main ce
qu'une route sert déjà, et qui diverge en silence le jour où le catalogue
change.

**La liste fermée vient du catalogue serveur, jamais recopiée ici** (même
règle qu'`essais/essai_vocabulaire.py` avec `docs/vocabulaire.html`) : les cinq
noms de famille d'image (`atelier/fournisseur/catalogue_styles.py`, `FAMILLES`),
les cinq noms de moteur sonore (`atelier/audio/graphes.py`, `CONSTRUCTEURS`,
restreints à ceux que `FAMILLES` sert vraiment — pas les demi-étapes internes
de YuE2), et le nom du moteur vidéo de la machine (`atelier/fournisseur/maison.py`,
`modele_de_la_maison`). Si un nom change côté serveur, ce banc n'a pas à
bouger : il le relit.

**Ce qui refuse, et ce qui ne refuse pas.** Une chaîne de caractères qui **n'est
rien d'autre** qu'un de ces noms — `nom: "Qwen-Image 2.1"`, ou n'importe quelle
autre chaîne dont le contenu, une fois les espaces ôtés, vaut exactement un nom
connu — est refusée : c'est la forme exacte de `NOM_MOTEUR_LOCAL[qwen21]`. Une
phrase qui *cite* le même nom au milieu d'un mot d'auteur (« YuE2 écrit d'abord
sa partition… », le fallback de `FabricationAudio.tsx` quand aucun profil
n'est installé) n'est pas refusée : ce n'est pas une table qui rend le même
service qu'une route et diverge en silence, c'est une phrase à la main sur un
mécanisme propre à ce moteur (le second étage de YuE2, `SN9`) — la distinguer
d'un vrai doublon est tout le travail de ce banc, et un essai trop strict qui
la refuserait un jour serait pire qu'utile (même prudence qu'`essai_jetons.py`,
§ AGENTS.md).

**`interface/src/aide.ts` est hors mesure, à dessein.** C'est le guide de
l'atelier (`AGENTS.md`, point 7) : une prose écrite et relue à la main, qui
nomme les moteurs pour l'auteur qui lit un écran — jamais une table qui
alimente un contrôle à l'écran. Une entrée du guide qui vieillit se répare à
la prochaine relecture humaine du guide, pas par ce banc.

**Ce que ce banc ne couvre pas.** Un nom écrit en toutes lettres dans du texte
JSX (`<h4>Qwen-Image 2.1</h4>`, hors guillemets) échappe à la mesure — aucun
des deux défauts payés (`NOM_MOTEUR_LOCAL`, `MOTEURS_SONORES`) n'avait cette
forme, et un vrai analyseur JSX serait disproportionné pour ce banc. Un
« réglage » écrit en dur (pas au nom du moteur, à ses paramètres — étapes,
formats, force) n'est pas mesuré séparément : `PanneauReglages.tsx` les
dessine déjà depuis ce que le catalogue déclare (`docs/DESIGN.md`, même
principe que la page « Moteurs ») — c'est une propriété du code, pas quelque
chose que ce banc a besoin de surveiller en plus.

Il ne coûte rien : ni clé, ni réseau, ni atelier lancé, ni navigateur.

    Lancer :  py essais/essai_moteurs_en_dur.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "interface" / "src"

sys.path.insert(0, str(RACINE))

from atelier.audio.graphes import CONSTRUCTEURS, FAMILLES as FAMILLES_SON  # noqa: E402
from atelier.fournisseur.catalogue_styles import FAMILLES as FAMILLES_IMAGE  # noqa: E402
from atelier.fournisseur.maison import modele_de_la_maison  # noqa: E402


# ── Ce qui est hors mesure, et pourquoi (voir le docstring) ─────────────────

FICHIERS_HORS_MESURE = {"aide.ts"}


def _fichier_est_mesure(chemin: Path) -> bool:
    if chemin.name in FICHIERS_HORS_MESURE:
        return False
    if chemin.name.endswith(".test.ts") or chemin.name.endswith(".test.tsx"):
        return False
    return True


def fichiers_a_mesurer() -> list[Path]:
    return sorted(
        chemin
        for chemin in SRC.rglob("*")
        if chemin.suffix in (".ts", ".tsx") and _fichier_est_mesure(chemin)
    )


# ── Ce que le catalogue serveur nomme, lu à sa source ───────────────────────


def noms_connus() -> list[str]:
    """La liste fermée : les noms que l'écran doit lire d'une route, jamais
    recopier. Une chaîne de longueur nulle (rien n'en produit ici) serait un
    faux positif universel — filtrée par précaution."""
    noms = {famille["nom"] for famille in FAMILLES_IMAGE.values()}

    # Les cinq moteurs que la page « Moteurs » catalogue vraiment (MO4) — pas
    # `yue2-partition`/`yue2-partition-jouee`, les demi-étapes internes de
    # SN9, ni `sfxr`, qui n'est pas un moteur ComfyUI.
    sonores = {
        identifiant
        for ordre in FAMILLES_SON.values()
        for identifiant in ordre
        if identifiant != "sfxr"
    }
    for identifiant, construire in CONSTRUCTEURS.items():
        if identifiant in sonores:
            noms.add(construire()["nom"])

    # Le moteur vidéo de la machine (`AGENTS.md`, point 8bis) — un seul nom,
    # écrit côté serveur en exception assumée à « le catalogue décide »
    # (`atelier/fournisseur/maison.py`, `modele_de_la_maison`).
    noms.add(modele_de_la_maison().nom)

    return sorted(n for n in noms if n)


# ── Lire du code sans lire ses commentaires (même garde qu'essai_vocabulaire.py) ─

BLOC_DE_COMMENTAIRE = re.compile(r"/\*.*?\*/", re.S)
# `//` qui ouvre un commentaire, et pas celui de `https://`.
FIN_DE_LIGNE = re.compile(r"(?<!:)//[^\n]*")


def sans_commentaires(texte: str) -> str:
    """Le même texte, ligne pour ligne, commentaires blanchis — les lignes ne
    bougent pas, pour que chaque écart se nomme à la bonne ligne."""

    def blanchir(trouve: re.Match[str]) -> str:
        return re.sub(r"[^\n]", " ", trouve.group(0))

    return FIN_DE_LIGNE.sub(blanchir, BLOC_DE_COMMENTAIRE.sub(blanchir, texte))


def ligne_de(texte: str, position: int) -> int:
    return texte.count("\n", 0, position) + 1


# Une chaîne littérale simple, sur une seule ligne — apostrophe, guillemet ou
# gabarit. Une chaîne qui traverse plusieurs lignes (un gabarit avec un saut
# de ligne dedans) n'a jamais la forme d'un nom de moteur tout seul ; ce n'est
# pas mesuré, et ça ne l'a pas besoin d'être.
CHAINE = re.compile(r'''(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1''')


def occurrences_en_dur(texte: str, relatif: str, noms: list[str]) -> list[str]:
    """Les écarts d'un fichier : une chaîne dont le contenu **entier**, une
    fois les espaces ôtés, vaut exactement un nom connu.

    C'est la forme précise d'une table de noms recopiée (`identifiant: "Nom du
    moteur"`) — pas celle d'une phrase qui le cite au passage. Une chaîne
    « Qwen-Image 2.1 : le modèle principal en brouillon. » ne vaut pas
    exactement « Qwen-Image 2.1 » et ne lève donc rien.
    """
    connus = set(noms)
    propre = sans_commentaires(texte)
    fautes = []
    for trouve in CHAINE.finditer(propre):
        valeur = trouve.group(2).strip()
        if valeur in connus:
            ligne = ligne_de(propre, trouve.start())
            fautes.append(
                f"{relatif}:{ligne} — la chaîne « {valeur} » nomme un moteur en dur ;"
                " lis-le depuis le catalogue (une route), pas une table locale"
            )
    return fautes


# ── L'auto-essai : le garde-fou refuse-t-il vraiment ce qu'il promet ? ──────
#
# Payé sur `A5` (`AGENTS.md`, point 8sexies) : une mesure trop large ne dit pas
# « il n'y a rien », elle dit « je ne sais pas regarder ». Avant de faire
# confiance à ce banc sur le vrai dépôt, on le fait mentir sur un cas fabriqué
# des deux côtés — la table qui a causé les deux pannes de MO4, et la phrase
# qui ne doit jamais lever.


def auto_essai() -> list[str]:
    """Deux cas fabriqués, jamais lus dans le vrai dépôt : si l'un des deux
    échoue, le garde-fou ne se comporte plus comme son docstring le promet."""
    noms = ["Qwen-Image 2.1"]
    fautes: list[str] = []

    table = (
        'export const NOM_MOTEUR_LOCAL: Record<string, string> = {\n'
        '  qwen21: "Qwen-Image 2.1",\n'
        '}\n'
    )
    if not occurrences_en_dur(table, "fabrique.ts", noms):
        fautes.append(
            "le cas fabriqué « table » n'est pas détecté : le garde-fou ne verrait plus"
            " une reprise de NOM_MOTEUR_LOCAL"
        )

    prose_et_commentaire = (
        "// Qwen-Image 2.1 est le moteur principal depuis le 22 septembre\n"
        'const phrase = "Qwen-Image 2.1 : le modèle principal en brouillon."\n'
    )
    if occurrences_en_dur(prose_et_commentaire, "fabrique.ts", noms):
        fautes.append(
            "le cas fabriqué « phrase et commentaire » est refusé à tort : le"
            " garde-fou est devenu trop strict"
        )

    return fautes


# ── Le journal ───────────────────────────────────────────────────────────────


def main() -> int:
    noms = noms_connus()
    fautes_auto = auto_essai()

    fichiers = fichiers_a_mesurer()
    fautes: list[str] = []
    for chemin in fichiers:
        relatif = str(chemin.relative_to(RACINE)).replace("\\", "/")
        fautes += occurrences_en_dur(
            chemin.read_text(encoding="utf-8"), relatif, noms
        )

    lignes: list[str] = []
    lignes.append("Aucun nom de moteur écrit en dur dans l'écran")
    lignes.append("=" * 46)
    lignes.append("")
    lignes.append(
        f"  {len(noms)} noms connus, lus sur le catalogue serveur : "
        + " · ".join(noms)
    )
    lignes.append(
        f"  {len(fichiers)} fichiers mesurés sous interface/src"
        f" ({len(FICHIERS_HORS_MESURE)} hors mesure : {', '.join(sorted(FICHIERS_HORS_MESURE))})."
    )
    lignes.append("")

    lignes.append("Auto-essai du garde-fou")
    lignes.append("-" * 46)
    if fautes_auto:
        for faute in fautes_auto:
            lignes.append(f"  ÉCART  {faute}")
    else:
        lignes.append("  Les deux cas fabriqués se comportent comme promis.")
    lignes.append("")

    lignes.append("Les écarts, un par un")
    lignes.append("-" * 46)
    if fautes:
        lignes.append("")
        for faute in fautes:
            lignes.append(f"  ÉCART  {faute}")
        lignes.append("")
    else:
        lignes.append("  Aucun.")
        lignes.append("")

    lignes.append("Verdict")
    lignes.append("-------")
    if fautes_auto or fautes:
        lignes.append(
            f"  {len(fautes_auto)} défaut(s) du garde-fou lui-même,"
            f" {len(fautes)} écart(s) dans l'écran."
        )
    else:
        lignes.append(
            "  Aucun nom de moteur connu n'est écrit en dur ailleurs que dans un"
            " commentaire, un essai, ou le guide."
        )

    # Windows : la console est en cp1252, et le journal porte des accents.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("\n".join(lignes))
    return 1 if (fautes or fautes_auto) else 0


if __name__ == "__main__":
    raise SystemExit(main())
