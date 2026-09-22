"""RV8 · **le même choix écrit les mêmes octets, par l'une ou l'autre entrée** (C03).

RV8 range le dossier de la forme « fichiers » (B21) avec le jeu Godot rattaché :
la racine d'AU1 (`association.json`) plus un sous-dossier voisin
(`fichiers.json`). Avant, on y arrivait en nommant le dossier dans l'appel —
entrée qui reste, pour le MCP. Ce que la tranche promet : **ce qui sort ne
dépend pas de l'entrée**.

La preuve, dans un même tirage : chaque choix passe par l'ancienne entrée (le
dossier nommé), puis par l'entrée unifiée (le jeu rattaché, rien de nommé), dans
deux dossiers temporaires. Les deux arbres se comparent chemin par chemin et
octet par octet, en retirant **seulement** `exporte_le` du descriptif — l'instant
de la sortie, qui change à chaque passage.

Le paquet Godot d'AU1 (animations, images, sons, tuiles) n'a qu'une entrée,
l'association, et RV8 n'y touche pas : ce qui se vérifie ici, c'est que poser le
sous-dossier des fichiers **ne le perturbe pas** — l'association garde ses quatre
clés, et le paquet préparé garde sa révision et ses empreintes. La preuve entre
deux commits, sur les quatre natures, est `essais/essai_rv8_identite.py`.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "essais"))

from atelier_jetable_b21 import peupler  # noqa: E402

from atelier.domaine import sortie as vocabulaire  # noqa: E402
from atelier.services.export import DESCRIPTIF  # noqa: E402

PROJECT_GODOT = (
    'config_version=5\n[application]\nconfig/name="Essai RV8"\n'
    'config/features=PackedStringArray("4.7", "GL Compatibility")\n'
)

# Les choix comparés : à plat et en dossiers, images et animations, les trois
# catalogues, et un sujet seul (`RP17`).
CHOIX = {
    "a-plat": {"lot": vocabulaire.TOUT, "rangement": vocabulaire.A_PLAT},
    "en-dossiers-godot": {
        "lot": vocabulaire.TOUT,
        "rangement": vocabulaire.EN_DOSSIERS,
        "moteur": vocabulaire.GODOT,
    },
    "animations-phaser": {"lot": vocabulaire.ANIMATIONS, "moteur": vocabulaire.PHASER},
    "objets-unity": {"lot": "objets", "rangement": vocabulaire.EN_DOSSIERS,
                     "moteur": vocabulaire.UNITY},
    "un-sujet": {"sujet": "@pelerin", "rangement": vocabulaire.EN_DOSSIERS},
}


def _arbre(dossier: Path) -> dict[str, str]:
    rendu = {}
    for fichier in sorted(p for p in dossier.rglob("*") if p.is_file()):
        octets = fichier.read_bytes()
        if fichier.name == DESCRIPTIF:
            contenu = json.loads(octets.decode("utf-8"))
            assert "exporte_le" in contenu
            contenu.pop("exporte_le")
            octets = json.dumps(contenu, ensure_ascii=False, indent=2).encode("utf-8")
        rendu[fichier.relative_to(dossier).as_posix()] = hashlib.sha256(octets).hexdigest()
    return rendu


@pytest.fixture
def jeu(atelier, double, tmp_path):
    ids = peupler(atelier, double)
    godot = tmp_path / "Jeu Godot unifié"
    godot.mkdir()
    (godot / "project.godot").write_text(PROJECT_GODOT, encoding="utf-8")
    return ids, godot


@pytest.mark.parametrize("nom", list(CHOIX))
def test_le_meme_choix_sort_les_memes_octets_par_les_deux_entrees(atelier, client, jeu, tmp_path, nom):
    ids, godot = jeu
    projet = atelier.bibliotheque.courant
    corps = {**CHOIX[nom]}
    if corps.get("sujet") == "@pelerin":
        corps["sujet"] = ids["pelerin"]

    # L'ancienne entrée : le dossier nommé dans l'appel.
    ancien = tmp_path / "ancienne-entree" / nom
    reponse = client.post("/api/output", json={"dossier": str(ancien), **corps})
    assert reponse.status_code == 200, reponse.text

    # L'entrée unifiée : le jeu rattaché, le sous-dossier posé, rien de nommé.
    assert client.put(f"/api/projects/{projet}/godot-link", json={"dossier": str(godot)}).status_code == 200
    pose = client.put("/api/output/folder", json={"sous_dossier": f"fichiers/{nom}"})
    assert pose.status_code == 200, pose.text
    reglages = client.get("/api/output/settings").json()
    assert reglages["origine"] == "jeu"
    assert Path(reglages["racine"]) == godot.resolve()
    assert reglages["sous_dossier"] == f"fichiers/{nom}"
    reponse = client.post("/api/output", json=corps)
    assert reponse.status_code == 200, reponse.text
    unifie = godot.resolve() / "fichiers" / nom
    assert Path(reponse.json()["dossier"]) == unifie

    avant, apres = _arbre(ancien), _arbre(unifie)
    assert avant, "le choix doit sortir quelque chose"
    assert apres == avant


def test_poser_le_dossier_des_fichiers_ne_touche_pas_au_paquet_godot(atelier, client, jeu):
    """Le piège de la note (§2) : l'association est comparée **en entier** et
    recopiée dans chaque `livraison.json`. Le sous-dossier des fichiers vit donc
    à côté, et le paquet d'AU1 ne voit rien changer."""
    ids, godot = jeu
    projet = atelier.bibliotheque.courant
    assert client.put(f"/api/projects/{projet}/godot-link", json={"dossier": str(godot)}).status_code == 200
    fichier = atelier.livraison._dossier(projet) / "association.json"
    octets_association = fichier.read_bytes()

    def paquets():
        animation = atelier.livraison.prevoir(projet, ids["pelerin"], ["bande-b21-la marche"])
        image = next(
            a for a in atelier.base.assets_du_personnage(ids["pelerin"], projet=projet)
            if a.supprime_le is None and not a.piece
        )
        fixe = atelier.livraison_images.prevoir(projet, ids["pelerin"], image.identifiant)
        return [
            (p["revision"], [(f["chemin"], f["empreinte"]) for f in p["fichiers"]])
            for p in (animation, fixe)
        ]

    avant = paquets()
    assert client.put("/api/output/folder", json={"sous_dossier": "sprites/atelier"}).status_code == 200
    assert paquets() == avant

    # Le format reste figé : quatre clés, pas une de plus, octet pour octet.
    assert fichier.read_bytes() == octets_association
    assert set(json.loads(octets_association)) == {"projet", "dossier", "sous_dossier", "version_godot"}
    assert set(client.get(f"/api/projects/{projet}/godot-link").json()) == {
        "projet", "dossier", "sous_dossier", "version_godot"}
    assert json.loads((fichier.parent / "fichiers.json").read_text(encoding="utf-8")) == {
        "sous_dossier": "sprites/atelier"}
