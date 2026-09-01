# -*- coding: utf-8 -*-
"""Essai d'animation — quel modèle sait dessiner un mouvement, et à quel prix réel.

**Manche 1, le 1ᵉʳ septembre 2026** : sept modèles, deux tirages chacun. Elle a
montré que le mouvement dépend du modèle et non de la méthode — trois modèles
font travailler le corps, quatre rendent huit copies de la même pose.

**Manche 2, la même journée** : les quatre premiers, plus l'ancien défaut du
produit comme témoin, **huit tirages chacun**. Deux tirages ne disent pas si un
modèle est *régulier* ; or c'est là qu'est la vraie question d'argent. Un modèle
trois fois moins cher qui rate une fois sur trois reste deux fois moins cher —
et c'est le **coût par planche utilisable** qui le dit, pas le tarif affiché.

**Rien n'est réinventé** : le prompt et les images jointes sont **relus dans la
génération de référence**, le gabarit est redessiné par le module du produit.
Chaque modèle reçoit exactement ce que le premier a reçu. Un essai qui
recomposerait son texte mesurerait sa propre recomposition.

    Clé   : une ligne OPENROUTER_API_KEY=sk-or-... dans gag2/.env
    Lancer: .venv\\Scripts\\python.exe essais/essai_animation.py

Sortie : `essais/resultats_animation/<modele>/jet<N>.png`, plus `mesures.json`.
Un tirage déjà sur le disque est sauté : **relancer ne repaie jamais**.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(DEPOT))

from atelier.domaine.demande import Demande
from atelier.domaine.pliage import geometrie
from atelier.image.pliage import gabarit
from atelier.fournisseur.openrouter import CLE, OpenRouter
from atelier.reglages import lire_secret

SORTIE = RACINE / "resultats_animation"
MESURES = SORTIE / "mesures.json"

# La génération dont on rejoue le départ — façon A, premier tirage.
REFERENCE = DEPOT / "donnees" / "generations" / "cb3ebb37f3cd4e21987964cd1af87770"
PROJET = "essai-animation"

JETS = tuple(range(1, 9))
CASES = 8

# **Un plafond dur, en argent réel, et il porte sur CE lancement.** Une boucle
# qui dépense sans borne n'est pas un essai, c'est un accident. Compté sur le
# lancement et non sur le cumul : un plafond cumulé rendrait une relance
# impossible à lire — on ne saurait plus si elle s'arrête parce qu'elle a fini
# ou parce que les manches d'avant ont mangé la réserve.
PLAFOND_USD = 2.50

# **Combien d'appels en même temps.** Le banc est long à cause d'un seul modèle —
# `qwen` met plus de quatre minutes par planche. Les mener en parallèle ramène
# l'attente au plus lent, au lieu de la somme de tous.
PARALLELE = 4

# Le banc de la manche 2 : les quatre qui ont fait travailler le corps, **plus
# `gpt-image-2`**, qui n'y est pas pour concourir mais pour servir de repère —
# c'est lui que le produit a utilisé jusqu'ici, et une comparaison sans le point
# de départ ne dit pas s'il faut changer.
BANC = [
    "qwen/qwen-image-3-pro",
    "google/gemini-3-pro-image",
    "google/gemini-3.1-flash-image",
    "bytedance-seed/seedream-4.5",
    "openai/gpt-image-2",
]


def references() -> tuple[bytes, ...]:
    """Ce qui est parti la première fois, relu à la source — et le gabarit.

    L'ordre est celui de l'envoi : ce que l'auteur et le projet ont posé, puis
    le gabarit de la grille, qui ferme la liste.
    """
    fiche = json.loads((REFERENCE / "generation.json").read_text("utf-8"))
    octets: list[bytes] = []
    for r in fiche["references"]:
        if r["origine"] == "carte":
            chemin = DEPOT / "donnees" / "projets" / PROJET / "tableau" / f"{r['asset']}.png"
        else:
            gen, rang = r["asset"].rsplit("-", 1)
            # **Le rendu, jamais le brut** : c'est ce que l'adaptateur renvoie.
            chemin = DEPOT / "donnees" / "generations" / gen / f"{rang}-rendu.png"
        octets.append(chemin.read_bytes())
    octets.append(gabarit(geometrie(CASES)))
    return tuple(octets)


class Caisse:
    """Ce qui a été dépensé, et le plafond. **Un seul endroit qui compte.**

    Partagée par tous les appels en parallèle : sans elle, quatre appels lancés
    ensemble pourraient franchir le plafond à quatre reprises avant qu'aucun ne
    l'ait vu.
    """

    def __init__(self, depart: float, plafond: float) -> None:
        self.depense = depart
        self.plafond = plafond
        self._verrou = asyncio.Lock()

    async def autorise(self) -> bool:
        async with self._verrou:
            return self.depense < self.plafond

    async def ajoute(self, montant: float) -> float:
        async with self._verrou:
            self.depense += montant
            return self.depense


async def principal() -> None:
    fiche = json.loads((REFERENCE / "generation.json").read_text("utf-8"))
    source = fiche["demande"]
    jointes = references()
    print(f"prompt rejoue  : {len(source['prompt'])} caracteres")
    print(f"images jointes : {len(jointes)} (dont le gabarit {CASES} cases)")

    passerelle = OpenRouter(lire_secret(CLE.nom))
    if (raison := passerelle.indisponible()) is not None:
        print(f"[x] {raison}")
        return
    catalogue = {m.chez_lui: m for m in await passerelle.catalogue()}

    SORTIE.mkdir(parents=True, exist_ok=True)
    releve = json.loads(MESURES.read_text("utf-8")) if MESURES.exists() else {}
    dejà = sum(
        l.get("cout_usd", 0.0)
        for m in releve.values()
        for l in m.values()
        if isinstance(l, dict)
    )
    # **Le plafond porte sur ce lancement**, pas sur le cumul : ce qui est déjà
    # sur le disque ne sera pas repayé, donc le compter ici n'empêcherait rien
    # et ferait s'arrêter une relance qui n'a rien dépensé.
    caisse = Caisse(0.0, PLAFOND_USD)
    print(f"deja paye avant: ${dejà:.4f}   plafond de ce lancement ${PLAFOND_USD:.2f}\n")

    # **Écrire le relevé est sérialisé** : quatre appels qui finissent ensemble
    # réécriraient le même fichier à partir de la même copie, et le dernier
    # effacerait les trois autres. C'est le piège de `cartes.json`, déjà payé
    # une fois dans ce dépôt (`atelier/domaine/carte.py`).
    plume = asyncio.Lock()
    portillon = asyncio.Semaphore(PARALLELE)

    async def noter(modele: str, jet: str, ligne: dict) -> None:
        async with plume:
            releve.setdefault(modele, {})[jet] = ligne
            MESURES.write_text(json.dumps(releve, indent=1, ensure_ascii=False), "utf-8")

    async def un_tirage(nom: str, modele, jet: int) -> None:
        dossier = SORTIE / nom.replace("/", "_")
        fichier = dossier / f"jet{jet}.png"
        if fichier.exists():
            return
        async with portillon:
            if not await caisse.autorise():
                return
            demande = Demande(
                prompt=source["prompt"],
                prompt_negatif=source.get("prompt_negatif", ""),
                proportions=source.get("proportions", "1:1"),
                resolution=source.get("resolution"),
                variations=1,
                references=jointes,
                # **Repris** : le texte part mot pour mot, sans que rien s'ajoute.
                # C'est ce qui rend les modeles comparables entre eux.
                repris=True,
            )
            debut = time.monotonic()
            try:
                image = await passerelle.generer(modele, demande)
            except Exception as erreur:  # noqa: BLE001 — un banc ne s'arrete pas
                secondes = round(time.monotonic() - debut, 1)
                # **Un echec compte comme un essai, et il ne coute rien.** C'est
                # exactement ce que le cout par planche utilisable doit absorber.
                await noter(
                    nom,
                    f"jet{jet}",
                    {
                        "echec": f"{type(erreur).__name__}: {erreur}",
                        "secondes": secondes,
                        "cout_usd": 0.0,
                    },
                )
                print(f"{nom:<32} jet {jet} — echec en {secondes:.0f}s : {type(erreur).__name__}")
                return
            fichier.write_bytes(image.octets)
            secondes = round(time.monotonic() - debut, 1)
            total = await caisse.ajoute(image.cout_usd)
            await noter(
                nom,
                f"jet{jet}",
                {
                    "cout_usd": image.cout_usd,
                    "unite": image.unite,
                    "consomme": image.consomme,
                    "secondes": secondes,
                    "octets": len(image.octets),
                },
            )
            print(f"{nom:<32} jet {jet} — ${image.cout_usd:.4f} · {secondes:.0f}s · total ${total:.4f}")

    taches = []
    for nom in BANC:
        modele = catalogue.get(nom)
        if modele is None:
            print(f"{nom:<32} absent du catalogue — saute")
            continue
        if modele.references_max < len(jointes):
            print(f"{nom:<32} {modele.references_max} places < {len(jointes)} — saute")
            continue
        (SORTIE / nom.replace("/", "_")).mkdir(parents=True, exist_ok=True)
        for jet in JETS:
            taches.append(un_tirage(nom, modele, jet))

    await asyncio.gather(*taches)
    print(f"\ntotal depense : ${caisse.depense:.4f}")
    if caisse.depense >= PLAFOND_USD:
        print("[!] plafond atteint — des tirages ont ete sautes.")


if __name__ == "__main__":
    asyncio.run(principal())
