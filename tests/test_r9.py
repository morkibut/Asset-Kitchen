# -*- coding: utf-8 -*-
"""Les critères de R9 qui vivent côté serveur — le calibrage montre ce qu'il fera.

**R9 est une tranche d'écran, et presque tout se mesure à l'écran** :
`interface/src/App.test.tsx` vérifie que l'écran dit ce qu'il répare, que les
faits se lisent au-dessus du bouton, que le bouton annonce son résultat et
s'éteint avec sa raison, que l'avant et l'après se voient côte à côte, que la
légende nomme les trois traitements, que chaque ligne porte sa silhouette et ses
deux colonnes, et que les deux symboles sont devenus des mots.

**Ce qui se mesure ici est la seule chose que la tranche demande au serveur** :
l'écran ne peut pas dessiner l'empilement d'après sans savoir, pose par pose, ce
que le bouton écrirait et ce que ça rendrait. Il ne peut pas le recalculer non
plus — deux bornes du domaine entrent dans ce chiffre, et les recopier à l'écran
serait poser une seconde vérité sur la même question. Le service les rend donc.

**Et il ne calcule rien de neuf**, c'est le dernier critère de la tranche :
`visee` est le calcul de `calibrer`, sorti de `calibrer` et rendu avant d'être
écrit. `test_ce_qui_est_montre_est_ce_qui_est_ecrit` le tient — c'est la règle de
`R7`, *ce qui est montré passe par le chemin que l'écriture emprunte*, appliquée
à un chiffre.
"""

from __future__ import annotations

from tests.test_e17 import _calibrage, _creer, _poser, _un_personnage_dephase


# ── « L'empilement d'après » ─────────────────────────────────────────────────


def test_chaque_pose_dit_ce_quelle_deviendrait(client, tmp_path):
    """**La réponse visuelle à « qu'est-ce que ce bouton va faire »** demande un
    chiffre par pose : l'occupation qui serait écrite, et la hauteur qui en
    sortirait."""
    chose = _un_personnage_dephase(client, tmp_path)

    lu = _calibrage(client, chose)

    apres = {p["pose"]: p["apres"] for p in lu["poses"]}
    # Les trois se retrouvent sur la hauteur commune, qui est celle de la pose
    # couchée tant qu'on ne l'a pas mise de côté.
    assert lu["commune"] == 24
    assert apres == {"repos": 24, "attaque": 24, "mort": 24}
    # Et l'occupation visée est bien plus basse que celle d'aujourd'hui pour les
    # deux poses qui doivent descendre.
    visees = {p["pose"]: p["visee"] for p in lu["poses"]}
    assert visees["repos"] < 100 and visees["attaque"] < 100
    assert visees["mort"] == 100


def test_une_pose_mise_de_cote_ne_bouge_pas(client, tmp_path):
    """**Sortir du calage commun n'est pas disparaître** : son après est son
    aujourd'hui, et l'empilement de droite la dessine à sa place."""
    chose = _un_personnage_dephase(client, tmp_path)
    mise = client.put(
        f"/api/characters/{chose}/calibration/mort/aside", json={"de_cote": True}
    )
    assert mise.status_code == 200, mise.text

    couchee = next(p for p in _calibrage(client, chose)["poses"] if p["pose"] == "mort")

    assert couchee["de_cote"] is True
    assert couchee["visee"] == couchee["occupation"]
    assert couchee["apres"] == couchee["rendue"]


def test_chaque_pose_dit_autour_de_quoi_elle_grandit(client, tmp_path):
    """L'écran agrandit la silhouette du rapport entre ce qu'elle rend et ce
    qu'elle rendrait. **Autour du mauvais point, elle décolle du sol** — et le
    sol est le seul trait de cet empilement qu'on ne discute pas."""
    chose = _un_personnage_dephase(client, tmp_path)

    assert {p["ancrage"] for p in _calibrage(client, chose)["poses"]} == {"bas"}


# ── « Le bouton s'éteint quand il n'y a rien à calibrer » ────────────────────


def test_rien_a_faire_se_compte_ici(client, tmp_path):
    """**Il restait allumé sur une chose déjà calée**, invitant à un geste qui ne
    change rien. Ce qui décide de son extinction est un compte, et il se fait là
    où les occupations sont connues."""
    chose = _un_personnage_dephase(client, tmp_path)

    assert _calibrage(client, chose)["a_faire"] == 2

    pose = client.post(f"/api/characters/{chose}/calibration")
    assert pose.status_code == 200, pose.text

    # Calibrer une seconde fois ne changerait plus rien : le bouton s'éteint.
    assert pose.json()["a_faire"] == 0
    assert _calibrage(client, chose)["a_faire"] == 0


def test_une_seule_pose_na_rien_a_accorder(client, tmp_path):
    """Une chose qui n'a qu'une pose est déjà d'accord avec elle-même. Le compte
    le dit sans qu'aucun écran ait à connaître ce cas-là."""
    client.put("/api/universe", json={"cible_px": 64})
    chose = _creer(client, "Seul")
    _poser(client, tmp_path, chose["identifiant"], "repos", 48, 64)

    assert _calibrage(client, chose["identifiant"])["a_faire"] == 0


# ── « Rien de ce que l'outil calcule ne change » ─────────────────────────────


def test_ce_qui_est_montre_est_ce_qui_est_ecrit(client, tmp_path):
    """**La règle de R7 appliquée à un chiffre** : l'occupation montrée avant le
    geste est celle que le disque reçoit après.

    Elle n'était pas fausse avant — elle n'était simplement pas montrée, et
    l'écart entre les deux bornes du domaine ne se voyait donc pas. Depuis que
    l'écran dessine l'après, il se verrait.
    """
    chose = _un_personnage_dephase(client, tmp_path)
    avant = _calibrage(client, chose)
    visees = {p["pose"]: p["visee"] for p in avant["poses"]}

    apres = client.post(f"/api/characters/{chose}/calibration")
    assert apres.status_code == 200, apres.text

    ecrites = {p["pose"]: p["occupation"] for p in apres.json()["poses"]}
    assert ecrites == visees
    # Et les hauteurs annoncées sont celles obtenues, pose par pose.
    assert {p["pose"]: p["rendue"] for p in apres.json()["poses"]} == {
        p["pose"]: p["apres"] for p in avant["poses"]
    }


def test_le_calibrage_ne_paie_rien_et_nenregistre_aucune_depense(client, tmp_path):
    """Le dernier critère de la tranche, et il tient par construction : le
    calibrage change le rendu d'images déjà payées, et un rendu est un cache."""
    chose = _un_personnage_dephase(client, tmp_path)
    depenses_avant = client.get("/api/spending").json()

    pose = client.post(f"/api/characters/{chose}/calibration")
    assert pose.status_code == 200, pose.text

    assert client.get("/api/spending").json() == depenses_avant


def test_la_hauteur_commune_ne_bouge_pas_dun_pixel(client, tmp_path):
    """**Ce que l'outil calcule est resté le même**, et c'est le critère qu'il
    fallait le plus surveiller : la tranche ajoute deux chiffres par pose, elle
    n'en révise aucun. Les valeurs sont celles que `tests/test_e17.py` mesure
    déjà — les répéter ici est ce qui rendrait visible une révision furtive."""
    chose = _un_personnage_dephase(client, tmp_path)

    lu = _calibrage(client, chose)

    assert {p["pose"]: p["plafond"] for p in lu["poses"]} == {
        "repos": 64,
        "attaque": 48,
        "mort": 24,
    }
    assert lu["commune"] == 24
    assert lu["limite"] == "mort"
    assert lu["perdus"] == 40
    assert lu["de_cote"] == "mort"
