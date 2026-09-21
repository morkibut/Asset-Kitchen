"""ML4 : le texte qui part vers un style local. ComfyUI est doublé (le relevé
réel de ML2) ; aucune génération ne tourne, sauf celle qui vérifie que le texte
enregistré est celui qui entre dans le graphe."""
import pytest

from atelier.domaine import texte_local
from atelier.domaine.envoi import Tri
from atelier.services import Atelier
from atelier.services.generation import Demande
from tests.test_a9 import AnimateurDouble
from tests.test_au7_au8 import raccorder
from tests.test_ml2 import ComfyStylesDouble

# Un style par famille — Klein deux fois : distillé (flux2-pixel, guidage à 1,
# négatif non relié) et base (klein-pxart4, négatif relié).
STYLES = {
    "zimage": "zimage-pixel",
    "klein-distille": "flux2-pixel",
    "klein-base": "klein-pxart4",
    "flux1dev": "flux1-modern",
    "sdxl": "sdxl-pixelart",
}
NEGATIF_RELIE = {"klein-base", "sdxl"}

SIGNALEMENT = "a stocky dwarf miner with a copper lantern"
BIBLE = [
    {"nom": "monde", "texte": "high fantasy, elves and dwarves, ancient kingdoms, deep old-growth forest, moss, ferns and giant roots. Every village hides a shrine.", "actif": True},
    {"nom": "epoque", "texte": "medieval fantasy age", "actif": True},
    {"nom": "trait", "texte": "flat colour fills, clean dark outline, no anti-aliasing", "actif": True},
    {"nom": "eclairage", "texte": "thick low-lying fog, volumetric haze, moonlight, cool blue key light, deep shadows, long cast shadows", "actif": True},
]


@pytest.fixture
async def jeu(tmp_path, double):
    """Un atelier dont les cinq styles sont installés, et un jeu décrit en entier :
    bible, vue, taille de sprite et fond — le texte le plus long que l'atelier
    compose."""
    atelier = Atelier(racine=tmp_path / "donnees", fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, ComfyStylesDouble())
    await atelier.ouvrir()
    modeles = {famille: (await atelier.styles_locaux.installer(style))["modele"] for famille, style in STYLES.items()}
    await atelier.catalogue.rafraichir()
    projet = atelier.bibliotheque.courant
    atelier.univers.regler_univers(projet, bible=BIBLE, vue="vue-dessus-34", cible_px=64, fond="#FF00FF")
    nain = atelier.production.creer_personnage(projet, "Nain", SIGNALEMENT, famille="personnages")
    yield atelier, projet, nain.identifiant, modeles
    await atelier.file_locale.fermer()


def apercu(atelier, projet, modele, **k):
    k.setdefault("prompt_negatif", "blurry, watermark")
    return atelier.generations.apercu(k.pop("sujet", SIGNALEMENT), projet=projet, modele=modele, **k)


CAS = {
    "case": lambda nain: {"personnage": nain, "pose": "marche", "direction": "sud"},
    "planche": lambda nain: {"personnage": nain, "pose": "marche", "directions": ["nord", "sud", "est", "ouest"]},
    "libre": lambda nain: {"sujet": "a wooden treasure chest"},
}


@pytest.mark.parametrize("famille", STYLES)
@pytest.mark.parametrize("cas", CAS)
async def test_le_declencheur_en_tete_puis_le_sujet_puis_l_univers_court(jeu, famille, cas):
    atelier, projet, nain, modeles = jeu
    profil = atelier.profils_workflow.de_modele(modeles[famille])
    declencheur, suffixe = profil["style"]["declencheur"], profil["style"].get("suffixe")
    vu = apercu(atelier, projet, modeles[famille], **CAS[cas](nain))
    texte, local = vu["texte"], vu["local"]

    assert texte.startswith(declencheur)
    if suffixe:
        assert texte.endswith(suffixe)
    # Rien de la forme GPT Image : ni titres, ni paragraphes, ni caméra longue.
    for gpt in ("CONTEXT", "REQUEST", "REFERENCES", "CAMERA —", "FRAMING —", "World:", "\n"):
        assert gpt not in texte
    sujet = "a wooden treasure chest" if cas == "libre" else SIGNALEMENT
    assert sujet in texte
    # L'ordre : déclencheur, signalement, consigne de case ou planche, jeu, cadre, suffixe.
    clefs = [s["clef"] for s in local["segments"]]
    assert clefs[:2] == ["style.declencheur", "sujet.sujet"]
    rang = {"style": 0, "sujet": 1, "planche": 2, "jeu": 3, "cadrage": 4}
    milieu = [rang[c.split(".")[0]] for c in clefs[1:-1 if suffixe else None]]
    # Sur SDXL, une planche prend toute la tranche : le jeu cède en entier.
    assert milieu == sorted(milieu) and (3 in milieu or (famille, cas) == ("sdxl", "planche"))
    if suffixe:
        assert clefs[-1] == "style.suffixe"
    if cas == "case":
        assert "walking posture" in texte
    if cas == "planche":
        assert ("sprite sheet of 4 sprites of the same subject, 2x2 grid, walking posture, full body, facing: "
            "1. north, away from the viewer; 2. south, toward the viewer") in texte
    # Ce qui ne part pas est nommé, avec sa raison.
    retires = {r["clef"]: r["raison"] for r in local["retires"]}
    if cas != "planche":
        assert retires["cadrage.camera"] == texte_local.RAISON_CAMERA
    # Une seule partie, sans titre, qui est le texte entier.
    assert [p["texte"] for p in vu["parties"]] == [texte] and vu["parties"][0]["titre"] == ""
    assert local["texte"] == texte and local["famille"] == profil["style"]["famille"]


@pytest.mark.parametrize("famille", STYLES)
async def test_sdxl_tient_dans_77_jetons_et_montre_ce_qu_il_retire(jeu, famille):
    atelier, projet, nain, modeles = jeu
    local = apercu(atelier, projet, modeles[famille], personnage=nain, pose="marche", direction="sud")["local"]
    coupes = [r for r in local["retires"] if r["raison"] == texte_local.RAISON_JETONS]
    if famille != "sdxl":
        assert local["limite"] is None and not coupes
        # L'univers part raccourci à sa première phrase, et le reste est montré.
        assert any(r["clef"] == "jeu.monde" and "shrine" in r["texte"] for r in local["retires"])
        return
    assert local["limite"] == 75 and local["tranche"] == 77 and local["comptage"]
    assert local["jetons"] == texte_local.compter_jetons(local["texte"]) <= 75
    assert coupes, "le jeu décrit en entier dépasse une tranche : quelque chose doit céder"
    # Du moins utile au plus utile : l'éclairage part avant le fond, et le sujet reste.
    ordre = [r["clef"] for r in coupes]
    assert ordre[0] == "jeu.eclairage"
    assert SIGNALEMENT in local["texte"]
    for r in coupes:
        assert r["texte"] and r["texte"] not in local["texte"]


async def test_sdxl_un_signalement_trop_long_cede_par_la_fin_jamais_le_declencheur(jeu):
    atelier, projet, nain, modeles = jeu
    long = " ".join(f"ornament{i}" for i in range(60))
    local = apercu(atelier, projet, modeles["sdxl"], sujet=long)["local"]
    declencheur = atelier.profils_workflow.de_modele(modeles["sdxl"])["style"]["declencheur"]
    assert local["texte"].startswith(declencheur)
    assert local["jetons"] <= 75
    queue = [r for r in local["retires"] if r["clef"] == "sujet.sujet"]
    assert queue and queue[0]["texte"].endswith("ornament59")
    assert "ornament0" in local["texte"] and "ornament59" not in local["texte"]


@pytest.mark.parametrize("famille", STYLES)
async def test_le_negatif_ne_part_que_quand_le_profil_le_relie(jeu, famille, double):
    atelier, projet, nain, modeles = jeu
    vu = apercu(atelier, projet, modeles[famille], sujet="a wooden treasure chest")
    lu = famille in NEGATIF_RELIE
    assert vu["negatif_lu"] is lu and vu["local"]["negatif_lu"] is lu
    assert ("blurry, watermark" in vu["interdiction"]) is lu
    assert "blurry" not in vu["texte"] and "watermark" not in vu["texte"]
    generation, _, _ = atelier.generations.preparer(
        modeles[famille], Demande(prompt="a wooden treasure chest", prompt_negatif="blurry, watermark",
            resolution="1024", proportions="1:1"), projet=projet)
    assert generation.demande["prompt"] == vu["texte"]
    assert ("blurry" in generation.demande["prompt_negatif"]) is lu
    assert "blurry" not in generation.demande["prompt"]


async def test_le_texte_montre_est_celui_qui_part_tri_compris(jeu):
    """Règle 6 : la même résolution, triée pareil, pour l'écran et pour l'envoi."""
    atelier, projet, nain, modeles = jeu
    tri = Tri(eteints=frozenset({"jeu.monde"}), textes={"jeu.epoque": "bronze age"})
    vu = apercu(atelier, projet, modeles["zimage"], personnage=nain, pose="marche", direction="sud", tri=tri)
    assert "bronze age" in vu["texte"] and "elves" not in vu["texte"]
    generation, _, _ = atelier.generations.preparer(
        modeles["zimage"], Demande(prompt=SIGNALEMENT, resolution="1024", proportions="1:1"),
        projet=projet, personnage=nain, pose="marche", direction="sud", tri=tri)
    assert generation.demande["prompt"] == vu["texte"]


async def test_un_texte_repris_part_mot_pour_mot_derriere_le_declencheur(jeu):
    atelier, projet, nain, modeles = jeu
    vu = apercu(atelier, projet, modeles["zimage"], sujet="CAMERA sideways, my own words.", repris=True)
    declencheur = atelier.profils_workflow.de_modele(modeles["zimage"])["style"]["declencheur"]
    assert vu["texte"] == f"{declencheur} CAMERA sideways, my own words."
    deja = apercu(atelier, projet, modeles["zimage"], sujet=f"{declencheur} a chest", repris=True)
    assert deja["texte"] == f"{declencheur} a chest"


async def test_le_texte_entre_tel_quel_dans_le_graphe(jeu):
    """Ce que l'aperçu montre est ce que le nœud de texte du graphe reçoit."""
    from atelier.domaine.workflow import composer
    atelier, projet, nain, modeles = jeu
    vu = apercu(atelier, projet, modeles["sdxl"], sujet="a wooden treasure chest")
    profil = atelier.profils_workflow.de_modele(modeles["sdxl"])
    graphe = composer(profil, prompt=vu["texte"], prompt_negatif=vu["interdiction"], resolution=profil["formats"][0]["resolution"],
        proportions=profil["formats"][0]["proportions"])
    textes = [n["inputs"].get("text") for n in graphe.values() if n["class_type"] == "CLIPTextEncode"]
    assert vu["texte"] in textes and vu["interdiction"] in textes


# ── Un modèle payant : pas un caractère ne bouge ─────────────────────────────

# Figé le 18 septembre 2026 : le texte qu'un modèle payant reçoit pour la case
# « marche, sud » du nain, au caractère près.
#
# **Refigé le 20 septembre 2026 (RT3)**, et sur un seul mot : le fond. Il n'est
# plus le réglage que le décor pose (`fond="#FF00FF"`, toujours écrit sur le
# disque et toujours relu) mais la couleur que l'atelier calcule pour cet appel.
# Cet appel-ci ne joint aucune image de référence, donc il n'y a rien à
# comparer, donc c'est le vert de studio. Tout le reste du texte est inchangé,
# et c'est ce que ce test existe pour dire.
FIGE = (
    "CONTEXT\n\n"
    "World: high fantasy, elves and dwarves, ancient kingdoms, deep old-growth forest, moss, ferns and giant roots. Every village hides a shrine.\n"
    "Era: medieval fantasy age\n"
    "Rendering technique: 2D pixel art on a 64x64 grid\n"
    "Line and shading: flat colour fills, clean dark outline, no anti-aliasing\n"
    "Lighting: thick low-lying fog, volumetric haze, moonlight, cool blue key light, deep shadows, long cast shadows\n"
    "View and framing: 3/4 top-down orthographic view, subject centered\n"
    "Technical constraints: single isolated sprite on a flat solid #00B140 studio green background, strict 64x64 px tile snap\n\n"
    "REQUEST\n\n"
    "a stocky dwarf miner with a copper lantern, walking posture, full body, facing south, toward the viewer\n\n"
    "FRAMING — one single sprite and nothing else: no scenery, no ground, no extra props, nothing the description "
    "above does not name. The subject is centred and fills most of the image. No text, no letters, no numbers, no "
    "logo, no frame, no border.\n"
    "CAMERA — this overrides everything above. The camera is above the subject and tilted down towards it, the way "
    "A Link to the Past and Stardew Valley look at their world. Not straight overhead, not at eye level. No horizon "
    "line, no vanishing point. You see the subject's front face and its upper surface at the same time, and its base "
    "is visible below it. On a character, the face and the top of the head at once, with the feet showing."
)
INTERDICTION_FIGEE = (
    "blurry, watermark ; the background colour #00B140 studio green, or any shade close to it, anywhere on the subject "
    "itself (on its outfit, its skin, its hair, its accessories, its reflections or its shadows)"
)


async def test_un_modele_openrouter_recoit_exactement_le_texte_d_avant(jeu, double):
    atelier, projet, nain, modeles = jeu
    vu = apercu(atelier, projet, "essai:rend-du-png", personnage=nain, pose="marche", direction="sud")
    assert vu["local"] is None and vu["negatif_lu"] is True
    assert vu["texte"] == FIGE and vu["interdiction"] == INTERDICTION_FIGEE
    assert [p["titre"] for p in vu["parties"]] == ["CONTEXT", "REFERENCES", "REQUEST"]
    generation, _, _ = atelier.generations.preparer(
        "essai:rend-du-png", Demande(prompt=SIGNALEMENT, prompt_negatif="blurry, watermark"),
        projet=projet, personnage=nain, pose="marche", direction="sud")
    assert generation.demande["prompt"] == FIGE
    assert generation.demande["prompt_negatif"] == INTERDICTION_FIGEE


def test_le_comptage_approche_clip_sur_des_cas_connus():
    # Relevés avec le vrai BPE de ComfyUI (comfy/sd1_tokenizer) : 5, 15, 8 — et
    # 63, 69 et 58 pour les trois textes SDXL de ce fichier, que l'approximation
    # compte 71, 72 et 70 : elle compte large, jamais court sur ces cas.
    assert texte_local.compter_jetons("pixel art, a dwarf") >= 5
    assert texte_local.compter_jetons("strict 64x64 px tile snap, #FF00FF") >= 15
    assert texte_local.compter_jetons("one isolated subject, centered, full view") >= 8


@pytest.mark.parametrize("famille", STYLES)
async def test_la_grille_du_jeu_ne_part_pas_elle_se_dessinerait(jeu, famille):
    """Premier tirage réel (ML7, Z-Image) : « on a 64x64 grid » et « tile snap »
    donnaient un fond quadrillé. Ils ne partent plus vers un style local, et
    l'écran les montre retirés — sur les cinq familles, SDXL compris : la
    grille est retirée pour elle-même avant que le rognage aux jetons de SDXL
    n'entre en jeu, elle n'a donc pas besoin d'un traitement à part."""
    atelier, projet, nain, modeles = jeu
    vu = apercu(atelier, projet, modeles[famille], personnage=nain, pose="marche", direction="sud")
    assert "grid" not in vu["texte"] and "tile snap" not in vu["texte"]
    retires = vu["local"]["retires"]
    grille = [r for r in retires if "64x64 grid" in r["texte"]]
    snap = [r for r in retires if "tile snap" in r["texte"]]
    # Jamais absente en silence : soit retirée pour elle-même (la taille reste
    # tenue au retour), soit noyée dans un dépassement de jetons — jamais dans
    # le texte envoyé, vérifié juste au-dessus.
    assert grille and all(r["raison"] in (texte_local.RAISON_GRILLE, texte_local.RAISON_JETONS) for r in grille)
    assert snap and all(r["raison"] in (texte_local.RAISON_GRILLE, texte_local.RAISON_JETONS) for r in snap)
