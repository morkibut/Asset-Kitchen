"""Ce qu'un graphe ComfyUI sait recevoir, lu sur le graphe seul (MO6).

`docs/PLAN-catalogue-des-moteurs.md` § MO6 : « un workflow importé devient un
moteur comme les autres : ses capacités se déduisent de ce qu'il sait recevoir
(une zone, une image de fin, une durée) ».

**Deux temps, jamais confondus.** Une *lecture* dit ce que le graphe semble
savoir recevoir ; une *liaison* (`atelier.domaine.workflow`) dit ce que le profil
reçoit vraiment. La capacité d'un moteur se lit toujours sur la liaison (MO3,
PX2 : « jamais supposée ») ; la lecture ne fait que **proposer** — préremplir le
formulaire d'import, ou dire sur la page « Moteurs » qu'un profil déjà importé
pourrait recevoir davantage, et le relier d'un geste qui écrit une nouvelle
version. Un profil qu'on ne touche pas garde sa forme, donc sa version.

**Comment la lecture reconnaît chaque chose** — par les noms d'entrée que les
nœuds natifs de ComfyUI emploient, relevés et non devinés :

- *la zone à repeindre* : une entrée `mask` (`SetLatentNoiseMask`,
  `VAEEncodeForInpaint`, `InpaintModelConditioning`) ; en remontant ses liens,
  le `LoadImage` qui ne sert **qu'à elle** — pas l'image de départ, dont la
  transparence ferait aussi un masque mais que l'atelier dépose à part ;
- *l'image de fin d'un clip* : l'entrée `end_image`
  (`WanFirstLastFrameToVideo`), et le `LoadImage` qui ne sert qu'à elle —
  exactement ce que `sans_image_de_fin` retire quand on n'en demande pas ;
- *la durée d'un clip* : un nombre d'images écrit en toutes lettres (`length`
  de `WanImageToVideo`, `num_frames`, …) ; son pas, quand ComfyUI le déclare
  (`/object_info`, `step`) — Wan veut 4n + 1 images.

Tout est pur : ni réseau, ni disque. `object_info`, s'il est donné, ne sert
qu'à lire un pas et une sortie ; sans lui, la lecture reste entière.
"""
from __future__ import annotations

import copy
import re
from typing import Any

from atelier.domaine.workflow import IMAGE_DE_FIN, MASQUE, WorkflowRefuse, _est_un_lien

#: Les entrées qui reçoivent une zone à repeindre.
ENTREES_ZONE = ("mask",)
#: Les entrées qui reçoivent l'image de fin d'un clip.
ENTREES_FIN = ("end_image",)
#: Les entrées qui reçoivent l'image de départ d'un clip.
ENTREES_DEPART = ("start_image",)
#: Les champs qui portent le nombre d'images d'un clip.
CHAMPS_NOMBRE_D_IMAGES = ("length", "num_frames", "video_frames", "frame_count", "frames")
#: Les champs qui portent la cadence d'un clip.
CHAMPS_CADENCE = ("fps", "frame_rate")
#: Les nœuds qui chargent une image déposée, et le champ qui la nomme.
CHARGEURS = {"LoadImage": "image", "LoadImageMask": "image"}
#: Les champs de texte d'un encodeur de prompt.
CHAMPS_TEXTE = ("text", "prompt")


def _ordre(cle: str) -> tuple[int, str]:
    """Les nœuds dans l'ordre de leur numéro : « 9 » avant « 10 »."""
    return (int(cle), cle) if re.fullmatch(r"[0-9]+", cle) else (10**9, cle)


def _en_amont(graphe: dict, departs, sauf: tuple[str, ...] = ()) -> set[str]:
    """Tous les nœuds d'où viennent ces nœuds-là, eux compris — sans passer
    par les entrées nommées dans `sauf`."""
    vus: set[str] = set()
    pile = [str(d) for d in departs]
    while pile:
        cle = pile.pop()
        if cle in vus or cle not in graphe:
            continue
        vus.add(cle)
        pile.extend(str(v[0]) for c, v in graphe[cle]["inputs"].items() if c not in sauf and _est_un_lien(v))
    return vus


def _branche_propre(graphe: dict, noms: tuple[str, ...]) -> tuple[set[str], set[str]]:
    """Ce qui ne sert qu'aux entrées `noms`, et ce qui sert aussi ailleurs.

    Rend `(propre, partage)` : les nœuds en amont de ces entrées, séparés selon
    qu'un autre usage du graphe les atteint aussi — la transparence de l'image
    de départ, reliée à la fois au masque et à l'encodeur, est *partagée*."""
    sources = [v[0] for n in graphe.values() for c, v in n["inputs"].items() if c in noms and _est_un_lien(v)]
    branche = _en_amont(graphe, sources)
    ailleurs = [v[0] for cle, n in graphe.items() if cle not in branche
                for c, v in n["inputs"].items() if c not in noms and _est_un_lien(v)]
    autres = _en_amont(graphe, ailleurs, sauf=noms)
    return branche - autres, branche & autres


def _chargeurs(graphe: dict, parmi) -> list[str]:
    return sorted((c for c in parmi if graphe[c]["class_type"] in CHARGEURS), key=_ordre)


def _champ(graphe: dict, cle: str) -> dict[str, str]:
    return {"noeud": cle, "champ": CHARGEURS[graphe[cle]["class_type"]]}


def _texte(graphe: dict, entree: str, exclus: set[str] = frozenset()) -> dict[str, str] | None:
    """Le champ de texte qui arrive à une entrée `positive` ou `negative`."""
    sources = [v[0] for n in graphe.values() for c, v in n["inputs"].items() if c == entree and _est_un_lien(v)]
    for cle in sorted(_en_amont(graphe, sources) - exclus, key=_ordre):
        for champ in CHAMPS_TEXTE:
            if isinstance(graphe[cle]["inputs"].get(champ), str):
                return {"noeud": cle, "champ": champ}
    return None


def _nombre(valeur) -> bool:
    return isinstance(valeur, (int, float)) and not isinstance(valeur, bool)


def _declaration(object_info: dict | None, classe: str, champ: str):
    entree = ((object_info or {}).get(classe) or {}).get("input") or {}
    return (entree.get("required") or {}).get(champ) or (entree.get("optional") or {}).get(champ)


def lire_le_graphe(graphe: Any, object_info: dict | None = None) -> dict[str, Any]:
    """Ce que ce graphe au format API semble savoir recevoir.

    Rend, pour chaque chose, le champ proposé (`{"noeud", "champ"}`) ou `None`,
    et `remarques` : ce que la lecture a vu sans pouvoir le proposer, en clair.
    Refuse un document qui n'est pas un graphe au format API."""
    if not isinstance(graphe, dict) or not graphe or "nodes" in graphe or not all(
        isinstance(n, dict) and isinstance(n.get("class_type"), str) and isinstance(n.get("inputs"), dict)
        for n in graphe.values()
    ):
        raise WorkflowRefuse("Choisis l'export « format API » de ComfyUI : un objet de nœuds avec class_type et inputs.")
    graphe = {str(c): n for c, n in graphe.items()}
    remarques: list[str] = []

    zone, zone_partagee = _branche_propre(graphe, ENTREES_ZONE)
    masques = _chargeurs(graphe, zone)
    if not masques and _chargeurs(graphe, zone_partagee):
        remarques.append("La zone à repeindre vient de la transparence de l'image de départ : pour que l'atelier "
                         "y dépose la zone peinte, il faut la charger par un « LoadImage » à elle.")
    fin, _ = _branche_propre(graphe, ENTREES_FIN)
    fins = _chargeurs(graphe, fin)
    depart, _ = _branche_propre(graphe, ENTREES_DEPART)
    departs = _chargeurs(graphe, depart)
    pris = set(masques[:1]) | set(fins[:1])
    references = [c for c in departs if c not in pris] + [
        c for c in _chargeurs(graphe, graphe) if c not in pris and c not in departs]

    positif = _texte(graphe, "positive")
    negatif = _texte(graphe, "negative", {positif["noeud"]} if positif else set())
    if positif is None:
        # Un graphe sans entrée `positive` : le premier champ de texte venu.
        positif = next(({"noeud": c, "champ": ch} for c in sorted(graphe, key=_ordre)
                        for ch in CHAMPS_TEXTE if isinstance(graphe[c]["inputs"].get(ch), str)), None)

    images = next(({"noeud": c, "champ": ch, "valeur": graphe[c]["inputs"][ch]} for c in sorted(graphe, key=_ordre)
                   for ch in CHAMPS_NOMBRE_D_IMAGES
                   if isinstance(graphe[c]["inputs"].get(ch), int) and not isinstance(graphe[c]["inputs"][ch], bool)), None)
    pas = None
    if images is not None:
        declaration = _declaration(object_info, graphe[images["noeud"]]["class_type"], images["champ"])
        if isinstance(declaration, list) and len(declaration) > 1 and isinstance(declaration[1], dict):
            step = declaration[1].get("step")
            pas = step if isinstance(step, int) and not isinstance(step, bool) and 1 < step <= 64 else None
    cadence = next((graphe[c]["inputs"][ch] for c in sorted(graphe, key=_ordre) for ch in CHAMPS_CADENCE
                    if _nombre(graphe[c]["inputs"].get(ch)) and graphe[c]["inputs"][ch] > 0), None)
    duree = None
    if images is not None and cadence:
        duree = max(1, round(images["valeur"] / cadence))

    consommes = {str(v[0]) for n in graphe.values() for v in n["inputs"].values() if _est_un_lien(v)}
    finaux = [c for c in sorted(graphe, key=_ordre) if c not in consommes]
    declares = [c for c in finaux if ((object_info or {}).get(graphe[c]["class_type"]) or {}).get("output_node")]
    nommes = [c for c in finaux if re.search(r"save|combine", graphe[c]["class_type"], re.I)]
    sortie = (declares or nommes or finaux or [None])[0]

    return {
        "prompt": positif,
        "prompt_negatif": negatif,
        "references": [_champ(graphe, c) for c in references],
        MASQUE: _champ(graphe, masques[0]) if masques else None,
        IMAGE_DE_FIN: _champ(graphe, fins[0]) if fins else None,
        "images": images,
        "pas_images": pas,
        "cadence": cadence,
        "duree": duree,
        "sortie": sortie,
        "remarques": remarques,
    }


# ── Un profil déjà importé : ce qu'il sait, et ce qu'il pourrait savoir ──────


def capacites_du_profil(profil: dict) -> list[str]:
    """Ce que ce profil sait faire, **lu sur ses liaisons** — jamais sur la
    lecture du graphe. Un profil d'image qui relie une zone ne crée plus rien :
    il ne part jamais sans elle (`composer`)."""
    liaisons = profil["liaisons"]
    if profil["nature"] == "image":
        return ["repeindre_zone"] if MASQUE in liaisons else ["creer_image"]
    if profil["nature"] == "video":
        return ["animer", *(["finir_sur_image"] if IMAGE_DE_FIN in liaisons else [])]
    return ["faire_un_son"]


def a_relier(profil: dict) -> list[dict[str, Any]]:
    """Ce que le graphe de ce profil semble savoir recevoir et que ses liaisons
    ne relient pas encore, chacun avec sa phrase — et `reliable` quand le geste
    « relier » (`relier_ce_que_le_graphe_sait`) peut l'ajouter tout seul."""
    lecture = lire_le_graphe(profil["graphe"])
    liaisons = profil["liaisons"]
    manques: list[dict[str, Any]] = []
    if profil["nature"] == "image" and MASQUE not in liaisons and lecture[MASQUE]:
        noeud = lecture[MASQUE]["noeud"]
        reference = profil["references_min"] >= 1 or bool(_reference_libre(profil, lecture))
        if profil.get("variantes"):
            texte = (f"Son graphe reçoit une zone à repeindre (nœud {noeud}), mais il a des variantes par nombre de "
                     "références : relie la zone dans chacune, en important une nouvelle version complète.")
        elif not reference:
            texte = (f"Son graphe reçoit une zone à repeindre (nœud {noeud}), mais aucune image à repeindre : "
                     "il lui faut un « LoadImage » pour l'image d'en dessous.")
        else:
            texte = (f"Son graphe reçoit une zone à repeindre (nœud {noeud}) : relie-la, et il repeindra une zone "
                     "dans « Repeindre ». Il ne créera plus d'image sans zone.")
        manques.append({"capacite": "repeindre_zone", "texte": texte,
                        "reliable": reference and not profil.get("variantes")})
    if profil["nature"] == "video" and IMAGE_DE_FIN not in liaisons and lecture[IMAGE_DE_FIN]:
        noeud = lecture[IMAGE_DE_FIN]["noeud"]
        manques.append({"capacite": "finir_sur_image", "reliable": True,
                        "texte": f"Son graphe charge une image de fin (nœud {noeud}) : relie-la, et « Fin de "
                                 "l'animation » s'y offrira."})
    if profil["nature"] == "video" and not {"images", "secondes"} & set(liaisons) and lecture["images"]:
        images = lecture["images"]
        manques.append({"capacite": "durees", "reliable": False,
                        "texte": f"Sa durée est écrite dans le graphe ({images['valeur']} images, champ "
                                 f"« {images['champ']} » du nœud {images['noeud']}) : pour lui proposer plusieurs "
                                 "durées, importe-le de nouveau en reliant le nombre d'images."})
    return manques


def _reference_libre(profil: dict, lecture: dict) -> dict[str, str] | None:
    """Le chargeur d'image que le profil ne relie à rien, pour l'image d'en
    dessous d'une zone — jamais celui de la zone elle-même."""
    lies = {(l["noeud"], l["champ"]) for liens in profil["liaisons"].values() for l in liens}
    return next((r for r in lecture["references"] if (r["noeud"], r["champ"]) not in lies), None)


def relier_ce_que_le_graphe_sait(profil: dict) -> dict[str, Any]:
    """Le profil brut d'une nouvelle version qui relie tout ce que `a_relier`
    dit reliable — la zone (et, s'il n'en reçoit aucune, l'image d'en dessous),
    l'image de fin. Refusé s'il n'y a rien à relier. Le profil d'origine ne
    bouge pas : c'est une version de plus, que `normaliser` vérifie comme
    toute autre."""
    reliables = {m["capacite"] for m in a_relier(profil) if m["reliable"]}
    if not reliables:
        raise WorkflowRefuse("Ce workflow relie déjà tout ce que son graphe sait recevoir.")
    lecture = lire_le_graphe(profil["graphe"])
    brut = {c: copy.deepcopy(v) for c, v in profil.items() if c not in ("version", "cree_le", "modele", "diagnostic")}
    liaisons = brut["liaisons"]
    if "repeindre_zone" in reliables:
        if profil["references_min"] < 1:
            liaisons["reference:0"] = [_reference_libre(profil, lecture)]
        liaisons[MASQUE] = [lecture[MASQUE]]
    if "finir_sur_image" in reliables:
        liaisons[IMAGE_DE_FIN] = [lecture[IMAGE_DE_FIN]]
    return brut
