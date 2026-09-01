# -*- coding: utf-8 -*-
"""U13 · Un second moteur de détourage, plus lourd et meilleur.

**Ce qui se mesure ici** : que le moteur d'une passe se choisisse dans un
catalogue et non dans une liste écrite en dur ; que le rapide reste ce qu'on
obtient sans rien demander ; que les **deux absences** se distinguent — un moteur
pas installé du tout est grisé avec sa raison, un modèle pas encore descendu
reste choisissable et annonce ce qu'il va rapatrier ; et qu'une recette nommant
un moteur absent le dise sans casser le rendu des autres passes.

**Aucun modèle n'est chargé ici, et c'est une obligation.** Importer `rembg`
tire `onnxruntime` dans le processus, or « le post-traitement ne touche jamais le
GPU » se *prouve* en regardant `sys.modules` (`tests/test_t2.py`) : un essai qui
l'importerait ferait tomber celui-là, dans l'ordre, sans rapport apparent. Le
seul essai qui a besoin de `rembg` le lance donc **dans un autre processus**.

**Ce que les modèles valent l'un contre l'autre** — durée, part gardée, accord —
vit dans `essais/essai_moteurs_silhouette.py`, gratuit, qui ne télécharge rien.
"""

from __future__ import annotations

import subprocess
import sys

import pytest

from atelier.domaine.recette import Passe, Recette
from atelier.image.traitement import (
    MODELE_ONNX,
    SILHOUETTES,
    _dossiers_des_modeles,
    detourer,
    etat_des_silhouettes,
    raison_du_modele,
    sans_moteur,
    silhouette,
)

from tests.conftest import image_sujet


# ── « Le moteur d'une passe se choisit dans une liste qui n'est plus en dur » ─


def test_le_catalogue_porte_plusieurs_modeles_et_un_seul_defaut():
    """*Le catalogue décide, jamais une liste en dur* — la règle du dépôt pour
    les modèles d'image, appliquée ici pour la même raison : un nom inscrit dans
    le code interdisait d'en essayer un autre sans toucher au code."""
    etat = etat_des_silhouettes()

    assert len(etat) >= 2
    assert [s["defaut"] for s in etat].count(True) == 1
    assert next(s for s in etat if s["defaut"])["nom"] == MODELE_ONNX
    # Chacun dit ce qu'il pèse, et ce n'est jamais zéro : « zéro n'est pas une
    # mesure, c'est l'absence de mesure ».
    assert all(s["octets"] > 0 and s["note"] for s in etat)


def test_le_rapide_est_ce_quon_obtient_sans_rien_demander():
    """Une passe qui ne nomme aucun modèle prend celui du produit — et c'est ce
    qui fait qu'une recette écrite avant ce champ rend ce qu'elle rendait."""
    assert Passe(moteur="modele").modele == ""
    assert silhouette("") is not None
    assert silhouette("").nom == MODELE_ONNX
    assert silhouette("").lent is False


def test_un_modele_inconnu_se_nomme_plutot_que_de_passer(client, tmp_path):
    fichier = tmp_path / "sujet.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]

    refus = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={"passes": [{"moteur": "modele", "modele": "u2net-des-familles"}]},
    )

    assert refus.status_code == 409, refus.text
    assert "u2net-des-familles" in refus.text


# ── « Deux absences, et elles ne se traitent pas pareil » ────────────────────


def test_un_modele_pas_descendu_reste_choisissable_et_annonce_son_poids():
    """**La seconde absence.** Griser un modèle qu'on peut rapatrier aurait
    obligé à sortir de l'atelier pour un téléchargement que l'atelier sait
    faire ; le confondre avec un moteur absent aurait laissé tomber une attente
    de plusieurs minutes sur un geste annoncé comme lent de quelques secondes.
    """
    etat = etat_des_silhouettes()

    for ligne in etat:
        # `descendu` dit le fichier sur le disque ; `raison` dit le paquet
        # absent. Ce sont deux questions, et l'écran s'en sert autrement : la
        # première annonce, la seconde grise.
        assert isinstance(ligne["descendu"], bool)
        assert ligne["raison"] is None or isinstance(ligne["raison"], str)
        # Et le poids voyage avec, parce que c'est lui qu'on annonce.
        assert ligne["octets"] > 1_000_000


def test_un_modele_pas_descendu_nempeche_pas_de_poser_la_recette(client, tmp_path):
    """Il se rapatrie au premier rendu ; la recette, elle, s'écrit tout de
    suite. C'est très exactement ce que « reste choisissable » veut dire."""
    absents = [s for s in SILHOUETTES if not _sur_le_disque(s.nom)]
    if not absents:
        pytest.skip("tous les modèles sont déjà descendus sur cette machine")
    fichier = tmp_path / "sujet.png"
    fichier.write_bytes(image_sujet())
    asset = client.post("/api/assets/import", json={"chemin": str(fichier)}).json()[
        "asset"
    ]

    pose = client.put(
        f"/api/assets/{asset['identifiant']}/recipe",
        json={
            "passes": [
                {"moteur": "bord", "tolerance": 28},
                {"moteur": "modele", "modele": absents[0].nom, "masquee": True},
            ]
        },
    )

    assert pose.status_code == 200, pose.text
    assert pose.json()["recette"]["passes"][1]["modele"] == absents[0].nom


def _sur_le_disque(nom: str) -> bool:
    from atelier.image.traitement import modele_descendu

    return modele_descendu(nom)


# ── « Une recette qui nomme un moteur absent ne casse pas le reste » ─────────


def test_une_passe_sans_moteur_est_sautee_et_les_autres_rendent(monkeypatch):
    """**Une recette voyage.** Elle peut nommer un modèle qu'une autre machine
    n'a pas, et l'image doit alors sortir avec les six autres places plutôt que
    pas du tout."""
    import atelier.image.traitement as tr

    monkeypatch.setattr(
        tr, "raison_moteur", lambda m: "le moteur par modèle n'est pas installé"
    )
    octets = image_sujet(toile=24, bloc=2)
    recette = Recette(
        passes=(Passe(moteur="bord", tolerance=28), Passe(moteur="modele"))
    )

    rgba = detourer(recette, octets)

    # Le fond est parti — la passe de bord a travaillé —, et rien n'a levé.
    assert rgba[0, 0, 3] == 0
    assert rgba[:, :, 3].any(), "il ne reste plus rien : la passe de bord n'a pas agi"


def test_ce_qui_manque_se_dit_au_lieu_de_se_taire(monkeypatch):
    """« Le dit sans casser » : sauter en silence serait la moitié du critère."""
    import atelier.image.traitement as tr

    monkeypatch.setattr(tr, "raison_moteur", lambda m: "pas installé")
    recette = Recette(
        passes=(Passe(moteur="bord"), Passe(moteur="modele"), Passe(moteur="modele"))
    )

    dites = sans_moteur(recette)

    assert dites == ["passe 2 : pas installé", "passe 3 : pas installé"]
    # Et une passe masquée ne se plaint pas : elle n'agit déjà pas.
    assert sans_moteur(Recette(passes=(Passe(moteur="modele", masquee=True),))) == []


def test_un_modele_pas_descendu_nest_pas_une_raison_de_ne_pas_agir():
    """Le distinguo qui tient toute l'étape : *pas installé* empêche, *pas
    descendu* n'empêche pas."""
    manquants = [s.nom for s in SILHOUETTES if not _sur_le_disque(s.nom)]
    if not manquants:
        pytest.skip("tous les modèles sont déjà descendus sur cette machine")

    # Sur une machine où `rembg` est là, un modèle non descendu ne donne aucune
    # raison : il se rapatrie au premier rendu.
    from atelier.image.traitement import raison_moteur

    if raison_moteur("modele") is None:
        assert raison_du_modele(manquants[0]) is None


# ── Les chemins où l'on cherche les modèles ─────────────────────────────────


def test_les_dossiers_cherches_sont_ceux_que_rembg_emploie():
    """**La seule redite du dépôt sur ce sujet, et elle est confrontée.**
    L'atelier ne peut pas demander ses chemins à `rembg` — l'importer tirerait
    `onnxruntime` dans le processus de l'atelier —, donc il les recalcule. Cet
    essai les confronte à ceux de `rembg` **dans un autre processus**, pour que
    la comparaison ne charge rien ici.

    Le pire qu'une divergence puisse faire est d'annoncer un téléchargement qui
    n'aura pas lieu ; elle ne peut pas fausser un rendu. C'est pour ça qu'elle
    se vérifie plutôt que de se prévenir par une mécanique.
    """
    lu = subprocess.run(
        [
            sys.executable,
            "-c",
            "from rembg.sessions import U2netSession as S;"
            "import os;print(os.path.dirname(S.model_dir()));print(S.legacy_home())",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    if lu.returncode != 0:
        pytest.skip("rembg n'est pas installé sur cette machine")

    par_modele, plat = (l.strip() for l in lu.stdout.strip().splitlines()[:2])
    cherches = _dossiers_des_modeles()

    assert par_modele in cherches, f"{par_modele} n'est pas cherché : {cherches}"
    assert plat in cherches, f"{plat} n'est pas cherché : {cherches}"


def test_lire_le_catalogue_ne_charge_pas_le_moteur():
    """L'invariant de T2, rejoué ici parce que c'est cette étape qui le mettait
    le plus en danger : tout ce qui répond « ce modèle est-il descendu ? » le
    fait en regardant le disque, jamais en important quoi que ce soit.

    **Dans un processus neuf, et il le faut.** `tests/test_t5.py` détoure pour
    de vrai quand `rembg` est installé, donc `onnxruntime` est déjà chargé quand
    ce fichier-ci s'exécute : une vérification faite ici mesurerait l'état laissé
    par un autre essai, pas ce que le catalogue charge. On repart de zéro.
    """
    lu = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys;"
            "from atelier.image.traitement import etat_des_silhouettes as e;"
            "e();"
            "print([n for n in ('onnxruntime','rembg','torch') if n in sys.modules])",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )

    assert lu.returncode == 0, lu.stderr
    assert lu.stdout.strip() == "[]", lu.stdout


def test_le_rendu_dune_passe_par_modele_reste_le_meme_sans_le_champ():
    """Une recette écrite avant ce champ se relit sans lui, et elle nomme alors
    le défaut du produit — donc elle rend ce qu'elle rendait."""
    ancienne = Passe.depuis_json({"moteur": "modele", "tolerance": 28})
    neuve = Passe.depuis_json({"moteur": "modele", "tolerance": 28, "modele": ""})

    assert ancienne == neuve
    assert Recette(passes=(ancienne,)).empreinte() == Recette(passes=(neuve,)).empreinte()
    # Et nommer explicitement le défaut change l'empreinte : c'est un autre
    # texte dans le fichier, même si le calcul est le même. On ne cache rien.
    explicite = Passe(moteur="modele", modele=MODELE_ONNX)
    assert (
        Recette(passes=(explicite,)).empreinte()
        != Recette(passes=(ancienne,)).empreinte()
    )
