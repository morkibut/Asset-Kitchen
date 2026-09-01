# -*- coding: utf-8 -*-
"""Les étiquettes livrées — le catalogue, et ce qui le tient d'accord avec sa page.

**Deux fichiers portent les mêmes soixante-dix paires**, et c'est délibéré :
`atelier/domaine/etiquettes_livrees.py` est ce que le produit sert,
`docs/etiquettes-livrees.md` est ce qu'on relit pour en ajouter une. Le second
est écrit pour un humain — il porte les trois tests d'admission, la raison des
deux cases exclues, et le pourquoi du renversement.

**Ce fichier-ci est le seul lien entre les deux.** Sans lui, corriger une
formule dans la page ne changerait rien au produit, et personne ne le verrait :
c'est la panne classique d'une donnée écrite deux fois. Un essai qui les compare
paire par paire coûte trente lignes et la rend impossible.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from atelier.domaine.etiquette import rangees
from atelier.domaine.etiquettes_livrees import LIVREES, PREFIXE
from atelier.domaine.projet import CHAMPS_BIBLE

DOC = Path(__file__).resolve().parents[1] / "docs" / "etiquettes-livrees.md"

# **Les deux cases du cadre, et elles n'en reçoivent aucune.** Elles disent d'où
# l'on regarde et comment l'image est calée — deux choses qui se choisissent
# deux étapes plus haut, avec une vignette. Offrir à les redécrire en mots
# serait ouvrir un second endroit qui règle la même chose.
SANS_ETIQUETTE = ("vue", "technique")


def _catalogue_du_document() -> list[tuple[str, str, str]]:
    """Les paires telles que la page les écrit — case, libellé, texte anglais."""
    texte = DOC.read_text(encoding="utf-8")
    bloc = texte[texte.index("## Le catalogue") :]
    paires: list[tuple[str, str, str]] = []
    for section in re.split(r"\n### ", bloc)[1:]:
        case = re.match(r"`([a-z]+)`", section).group(1)
        for ligne in section.splitlines():
            trouvee = re.match(r"^\| (.+?) \| `(.+?)` \|$", ligne)
            if trouvee:
                paires.append((case, trouvee.group(1).strip(), trouvee.group(2).strip()))
    return paires


# ── Le catalogue et sa page disent la même chose ─────────────────────────────


def test_le_module_et_le_document_portent_les_memes_paires():
    """**La seule chose qui empêche les deux d'aller chacun de son côté.**

    Comparées dans l'ordre : une paire ajoutée d'un seul côté, un libellé
    corrigé d'un seul côté, un texte anglais retouché d'un seul côté — les trois
    se voient ici, et nulle part ailleurs.
    """
    du_module = [(e.case, e.libelle, e.texte) for e in LIVREES]

    assert du_module == _catalogue_du_document()


def test_le_document_annonce_le_compte_qu_il_porte():
    """Le titre dit « 70 paires », et chaque section dit le sien. Un compte écrit
    à la main se périme à la première ligne ajoutée."""
    texte = DOC.read_text(encoding="utf-8")
    paires = _catalogue_du_document()

    assert f"## Le catalogue — {len(paires)} paires" in texte
    for case in {c for c, _, _ in paires}:
        combien = sum(1 for c, _, _ in paires if c == case)
        assert re.search(rf"### `{case}` — .+ · {combien}\n", texte), case


# ── Ce qu'une livrée doit être ───────────────────────────────────────────────


def test_soixante_dix_paires_sur_cinq_cases():
    assert len(LIVREES) == 70
    assert {e.case for e in LIVREES} == set(CHAMPS_BIBLE) - set(SANS_ETIQUETTE)


@pytest.mark.parametrize("case", SANS_ETIQUETTE)
def test_les_deux_cases_du_cadre_n_en_recoivent_aucune(case):
    """**Elles se choisissent deux étapes plus haut, avec une vignette.**

    Ce n'est pas le gel de la phrase qui les exclut — il est réparé depuis que
    la phrase du produit se calcule au lieu d'être rangée dans la case. C'est
    qu'un second endroit qui règle la même chose finit toujours par la
    contredire.
    """
    assert not [e for e in LIVREES if e.case == case]


def test_chaque_repere_est_unique_lisible_et_marque_comme_livre():
    """**Un repère stable, dérivé du libellé** — jamais un tirage au sort.

    C'est lui qui permet d'en livrer de nouvelles dans une version suivante sans
    redonner celles que l'auteur avait retirées : le fichier de l'atelier les
    reconnaît une par une.
    """
    reperes = [e.identifiant for e in LIVREES]

    assert len(set(reperes)) == len(reperes)
    assert all(r.startswith(f"{PREFIXE}-") for r in reperes)
    assert all(re.fullmatch(r"[a-z0-9-]+", r) for r in reperes)
    assert all(e.livree and not e.oubliee and e.emplois == 0 for e in LIVREES)


def test_les_deux_moities_sont_pleines_et_chacune_dans_sa_langue():
    """Un libellé français qu'on clique, un texte anglais qui part. Une paire
    dont une moitié manque ne fait rien, ou ne se clique pas."""
    for etiquette in LIVREES:
        assert etiquette.libelle.strip(), etiquette.identifiant
        assert etiquette.texte.strip(), etiquette.identifiant
        # Le texte qui part est écrit pour une machine : des noms de choses,
        # séparés par des virgules, sans phrase — donc sans point final.
        assert not etiquette.texte.endswith("."), etiquette.identifiant
        assert etiquette.texte == etiquette.texte.strip()


def test_aucun_libelle_ne_se_repete_dans_une_case():
    """Deux libellés identiques dans une case seraient deux boutons qu'on ne
    distingue pas — et le service refuse déjà d'en fabriquer un doublon."""
    for case in {e.case for e in LIVREES}:
        libelles = [e.libelle.lower() for e in LIVREES if e.case == case]
        assert len(set(libelles)) == len(libelles), case


# ── Ce que la base en fait ───────────────────────────────────────────────────


def test_la_base_nait_pleine_et_le_tri_reste_celui_des_emplois(client):
    """**La décision renversée, vue depuis l'API.** Ouvrir l'étape de l'allure
    ne montre plus « 0 dans la base » : les livrées de la case sont là, et
    l'ordre reste celui du produit — les plus employées en premier."""
    recu = client.get("/api/labels").json()["etiquettes"]

    assert len(recu) == len(LIVREES)
    assert all(e["livree"] for e in recu)
    du_rendu = [e for e in recu if e["case"] == "rendu"]
    assert len(du_rendu) == 14
    assert not [e for e in recu if e["case"] in SANS_ETIQUETTE]


def test_une_livree_servie_remonte_en_tete_de_sa_case(client):
    """Le compte d'emplois vaut pour les deux origines : au bout de trois jeux,
    la liste d'un auteur ne ressemble plus à celle de départ."""
    aquarelle = next(e for e in LIVREES if e.libelle == "aquarelle")
    assert rangees(LIVREES, "rendu")[0].libelle != "aquarelle"

    client.post(f"/api/labels/{aquarelle.identifiant}/used")
    client.post(f"/api/labels/{aquarelle.identifiant}/used")

    recu = client.get("/api/labels").json()["etiquettes"]
    servie = next(e for e in recu if e["identifiant"] == aquarelle.identifiant)
    assert servie["emplois"] == 2


def test_une_livree_retiree_ne_revient_pas(client):
    """**La pierre**, et la seule raison qu'elle ait d'exister : le catalogue se
    relit à chaque lecture, donc effacer une livrée la ferait revenir à la ligne
    suivante — et l'auteur retirerait la même étiquette indéfiniment."""
    gouache = next(e for e in LIVREES if e.libelle == "gouache")

    client.delete(f"/api/labels/{gouache.identifiant}")

    apres = client.get("/api/labels").json()["etiquettes"]
    assert not [e for e in apres if e["identifiant"] == gouache.identifiant]

    # Et un écrit de plus dans la base ne la ressuscite pas.
    client.post(
        "/api/labels",
        json={"libelle": "lueur de braise", "texte": "dim ember glow", "case": "eclairage"},
    )
    encore = client.get("/api/labels").json()["etiquettes"]
    assert not [e for e in encore if e["identifiant"] == gouache.identifiant]


def test_une_fabriquee_se_distingue_d_une_livree(client):
    """**Aucun vocabulaire neuf pour les distinguer** : l'écran marque en
    `--epingle` ce qui vient de l'auteur, comme il le fait déjà pour le modèle
    d'une famille et l'occupation d'un asset."""
    client.post(
        "/api/labels",
        json={"libelle": "brume de tourbe", "texte": "peat smoke haze", "case": "eclairage"},
    )

    recu = client.get("/api/labels").json()["etiquettes"]
    mienne = next(e for e in recu if e["libelle"] == "brume de tourbe")
    assert mienne["livree"] is False
    assert sum(1 for e in recu if not e["livree"]) == 1
