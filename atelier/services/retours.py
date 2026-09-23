"""RV7 — **le retour, là où l'on a cliqué** : ce qui est parti, rangé par case visée.

Après « Lancer », la case visée (la rangée d'une direction, la case d'une pose)
montre « en cours », puis la vignette, ou « ratée » avec sa raison. Ce module
écrit **la forme de cet état**, et c'est la décision de la tranche.

## La décision : un retour se *déduit*, il ne s'enregistre pas

Un retour n'est écrit nulle part. Il se recalcule à chaque lecture depuis deux
choses que le serveur garde déjà sur le disque :

- les **travaux** des fabrications suivies (`travaux/<jeu>/<id>/travail.json`) —
  un clip, de l'image de départ jusqu'au découpage ;
- le **chantier** des générations d'image (`ServiceGenerations.chantier`) — une
  image fixe qui attend encore son issue.

C'est ce qui le fait **survivre à un rechargement** : l'écran n'a rien poussé,
il relit. Un état « en cours » que l'écran aurait posé lui-même serait perdu au
premier F5, et mentirait sur un travail lancé depuis un autre onglet ou par
l'agent. Un second fichier « ce qui est en vol » aurait été une seconde vérité à
tenir à jour à côté du travail — la première divergence aurait laissé une case
« en cours » pour toujours.

## La forme : une liste plate de retours, chacun avec son adresse

```
{"nature": "clip" | "image",
 "travail": id | None, "generation": id | None, "serie": clé | None,
 "personnage", "pose", "direction",          # l'adresse : la case visée ("" = sans direction)
 "etat": "en_cours" | "ratee" | "interrompue",
 "phase": "image" | "video" | "decoupage" | "livraison",
 "lance_le": secondes depuis l'époque,        # l'écran compte le temps écoulé lui-même
 "attendu_s": secondes | None,                # None : personne ne sait (payant, jamais mesuré)
 "raison": texte | None, "clip": id | None,
 "demande": la demande du travail | None}     # « Relancer » la reprend mot pour mot
```

- **Plate, et non rangée dans la matrice du personnage.** La charge d'un
  personnage voyage sur le flux à chaque retouche de fiche ; y mettre un état
  qui change toutes les secondes l'aurait fait voyager pour rien. L'écran range
  lui-même par `(pose, direction)`, la même clé que ses rangées.
- **Le temps écoulé ne se sert pas** : `lance_le` suffit, l'écran compte. Un
  chiffre servi serait faux une seconde plus tard.
- **`attendu_s` part du lancement**, pas du début du calcul : une série locale
  passe dans la file une case après l'autre, donc la case de rang *k* attend
  `secondes + k × secondes_suivant` (`Attente.lot` : le premier tirage charge le
  modèle, les suivants non — point 8ter d'AGENTS.md).
- **Un travail fini ne rend plus de retour** : sa bande est dans la case, par
  le chemin ordinaire des bandes. Un travail annulé non plus.
- **Un échec reste affiché jusqu'au suivant.** Un retour « ratée » ou
  « interrompue » s'efface dès qu'un travail plus récent vise la même case : on
  a relancé, et le nouveau retour prend sa place. Rien d'autre ne l'efface, et
  c'est voulu — un échec qui disparaît tout seul serait un échec qu'on n'a pas
  vu (RV1).
- **`clips_suivis`** accompagne la liste : les clips que ces travaux portent.
  L'écran les tait parmi les « clips pas encore montés » de la rangée, pour ne
  pas montrer deux fois la même vidéo — une fois comme clip, une fois comme
  retour.

Aucun fournisseur, aucune écriture : ce module lit des dictionnaires et des
générations, et il tourne réseau coupé.
"""

from __future__ import annotations

from typing import Any, Iterable

from atelier.domaine.generation import Generation, Statut

# Les étapes d'un travail (`ServiceTravaux._executer`), dites en trois mots que
# l'auteur reconnaît. **La seule table** : la relecture d'une série et la case
# visée lisent toutes les deux `phase`, jamais `etape`.
_PHASES = {
    "reference": "image",
    "reference_soumise": "image",
    "video": "video",
    "video_soumise": "video",
    "file_locale": "video",
    "montage": "decoupage",
    "livraison": "livraison",
}

# Les états d'un travail relu (`ServiceTravaux.lire`) qui rendent un retour.
_ETATS = {
    "en_cours": "en_cours",
    "a_verifier": "ratee",
    "a_reprendre": "interrompue",
    "externe_inconnu": "interrompue",
}


def phase(travail: dict[str, Any]) -> str:
    """L'étape d'un travail en un mot : image, vidéo, découpage, livraison.

    Une case qui part d'une image **déjà là** n'a pas d'étape « image » : son
    travail garde `etape = "reference"` jusqu'à la soumission du clip, mais sa
    référence est préparée (`entree_video`) — c'est donc la vidéo qu'on attend.
    """
    etape = travail.get("etape") or ""
    trouvee = _PHASES.get(etape, "termine" if etape == "termine" else "video")
    if trouvee == "image" and travail.get("entree_video"):
        return "video"
    return trouvee


def attendu_s(travail: dict[str, Any]) -> float | None:
    """Le temps attendu **depuis le lancement**, ou `None` quand on l'ignore.

    Seul un calcul local mesuré a un temps (`annonce.temps_local`) ; un payant
    n'en a pas, et on n'en invente pas.
    """
    temps = (travail.get("annonce") or {}).get("temps_local")
    if not temps or not temps.get("secondes"):
        return None
    rang = int((travail.get("serie") or {}).get("rang") or 0)
    suivant = temps.get("secondes_suivant") or temps["secondes"]
    return float(temps["secondes"]) + rang * float(suivant)


def _lance_le(travail: dict[str, Any]) -> float:
    # `lance_le` naît avec RV7 ; un travail lancé avant n'a que sa dernière
    # écriture, puis sa préparation.
    return float(travail.get("lance_le") or travail.get("modifie_le") or travail.get("cree_le") or 0)


def _du_clip(travail: dict[str, Any]) -> bool:
    """Un travail d'animation — celui qui vise une case d'un sujet."""
    return travail.get("nature") in (None, "animation") and bool((travail.get("demande") or {}).get("personnage"))


def retour_du_travail(travail: dict[str, Any]) -> dict[str, Any] | None:
    """Le retour d'un travail **relu** (`ServiceTravaux.lire`), ou `None`."""
    if not _du_clip(travail):
        return None
    etat = "ratee" if travail.get("controle") else _ETATS.get(travail.get("etat", ""))
    if etat is None:
        return None
    d = travail["demande"]
    return {
        "nature": "clip",
        "travail": travail["identifiant"],
        "generation": None,
        "serie": (travail.get("serie") or {}).get("cle"),
        "personnage": d["personnage"],
        "pose": d.get("pose") or "",
        "direction": d.get("direction") or "",
        "etat": etat,
        "phase": phase(travail),
        "lance_le": _lance_le(travail),
        "attendu_s": attendu_s(travail),
        "raison": travail.get("raison") if etat != "en_cours" else None,
        "clip": travail.get("clip"),
        "demande": d,
    }


_EN_VOL = (Statut.EN_ATTENTE, Statut.EN_COURS)


def retour_de_l_image(generation: Generation) -> dict[str, Any] | None:
    """Le retour d'une image fixe qui vise une case et n'est pas arrivée.

    Seulement « en cours » : l'issue d'une image — arrivée, échouée — se lit
    déjà dans sa rangée et dans le chantier ; c'est l'attente qu'on ne voyait
    pas.
    """
    if generation.clip is not None or not generation.personnage or not generation.pose:
        return None
    if not any(e.statut in _EN_VOL for e in generation.emplacements):
        return None
    return {
        "nature": "image",
        "travail": None,
        "generation": generation.identifiant,
        "serie": None,
        "personnage": generation.personnage,
        "pose": generation.pose,
        "direction": generation.direction or "",
        "etat": "en_cours",
        "phase": "image",
        "lance_le": float(generation.cree_le),
        "attendu_s": None,
        "raison": None,
        "clip": None,
        "demande": None,
    }


def retours_par_case(travaux: Iterable[dict[str, Any]], chantier: Iterable[Generation],
                     personnage: str | None = None) -> dict[str, Any]:
    """Les retours d'un jeu — ou d'un seul sujet —, et les clips qu'ils portent.

    `travaux` sont des travaux **relus** (un travail dont le suivi s'est
    interrompu y est déjà `a_reprendre`) ; `chantier` les générations d'image
    qui attendent une issue.
    """
    travaux = [t for t in travaux if _du_clip(t)
               and (personnage is None or t["demande"]["personnage"] == personnage)]
    # Les images de départ des travaux passent aussi par le chantier ; elles
    # sont l'étape « image » de leur clip, pas une image fixe de plus.
    references = {t.get("generation_image") for t in travaux if t.get("generation_image")}
    retours = [r for t in travaux if (r := retour_du_travail(t))]

    # **Un échec reste jusqu'au suivant** : un travail lancé plus tard sur la
    # même case l'efface.
    dernier: dict[tuple[str, str, str], float] = {}
    for t in travaux:
        # `demarrage_recu` ne sort pas de `lire` ; un travail parti n'est
        # simplement plus « prepare ».
        if t.get("etat") != "prepare":
            d = t["demande"]
            cle = (d["personnage"], d.get("pose") or "", d.get("direction") or "")
            dernier[cle] = max(dernier.get(cle, 0.0), _lance_le(t))
    retours = [r for r in retours if r["etat"] == "en_cours"
               or dernier.get((r["personnage"], r["pose"], r["direction"]), 0.0) <= r["lance_le"]]

    for generation in chantier:
        if generation.identifiant in references:
            continue
        if personnage is not None and generation.personnage != personnage:
            continue
        if (r := retour_de_l_image(generation)):
            retours.append(r)

    retours.sort(key=lambda r: r["lance_le"])
    suivis = sorted({t["clip"] for t in travaux if t.get("clip") and t.get("etat") in _ETATS})
    return {"retours": retours, "clips_suivis": suivis}
