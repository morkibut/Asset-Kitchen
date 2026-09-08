# -*- coding: utf-8 -*-
"""B12 — l'essai : **la vitesse jouée est celle qui sort à l'export**, et une
animation qui manque se voit dans ce que le serveur rend.

L'écran est neuf et ne parle à personne : il ne reçoit que des props. Ce qui se
vérifie ici n'est donc pas l'écran — `interface/src/composants/EssaiDuSujet.test.tsx`
s'en charge — mais les deux promesses qu'il emprunte au serveur.

**1. Le temps d'une image, des deux côtés du calque.** `duree_en_ms`
(`atelier/domaine/aseprite.py`) est le seul endroit qui arrondit, et son
résultat part dans `duration` du descriptif *et* dans l'image animée.
`dureeImageMs` (`interface/src/api.ts`) le double, parce que l'écran doit
compter seul. Deux formules qui divergeraient feraient jouer un rythme que rien
n'exporte — et le critère de la tranche dit exactement l'inverse.

⚠️ **La divergence n'est pas théorique, et elle ne se voit pas à la lecture.**
Python arrondit un demi au **pair le plus proche**, JavaScript le pousse vers le
**haut**. À 16 images par seconde — 62,5 ms —, `round` rend 62 et `Math.round`
rend 63. Seize images par seconde est une cadence d'animation ordinaire. C'est
pour ça que cet essai fait tourner la vraie fonction TypeScript sous Node plutôt
que de recopier une table de valeurs attendues : deux tables tenues à la main
finissent par ne plus dire la même chose, et c'est très exactement la panne
qu'on veut fermer.

**2. La forme que l'écran lit.** Une bande se range dans `(pose, direction)`, et
une direction sans bande rend une liste vide plutôt qu'une bande d'ailleurs.
C'est ce qui permet à l'essai de dire *l'attaque vers le sud n'existe pas* au
lieu de jouer l'attaque vers l'est.

⚠️ **Aucune bande n'est découpée ici** — même choix que `tests/test_b11.py` :
les bandes sont écrites dans le dépôt comme un montage les aurait laissées.
Rien n'est payé, aucun fournisseur n'est sollicité.
"""

from __future__ import annotations

import itertools
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from atelier.domaine import aseprite
from atelier.domaine.bande import ALLER_RETOUR, Bande, Cadre, Prise
from atelier.domaine.plan import CONSIGNES

RACINE = Path(__file__).resolve().parent.parent
API = RACINE / "interface" / "src" / "api.ts"

_DISTINCTES = itertools.count(1)


# ── « L'écran et le serveur comptent le même temps » ──────────────────────────

# De 1 à 60 images par seconde par demi-cran — les curseurs du produit vont de 1
# à 30 (`AtelierDeBande.tsx`) et de 2 à 24 (`Montage.tsx`), le serveur n'impose
# que « plus de zéro ». Les demi-crans font tomber les cas qui arrondissent
# pile : 16 i/s vaut 62,5 ms, 3,2 i/s vaut 312,5 ms.
CADENCES = [n / 2 for n in range(2, 121)] + [3.2, 6.4, 12.5, 0.75]


def _corps_de_duree_image_ms() -> str:
    """Le corps de `dureeImageMs`, pris dans `api.ts` — **jamais recopié ici**.

    Recopier la formule ferait vérifier une copie plutôt que le code livré :
    l'essai passerait encore le jour où quelqu'un changerait `api.ts` seul.
    """
    source = API.read_text(encoding="utf-8")
    trouve = re.search(
        r"export function dureeImageMs\(cadence: number\): number \{\n(.*?)\n\}",
        source,
        re.S,
    )
    assert trouve is not None, "`dureeImageMs` a quitté interface/src/api.ts"
    return trouve.group(1)


def test_l_ecran_et_l_export_comptent_le_meme_temps_par_image():
    """Le critère de la tranche, pris au mot : *la vitesse jouée est exactement
    celle qui sortira à l'export*.

    La vraie fonction de l'écran tourne sous Node, et son résultat est comparé à
    `duree_en_ms` cadence par cadence. Un `Math.round` à la place de l'arrondi
    au pair ferait tomber cet essai sur 16 images par seconde."""
    node = shutil.which("node")
    if node is None:  # pragma: no cover — dépend de la machine
        pytest.skip("Node n'est pas sur cette machine : la moitié TypeScript ne peut pas tourner")

    programme = (
        "function dureeImageMs(cadence) {\n"
        f"{_corps_de_duree_image_ms()}\n"
        "}\n"
        "const cadences = JSON.parse(process.argv[1]);\n"
        "console.log(JSON.stringify(cadences.map(dureeImageMs)));\n"
    )
    rendu = subprocess.run(
        [node, "-e", programme, json.dumps(CADENCES)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert rendu.returncode == 0, rendu.stderr
    a_l_ecran = json.loads(rendu.stdout)

    assert len(a_l_ecran) == len(CADENCES)
    ecarts = [
        (cadence, vu, aseprite.duree_en_ms(cadence))
        for cadence, vu in zip(CADENCES, a_l_ecran)
        if vu != aseprite.duree_en_ms(cadence)
    ]
    assert ecarts == [], f"l'écran et l'export ne comptent pas pareil : {ecarts}"


def test_l_arrondi_au_pair_est_bien_celui_qui_diverge():
    """**La preuve que l'essai précédent mord.** Si la formule de l'écran
    employait `Math.round`, ces trois cadences-là rendraient une milliseconde de
    plus que le fichier. L'écrire noir sur blanc évite qu'un jour on « simplifie »
    la formule sans comprendre ce qu'elle tient."""
    for cadence, au_pair, vers_le_haut in ((16, 62, 63), (3.2, 312, 313), (0.8, 1250, 1250)):
        assert aseprite.duree_en_ms(cadence) == au_pair
        naif = max(1, int(1000.0 / cadence + 0.5))
        assert naif == vers_le_haut


def test_le_temps_d_une_image_ne_tombe_jamais_a_zero():
    """Une cadence très rapide reste jouable : le plancher est une milliseconde,
    des deux côtés. Sans lui, une bande à mille images par seconde rendrait un
    intervalle nul — un métronome qui ne bat plus."""
    assert aseprite.duree_en_ms(2000) == 1
    assert aseprite.duree_en_ms(0) == 0


# ── « C'est bien ce nombre-là qui part dans le fichier » ──────────────────────


def _une_bande(**surplus) -> Bande:
    return Bande(
        identifiant=f"bande-{next(_DISTINCTES)}",
        clip="clip-paye",
        nom="marche",
        prises=tuple(Prise(numero=n) for n in range(4)),
        cadre=Cadre(gauche=0, sommet=0, droite=23, bas=23),
        case_largeur=24,
        case_hauteur=24,
        **surplus,
    )


def test_le_descriptif_ecrit_la_duree_que_l_ecran_joue():
    """Le lien qui rend le critère vérifiable : ce que l'écran calcule est
    littéralement ce que le fichier d'accompagnement porte, image par image."""
    bande = _une_bande(cadence=16.0)
    descriptif = aseprite.descriptif(
        bande, image="marche.png", case_largeur=24, case_hauteur=24, compte=4
    )
    durees = {image["duration"] for image in descriptif["frames"]}
    assert durees == {aseprite.duree_en_ms(16.0)} == {62}


def test_l_aller_retour_ne_rejoue_pas_les_deux_bouts():
    """La règle de cycle que l'écran recopie (`rangDeLaBande`, `Apercu.tsx`) est
    celle-ci, et pas une autre : sur quatre images, six pas et non huit. Un essai
    qui jouerait huit marquerait un temps d'arrêt à chaque extrémité."""
    assert aseprite.ordre_des_images(4, ALLER_RETOUR) == [0, 1, 2, 3, 2, 1]
    assert _une_bande(cadence=8.0, sens=ALLER_RETOUR).secondes == 0.75


# ── « Ce que l'écran lit pour dire qu'une animation manque » ──────────────────


def _creer(client, nom: str = "Le pèlerin") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _poser(atelier, personnage: str, pose: str, direction: str, **surplus) -> Bande:
    bande = _une_bande(
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
        **surplus,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


def _case(client, personnage: str, pose: str) -> dict:
    charge = client.get("/api/characters").json()
    sien = next(p for p in charge["personnages"] if p["identifiant"] == personnage)
    return next(c for c in sien["cases"] if c["pose"] == pose)


def test_une_direction_sans_bande_rend_une_liste_vide_et_pas_celle_d_a_cote(
    atelier, client
):
    """**Le cœur du deuxième critère.** L'attaque existe vers l'est et pas vers
    le sud : le serveur range l'une dans sa direction et laisse l'autre vide. Il
    n'y a donc rien à substituer, et l'écran n'a pas à s'en empêcher — la donnée
    ne le lui propose même pas."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    pelerin = _creer(client)
    _poser(atelier, pelerin, "attaque", "est", cadence=14.0)

    sienne = _case(client, pelerin, "attaque")
    par_direction = {d["identifiant"]: d["bandes"] for d in sienne["directions"]}
    assert [b["direction"] for b in par_direction["est"]] == ["est"]
    assert par_direction["sud"] == []
    assert par_direction["nord"] == []
    assert par_direction["ouest"] == []


def test_la_retenue_d_une_direction_est_celle_que_l_ecran_jouera(atelier, client):
    """L'essai joue *ce qui sortirait dans le jeu*, et le départage est celui de
    *Ses animations* : la retenue d'abord. Le serveur écrit le champ et ne
    démote personne (`atelier/domaine/bande.py`) — l'écran a donc besoin de le
    lire, direction par direction, et c'est ce que la matrice lui rend."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    pelerin = _creer(client)
    _poser(atelier, pelerin, "marche", "sud", cadence=12.0)
    retenue = _poser(atelier, pelerin, "marche", "sud", cadence=12.0, favori=True)

    dedans = next(
        d for d in _case(client, pelerin, "marche")["directions"] if d["identifiant"] == "sud"
    )
    assert len(dedans["bandes"]) == 2
    assert [b["identifiant"] for b in dedans["bandes"] if b["favori"]] == [
        retenue.identifiant
    ]


def test_une_bande_ecartee_ne_se_joue_pas(atelier, client):
    """Une animation écartée a quitté le rangement : l'essai doit la traiter
    comme absente, pas comme discrète. Le serveur la range à part, et `bandes`
    ne la porte plus — l'écran n'a rien à filtrer."""
    assert client.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    pelerin = _creer(client)
    _poser(atelier, pelerin, "repos", "sud", cadence=8.0, supprime_le=1.0)

    dedans = next(
        d for d in _case(client, pelerin, "repos")["directions"] if d["identifiant"] == "sud"
    )
    assert dedans["bandes"] == []
    assert len(dedans["bandes_ecartees"]) == 1


def test_les_quatre_poses_que_le_clavier_joue_sont_celles_que_le_produit_livre():
    """`EssaiDuSujet.tsx` mappe le déplacement, la course et l'attaque **par
    identifiant**, sur la liste livrée et rien d'autre. Renommer une de ces
    quatre clés côté serveur rendrait ces touches muettes sans qu'aucune erreur
    ne se lève : l'écran ne devine pas qu'un mot français désigne une marche."""
    for identifiant in ("repos", "marche", "course", "attaque"):
        assert identifiant in CONSIGNES

    source = (RACINE / "interface" / "src" / "composants" / "EssaiDuSujet.tsx").read_text(
        encoding="utf-8"
    )
    for identifiant in ("repos", "marche", "course", "attaque"):
        assert f'"{identifiant}"' in source, identifiant
