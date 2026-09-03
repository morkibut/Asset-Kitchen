# -*- coding: utf-8 -*-
"""Les fonctions pures du socle des six essais — sans un centime, sur le double.

**Ce que ces essais protègent.** Le cahier des essais tient sur une promesse :
*on range, on ne réécrit pas*. Les variantes se fabriquent par transformation du
texte témoin, et c'est la différence mot à mot qui le prouve. Si la
transformation ajoutait un mot en douce, ou si la différence ne le voyait pas,
un essai payé mesurerait sa propre recomposition — le piège que
`essais/essai_animation.py` nomme en tête.

Rien ici n'ouvre `donnees/` : le texte témoin est un double écrit dans le
fichier, avec les mêmes marqueurs que celui du produit. Le seul appel au
fournisseur passe par le double de `conftest`, et il sert à vérifier la caisse,
pas une image.
"""

from __future__ import annotations

import asyncio
import io
import json
import sys
from pathlib import Path

import pytest
from PIL import Image

DEPOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DEPOT / "essais"))

import socle_essais as socle  # noqa: E402
from atelier.domaine.pliage import Geometrie  # noqa: E402
from conftest import CATALOGUE, FournisseurDouble, planche_sujets  # noqa: E402

BIBLE = (
    "World: a quiet medieval fantasy world\n"
    "Era: early middle ages\n"
    "Rendering technique: 2D pixel art on a 64x64 grid\n"
    "View and framing: side view, orthographic, full-body character centered\n"
    "Technical constraints: single isolated sprite on a flat background"
)
SUJET = "a hooded traveller, seen from the side;\nbrown boots; a lit lantern"
CONSIGNE = (
    "Render this as a sprite sheet of 8 sprites of the SAME subject. Exactly 3 columns "
    "and 3 rows, 8 cells total, one single sprite per cell. The attached layout image "
    "shows 8 empty cells. Do NOT draw the cell outlines in your image."
)
TEMOIN = f"{BIBLE}\n\n{SUJET}\n\n{CONSIGNE}"
ROLES = ["style", "reference", "gabarit"]


# ── Les rôles, lus dans la fiche ─────────────────────────────────────────────


def test_les_roles_se_lisent_dans_l_ordre_d_envoi_et_le_gabarit_ferme_la_liste():
    fiche = {"references": [{"role": "style", "origine": "carte"}, {"role": "reference", "origine": "asset"}]}
    assert socle.roles_de(fiche) == ["style", "reference", "gabarit"]
    assert socle.roles_de(fiche, palette_jointe=True) == ["style", "reference", "gabarit", "palette"]
    assert socle.roles_de({"references": []}, gabarit_joint=False) == []


# ── Nommer : la variante B de E1 ─────────────────────────────────────────────


def test_une_ligne_par_image_numerotee_dans_l_ordre_et_rien_pour_une_image_absente():
    lignes = socle.lignes_de_nommage(ROLES)
    assert len(lignes) == 3
    assert lignes[0].startswith("Image 1 — STYLE REFERENCE")
    assert lignes[1].startswith("Image 2 — THE SAME CHARACTER")
    assert lignes[2].startswith("Image 3 — EMPTY LAYOUT GRID: 8 cells")
    assert not any("PALETTE" in l for l in lignes)
    assert socle.lignes_de_nommage(ROLES + ["palette"])[3].startswith("Image 4 — PALETTE STRIP")
    with pytest.raises(ValueError):
        socle.lignes_de_nommage(["inconnu"])


def test_nommer_ne_touche_a_rien_d_autre_que_les_lignes_ajoutees():
    b = socle.nommer(TEMOIN, ROLES)
    assert b.startswith(TEMOIN)
    assert socle.ecarts_du_rangement(TEMOIN, b, socle.lignes_de_nommage(ROLES)) == []
    ajoutes = [m for op, m in socle.difference_mots(TEMOIN, b) if op == "+"]
    retires = [m for op, m in socle.difference_mots(TEMOIN, b) if op == "-"]
    assert retires == []
    assert ajoutes == " ".join(socle.lignes_de_nommage(ROLES)).split()


def test_nommer_retire_la_phrase_generique_du_produit_quand_elle_est_la():
    avec = TEMOIN + "\n\n" + socle.PHRASES_GENERIQUES[0] + " " + socle.PHRASES_GENERIQUES[2]
    b = socle.nommer(avec, ROLES)
    assert "One or more reference images are attached" not in b
    assert "override what the images show" not in b
    retires = [m for op, m in socle.difference_mots(TEMOIN, b) if op == "-"]
    assert retires == []


# ── Ranger : la variante C de E1 ─────────────────────────────────────────────


def test_ranger_pose_trois_titres_et_ne_change_pas_un_mot_du_fond():
    c = socle.ranger(TEMOIN, ROLES)
    paragraphes = socle.blocs(c)
    assert paragraphes[0] == "CONTEXT"
    assert paragraphes[1] == BIBLE
    assert paragraphes[2] == "REFERENCES"
    assert paragraphes[3] == "\n".join(socle.lignes_de_nommage(ROLES))
    assert paragraphes[4] == "REQUEST"
    assert paragraphes[5] == SUJET
    assert paragraphes[6] == CONSIGNE
    autorisees = list(socle.lignes_de_nommage(ROLES)) + list(socle.TITRES)
    assert socle.ecarts_du_rangement(TEMOIN, c, autorisees) == []


def test_framing_et_camera_restent_les_deux_dernieres_lignes_de_la_demande():
    temoin = TEMOIN + "\n\nFRAMING — one single sprite and nothing else.\nCAMERA — this overrides everything above."
    c = socle.ranger(temoin, ROLES)
    lignes = c.splitlines()
    assert lignes[-2].startswith("FRAMING —")
    assert lignes[-1].startswith("CAMERA —")
    assert c.count("FRAMING —") == 1 and c.count("CAMERA —") == 1
    autorisees = list(socle.lignes_de_nommage(ROLES)) + list(socle.TITRES)
    assert socle.ecarts_du_rangement(temoin, c, autorisees) == []


def test_le_controle_de_rangement_voit_un_mot_ajoute_ou_retire_en_douce():
    autorisees = list(socle.lignes_de_nommage(ROLES)) + list(socle.TITRES)
    tricheuse = socle.ranger(TEMOIN, ROLES).replace("a lit lantern", "a lit red lantern")
    assert socle.ecarts_du_rangement(TEMOIN, tricheuse, autorisees) == ["+red"]
    amputee = socle.ranger(TEMOIN, ROLES).replace("brown boots; ", "")
    ecarts = socle.ecarts_du_rangement(TEMOIN, amputee, autorisees)
    assert "-brown" in ecarts and "-boots;" in ecarts
    # Un mot autorisé répété une fois de trop est un mot de trop.
    doublee = socle.ranger(TEMOIN, ROLES) + "\n\nREQUEST"
    assert socle.ecarts_du_rangement(TEMOIN, doublee, autorisees) == ["+REQUEST"]


def test_un_bloc_deplace_n_est_pas_un_ecart():
    deplace = f"{SUJET}\n\n{BIBLE}\n\n{CONSIGNE}"
    assert socle.ecarts_du_rangement(TEMOIN, deplace, []) == []


# ── La différence mot à mot ──────────────────────────────────────────────────


def test_la_difference_est_sur_les_mots_et_ignore_les_sauts_de_ligne():
    assert socle.difference_mots("a b c", "a b c") == [("=", "a"), ("=", "b"), ("=", "c")]
    assert socle.difference_mots("a b c", "a\nb\n\nc") == [("=", "a"), ("=", "b"), ("=", "c")]
    assert socle.difference_mots("a b c", "a x c") == [("=", "a"), ("-", "b"), ("+", "x"), ("=", "c")]


def test_les_instants_du_cycle_se_lisent_sans_la_vue_repetee():
    consigne = (
        "The cells, in reading order, show: 1. walk cycle, frame 1 of 8: contact, left foot forward, "
        "facing right, side view; 2. walk cycle, frame 2 of 8: down, weight on left foot, facing right, "
        "side view; 3. walk cycle, frame 3 of 8: passing, right leg swinging through, facing right, side view; "
        "4. walk cycle, frame 4 of 8: up, left leg straight, body highest, facing right, side view; "
        "5. walk cycle, frame 5 of 8: contact, right foot forward, facing right, side view; "
        "6. walk cycle, frame 6 of 8: down, weight on right foot, facing right, side view; "
        "7. walk cycle, frame 7 of 8: passing, left leg swinging through, facing right, side view; "
        "8. walk cycle, frame 8 of 8: up, right leg straight, body highest, facing right, side view. It must be"
    )
    instants = socle.instants_de(consigne)
    assert instants[0] == "contact, left foot forward"
    assert instants[3] == "up, left leg straight, body highest"
    assert instants[7] == "up, right leg straight, body highest"
    assert not any("side view" in i for i in instants)
    with pytest.raises(ValueError):
        socle.instants_de(consigne, cases=6)


# ── La grille : E3 ───────────────────────────────────────────────────────────


def test_changer_la_grille_ne_change_que_les_chiffres_de_la_consigne():
    g = socle.changer_grille(TEMOIN, 4, 2)
    assert "Exactly 4 columns and 2 rows, 8 cells total" in g
    ecarts = [(op, m) for op, m in socle.difference_mots(TEMOIN, g) if op != "="]
    assert ecarts == [("-", "3"), ("+", "4"), ("-", "3"), ("+", "2")]
    with pytest.raises(ValueError):
        socle.changer_grille(BIBLE, 4, 2)


def test_le_gabarit_rectangle_dessine_exactement_les_cases_demandees_avec_les_constantes_du_produit():
    octets = socle.gabarit_rectangle(Geometrie(8, 4, 2), 1024, 683)
    with Image.open(io.BytesIO(octets)) as image:
        assert image.size == (1024, 683)
        pixels = image.convert("RGB")
        assert pixels.getpixel((2, 2)) == socle.FOND
        # Le bord gauche de la première case, à la marge du produit.
        assert pixels.getpixel((socle.MARGE + 1, 200)) == socle.TRAIT
    carre = socle.gabarit_rectangle(Geometrie(8, 3, 3), 1024, 1024)
    with Image.open(io.BytesIO(carre)) as image:
        # Trois par trois à huit cases : la neuvième case n'existe pas.
        large = (1024 - 2 * socle.MARGE - socle.GOUTTIERE * 2) // 3
        haut = large
        x = socle.MARGE + 2 * (large + socle.GOUTTIERE) + 1
        y = socle.MARGE + 2 * (haut + socle.GOUTTIERE) + 20
        assert image.convert("RGB").getpixel((x, y)) == socle.FOND


# ── Agrandir : E2 ────────────────────────────────────────────────────────────


def test_agrandir_garde_les_pixels_carres():
    petite = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
    petite.putpixel((0, 0), (255, 0, 0, 255))
    tampon = io.BytesIO()
    petite.save(tampon, format="PNG")
    with Image.open(io.BytesIO(socle.agrandir(tampon.getvalue(), 4))) as grande:
        assert grande.size == (8, 8)
        assert grande.getpixel((3, 3)) == (255, 0, 0, 255)
        assert grande.getpixel((4, 3)) == (0, 0, 0, 0)


# ── Prélever et caler : E6 et E5 ─────────────────────────────────────────────


def test_prelever_huit_images_equidistantes_sans_refermer_le_cycle_sur_sa_premiere():
    assert socle.prelever(120, 10, 40) == [10, 15, 20, 25, 30, 35, 40, 45]
    assert socle.prelever(120, 0, 8) == list(range(8))
    assert socle.prelever(0, 0, 8) == []
    with pytest.raises(ValueError):
        socle.prelever(120, 100, 40)
    with pytest.raises(ValueError):
        socle.prelever(120, 0, 4)


def test_la_fenetre_commune_est_l_union_des_boites():
    assert socle.fenetre_commune([(10, 10, 20, 30), (5, 12, 18, 40)]) == (5, 10, 20, 40)
    with pytest.raises(ValueError):
        socle.fenetre_commune([])


def test_caler_pose_les_pieds_sur_la_meme_ligne_et_centre_les_corps():
    decalages, fenetre = socle.caler([(0, 0, 10, 20), (5, 3, 25, 30)])
    assert decalages == [(10, 10), (0, 0)]
    assert fenetre == (5, 3, 25, 30)
    # Une fois décalées, les deux boîtes ont le même bas.
    boites = [(0, 0, 10, 20), (5, 3, 25, 30)]
    bas = {b[3] + dy for b, (_, dy) in zip(boites, decalages)}
    assert bas == {30}


# ── Le jugement de la machine, sur le double de planche ──────────────────────


def test_juger_machine_compte_les_sujets_comme_le_produit_et_dit_decoupable():
    faits = socle.juger_machine(planche_sujets(8), 8)
    assert faits["sujets"] == 8 and faits["compte_ok"] and faits["decoupable"]
    assert len(faits["boites"]) == 8
    assert 0 < faits["remplissage_pct"] < 92
    sept = socle.juger_machine(planche_sujets(7), 8)
    assert sept["sujets"] == 7 and not sept["compte_ok"]


def test_animer_rend_huit_carres_de_132_px_et_le_metronome_est_a_125_ms():
    images = socle.animer(planche_sujets(8))
    assert images is not None and len(images) == 8
    import base64

    for b64 in images:
        with Image.open(io.BytesIO(base64.b64decode(b64))) as image:
            assert image.size == (132, 132)
    # Le rythme est celui de la page, pas d'un GIF : 125 ms, pour tout le monde.
    assert socle.MS == 125
    assert "setInterval(" in socle.SCRIPT and "MS);" in socle.SCRIPT
    assert socle.animer(planche_sujets(1)) is None


# ── La séance, sur le double : la caisse, le relevé, le témoin ───────────────


def _variante(cle: str, texte: str = TEMOIN, temoin: bool = False, dossier: Path | None = None) -> socle.Variante:
    return socle.Variante(
        cle=cle, titre=cle, propos="", texte=texte,
        images=(socle.ImageJointe(1, "style", planche_sujets(1), "carte"),),
        temoin=temoin, dossier=dossier,
    )


def test_la_seance_ne_repaie_jamais_ce_qui_est_sur_le_disque_et_s_arrete_au_plafond(tmp_path):
    double = FournisseurDouble()
    modele = CATALOGUE[0]
    seance = socle.Seance("double", plafond=0.05, dossier=tmp_path, parallele=1)
    v = _variante("B-double")
    (tmp_path / "B-double").mkdir()
    (tmp_path / "B-double" / "jet1.png").write_bytes(planche_sujets(8))
    asyncio.run(seance.tirer(v, double, modele, jets=(1, 2, 3, 4, 5, 6, 7, 8), journal=lambda _: None))
    faits = sorted(p.name for p in (tmp_path / "B-double").glob("jet*.png"))
    # Le jet 1 était là ; le double coûte $0,0245 l'image et les appels passent un par un :
    # le troisième franchit le plafond, et il est le dernier.
    assert "jet1.png" in faits
    assert len(faits) - 1 == 3
    releve = json.loads((tmp_path / "mesures.json").read_text("utf-8"))
    assert "jet1" not in releve["B-double"]
    assert all(l["cout_usd"] > 0 for k, l in releve["B-double"].items() if k.startswith("jet"))
    assert releve["_seance"]["date"]
    assert seance.caisse.depense >= 0.05


def test_le_temoin_ne_part_jamais_et_ses_manquants_sont_vides(tmp_path):
    seance = socle.Seance("double", plafond=1.0, dossier=tmp_path)
    temoin = _variante("A-temoin", temoin=True, dossier=tmp_path / "ailleurs")
    assert seance.manquants(temoin) == []
    double = FournisseurDouble()
    asyncio.run(seance.tirer(temoin, double, CATALOGUE[0], journal=lambda _: None))
    assert double.appels == 0
    assert not (tmp_path / "mesures.json").exists()


def test_a_sec_ne_depense_rien_et_compte_les_appels_manquants(tmp_path, capsys):
    seance = socle.Seance("double", plafond=1.0, dossier=tmp_path)
    temoin = _variante("A-temoin", temoin=True, dossier=tmp_path / "ailleurs")
    b = _variante("B-double", texte=socle.nommer(TEMOIN, ROLES))
    cout = seance.a_sec([temoin, b], jets=(1, 2, 3), prix_appel=0.01)
    assert cout == pytest.approx(0.03)
    sortie = capsys.readouterr().out
    assert "3 appel(s) a faire sur 3" in sortie
    assert "[+Image]" in sortie
    assert not list(tmp_path.iterdir())


# ── E1 refait : les numéros d'images suivent l'envoi réel ────────────────────


TEMOIN_HUIT = TEMOIN + " " + "; ".join(
    f"{i}. walk cycle, frame {i} of 8: pose {i}, facing right, side view" for i in range(1, 9)
) + "."


def _png(largeur: int, hauteur: int) -> bytes:
    tampon = io.BytesIO()
    Image.new("RGBA", (largeur, hauteur), (10, 20, 30, 255)).save(tampon, format="PNG")
    return tampon.getvalue()


def test_e1_les_artworks_passent_devant_et_tout_est_renumerote():
    import essai_references_nommees as e1

    depart = socle.Depart(
        texte=TEMOIN, negatif="", proportions="1:1", resolution=None,
        images=(socle.ImageJointe(1, "style", _png(4, 6), "carte vieille"),
                socle.ImageJointe(2, "reference", _png(2, 2), "asset"),
                socle.ImageJointe(3, "gabarit", _png(8, 8), "gabarit")),
    )
    images = e1.images_du_jour(depart, [("aaa", _png(3, 5), "concept"), ("bbb", _png(5, 3), "")])
    assert [(i.rang, i.role) for i in images] == [(1, "style"), (2, "style"), (3, "reference"), (4, "gabarit")]
    assert images[0].origine == "carte aaa — concept" and images[1].origine == "carte bbb"
    assert images[2].octets == depart.images[1].octets, "le sprite promu est celui du témoin, octet pour octet"
    assert "vieille" not in " ".join(i.origine for i in images), "l'ancien artwork ne part plus"


def test_e1_la_priorite_et_le_texte_reecrit_nomment_les_images_par_leur_role_reel():
    import essai_references_nommees as e1

    roles = ["style", "style", "reference", "gabarit"]
    phrase = e1.priorite(roles)
    assert "Image 3 decides who the character is" in phrase
    assert "Images 1 and 2 decide the colours" in phrase
    assert "Image 4 decides where" in phrase
    assert "Image 1 decides the colours" in e1.priorite(["style", "reference", "gabarit"])
    texte = e1.reecrit_par_ia(TEMOIN_HUIT, roles)
    assert "1. Image 3 — the character" in texte
    assert "2. Images 1 and 2 — official artworks" in texte
    assert "3. Image 4 — empty layout grid" in texte
    r2 = e1.avec_priorite(e1.ranger_vraiment(TEMOIN_HUIT, roles), roles)
    assert r2.index(phrase) < r2.index("\n\nLAYOUT\n"), "la priorité ferme la section REFERENCES"
    assert e1.ranger_vraiment(TEMOIN_HUIT, roles).count("STYLE REFERENCE") == 2


def test_e1_ranger_vraiment_garde_la_bible_et_le_sujet_mot_pour_mot():
    import essai_references_nommees as e1

    texte = e1.ranger_vraiment(TEMOIN_HUIT, ROLES)
    assert BIBLE in texte and SUJET in texte
    assert texte.count("Do NOT draw") == 1, "l'interdiction de grille est dite une fois"
    cadres = texte.split("FRAMES")[1].split("CONSISTENCY")[0].splitlines()[1:]
    assert "7. pose 7" in cadres and not any("side view" in c for c in cadres)


def test_une_cle_de_variante_doit_pouvoir_nommer_un_dossier_windows():
    with pytest.raises(ValueError):
        _variante("B-4x2-1:1")
    assert _variante("B-4x2-carre").cle == "B-4x2-carre"


def test_e6_l_entree_video_tient_entiere_dans_la_toile_et_sur_le_fond_du_produit():
    """Le 2 septembre 2026, l'entrée partait à 768 px de haut sur une toile de 576 : coupée."""
    import essai_video_planche as e6

    sujet = Image.new("RGBA", (300, 900), (0, 0, 0, 0))
    sujet.paste(Image.new("RGBA", (200, 800), (20, 90, 100, 255)), (50, 50))
    tampon = io.BytesIO(); sujet.save(tampon, format="PNG")
    octets = e6.composer_entree(tampon.getvalue(), canevas=(1024, 576))
    with Image.open(io.BytesIO(octets)) as toile:
        assert toile.size == (1024, 576)
        pixels = toile.convert("RGB").load()
        assert pixels[0, 0] == (235, 235, 235), "le fond est celui du produit"
        colonnes = [x for x in range(1024) if any(pixels[x, y] != (235, 235, 235) for y in range(0, 576, 4))]
        lignes = [y for y in range(576) if any(pixels[x, y] != (235, 235, 235) for x in range(0, 1024, 4))]
    assert 0 < min(lignes) and max(lignes) < 575, "le sujet ne touche ni le haut ni le bas"
    assert 0 < min(colonnes) and max(colonnes) < 1023, "le sujet ne touche ni bord gauche ni bord droit"
