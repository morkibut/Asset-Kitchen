# -*- coding: utf-8 -*-
"""Ce qu'on prouve avant de payer — la part commune aux deux essais de la V2.

**Aucune fonction de ce module ne fait d'appel payant.** Le seul réseau touché
est `GET /api/v1/images/models`, qui est gratuit et ne demande aucune clé, plus
deux relevés de solde qui n'engagent rien.

Un essai payant a un défaut de structure : il ne se relance pas. Le premier lot
est aussi le dernier, et tout ce qui aurait pu être vérifié avant l'est trop tard
après. Ce module tient donc les preuves qui se partagent — le catalogue relu
frais, les paramètres qui partent vraiment, l'empreinte de ce qu'on envoie, la
chaîne de mesure passée sur tout le disque, la note chiffrée, le solde — et
laisse à chaque essai le soin de dire ce que *lui* envoie.

**Le verdict est le code de sortie.** Une preuve manquée rend 1 ; `--payer` ne
doit partir que sur un 0. C'est ce qui rend « ne paie que si tout est vert »
vérifiable par une machine, et non par un œil fatigué qui a déjà lu trois écrans.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent
CATALOGUE_URL = "https://openrouter.ai/api/v1/images/models"
CACHE = RACINE / "catalogue.json"
DELAI = 60

# Le corpus, c'est **tout** ce qui traîne sous `essais/`, pas la sélection qui
# arrange. Les JPEG de Seedream et les planches multi-sprites sont dedans, et ce
# sont précisément eux qui cassent une chaîne de mesure écrite sur des PNG
# fabriqués. Les compter à part reviendrait à choisir ses cas.
EXTENSIONS_IMAGE = (".png", ".jpg", ".jpeg", ".webp")


# ─────────────────────────────────────────────────────────────────────────────
# Le rapport — vert, rouge, et rien entre les deux
# ─────────────────────────────────────────────────────────────────────────────

class Section:
    """Une preuve. Elle tient ou elle ne tient pas ; le jaune n'arrête rien."""

    def __init__(self, rapport: "Rapport", numero: int, titre: str) -> None:
        self.rapport = rapport
        print(f"\n{'─' * 78}\n{numero}. {titre.upper()}\n{'─' * 78}")

    def dit(self, ligne: str = "") -> None:
        print(ligne)

    def vert(self, ligne: str) -> None:
        self.rapport.verts += 1
        print(f"  [ok]    {ligne}", flush=True)

    def rouge(self, ligne: str) -> None:
        self.rapport.rouges.append(ligne)
        print(f"  [ROUGE] {ligne}", flush=True)

    def jaune(self, ligne: str) -> None:
        self.rapport.jaunes.append(ligne)
        print(f"  [note]  {ligne}", flush=True)


class Rapport:
    def __init__(self, titre: str) -> None:
        self.verts = 0
        self.rouges: list[str] = []
        self.jaunes: list[str] = []
        self._numero = 0
        self.depart = time.monotonic()
        print(f"\n{'═' * 78}")
        print(f"  VÉRIFICATION — {titre}")
        print("  Aucun appel payant n'est fait ici. Le code de sortie est le verdict.")
        print(f"{'═' * 78}")

    def section(self, titre: str) -> Section:
        self._numero += 1
        return Section(self, self._numero, titre)

    def bilan(self, commande: str) -> int:
        duree = time.monotonic() - self.depart
        print(f"\n{'═' * 78}")
        if self.rouges:
            print(f"  ROUGE — {len(self.rouges)} preuve(s) manquée(s) sur "
                  f"{self.verts + len(self.rouges)}, en {duree:.0f} s")
            for ligne in self.rouges:
                print(f"     · {ligne}")
            print(f"\n  **Ne pas lancer `{commande} --payer`.**")
            print(f"{'═' * 78}")
            return 1
        print(f"  VERT — {self.verts} preuves tenues, en {duree:.0f} s")
        if self.jaunes:
            print(f"  {len(self.jaunes)} remarque(s), qui n'empêchent rien :")
            for ligne in self.jaunes:
                print(f"     · {ligne}")
        print(f"\n  `{commande} --payer` peut partir.")
        print(f"{'═' * 78}")
        return 0


# ─────────────────────────────────────────────────────────────────────────────
# 1 · Le catalogue, relu frais
# ─────────────────────────────────────────────────────────────────────────────

def catalogue_frais() -> dict[str, dict]:
    """Le catalogue tel qu'il est **maintenant**, jamais celui du cache.

    `charger_catalogue()` de l'essai d'identité écrit `essais/catalogue.json` au
    premier appel et le relit ensuite sans jamais le rafraîchir. C'est ce qu'il
    faut pour un lot déjà lancé — on ne veut pas que le catalogue change au
    milieu — et c'est exactement ce qu'il ne faut pas pour décider de payer : le
    relevé du 26 août 2026 comptait 47 modèles, le lendemain 48. Un modèle retiré
    entre-temps ferait sauter sa configuration en silence, `executer()` imprimant
    « absent du catalogue — saute », et le lot rendrait un trou là où l'on
    croyait avoir mesuré.
    """
    requete = urllib.request.Request(
        CATALOGUE_URL, headers={"Accept": "application/json"}
    )
    with urllib.request.urlopen(requete, timeout=DELAI) as reponse:
        donnees = json.loads(reponse.read().decode("utf-8"))
    modeles = donnees.get("data") or []
    if not modeles:
        raise RuntimeError("le catalogue est revenu vide")
    return {m["id"]: m for m in modeles}


def catalogue_cache() -> dict[str, dict] | None:
    """Le cache du disque, **sans jamais aller le chercher s'il manque**."""
    if not CACHE.exists():
        return None
    try:
        donnees = json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return {m["id"]: m for m in (donnees.get("data") or [])}


def refs_max(fiche: dict) -> int:
    declare = (fiche.get("supported_parameters") or {}).get("input_references")
    return int(declare.get("max", 0)) if isinstance(declare, dict) else 0


def preuve_catalogue(section: Section, configurations: list[tuple]) -> dict[str, dict]:
    """Chaque modèle configuré existe-t-il encore, et le catalogue a-t-il bougé ?"""
    try:
        frais = catalogue_frais()
    except (urllib.error.URLError, OSError, ValueError, RuntimeError) as erreur:
        section.rouge(f"catalogue injoignable — {type(erreur).__name__} : {erreur}")
        section.dit("\n  Sans catalogue frais, rien ne prouve que les modèles existent")
        section.dit("  encore. On ne paie pas à l'aveugle.")
        return {}

    cache = catalogue_cache()
    section.dit(f"  relu à l'instant sur {CATALOGUE_URL}")
    section.dit(f"  {len(frais)} modèles image au catalogue frais")
    if cache is None:
        section.jaune("aucun cache local à comparer (essais/catalogue.json absent)")
    else:
        partis = sorted(set(cache) - set(frais))
        venus = sorted(set(frais) - set(cache))
        section.dit(f"  {len(cache)} au cache du disque (essais/catalogue.json, 26 août)")
        if partis:
            section.jaune(f"disparus depuis le cache : {', '.join(partis)}")
        if venus:
            section.jaune(f"apparus depuis le cache : {', '.join(venus)}")
        if not partis and not venus:
            section.dit("  aucune entrée n'est apparue ni n'a disparu depuis le relevé")

    section.dit()
    for etiquette, identifiant, _ in configurations:
        fiche = frais.get(identifiant)
        if fiche is None:
            section.rouge(f"{etiquette:22} [{identifiant}] ABSENT du catalogue frais")
            continue
        details = f"réfs max {refs_max(fiche)}"
        if cache is not None and identifiant in cache:
            avant = cache[identifiant].get("supported_parameters") or {}
            apres = fiche.get("supported_parameters") or {}
            if json.dumps(avant, sort_keys=True) != json.dumps(apres, sort_keys=True):
                details += "  — ses PARAMÈTRES ont bougé depuis le cache"
                section.jaune(
                    f"{etiquette} : paramètres différents du cache "
                    f"({sorted(avant)} → {sorted(apres)})"
                )
        elif cache is not None:
            details += "  — absent du cache, donc nouveau"
        section.vert(f"{etiquette:22} [{identifiant}] présent, {details}")
    return frais


# ─────────────────────────────────────────────────────────────────────────────
# 2 · Ce qui part vraiment, et ce qui tombe en silence
# ─────────────────────────────────────────────────────────────────────────────

def preuve_parametres(
    section: Section,
    configurations: list[tuple],
    commun: dict,
    frais: dict[str, dict],
    reference_requise: dict[str, bool],
) -> None:
    """Les paramètres retenus par le catalogue frais, et ceux qu'il écarte.

    **Un paramètre écarté ne lève pas et ne se voit pas.** `options_retenues()`
    le retire du corps de la requête et l'écrit dans une liste que le journal du
    lot imprime — mais le journal, on le lit après. Or `aspect_ratio` perdu, ce
    n'est pas une image un peu différente : `ARCHITECTURE.md` §4 bis a mesuré que
    Gemini part alors en 16:9. Trente-six images en 16:9, c'est le lot à refaire.
    """
    from essai_identite import options_retenues

    for etiquette, identifiant, propres in configurations:
        fiche = frais.get(identifiant)
        if fiche is None:
            section.rouge(f"{etiquette:22} pas de fiche fraîche — rien à vérifier")
            continue
        voulues = {**commun, **propres}
        gardees, ecartees = options_retenues(fiche, voulues)

        section.dit(f"\n  {etiquette}  [{identifiant}]")
        section.dit(f"      demandé : {json.dumps(voulues, ensure_ascii=False)}")
        section.dit(f"      retenu  : {json.dumps(gardees, ensure_ascii=False)}")
        section.dit(f"      écarté  : {ecartees if ecartees else '—'}")

        if ecartees:
            section.rouge(
                f"{etiquette} : {', '.join(ecartees)} écarté(s) en silence — "
                f"le modèle décidera à notre place"
            )
        else:
            section.vert(f"{etiquette:22} tout ce qui est demandé part vraiment")

        if reference_requise.get(etiquette, False):
            plafond = refs_max(fiche)
            if plafond < 1:
                section.rouge(
                    f"{etiquette} : n'accepte aucune référence (max {plafond}) alors "
                    f"que l'essai lui en envoie une — sa configuration serait sautée"
                )
            else:
                section.vert(
                    f"{etiquette:22} accepte la référence envoyée (max {plafond})"
                )


def preuve_corps(section: Section, corps: dict, nom: str) -> None:
    """Le corps JSON exact, référence remplacée par son empreinte.

    Il est construit par la **même** fonction que celle qu'utilise l'appel payant
    (`essai_identite.corps_requete`) : ce n'est pas une description de ce qui
    part, c'est ce qui part.
    """
    montrable = dict(corps)
    references = montrable.pop("input_references", None)
    montrable.pop("prompt", None)
    section.dit(f"      corps POST ({nom}) hors prompt : "
                f"{json.dumps(montrable, ensure_ascii=False)}")
    if references is None:
        section.dit("      input_references : aucune")
        return
    for index, reference in enumerate(references):
        url = reference.get("image_url", {}).get("url", "")
        entete, _, charge = url.partition(",")
        section.dit(
            f"      input_references[{index}] : {entete},"
            f"<{len(charge)} caractères de base64 ≈ {len(charge) * 3 // 4} octets>"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3 · L'empreinte de ce qu'on envoie
# ─────────────────────────────────────────────────────────────────────────────

MAGIES = ((b"\x89PNG\r\n\x1a\n", "PNG"), (b"\xff\xd8", "JPEG"), (b"RIFF", "WEBP"))


def empreinte(octets: bytes) -> dict:
    """Ce qu'une image est vraiment — pas ce que son extension prétend."""
    magie = next((nom for tete, nom in MAGIES if octets.startswith(tete)), "?")
    try:
        with Image.open(io.BytesIO(octets)) as image:
            taille, mode, format_ = image.size, image.mode, image.format
    except Exception:  # noqa: BLE001 — une empreinte ne lève jamais
        taille, mode, format_ = (0, 0), "?", "?"
    return {
        "octets": len(octets),
        "sha256": hashlib.sha256(octets).hexdigest()[:16],
        "magie": magie,
        "dimensions": f"{taille[0]}x{taille[1]}",
        "mode": mode,
        "format": format_,
    }


def preuve_reference(section: Section, octets: bytes, nom: str, origine: str) -> None:
    """La référence part annoncée `image/png` — donc elle doit en être un.

    `essai_identite.corps_requete` écrit `data:image/png;base64,…` sans regarder
    ce qu'il encode. Une référence JPEG passerait avec un type menteur, et c'est
    le genre de chose qu'un fournisseur accepte poliment avant de rendre
    n'importe quoi.
    """
    e = empreinte(octets)
    octets_lisibles = f"{e['octets']:,}".replace(",", " ")
    section.dit(f"      {nom}")
    section.dit(f"          {origine}")
    section.dit(f"          {e['dimensions']} {e['mode']} {e['format']} · "
                f"{octets_lisibles} octets · sha256 {e['sha256']}…")
    if e["magie"] != "PNG":
        section.rouge(
            f"{nom} n'est pas un PNG ({e['magie']}) alors que la requête "
            f"l'annonce en image/png"
        )
    else:
        section.vert(f"{nom} est bien un PNG, conforme au type annoncé dans le data URL")


# ─────────────────────────────────────────────────────────────────────────────
# 4 · La chaîne de mesure, sur tout ce qui est déjà sur le disque
# ─────────────────────────────────────────────────────────────────────────────

def corpus() -> list[Path]:
    """Toutes les images sous `essais/`, sans exception ni tri favorable."""
    return sorted(
        chemin for chemin in RACINE.rglob("*")
        if chemin.suffix.lower() in EXTENSIONS_IMAGE and chemin.is_file()
    )


def preuve_corpus(section: Section, mesurer_une,
                  attendu: int | None = None) -> list[tuple[Path, object]]:
    """`mesurer_une(octets, chemin)` sur chaque image du disque. Rien ne doit lever.

    **Le corpus n'est pas décoratif.** Une chaîne de mesure écrite sur des PNG
    fabriqués tombe sur les JPEG de Seedream — pas d'alpha, du bruit de
    compression sur le fond plat que le détourage lit —, sur les planches
    multi-sprites qui rendent dix boîtes là où le code en attend une, et sur les
    vignettes de 64 px où une érosion mange tout. Ces trois familles sont déjà
    sur le disque : découvrir après le lot qu'elles cassent la mesure serait le
    seul vrai gâchis de cet essai.
    """
    fichiers = corpus()
    section.dit(f"  {len(fichiers)} images sous essais/, toutes passées à la mesure")
    if attendu is not None and len(fichiers) != attendu:
        section.jaune(
            f"le corpus fait {len(fichiers)} images, on en attendait {attendu} "
            f"— le compte a bougé depuis l'écriture de l'essai"
        )

    par_extension: dict[str, int] = {}
    for chemin in fichiers:
        cle = chemin.suffix.lower().lstrip(".")
        par_extension[cle] = par_extension.get(cle, 0) + 1
    section.dit("  par extension : " + ", ".join(
        f"{n} {ext}" for ext, n in sorted(par_extension.items(), key=lambda p: -p[1])
    ))
    section.dit()

    pannes: list[tuple[Path, str, str]] = []
    perdus: list[Path] = []
    resultats: list[tuple[Path, object]] = []
    depart = time.monotonic()
    for index, chemin in enumerate(fichiers, start=1):
        try:
            resultat = mesurer_une(chemin.read_bytes(), chemin)
        except Exception as erreur:  # noqa: BLE001 — c'est exactement ce qu'on cherche
            pannes.append((chemin, type(erreur).__name__, str(erreur)[:200]))
            continue
        resultats.append((chemin, resultat))
        if resultat is None:
            perdus.append(chemin)
        if index % 40 == 0 or index == len(fichiers):
            print(f"        {index}/{len(fichiers)}  "
                  f"({time.monotonic() - depart:.0f} s)", flush=True)

    section.dit()
    if pannes:
        for chemin, genre, message in pannes[:12]:
            section.rouge(f"{chemin.relative_to(RACINE)} lève {genre} : {message}")
        if len(pannes) > 12:
            section.rouge(f"… et {len(pannes) - 12} autres images qui lèvent")
    else:
        section.vert(
            f"aucune des {len(fichiers)} images ne lève — les "
            f"{par_extension.get('jpg', 0)} JPEG de Seedream comprises"
        )
    if perdus:
        section.jaune(
            f"{len(perdus)} image(s) sans sujet après détourage — un résultat, "
            f"pas une panne : " + ", ".join(p.name for p in perdus[:5])
        )
    else:
        section.vert("aucun sujet perdu au détourage sur tout le corpus")
    return resultats


def preuve_planches(section: Section, resultats: list[tuple[Path, object]],
                    sujets_de, seuil: int = 4) -> None:
    """Nommer les planches multi-sprites traversées, au lieu de les supposer.

    Le corpus ne prouve quelque chose que si l'on sait ce qu'il contient : une
    planche multi-sprites n'est un cas limite **que si elle y est**, et
    l'affirmer sans la nommer serait la même faute que « on a testé, ça marche ».

    Le compte de sujets vient du balayage qui vient d'avoir lieu — on ne
    redétoure pas 239 images pour le plaisir de recompter.
    """
    trouvees = [
        (sujets_de(resultat), chemin)
        for chemin, resultat in resultats
        if resultat is not None and sujets_de(resultat) >= seuil
    ]
    trouvees.sort(key=lambda paire: -paire[0])
    section.dit(f"  images du corpus portant au moins {seuil} sujets : {len(trouvees)}")
    for nombre, chemin in trouvees[:8]:
        section.dit(f"      {nombre:3} sujets   {chemin.relative_to(RACINE)}")
    if trouvees:
        section.vert(
            f"la plus chargée porte {trouvees[0][0]} sujets "
            f"({trouvees[0][1].name}) et la mesure la traverse sans lever"
        )
    else:
        section.rouge(
            "aucune planche multi-sprites dans le corpus — le cas qui casse "
            "la découpe n'est donc pas couvert par ce balayage"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5 · La note
# ─────────────────────────────────────────────────────────────────────────────

# **Les tarifs du catalogue mentent** (`ARCHITECTURE.md` §4 bis : `riverflow`
# annonce $0,019 l'image et facture $0,042). Ces chiffres-ci viennent donc de ce
# qui a été *facturé* le 26 août 2026 — `essais/resultats/jet<N>/<config>/
# mesures.json`, quatre appels par configuration : un sans référence, trois avec
# une.
#
# Pour les modèles facturés **à l'image**, le partage est exact et se recoupe au
# centime avec `essais/prix.json` : `seedream-5.0-lite` a facturé $0,1400 pour
# quatre appels, soit $0,0350 chacun — exactement son tarif, référence ou pas ;
# `qwen-image-3` a facturé $0,1290, soit $0,030 + 3 × $0,033 — exactement son
# tarif de sortie plus son tarif d'image d'entrée. Ces deux-là sont mesurés.
#
# Pour les modèles facturés **au token**, le partage vient d'une équation.
# `prix.json` ne donne aux Gemini **aucune ligne d'entrée** : référence ou pas,
# c'est le même prix — et les quatre appels du banc rendent bien le même quart
# chacun. `gpt-image-2` facture son entrée : §4 bis donne $0,0064 sans référence
# en `low`, ce qui impose $0,0144 avec une pour retomber sur les $0,0497
# mesurés. Le surcoût de référence ainsi obtenu ($0,0080) est reporté sur
# `medium`, dont l'entrée est facturée au même tarif que le `low` — seule la
# sortie change de qualité.
#
# **Ces chiffres restent une estimation.** Seul `usage.cost` de chaque réponse
# dira la note réelle, et c'est lui que le lot enregistre appel par appel.
COUTS: dict[str, tuple[float, float, str]] = {
    # étiquette              (sans référence, avec 1 référence, provenance)
    "gpt-image-2_low":       (0.0064, 0.0144, "§4 bis mesuré + banc du 26 août"),
    "gpt-image-2_medium":    (0.0532, 0.0612, "banc du 26 août + surcoût de réf. du low"),
    "gemini-3.1-flash":      (0.0681, 0.0681, "banc du 26 août — entrée non facturée"),
    "gemini-3.1-flash-LITE": (0.0342, 0.0342, "banc du 26 août — entrée non facturée"),
    "seedream-5.0-lite":     (0.0350, 0.0350, "banc du 26 août = prix.json à l'exact"),
    "qwen-image-3":          (0.0300, 0.0330, "prix.json, recoupé au centime par le banc"),
}


def preuve_note(section: Section, appels: list[tuple[str, int, int]],
                annonce: float | None = None) -> float:
    """`appels` = [(étiquette, nombre avec référence, nombre sans référence)].

    Ne compte que ce qui **reste à faire** : une image déjà sur le disque est
    sautée par `executer()` et ne se repaie jamais.
    """
    section.dit(f"  {'modèle':24} {'avec réf':>9} {'sans réf':>9} "
                f"{'$/appel':>17} {'sous-total':>12}")
    total = 0.0
    inconnus: list[str] = []
    for etiquette, avec, sans in appels:
        if avec + sans == 0:
            continue
        tarif = COUTS.get(etiquette)
        if tarif is None:
            inconnus.append(etiquette)
            section.dit(f"  {etiquette:24} {avec:>9} {sans:>9} "
                        f"{'INCONNU':>17} {'?':>12}")
            continue
        prix_sans, prix_avec, _ = tarif
        sous_total = avec * prix_avec + sans * prix_sans
        total += sous_total
        prix = f"{prix_avec:.4f}" if not sans else f"{prix_avec:.4f}/{prix_sans:.4f}"
        section.dit(f"  {etiquette:24} {avec:>9} {sans:>9} {prix:>17} "
                    f"{sous_total:>10.4f} $")

    nombre = sum(avec + sans for _, avec, sans in appels)
    section.dit(f"  {'':24} {'':>9} {'':>9} {'':>17} {'─' * 12}")
    section.dit(f"  {'TOTAL':24} {sum(a for _, a, _ in appels):>9} "
                f"{sum(s for _, _, s in appels):>9} {'':>17} {total:>10.4f} $")
    section.dit(f"\n  {nombre} appel(s) restant(s) à faire. Ce qui est déjà sur le")
    section.dit("  disque est sauté par `executer()` et ne se repaie jamais.")
    section.dit("\n  provenance des tarifs, modèle par modèle :")
    for etiquette, avec, sans in appels:
        if avec + sans and etiquette in COUTS:
            section.dit(f"      {etiquette:24} {COUTS[etiquette][2]}")

    if inconnus:
        section.rouge(
            f"aucun tarif mesuré pour {', '.join(inconnus)} — la note est "
            f"incomplète, donc inconnue"
        )
    else:
        section.vert(f"note estimée : {total:.2f} $ pour {nombre} appels")

    if annonce is not None and nombre:
        ecart = abs(total - annonce) / max(annonce, 1e-9)
        if ecart > 0.30:
            section.jaune(
                f"l'en-tête du script annonce ~{annonce:.2f} $, le calcul en donne "
                f"{total:.2f} $ ({(total - annonce) / annonce:+.0%})"
            )
    section.dit("\n  Seul `usage.cost` de chaque réponse dira la note réelle (§4 bis) ;")
    section.dit("  le lot l'enregistre appel par appel dans son journal.")
    return total


# ─────────────────────────────────────────────────────────────────────────────
# 6 · La clé, le solde, le disque — gratuit, et ça évite un lot lancé pour rien
# ─────────────────────────────────────────────────────────────────────────────

def preuve_cle(section: Section, note: float) -> None:
    """La clé existe, elle est acceptée, et le solde couvre la note.

    Les deux relevés interrogés — `/api/v1/key` et `/api/v1/credits` — sont
    gratuits. **La clé n'est jamais imprimée**, ni entière ni tronquée : on ne
    montre que ce qu'elle répond.
    """
    from essai_identite import lire_cle

    cle = lire_cle()
    if not cle:
        section.rouge("aucune clé OpenRouter — ni dans l'environnement, ni dans .env")
        section.dit('      soit :  $env:OPENROUTER_API_KEY = "sk-or-..."')
        section.dit(f"      soit :  une ligne OPENROUTER_API_KEY=... "
                    f"dans {RACINE.parent / '.env'}")
        return
    provenance = ("la variable d'environnement OPENROUTER_API_KEY"
                  if os.environ.get("OPENROUTER_API_KEY", "").strip()
                  else str(RACINE.parent / ".env"))
    section.vert(f"clé trouvée ({len(cle)} caractères), lue depuis {provenance}")

    solde: float | None = None
    for chemin in ("/api/v1/key", "/api/v1/credits"):
        requete = urllib.request.Request(
            "https://openrouter.ai" + chemin,
            headers={"Authorization": f"Bearer {cle}"},
        )
        try:
            with urllib.request.urlopen(requete, timeout=DELAI) as reponse:
                donnees = (json.loads(reponse.read().decode("utf-8")) or {}).get("data") or {}
        except urllib.error.HTTPError as erreur:
            if erreur.code in (401, 403):
                section.rouge(
                    f"la clé est refusée par {chemin} (HTTP {erreur.code}) — "
                    f"tous les appels du lot échoueraient"
                )
                return
            section.jaune(f"{chemin} indisponible (HTTP {erreur.code})")
            continue
        except (urllib.error.URLError, OSError, ValueError) as erreur:
            section.jaune(f"{chemin} injoignable ({type(erreur).__name__})")
            continue

        if chemin == "/api/v1/key":
            section.vert("la clé est acceptée par le fournisseur")
            plafond = donnees.get("limit")
            reste = donnees.get("limit_remaining")
            if plafond is None:
                section.dit("      la clé n'a pas de plafond propre")
            else:
                section.dit(f"      plafond de la clé : {plafond} $, reste {reste} $")
                if isinstance(reste, (int, float)):
                    solde = float(reste) if solde is None else min(solde, float(reste))
        else:
            credits = donnees.get("total_credits")
            usage = donnees.get("total_usage")
            if isinstance(credits, (int, float)) and isinstance(usage, (int, float)):
                reste = float(credits) - float(usage)
                section.dit(f"      compte : {credits:.2f} $ achetés, "
                            f"{usage:.2f} $ consommés, {reste:.2f} $ restants")
                solde = reste if solde is None else min(solde, reste)

    if solde is None:
        section.jaune("solde inconnu — le fournisseur ne l'a pas dit")
    elif solde < note:
        section.rouge(
            f"solde {solde:.2f} $ inférieur à la note estimée {note:.2f} $ — "
            f"le lot s'arrêterait au milieu, après avoir payé le début"
        )
    else:
        section.vert(
            f"solde {solde:.2f} $ pour une note de {note:.2f} $ — il resterait "
            f"{solde - note:.2f} $ après le lot"
        )


def preuve_disque(section: Section, dossiers: list[Path]) -> None:
    """On peut écrire là où les images payées vont tomber.

    Un lot payant qui découvre au premier `write_bytes` que le dossier n'est pas
    inscriptible a déjà payé l'appel dont il perd l'image.
    """
    for dossier in dossiers:
        try:
            dossier.mkdir(parents=True, exist_ok=True)
            temoin = dossier / ".verifier-ecriture"
            temoin.write_bytes(b"ok")
            temoin.unlink()
        except OSError as erreur:
            section.rouge(f"{dossier} n'est pas inscriptible — {erreur}")
            continue
        section.vert(f"{dossier.relative_to(RACINE.parent)} est inscriptible")


def utf8() -> None:
    """La console en UTF-8 — `docs/PIEGES.md`, et ça vaut aussi pour le rapport."""
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
