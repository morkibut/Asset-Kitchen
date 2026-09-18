"""Relecture du chantier des moteurs locaux (18 septembre 2026) — défauts 1, 5,
6 et 8. ComfyUI est doublé : le relevé réel de ML2 pour ce qui ne génère pas,
le double de AU7 pour ce qui passe par la file.

1. Ce que le produit ajoute ne devient jamais l'image de départ d'un style
   « partir de cette image », et un style « garder ce sujet » ne reçoit ni
   gabarit ni bande de couleurs (règle 4). Ce qui cède est montré.
5. Le temps annoncé est la durée propre du calcul, à chaud ; le premier tirage
   est annoncé à part.
6. Une graine fournie refait la même image ; une relance garde la graine de
   son étape.
8. L'image de départ est posée sur le fond du jeu, pas sur blanc.
"""
import asyncio
import io

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from atelier.api.app import creer_application
from atelier.domaine import Emplacement, Generation, Reinjection, Statut
from atelier.domaine.erreurs import DemandeRefusee
from atelier.domaine.generation import ASSET, REFERENCE
from atelier.services import Atelier
from atelier.domaine.envoi import Tri
from atelier.services.envoi import PALETTE
from atelier.services.generation import Demande
from tests.test_a9 import AnimateurDouble
from tests.conftest import image_sujet
from tests.test_au7_au8 import ComfyDouble, ajouter, profil, raccorder
from tests.test_ml1 import avec_graine, png_transparent
from tests.test_ml4 import SIGNALEMENT, jeu  # noqa: F401 — la fixture du jeu décrit

QUATRE = ["nord", "sud", "est", "ouest"]
MAGENTA = (255, 0, 255)


def _artwork(atelier, projet):
    """Un artwork officiel du jeu, pour toutes les familles — ce que le produit
    ajoute de lui-même à chaque appel."""
    tampon = io.BytesIO()
    Image.new("RGB", (32, 32), (20, 120, 60)).save(tampon, format="PNG")
    carte = atelier.univers.coller_image(projet, tampon.getvalue(), nom="artwork.png", forcer=True)["carte"]
    atelier.univers.promouvoir(projet, carte["identifiant"], officiel=True)
    return carte["identifiant"]


def _joindre(atelier, projet, octets, nom):
    return atelier.generations.importer(octets, nom, projet=projet)["asset"]["identifiant"]


def _parties(atelier, generation):
    """Les images qui partent vraiment : celles que la file locale recevra."""
    return atelier.generations.demande_preparee(generation).references


# ── Défaut 1 · partir de cette image (Z-Image) ──────────────────────────────

async def test_sonde_1_image_libre_z_image_l_artwork_n_est_pas_repeint(jeu):
    atelier, projet, nain, modeles = jeu
    artwork = _artwork(atelier, projet)
    generation, _, _ = atelier.generations.preparer(
        modeles["zimage"], Demande(prompt="a wooden treasure chest"), projet=projet)
    assert _parties(atelier, generation) == ()
    assert generation.references == ()
    assert [r.asset for r in generation.hors_plafond] == [artwork]
    # L'écran de confirmation dit la même chose, sur la même ligne.
    rendu = atelier.envoi.envoi(projet=projet, sujet="a wooden treasure chest", modele=modeles["zimage"])
    ligne = next(l for l in rendu["images"]["lignes"] if l["asset"] == artwork)
    assert ligne["cochee"] and ligne["hors_plafond"] and ligne["rang"] is None
    assert rendu["images"]["partent"] == 0
    textes = " ".join(a["texte"] for a in rendu["avertissements"])
    assert "ne repeint que l'image que vous joignez" in textes


async def test_sonde_2_planche_quatre_directions_le_gabarit_ne_part_pas(jeu):
    atelier, projet, nain, modeles = jeu
    generation, _, _ = atelier.generations.preparer(
        modeles["zimage"], Demande(prompt=SIGNALEMENT), projet=projet,
        personnage=nain, pose="marche", directions=QUATRE)
    assert generation.pliage is not None and generation.pliage.nombre == 4
    assert _parties(atelier, generation) == ()
    # Et l'écran le montre, au lieu de ne rien dire.
    rendu = atelier.envoi.envoi(projet=projet, sujet=SIGNALEMENT, modele=modeles["zimage"],
        personnage=nain, pose="marche", directions=QUATRE)
    assert rendu["images"]["jointe"] is None and rendu["images"]["gabarit"] == 0
    assert any(a["texte"].startswith("le gabarit de la grille ne part pas") for a in rendu["avertissements"])


async def test_sonde_3_artwork_et_planche_sans_rien_joindre_part_quand_meme(jeu):
    atelier, projet, nain, modeles = jeu
    artwork = _artwork(atelier, projet)
    # Avant : « n'accepte que 1 image de référence, il en faudrait 2 ».
    generation, _, _ = atelier.generations.preparer(
        modeles["zimage"], Demande(prompt=SIGNALEMENT, palette=True), projet=projet,
        personnage=nain, pose="marche", directions=QUATRE)
    assert _parties(atelier, generation) == ()
    assert [r.asset for r in generation.hors_plafond] == [artwork]


async def test_l_image_jointe_par_l_auteur_part_seule_comme_image_de_depart_sur_le_fond_du_jeu(jeu):
    """Défaut 1 et défaut 8 : l'image de l'auteur part, seule, posée sur le
    fond que le texte demande (#FF00FF), et l'artwork du jeu cède."""
    atelier, projet, nain, modeles = jeu
    artwork = _artwork(atelier, projet)
    joint = _joindre(atelier, projet, png_transparent(), "croquis")
    generation, _, _ = atelier.generations.preparer(
        modeles["zimage"], Demande(prompt="a wooden treasure chest"), projet=projet,
        references=[Reinjection(asset=joint, role=REFERENCE, origine=ASSET)])
    assert [r.asset for r in generation.references] == [joint]
    assert [r.asset for r in generation.hors_plafond] == [artwork]
    (depart,) = _parties(atelier, generation)
    posee = Image.open(io.BytesIO(depart))
    assert posee.mode == "RGB"
    assert posee.getpixel((0, 0)) == MAGENTA and posee.getpixel((4, 4)) == (190, 40, 40)
    # L'écran : l'image jointe a le rang 1, l'artwork est grisé.
    rendu = atelier.envoi.envoi(projet=projet, sujet="a wooden treasure chest", modele=modeles["zimage"],
        references=[Reinjection(asset=joint, role=REFERENCE, origine=ASSET)])
    rangs = {l["asset"]: (l["rang"], l["hors_plafond"]) for l in rendu["images"]["lignes"]}
    assert rangs == {joint: (1, False), artwork: (None, True)}


async def test_deux_images_jointes_par_l_auteur_restent_refusees(jeu):
    atelier, projet, nain, modeles = jeu
    refs = [Reinjection(asset=_joindre(atelier, projet, image_sujet(bloc=4 + i), f"r{i}"), role=REFERENCE, origine=ASSET)
            for i in range(2)]
    with pytest.raises(DemandeRefusee, match="1 image de référence, il en faudrait 2"):
        atelier.generations.preparer(modeles["zimage"], Demande(prompt="a chest"), projet=projet, references=refs)


# ── Défaut 1 · garder ce sujet (Klein) ──────────────────────────────────────

async def test_klein_recoit_les_images_du_sujet_ni_gabarit_ni_bande_ni_artwork(jeu):
    atelier, projet, nain, modeles = jeu
    artwork = _artwork(atelier, projet)
    promue = _joindre(atelier, projet, png_transparent(), "le nain de face")
    atelier.production.promouvoir_reference(projet, nain, promue)
    klein = modeles["klein-base"]
    generation, _, _ = atelier.generations.preparer(
        klein, Demande(prompt=SIGNALEMENT, palette=True), projet=projet,
        personnage=nain, pose="marche", directions=QUATRE)
    assert [r.asset for r in generation.references] == [promue]
    assert [r.asset for r in generation.hors_plafond] == [artwork]
    # Une seule image part : la référence du sujet — sur le fond du jeu (défaut 8).
    (sujet,) = _parties(atelier, generation)
    assert Image.open(io.BytesIO(sujet)).getpixel((0, 0)) == MAGENTA
    # Le texte ne numérote pas un gabarit ou une bande qui ne partent pas.
    assert "palette" not in generation.demande["prompt"].lower()
    rendu = atelier.envoi.envoi(projet=projet, sujet=SIGNALEMENT, modele=klein, tri=Tri(allumes=frozenset({PALETTE})),
        personnage=nain, pose="marche", directions=QUATRE)
    assert rendu["images"]["jointe"] is None and rendu["images"]["palette"] == 0
    textes = [a["texte"] for a in rendu["avertissements"]]
    assert any(t.startswith("le gabarit de la grille ne part pas") for t in textes)
    assert any(t.startswith("la bande de couleurs ne part pas") for t in textes)
    assert any("ne garde que les images du sujet" in t for t in textes)
    option = next(o for o in rendu["options"] if o["nom"] == "palette")
    assert option["refus"] and not option["allumee"]


async def test_un_modele_distant_garde_l_artwork_le_gabarit_et_la_bande(jeu):
    """Rien ne bouge hors des styles locaux : le même appel vers un modèle
    distant emporte l'artwork, le gabarit et la bande comme avant."""
    atelier, projet, nain, modeles = jeu
    artwork = _artwork(atelier, projet)
    distant = "essai:rend-du-png"
    generation, _, _ = atelier.generations.preparer(
        distant, Demande(prompt=SIGNALEMENT), projet=projet,
        personnage=nain, pose="marche", directions=QUATRE)
    assert [r.asset for r in generation.references] == [artwork] and generation.hors_plafond == ()
    assert len(_parties(atelier, generation)) == 2  # l'artwork, puis le gabarit
    compte = atelier.generations.compter_references(projet, "", (), nain, 4, None, palette=True,
        directions=QUATRE, modele=distant)
    assert "style_local" not in compte and compte["gabarit"] == 1 and compte["palette"] == 1


# ── Défaut 5 · le temps annoncé ──────────────────────────────────────────────

def _etape(n, modele, duree, *, moteur="ComfyUI@http://comfy.test", temperature="inconnue", etat="termine"):
    return {"identifiant": f"{n:032x}", "moteur": moteur, "modele": modele, "etat": etat,
            "demarre_le": 1000.0 + n, "duree_s": duree, "temperature": temperature}


async def test_le_temps_annonce_est_la_duree_a_chaud_sans_l_attente_de_la_file(jeu, monkeypatch):
    atelier, projet, nain, modeles = jeu
    z, k = modeles["zimage"], modeles["klein-base"]
    etapes = [
        _etape(1, z, 60.0),            # le premier : modèle à charger
        _etape(2, z, 20.0), _etape(3, z, 22.0), _etape(4, z, 24.0),
        _etape(5, k, 90.0),            # un autre modèle prend la mémoire…
        _etape(6, z, 58.0),            # … et Z-Image se recharge
        _etape(7, z, None, etat="echoue"),
    ]
    monkeypatch.setattr(atelier.file_locale, "lister", lambda: {"etapes": etapes, "regle": ""})
    # Une génération mesurée autour de tout l'appel, attente dans la file
    # comprise : elle ne décide plus du temps annoncé.
    atelier.generations._base.enregistrer(Generation(
        identifiant="attente", modele=z, demande={}, parametres_resolus={},
        emplacements=[Emplacement(rang=0, statut=Statut.REUSSIE, duree_s=600.0, consomme=0.0)]))
    temps = atelier.generations.temps_attendu(z)
    assert temps["secondes"] == 22.0 and temps["premier_secondes"] == 59.0
    assert temps["mesures"] == 5 and temps["vitesse"]
    # Klein n'a qu'un tirage, à froid : c'est tout ce qu'on sait, et il est dit tel.
    assert atelier.generations.temps_attendu(k) == {
        "secondes": 90.0, "mesures": 1, "vitesse": temps_vitesse(atelier, k), "premier_secondes": 90.0}
    # L'écran de confirmation lit le même temps.
    assert atelier.envoi.envoi(projet=projet, sujet="a chest", modele=z)["local"]["temps"] == temps


def temps_vitesse(atelier, modele):
    return atelier.profils_workflow.de_modele(modele)["style"]["vitesse"]


async def test_la_temperature_dite_par_la_file_l_emporte(jeu, monkeypatch):
    atelier, projet, nain, modeles = jeu
    z = modeles["zimage"]
    etapes = [_etape(1, z, 21.0, temperature="chaud"), _etape(2, z, 70.0, temperature="froid")]
    monkeypatch.setattr(atelier.file_locale, "lister", lambda: {"etapes": etapes, "regle": ""})
    temps = atelier.generations.temps_attendu(z)
    assert (temps["secondes"], temps["premier_secondes"], temps["mesures"]) == (21.0, 70.0, 2)


# ── Défaut 6 · la graine ─────────────────────────────────────────────────────

class ComfyOccupe(ComfyDouble):
    """Le double d'AU7, dont la file peut se dire occupée par un autre calcul."""
    def __init__(self):
        super().__init__()
        self.occupe = False

    def repondre(self, req):
        if req.url.path == "/queue" and self.occupe:
            return httpx.Response(200, json={"queue_running": [[0, "calcul-d-ailleurs"]], "queue_pending": []})
        return super().repondre(req)


async def _ouvrir(racine, double, comfy):
    atelier = Atelier(racine=racine, fabrique_fournisseur=lambda: double, fabrique_animateur=lambda: AnimateurDouble())
    raccorder(atelier, comfy)
    await atelier.ouvrir()
    return atelier


async def _fermer(atelier):
    await atelier.file_locale.fermer()
    await atelier.generations.attendre_tout()


async def test_une_relance_garde_la_graine_de_son_etape(tmp_path, double):
    """Relancer passe par `generer_suivi`, qui retrouve l'étape déjà préparée :
    sans la réutilisation de sa graine, la clé désignerait un autre calcul et la
    relance échouerait (« Cette clé locale désigne déjà un autre calcul »)."""
    comfy = ComfyOccupe()
    atelier = await _ouvrir(tmp_path / "donnees", double, comfy)
    p = await ajouter(atelier, comfy, avec_graine(profil()))
    comfy.occupe = True
    generation = await atelier.generations.soumettre(p["modele"], Demande(prompt="Un pèlerin", repris=True, resolution="64"))
    etape = None
    for _ in range(500):
        etape = atelier.generations.etape_locale(generation.identifiant)
        if etape:
            break
        await asyncio.sleep(0.01)
    assert etape and etape["etat"] == "en_attente" and not comfy.envois
    graine = etape["parametres"]["valeurs"]["graine"]
    # L'atelier se ferme pendant que l'image attend son tour.
    await _fermer(atelier)

    rouvert = await _ouvrir(tmp_path / "donnees", double, comfy)
    try:
        assert rouvert.generations.lire(generation.identifiant).emplacement(0).statut == Statut.INTERROMPUE
        comfy.occupe = False
        await rouvert.generations.relancer(generation.identifiant, 0)
        await rouvert.generations.attendre_tout()
        relue = rouvert.generations.lire(generation.identifiant)
        assert relue.emplacement(0).statut == Statut.REUSSIE, relue.emplacement(0).raison
        assert len(comfy.envois) == 1
        assert comfy.envois[0]["prompt"]["3"]["inputs"]["seed"] == graine == relue.emplacement(0).graine
        # Et la fiche de l'image la lit : GET /api/generations/{id}.
        lue = TestClient(creer_application(rouvert)).get(f"/api/generations/{generation.identifiant}").json()
        assert lue["emplacements"][0]["graine"] == graine
    finally:
        await _fermer(rouvert)


async def test_une_graine_illisible_ou_sans_liaison_est_refusee_avant_la_file(tmp_path, double):
    comfy = ComfyDouble()
    atelier = await _ouvrir(tmp_path / "donnees", double, comfy)
    try:
        avec = await ajouter(atelier, comfy, avec_graine(profil()))
        for mauvaise in ("123", -1, 2**53, True, 1.5):
            with pytest.raises(DemandeRefusee, match="la graine est un entier positif"):
                atelier.generations.preparer(avec["modele"], Demande(prompt="Un pèlerin", repris=True,
                    resolution="64", options={"graine": mauvaise}))
        sans = await ajouter(atelier, comfy, {**profil(), "identifiant": "sans-graine"})
        with pytest.raises(DemandeRefusee, match="pas de graine reliée"):
            atelier.generations.preparer(sans["modele"], Demande(prompt="Un pèlerin", repris=True,
                resolution="64", options={"graine": 7}))
        # Acceptée : ni refusée comme option inconnue, ni écartée, et dite.
        generation, _, _ = atelier.generations.preparer(avec["modele"], Demande(prompt="Un pèlerin",
            repris=True, resolution="64", options={"graine": 7}))
        assert generation.ecartees == [] and generation.parametres_resolus["graine"] == 7
        assert not atelier.file_locale.lister()["etapes"]
    finally:
        await _fermer(atelier)


async def test_deux_generations_avec_la_meme_graine_envoient_la_meme_graine(tmp_path, double):
    comfy = ComfyDouble()
    atelier = await _ouvrir(tmp_path / "donnees", double, comfy)
    try:
        p = await ajouter(atelier, comfy, avec_graine(profil()))
        # Le corps de POST /api/generations passe `options` tel quel à la
        # demande (`routes.generer`) : la graine y est une clé réservée.
        identifiants = []
        for _ in range(2):
            generation = await atelier.generations.soumettre(p["modele"], Demande(prompt="Un pèlerin",
                repris=True, resolution="64", options={"graine": 123456}))
            identifiants.append(generation.identifiant)
            await atelier.generations.attendre_tout()
        assert [e["prompt"]["3"]["inputs"]["seed"] for e in comfy.envois] == [123456, 123456]
        client = TestClient(creer_application(atelier))
        for identifiant in identifiants:
            lue = client.get(f"/api/generations/{identifiant}").json()
            assert lue["emplacements"][0]["graine"] == 123456
    finally:
        await _fermer(atelier)
