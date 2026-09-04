# -*- coding: utf-8 -*-
"""A12 — la matrice sur deux calques : les images fixes, et les animations.

Les critères de `docs/PLAN.md` § A12 qui vivent côté serveur. Ce que l'écran
montre — la bascule, les deux jauges, la vignette qui tourne — vit dans
`interface/src/App.test.tsx`.

**Aucun de ces essais ne découpe un vrai clip**, et c'est délibéré : ce qui se
mesure ici est *la composition d'une case*, pas l'extraction d'images. Les
bandes sont donc écrites directement dans le dépôt, comme un montage les aurait
laissées. `tests/test_a10.py` couvre l'autre moitié — comment elles naissent —
et lui a besoin du décodeur vidéo ; celui-ci tourne partout.

**Ce que la tranche instaure, et que ces essais tiennent.**

1. **Les deux calques ne se mêlent pas.** Une case qui porterait l'image *et*
   l'animation serait « remplie » dès qu'elle a l'une des deux, et une animation
   manquante se cacherait derrière une image présente — très exactement ce que
   l'auteur veut voir. L'invariant d'`E2` n'est pas tordu : il vaut **deux
   fois**, une fois par calque.
2. **Une animation par direction, jamais autant que d'images.** Une marche
   demande huit images *par direction* pour être dessinée et **une seule bande**
   par direction pour être animée : la bande porte déjà ses huit images dedans.
   C'est le seul endroit du produit où les deux comptes divergent, et c'est pour
   ça qu'il est écrit une fois, côté serveur.
3. **Retirer une bande d'une case ne perd rien.** Ni la bande, ni le clip — qui,
   lui, a été payé. C'est la différence de nature avec l'autre moitié de
   l'atelier, où défaire une désignation touche une image qui a coûté de
   l'argent.
4. **Une bande qui bouge s'annonce.** Le calque animé se lit dans le codex, les
   bandes s'écrivent dans la galerie : sans annonce, la matrice serait restée
   juste jusqu'au prochain changement de projet.
"""

from __future__ import annotations

import itertools

import pytest

from atelier.domaine.bande import Bande, Cadre

from tests.conftest import image_sujet


# ── Le décor : un personnage, ses poses, et des bandes écrites à la main ─────


_DISTINCTES = itertools.count(3)


def _creer(client, nom: str = "Balthazar") -> str:
    reponse = client.post("/api/characters", json={"nom": nom})
    assert reponse.status_code == 201, reponse.text
    return reponse.json()["personnage"]["identifiant"]


def _vue(client, identifiant: str) -> None:
    """Déclarer la vue du jeu, donc ses directions — un seul geste (E10)."""
    reponse = client.put("/api/universe", json={"vue": identifiant})
    assert reponse.status_code == 200, reponse.text


def _cases(client, personnage: str) -> dict[str, dict]:
    reponse = client.get("/api/characters")
    assert reponse.status_code == 200, reponse.text
    chose = next(
        p for p in reponse.json()["personnages"] if p["identifiant"] == personnage
    )
    return {c["pose"]: c for c in chose["cases"]}


def _poser_une_image(client, tmp_path, personnage: str, pose: str, direction="") -> str:
    """Une image importée puis rangée dans une case — le calque des images."""
    rang = next(_DISTINCTES) % 20 + 1
    fichier = tmp_path / f"{personnage}-{pose}-{direction}-{rang}.png"
    fichier.write_bytes(image_sujet(toile=24, bloc=1, logique_l=rang, logique_h=12))
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]
    corps = {"personnage": personnage, "pose": pose}
    if direction:
        corps["direction"] = direction
    reponse = client.put(f"/api/assets/{asset['identifiant']}/character", json=corps)
    assert reponse.status_code == 200, reponse.text
    return asset["identifiant"]


def _poser_une_bande(
    atelier,
    personnage: str,
    pose: str | None,
    direction: str | None = None,
    *,
    clip: str = "clip-paye",
    nom: str = "marche",
) -> Bande:
    """Une bande gardée, telle qu'un montage l'aurait laissée.

    **Écrite dans le dépôt, pas produite par le montage** : ce qui se mesure
    ici est ce que la matrice en fait, et faire tourner l'extraction à chaque
    essai aurait ajouté le décodeur vidéo aux conditions de tous.
    """
    bande = Bande(
        identifiant=f"bande-{next(_DISTINCTES)}",
        clip=clip,
        nom=nom,
        images=(0, 2, 4, 6),
        cadence=8.0,
        cadre=Cadre(0, 0, 23, 23),
        projet=atelier.bibliotheque.courant,
        personnage=personnage,
        pose=pose,
        direction=direction,
        case_largeur=24,
        case_hauteur=24,
    )
    atelier.base.enregistrer_bande(bande)
    return bande


# ── « Une case du calque animé est prise dès qu'une bande la porte » ─────────


def test_une_case_est_animee_des_qu_une_bande_la_porte(client, atelier):
    """*Pas parce que la bande est bonne* — **même règle que pour les images**.

    C'est l'invariant d'`E2` appliqué au second calque : une case est prise dès
    que quelque chose la porte. Juger si l'animation est réussie est une autre
    question, et elle se pose ailleurs.
    """
    personnage = _creer(client)
    assert _cases(client, personnage)["marche"]["bandes"] == []

    bande = _poser_une_bande(atelier, personnage, "marche")

    portees = _cases(client, personnage)["marche"]["bandes"]
    assert [b["identifiant"] for b in portees] == [bande.identifiant]


def test_une_case_animee_dit_de_quel_clip_sa_bande_vient(client, atelier):
    """**Le clip voyage avec la bande**, et c'est ce qui permet d'y remonter.

    Sans lui, l'écran saurait qu'une case est animée sans savoir d'où — donc
    sans pouvoir proposer d'en tirer une seconde bande plutôt que de commander
    un second clip, qui, lui, se paierait.
    """
    personnage = _creer(client)
    _poser_une_bande(atelier, personnage, "marche", clip="le-clip-qu-on-a-paye")

    portee = _cases(client, personnage)["marche"]["bandes"][0]
    assert portee["clip"] == "le-clip-qu-on-a-paye"


def test_les_deux_calques_ne_se_melent_pas(client, tmp_path, atelier):
    """⚠️ **La décision de la tranche, et le seul essai qui la tienne.**

    Une pose dessinée mais pas animée doit se lire comme *manquante* sur le
    calque animé. Si les deux contenus vivaient dans la même liste, la case
    serait pleine, et l'animation manquante se cacherait derrière l'image
    présente — ce que l'auteur vient précisément voir.
    """
    personnage = _creer(client)
    _poser_une_image(client, tmp_path, personnage, "marche")

    case = _cases(client, personnage)["marche"]
    assert len(case["images"]) == 1, "l'image est là"
    assert case["bandes"] == [], "et l'animation manque, visiblement"


def test_une_case_animee_ne_remplit_pas_le_calque_des_images(client, atelier):
    """La réciproque, et elle compte autant : une pose animée mais pas dessinée
    reste un trou sur le calque des images. Les deux calques se lisent l'un sans
    l'autre, dans les deux sens."""
    personnage = _creer(client)
    _poser_une_bande(atelier, personnage, "marche")

    case = _cases(client, personnage)["marche"]
    assert case["images"] == []
    assert len(case["bandes"]) == 1


# ── « Une animation par direction, jamais autant que d'images » ──────────────


def test_une_case_demande_une_animation_par_direction(client):
    """**C'est là que les deux calques cessent de se ressembler.**

    Une pose vue sous quatre angles demande quatre images pour être dessinée et
    quatre bandes pour être animée — une par angle. Le compte des images, lui,
    peut être bien plus grand : c'est *tant d'images dans tant de directions*.
    """
    personnage = _creer(client)
    _vue(client, "vue-dessus-34")

    case = _cases(client, personnage)["marche"]
    assert case["bandes_demandees"] == 4
    assert len(case["directions"]) == 4


def test_un_jeu_sans_direction_ne_demande_qu_une_animation(client):
    """Un jeu vu de face n'a pas d'angles : une pose y est animée par **une**
    bande, et le mot « direction » ne paraît nulle part — ici comme ailleurs."""
    personnage = _creer(client)
    _vue(client, "vue-face-fixe")

    case = _cases(client, personnage)["marche"]
    assert case["bandes_demandees"] == 1
    assert case["directions"] == []


def test_le_compte_des_animations_ne_suit_pas_celui_des_images(client):
    """⚠️ **Le piège que ce compte évite**, et il vaut d'être écrit.

    Multiplier comme le calque des images le fait — *tant d'images dans tant de
    directions* — aurait demandé trente-deux bandes pour une marche à huit
    images sur quatre angles. Une bande porte déjà ses images dedans : il en
    faut **quatre**, et la jauge aurait sinon plafonné à un huitième pour
    toujours.

    La marche est portée à huit images pour que l'écart se voie : sur une pose à
    une image par angle, les deux comptes tombent juste — et c'est le cas qui
    aurait laissé passer la multiplication.
    """
    personnage = _creer(client)
    _vue(client, "vue-dessus-34")
    reponse = client.put(
        "/api/characters/poses/marche", json={"nom": "marche", "images": 8}
    )
    assert reponse.status_code == 200, reponse.text

    case = _cases(client, personnage)["marche"]
    assert case["demandees"] > case["bandes_demandees"], (
        "une marche demande plus d'images que d'animations"
    )
    assert case["bandes_demandees"] == len(case["directions"])


def test_une_bande_se_range_dans_sa_direction(client, atelier):
    """Le second axe du calque animé : une bande dit son angle, et c'est là
    qu'elle se voit. Sans ça, on ne pourrait pas dire qu'il manque la marche
    vers le nord."""
    personnage = _creer(client)
    _vue(client, "vue-dessus-34")
    _poser_une_bande(atelier, personnage, "marche", "nord")

    angles = {a["identifiant"]: a for a in _cases(client, personnage)["marche"]["directions"]}
    assert len(angles["nord"]["bandes"]) == 1
    assert angles["sud"]["bandes"] == []


def test_une_bande_gardee_avant_les_directions_se_range_dans_la_premiere(
    client, atelier
):
    """**Le même repli que les images**, et pour la même raison : un jeu peut
    déclarer ses angles après avoir gardé des bandes, et une bande sans angle ne
    doit pas disparaître de la matrice. Elle se range dans la première, comme
    une image faite avant la déclaration (US-242)."""
    personnage = _creer(client)
    _poser_une_bande(atelier, personnage, "marche")  # aucune direction écrite
    _vue(client, "vue-dessus-34")

    angles = {a["identifiant"]: a for a in _cases(client, personnage)["marche"]["directions"]}
    premiere = _cases(client, personnage)["marche"]["directions"][0]["identifiant"]
    assert len(angles[premiere]["bandes"]) == 1
    assert sum(len(a["bandes"]) for a in angles.values()) == 1, "comptée une fois"


# ── « Une pose écartée n'apparaît sur aucun des deux calques » ───────────────


def test_une_pose_ecartee_n_apparait_sur_aucun_des_deux_calques(
    client, tmp_path, atelier
):
    """La règle du plan vaut pour les deux calques, et elle n'est écrite qu'une
    fois : les deux lisent les mêmes poses tenues. Une bande faite pour une pose
    ensuite écartée reste en dépôt — c'est la case qui disparaît, pas elle."""
    personnage = _creer(client)
    _poser_une_image(client, tmp_path, personnage, "marche")
    bande = _poser_une_bande(atelier, personnage, "marche")

    restantes = [
        p["identifiant"]
        for p in client.get("/api/characters").json()["plan"]
        if p["identifiant"] != "marche"
    ]
    reponse = client.put(
        f"/api/characters/{personnage}", json={"poses": restantes}
    )
    assert reponse.status_code == 200, reponse.text

    assert "marche" not in _cases(client, personnage)
    assert atelier.base.lire_bande(bande.identifiant) is not None


# ── « Retirer une bande d'une case ne supprime ni la bande, ni le clip » ─────


def test_retirer_une_bande_de_sa_case_ne_la_supprime_pas(client, atelier):
    """⚠️ **Le geste le plus facile à rendre destructeur du produit**, et il ne
    l'est pas.

    Une bande retirée redevient un brouillon : elle reste dans son clip, elle se
    réaffecte. Le clip, lui, a été payé une fois — aucun geste de la matrice ne
    peut le perdre.
    """
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")

    reponse = client.put(
        f"/api/strips/{bande.identifiant}/case",
        json={"pose": None, "direction": None},
    )
    assert reponse.status_code == 200, reponse.text

    assert _cases(client, personnage)["marche"]["bandes"] == [], "la case est vide"
    reste = atelier.base.lire_bande(bande.identifiant)
    assert reste is not None, "la bande est là"
    assert reste.brouillon, "et elle est redevenue un brouillon"
    assert reste.clip == bande.clip, "avec son clip"


def test_une_bande_retiree_se_reaffecte(client, atelier):
    """La conséquence de la précédente, et c'est elle qui la rend utile : on
    range une bande dans la mauvaise case, on la retire, on la remet ailleurs —
    sans jamais repasser par le montage, et sans rien payer."""
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")

    client.put(
        f"/api/strips/{bande.identifiant}/case",
        json={"pose": None, "direction": None},
    )
    reponse = client.put(
        f"/api/strips/{bande.identifiant}/case", json={"pose": "repos"}
    )
    assert reponse.status_code == 200, reponse.text

    cases = _cases(client, personnage)
    assert cases["marche"]["bandes"] == []
    assert len(cases["repos"]["bandes"]) == 1


# ── « Une bande qui bouge s'annonce » ───────────────────────────────────────


def test_le_flux_annonce_une_bande_affectee(client, atelier):
    """**Sans cette annonce, la matrice mentirait jusqu'au prochain projet.**

    On découpe un clip dans la galerie et la case se remplit dans le codex,
    deux écrans plus loin : le seul chemin qui relie les deux est le flux. Le
    genre est à lui, comme celui d'une carte ou d'un personnage.
    """
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, None)

    with atelier.diffusion.abonnement() as file:
        atelier.montage.affecter(bande.identifiant, "marche")
        annonce = file.get_nowait()

    assert annonce.genre == "bande"
    assert annonce.charge["identifiant"] == bande.identifiant
    assert annonce.charge["pose"] == "marche"
    assert annonce.charge["oubliee"] is False


def test_le_flux_annonce_une_bande_oubliee(client, atelier):
    """Elle part **marquée**, comme une carte oubliée et un lien coupé : l'écran
    lit le drapeau que le serveur pose, il ne rejoue jamais la règle."""
    personnage = _creer(client)
    bande = _poser_une_bande(atelier, personnage, "marche")

    with atelier.diffusion.abonnement() as file:
        atelier.montage.oublier(bande.identifiant)
        annonce = file.get_nowait()

    assert annonce.genre == "bande"
    assert annonce.charge["identifiant"] == bande.identifiant
    assert annonce.charge["oubliee"] is True


# ── « Un projet sans aucune animation se comporte comme aujourd'hui » ────────


def test_un_projet_sans_animation_se_lit_comme_avant(client, tmp_path):
    """Le calque animé **s'ajoute**, il ne déplace rien. Un projet qui n'a jamais
    vu une vidéo porte les mêmes cases, les mêmes comptes et les mêmes images
    qu'avant la tranche — les seules clés de plus sont vides."""
    personnage = _creer(client)
    _poser_une_image(client, tmp_path, personnage, "marche")

    for pose, case in _cases(client, personnage).items():
        assert case["bandes"] == [], pose
        assert case["bandes_demandees"] >= 1, pose
        for angle in case["directions"]:
            assert angle["bandes"] == [], (pose, angle["identifiant"])

    case = _cases(client, personnage)["marche"]
    assert len(case["images"]) == 1
    assert case["demandees"] >= 1


@pytest.mark.parametrize("vue", ["vue-face-fixe", "vue-dessus-34"])
def test_la_matrice_se_compose_sans_reseau(client, atelier, vue):
    """**Tout fonctionne réseau coupé, sauf commander.** Rien de ce que cet
    essai touche ne sort de la machine : les cases se composent sur le dépôt,
    et le double de fournisseur n'est pas même sollicité."""
    personnage = _creer(client)
    _vue(client, vue)
    _poser_une_bande(atelier, personnage, "marche")

    case = _cases(client, personnage)["marche"]
    assert case["bandes_demandees"] >= 1
    assert sum(len(a["bandes"]) for a in case["directions"]) + len(
        case["bandes"]
    ) >= 1
