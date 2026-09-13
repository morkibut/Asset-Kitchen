"""Le banc de mesure AU11 se vérifie sans GPU : sa doublure joue tout le parcours.

Ce test ne prouve rien sur un vrai rendu asset3d — il prouve que le script
`essais/essai_au11_cadre_directions.py` déroule sa mécanique (modèle → squelette
→ un rendu par direction → mesure → verdict) de bout en bout, sans réseau ni
calcul 3D réel, et qu'il l'annonce clairement. C'est la seule vérification
possible ici : la machine qui fait tourner cette suite n'a pas de carte
graphique, et l'installation asset3d voisine n'est jamais sollicitée.
"""
import asyncio
import io
import json
import sys
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE / "essais"))

import essai_au11_cadre_directions as banc  # noqa: E402


def test_repetition_ne_contacte_jamais_un_serveur_reel(monkeypatch):
    """`principal(["--repetition"])` ne doit jamais tenter de résoudre
    l'adresse réelle : c'est ce qui garantit qu'aucune tentative réseau
    ne part vers un hypothétique asset3d payant."""
    def interdit(_adresse):
        raise AssertionError("la vérification d'un asset3d réel n'a pas à être appelée en --repetition")
    monkeypatch.setattr(banc, "_asset3d_reel_disponible", interdit)
    monkeypatch.setattr(sys, "argv", ["essai_au11_cadre_directions.py"])
    assert banc.arguments(["--repetition"]).repetition is True


def test_mesurer_silhouette_lit_hauteur_et_position_des_pieds():
    image = Image.new("RGBA", (40, 60), (0, 0, 0, 0))
    for y in range(20, 50):
        for x in range(10, 25):
            image.putpixel((x, y), (200, 100, 50, 255))
    tampon = io.BytesIO()
    image.save(tampon, "PNG")
    mesure = banc.mesurer_silhouette(tampon.getvalue())
    assert mesure == {
        "largeur_canevas": 40, "hauteur_canevas": 60, "vide": False,
        "hauteur_apparente_px": 30, "largeur_apparente_px": 15,
        "pivot_x_frac": round((10 + 15 / 2) / 40, 4), "pivot_y_frac": round(50 / 60, 4),
    }


def test_comparer_directions_dit_coherent_quand_les_mesures_se_ressemblent():
    mesures = {d: {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96,
                    "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.9}
               for d in ("nord", "est", "sud")}
    verdict = banc.comparer_directions(mesures)
    assert verdict == {"coherent": True, "raisons": [], "ecart_hauteur_pct": 0.0, "ecart_pivot_fraction": 0.0}


def test_comparer_directions_chiffre_un_ecart_de_hauteur():
    mesures = {
        "nord": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.9},
        "est": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 40, "largeur_apparente_px": 28, "pivot_y_frac": 0.9},
        "sud": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.9},
    }
    verdict = banc.comparer_directions(mesures)
    assert verdict["coherent"] is False
    assert verdict["ecart_hauteur_pct"] > banc.SEUIL_HAUTEUR_PCT
    assert "est" in verdict["raisons"][0] and "60" in verdict["raisons"][0] and "40" in verdict["raisons"][0]


def test_comparer_directions_chiffre_un_ecart_de_pivot():
    mesures = {
        "nord": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.90},
        "est": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.70},
        "sud": {"vide": False, "largeur_canevas": 64, "hauteur_canevas": 96, "hauteur_apparente_px": 60, "largeur_apparente_px": 28, "pivot_y_frac": 0.90},
    }
    verdict = banc.comparer_directions(mesures)
    assert verdict["coherent"] is False
    assert verdict["ecart_pivot_fraction"] > banc.SEUIL_PIVOT_FRACTION


def test_le_parcours_complet_tourne_sur_la_doublure_et_produit_un_verdict(tmp_path):
    """Le vrai chemin du script — Atelier jetable, TestClient, trois étapes 3D,
    import des rendus, mesure des pixels — sans qu'aucun octet ne parte vers un
    vrai serveur : `transport` pointe sur la doublure ASGI en mémoire."""
    import httpx

    sortie = tmp_path / "resultats_au11_cadre"
    resultat = asyncio.run(banc.executer_mesure(
        adresse="http://127.0.0.1:8000",
        transport=httpx.ASGITransport(app=banc.construire_double_asset3d()),
        mode="repetition", directions=("nord", "est", "sud"), pose="marche",
        reference=None, sortie=sortie,
    ))
    assert resultat["mode"] == "repetition"
    assert set(resultat["mesures"]) == {"nord", "est", "sud"}
    assert resultat["verdict"]["coherent"] is True
    assert (sortie / "mesures.json").is_file()
    relu = json.loads((sortie / "mesures.json").read_text(encoding="utf-8"))
    assert relu["verdict"]["coherent"] is True
    # Le dossier jetable est bien celui passé en argument (`tmp_path`, ici) :
    # rien n'a de raison d'être écrit sous `donnees/` ou un projet Godot.
    assert (sortie / "atelier").is_dir()


def test_une_direction_rendue_a_une_autre_echelle_est_detectee(tmp_path):
    """Preuve que le banc sait détecter une incohérence : la doublure fabrique
    ici un personnage deux fois plus petit dans une seule direction, comme le
    ferait un `ortho_scale` calculé indépendamment par caméra (le risque décrit
    dans le relevé AU10/AU11)."""
    import httpx

    sortie = tmp_path / "resultats_au11_cadre"
    silhouettes = {"nord": (28, 60, 88), "est": (14, 30, 88), "sud": (28, 60, 88)}
    resultat = asyncio.run(banc.executer_mesure(
        adresse="http://127.0.0.1:8000",
        transport=httpx.ASGITransport(app=banc.construire_double_asset3d(silhouettes=silhouettes)),
        mode="repetition", directions=("nord", "est", "sud"), pose="marche",
        reference=None, sortie=sortie,
    ))
    assert resultat["verdict"]["coherent"] is False
    assert resultat["verdict"]["ecart_hauteur_pct"] > banc.SEUIL_HAUTEUR_PCT
    assert any("est" in raison for raison in resultat["verdict"]["raisons"])
