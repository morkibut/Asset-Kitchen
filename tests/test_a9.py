# -*- coding: utf-8 -*-
"""A9 — le clip entre dans l'atelier.

Les critères de `docs/archive/plan-r6-a-v3.02.md` § A9. **Aucun n'appelle un vrai fournisseur** :
l'animateur d'ici est un double qui rend un vrai fichier MP4 quand le décodeur
est installé, et des octets quelconques sinon. Les dix-huit clips qui ont servi
à trancher la méthode ont coûté 1,38 $ ; ces essais-ci coûtent zéro.

**Ce que la tranche instaure, et que ces essais mesurent.** Un appel vidéo n'est
pas un appel d'image sur trois points, et chacun casse quelque chose s'il n'est
pas tenu :

1. **Il est asynchrone**, et le numéro du travail s'écrit *avant* la première
   attente — sinon un clip payé pendant qu'on fermait l'atelier se repaie.
2. **Son entrée est obligatoire**, et aucun plafond ne la fait céder — là où les
   trois rôles d'image jointe du produit cèdent tous (F6).
3. **Ce qui revient n'est pas une image**, et la dépense s'écrit avant toute
   mesure de fichier — sinon un clip payé disparaît du journal.

**Ce qui ne se mesure pas ici** : que les modèles retenus rendent de bonnes
animations. Ça s'est mesuré en payant, au banc, et c'est écrit dans le plan. Un
double qui rendrait de belles images prouverait seulement que le double est bien
écrit.
"""

from __future__ import annotations

import io



import pytest

from atelier.domaine.animation import (
    Clip,
    DemandeClip,
    ModeleVideo,
    Prix,
    Tarification,
)
from atelier.domaine.erreurs import AppelRefuse, DemandeRefusee, ErreurAtelier
from atelier.domaine.travail import TravailRefuse
from conftest import commander_un_clip
from atelier.domaine.generation import Statut
from atelier.depot import Base, Fichiers
from atelier.fournisseur.openrouter_video import (
    OpenRouterVideo,
    tarification_pour,
)
from atelier.fournisseur.port import ClipProduit, EtatTravail
from atelier.image import clip as decodeur
from atelier.services.animation import ServiceAnimation


# ── Le double d'animateur ───────────────────────────────────────────────────


JETONS = Tarification(genre="jeton", montant=0.0000035, libelle="video_tokens")
A_LA_SECONDE = Tarification(genre="seconde", montant=0.02, libelle="duration_seconds")

MELE = ModeleVideo(
    identifiant="essai:mele-les-poses",
    nom="Essai — plusieurs poses",
    fournisseur="essai",
    chez_lui="mele-les-poses",
    durees=(4, 5, 6),
    resolutions=("480p", "720p"),
    proportions=("1:1", "16:9"),
    mesure="3 clips payés, 2 notés bons sur 2. Sous la barre des 8 tirages.",
    tarification=JETONS,
)
SANS_TARIF = ModeleVideo(
    identifiant="essai:sans-tarif",
    nom="Essai — tarif illisible",
    fournisseur="essai",
    chez_lui="sans-tarif",
    durees=(5,),
    resolutions=("480p",),
    proportions=("1:1",),
    tarification=None,
    tarifs_declares=("un_sku_inconnu",),
)
SANS_IMAGE = ModeleVideo(
    identifiant="essai:texte-seulement",
    nom="Essai — texte seulement",
    fournisseur="essai",
    chez_lui="texte-seulement",
    durees=(5,),
    resolutions=("480p",),
    proportions=("1:1",),
    accepte_une_image=False,
    tarification=A_LA_SECONDE,
)


def clip_mp4(images: int = 6, cote: int = 32) -> bytes:
    """Un vrai clip, quand le décodeur est là. Sinon des octets quelconques.

    **Un double qui rendrait toujours des octets quelconques ne mesurerait
    rien** de l'extraction : c'est précisément ce que la tranche ajoute. Quand
    le décodeur manque, les essais qui en dépendent se sautent, et les autres
    tournent — ce qui est aussi la promesse du produit.
    """
    if decodeur.indisponible():
        return b"\x00\x00\x00\x18ftypmp42 ce ne sont pas de vraies images"
    import imageio.v3 as iio
    import numpy as np

    suite = np.zeros((images, cote, cote, 3), dtype="uint8")
    for numero in range(images):
        suite[numero, :, : max(1, numero * 4)] = 200
    return iio.imwrite("<bytes>", suite, extension=".mp4", fps=24)


class AnimateurDouble:
    """Implémente `PortAnimateur`, sans réseau et sans facture.

    Ses leviers disent chacun un cas du produit : `facture` sépare le montant
    réel de l'estimation, `octets` fait revenir un fichier illisible, `echec_au
    _telechargement` fait rater le dernier pas *après* la facturation, et
    `tours_avant_la_fin` fait attendre — c'est lui qui permet de regarder ce qui
    est écrit sur le disque **pendant** l'attente.
    """

    nom = "essai"

    def __init__(self) -> None:
        self.modeles = [MELE, SANS_TARIF, SANS_IMAGE]
        self.soumissions: list[tuple[str, DemandeClip]] = []
        self.travaux_rendus: list[str] = []
        self.etats_demandes: list[str] = []
        self.recuperations: list[str] = []
        self.facture = 0.041
        self.octets: bytes | None = None
        self.echec_au_telechargement: AppelRefuse | None = None
        self.tours_avant_la_fin = 0
        self.manque: str | None = None
        # Ce qui a été écrit sur le disque au moment où l'on a demandé l'état
        # pour la première fois. C'est la seule façon de vérifier que le numéro
        # du travail est écrit **avant** la première attente.
        self.travail_sur_disque_au_premier_regard: str | None = None
        self._regarder = None

    def indisponible(self) -> str | None:
        return self.manque

    async def catalogue_video(self) -> list[ModeleVideo]:
        return list(self.modeles)

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        self.soumissions.append((modele.identifiant, demande))
        travail = f"travail-{len(self.soumissions)}"
        self.travaux_rendus.append(travail)
        return travail

    async def etat(self, travail: str) -> EtatTravail:
        if not self.etats_demandes and self._regarder is not None:
            self.travail_sur_disque_au_premier_regard = self._regarder()
        self.etats_demandes.append(travail)
        if len(self.etats_demandes) <= self.tours_avant_la_fin:
            return EtatTravail(travail=travail, raison="il le fabrique encore")
        return EtatTravail(travail=travail, fini=True)

    async def recuperer(self, travail: str) -> ClipProduit:
        self.recuperations.append(travail)
        if self.echec_au_telechargement is not None:
            raise self.echec_au_telechargement
        return ClipProduit(
            octets=self.octets if self.octets is not None else clip_mp4(),
            consomme=self.facture,
            type_media="video/mp4",
            travail=travail,
            generation=f"gen-{travail}",
        )


@pytest.fixture
def animateur() -> AnimateurDouble:
    return AnimateurDouble()


@pytest.fixture
async def service(tmp_path, animateur) -> ServiceAnimation:
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()
    service = ServiceAnimation(
        base=Base(tmp_path / "donnees" / "atelier.sqlite3"),
        fichiers=fichiers,
        animateur=lambda: animateur,
    )
    await service.rafraichir()
    return service


def demande(secondes: int = 5, image: bytes = b"\x89PNG\r\n\x1a\nsprite") -> DemandeClip:
    return DemandeClip(
        texte="Idle 2 s, transition, puis marche à vitesse constante.",
        image=image,
        secondes=secondes,
    )


# ── Le montant enregistré est celui de la réponse ───────────────────────────


async def test_le_montant_enregistre_est_celui_facture_jamais_l_estimation(
    service, animateur
):
    """*Le montant enregistré est celui de la réponse, jamais l'estimation.*

    Le double facture 0,041 $ là où la formule en annonce 0,094 : c'est l'écart
    réel, mesuré le 2 septembre 2026, entre une estimation par jetons vidéo et
    ce qui tombe sur la facture. **Les deux sont gardés**, et l'écran peut donc
    les distinguer — ce que le critère demande explicitement.
    """
    annonce = service.annonce(MELE, demande())
    assert annonce.montant == pytest.approx(0.0945, abs=1e-4)

    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.emplacements[0].consomme == pytest.approx(0.041)
    assert relue.cout_usd == pytest.approx(0.041)
    # L'estimation est gardée à part, avec sa formule : elle ne se confond
    # jamais avec la dépense.
    assert relue.clip.prix_annonce == pytest.approx(0.0945, abs=1e-4)
    assert "jeton" in relue.clip.prix_formule


async def test_le_prix_annonce_porte_toujours_sa_formule(service):
    """*Le prix annoncé avant l'envoi porte sa formule.*

    Un prix sans sa formule n'est pas vérifiable : selon qu'un modèle compte à
    la seconde ou au jeton vidéo, le même clip n'a pas le même prix, et l'auteur
    doit pouvoir refaire le calcul.
    """
    au_jeton = service.annonce(MELE, demande())
    assert "480×480×24×5/1024" in au_jeton.formule
    assert "video_tokens" in au_jeton.formule

    a_la_seconde = ModeleVideo(
        identifiant="essai:x", nom="X", durees=(5,), tarification=A_LA_SECONDE
    ).prix(demande())
    assert a_la_seconde.montant == pytest.approx(0.10)
    assert "0,02 $ la seconde" in a_la_seconde.formule


def test_la_formule_s_ecrit_en_nombres_qu_on_peut_lire():
    """⚠️ *Elle s'écrivait `3.5e-06 $ le jeton … = 27000 jetons`.*

    Vu au navigateur le 4 septembre 2026, et pas avant : trois défauts à la
    fois — la notation scientifique, le point décimal, un compte sans
    séparateur — **sur la ligne dont tout l'objet est de rendre un prix
    vérifiable de tête**. Un nombre qu'on n'arrive pas à lire ne vérifie rien,
    et la formule ne servait donc à personne.
    """
    formule = MELE.prix(demande()).formule
    assert formule.startswith("0,0000035 $ le jeton")
    assert "27 000 jetons" in formule
    assert "e-" not in formule


def test_une_estimation_se_dit_estimation_dans_ce_qui_part_a_l_ecran():
    """L'écran ne peut distinguer les deux que si le mot voyage avec le chiffre."""
    assert Prix(montant=0.09, formule="…").en_json()["nature"] == "estimation"


# ── Le grisé et ce qu'il dit ────────────────────────────────────────────────


async def test_un_modele_sans_tarif_lisible_est_grise_avec_sa_raison(service):
    """*Un modèle dont le prix n'a pas pu être relu est grisé avec sa raison.*

    Jamais proposé au hasard : commander sans savoir ce qu'on engage est
    exactement ce que le produit refuse de faire faire à l'auteur.
    """
    raison = service.grise(SANS_TARIF, demande())
    assert raison is not None
    assert "prix n'a pas pu être relu" in raison
    assert "un_sku_inconnu" in raison

    with pytest.raises(DemandeRefusee):
        await service.commander(SANS_TARIF.identifiant, demande())
    assert animateur_vide(service)


def animateur_vide(service) -> bool:
    """Rien n'est parti chez le fournisseur — donc rien n'a été payé."""
    return not service._animateur().soumissions


async def test_un_modele_qui_n_anime_pas_une_image_n_est_pas_propose(service):
    """Il n'est pas grisé, il est **absent**.

    Un grisé se lève quand on répare quelque chose — déposer une clé, changer
    une durée. Là il n'y a rien à réparer : ce modèle ne sait pas partir d'un
    sprite, et le proposer serait proposer ce qu'on devra refuser.
    """
    proposes = [m.identifiant for m in service.modeles()]
    assert SANS_IMAGE.identifiant not in proposes
    assert MELE.identifiant in proposes


async def test_ce_qui_manque_au_fournisseur_grise_tous_ses_modeles(service, animateur):
    animateur.manque = "il manque, chez essai : la clé"
    assert service.grise(MELE, demande()) == "il manque, chez essai : la clé"


async def test_le_catalogue_video_ne_leve_jamais_et_dit_sa_panne(service, animateur):
    """« L'échec survient au moment où on génère, jamais au démarrage » (US-95)."""

    async def tombe():
        raise AppelRefuse("le catalogue vidéo a répondu 503", statut=503)

    animateur.catalogue_video = tombe
    modeles = await service.rafraichir()
    assert [m.identifiant for m in modeles] == [
        MELE.identifiant,
        SANS_TARIF.identifiant,
        SANS_IMAGE.identifiant,
    ]  # la liste précédente reste servie
    assert service.etat()["raison"] == "le catalogue vidéo a répondu 503"


# ── L'image de départ ───────────────────────────────────────────────────────


def test_l_image_de_depart_est_obligatoire_et_a_sa_propre_phrase():
    """*L'image de départ part sous son propre rôle.*

    Le produit refuse une image de référence de trop en disant « n'accepte que
    N images de référence » ; ici la phrase est autre, parce que le manque est
    d'une autre nature : sans image de départ il n'y a **pas d'appel du tout**.
    """
    refus = MELE.refus(DemandeClip(texte="marche", image=b"", secondes=5))
    assert refus == "demande une image de départ, et il n'y en a pas"


def test_aucun_plafond_ne_fait_ceder_l_image_de_depart():
    """*Aucun plafond ne la fait céder.*

    C'est la différence avec F6, où ce que le produit ajoute de lui-même —
    artworks, concept arts, images d'ambiance — cède devant le plafond du
    modèle. Un modèle vidéo n'a **pas** de plafond de références : le mot ne
    figure nulle part dans son vocabulaire, donc rien ne peut la faire céder.
    """
    assert not hasattr(MELE, "references_max")
    corps = OpenRouterVideo.corps_appel(MELE, demande())
    assert "input_references" not in corps
    assert len(corps["frame_images"]) == 1
    assert corps["frame_images"][0]["frame_type"] == "first_frame"


def test_un_clip_herite_son_style_de_son_sprite_et_de_rien_d_autre():
    """*Un clip hérite son style de son sprite de départ et de rien d'autre.*

    Une seule image part, et c'est celle-là. Ni bible, ni artworks, ni concept
    arts : le corps de l'appel n'a aucun autre endroit où en mettre.
    """
    corps = OpenRouterVideo.corps_appel(MELE, demande())
    images = [v for k, v in corps.items() if "image" in k or "reference" in k]
    assert len(images) == 1 and len(images[0]) == 1
    assert corps["generate_audio"] is False


# ── Le numéro du travail, et la reprise ─────────────────────────────────────


async def test_le_numero_du_travail_est_ecrit_avant_la_premiere_attente(
    service, animateur
):
    """*Le numéro du travail s'écrit sur l'emplacement dès la soumission.*

    C'est **la** ligne qui rend un clip rattrapable. Le double regarde le disque
    au moment où on lui demande l'état pour la première fois : si le numéro n'y
    est pas encore, un atelier fermé pendant l'attente perd un clip payé.
    """
    animateur.tours_avant_la_fin = 1

    def sur_disque():
        derniere = service._base.recentes(1)
        return derniere[0].clip.travail if derniere else None

    animateur._regarder = sur_disque

    await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()
    assert animateur.travail_sur_disque_au_premier_regard == "travail-1"


async def test_un_clip_commande_et_pas_revenu_se_retrouve_et_ne_repaie_rien(
    service, animateur
):
    """*Un clip commandé et pas encore revenu se retrouve au redémarrage, et le
    récupérer est un geste que l'auteur demande.*

    On simule la fermeture : la commande part sans que personne ne l'attende,
    exactement comme si le serveur s'était arrêté juste après. Le clip est alors
    en souffrance, et **il faut le demander** pour qu'il revienne.
    """
    generation = await service.commander(
        MELE.identifiant, demande(), attendre=False
    )
    assert animateur.recuperations == []  # rien n'a été rapatrié tout seul

    en_souffrance = [g.identifiant for g in service.en_souffrance()]
    assert en_souffrance == [generation.identifiant]

    relue = await service.recuperer(generation.identifiant)
    assert relue.emplacements[0].statut == Statut.REUSSIE
    assert relue.clip.recupere is True
    # **Une seule soumission** : le clip a été rapatrié, pas recommandé.
    assert len(animateur.soumissions) == 1
    assert relue.cout_usd == pytest.approx(0.041)


async def test_recuperer_deux_fois_ne_refait_rien(service):
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()
    avant = service.lire(generation.identifiant).cout_usd

    relue = await service.recuperer(generation.identifiant)
    assert relue.cout_usd == pytest.approx(avant)
    assert service._animateur().recuperations == ["travail-1"]


async def test_un_clip_sans_numero_de_travail_le_dit_au_lieu_de_relancer(service):
    generation = await service.commander(MELE.identifiant, demande(), attendre=False)
    generation.clip.travail = ""
    service._sauver(generation)
    with pytest.raises(ErreurAtelier) as refus:
        await service.recuperer(generation.identifiant)
    assert "rien à récupérer" in refus.value.raison


# ── Un clip payé garde sa dépense, quoi qu'il arrive ensuite ────────────────


async def test_un_clip_paye_garde_sa_depense_si_son_fichier_est_illisible(
    service, animateur
):
    """*Un clip payé garde sa dépense même si son fichier est illisible.*

    C'est le défaut que la tranche ferme. La chaîne d'images mesure tout fichier
    reçu ; un fichier vidéo y lève « illisible », et le rattrapage enregistrait
    alors un échec **à zéro dollar** — un clip payé disparu du journal.
    """
    animateur.octets = b"ce ne sont pas des images"
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.cout_usd == pytest.approx(0.041)
    # Le clip a réussi : il est arrivé, il est payé, il est sur le disque.
    assert relue.emplacements[0].statut == Statut.REUSSIE
    # Seule l'extraction a échoué, et elle le dit là où c'est sa place.
    assert relue.clip.extraction_refus
    assert relue.clip.images == 0


async def test_un_telechargement_rate_garde_la_depense_et_le_numero_du_travail(
    service, animateur
):
    """Un échec de téléchargement n'est pas un échec de fabrication.

    Le clip existe chez le fournisseur, il a été facturé, et « récupérer » ira
    le chercher. Effacer le numéro du travail ici transformerait un clip
    récupérable en clip à repayer.
    """
    animateur.echec_au_telechargement = AppelRefuse(
        "le clip n'a pas pu être téléchargé (401)", statut=401, consomme=0.041
    )
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.emplacements[0].statut == Statut.ECHOUEE
    assert relue.cout_usd == pytest.approx(0.041)
    assert relue.clip.travail == "travail-1"
    assert [g.identifiant for g in service.en_souffrance()] == [generation.identifiant]

    # Et le geste de reprise le rattrape sans repayer.
    animateur.echec_au_telechargement = None
    rattrapee = await service.recuperer(generation.identifiant)
    assert rattrapee.emplacements[0].statut == Statut.REUSSIE
    assert len(animateur.soumissions) == 1


async def test_une_attente_trop_longue_interrompt_sans_declarer_l_echec(
    service, animateur, monkeypatch
):
    """Le clip continue de se fabriquer et sera facturé : ce n'est pas un « non ».

    « Interrompue » est le statut de ce qui attend un geste ; « échouée » dirait
    que la réponse est arrivée et qu'elle est négative. Les confondre ferait
    croire qu'il n'y a rien à récupérer.
    """
    monkeypatch.setattr("atelier.services.animation.ATTENTE_MAX", 0.0)
    monkeypatch.setattr("atelier.services.animation.CADENCE_ATTENTE", 0.0)
    animateur.tours_avant_la_fin = 99

    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.emplacements[0].statut == Statut.INTERROMPUE
    assert "récupérer" in relue.emplacements[0].raison
    assert relue.clip.travail == "travail-1"


# ── Les images du clip ──────────────────────────────────────────────────────


@pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason=f"le décodeur de clips manque — {decodeur.indisponible()}",
)
async def test_les_images_sont_extraites_une_fois_et_le_clip_dit_combien(service):
    """*Les images du clip sont extraites une fois, à l'arrivée, et le clip dit
    combien il en porte et à quelle cadence.*

    Une fois et plus jamais : l'éditeur de montage fait glisser une fenêtre sur
    la pellicule, et redécoder cent images à chaque geste rendrait le geste
    central de la version impossible à faire à l'œil.
    """
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.clip.images == 6
    assert relue.clip.cadence == pytest.approx(24.0, abs=1.0)
    assert relue.clip.extraction_refus is None
    # Les dimensions sont **mesurées sur le fichier**, jamais celles demandées.
    assert relue.emplacements[0].resultat.largeur == 32

    dossier = service._fichiers.dossier_images_clip(generation.identifiant, 0)
    images = sorted(p.name for p in dossier.glob("*.png"))
    assert images[:2] == ["0000.png", "0001.png"]
    assert len(images) == 6


def test_le_decodeur_absent_dit_ce_qu_il_faut_installer(monkeypatch):
    """*Ce que le décodeur ajoute au dépôt est déclaré et justifié.*

    Absent, il ne dit pas « indisponible » : il nomme ce qu'il faut installer.
    Un grisé qui obligerait à lire le code pour être levé n'en est pas un.
    """
    import builtins

    vrai_import = builtins.__import__

    def sans_ffmpeg(nom, *reste, **mots):
        if nom == "imageio_ffmpeg":
            raise ImportError("pas là")
        return vrai_import(nom, *reste, **mots)

    monkeypatch.setattr(builtins, "__import__", sans_ffmpeg)
    manque = decodeur.indisponible()
    assert manque is not None and "pip install" in manque


# ── La lecture des tarifs, chez OpenRouter ──────────────────────────────────


def test_les_tarifs_en_centimes_sont_ramenes_en_dollars():
    """Cent fois trop cher ferait renoncer à un clip à trois centimes.

    Le nom du tarif est la seule chose qui distingue les deux — `cents_per_…`
    contre `duration_seconds` —, et un fournisseur sur trois compte en centimes.
    """
    tarif = tarification_pour(
        {"pricing_skus": {"cents_per_second_output": "1.5"}}, "480p"
    )
    assert tarif.genre == "seconde"
    assert tarif.montant == pytest.approx(0.015)


def test_le_tarif_de_la_resolution_demandee_passe_avant_le_generique():
    tarif = tarification_pour(
        {
            "pricing_skus": {
                "duration_seconds": "0.10",
                "duration_seconds_480p": "0.02",
            }
        },
        "480p",
    )
    assert tarif.libelle == "duration_seconds_480p"
    assert tarif.montant == pytest.approx(0.02)


def test_le_tarif_sans_audio_passe_avant_celui_avec_audio():
    """Le produit ne demande jamais de son : payer le tarif « avec » serait faux."""
    tarif = tarification_pour(
        {
            "pricing_skus": {
                "duration_seconds_with_audio": "0.40",
                "duration_seconds_without_audio": "0.15",
            }
        },
        "480p",
    )
    assert tarif.libelle == "duration_seconds_without_audio"


def test_un_tarif_inconnu_rend_rien_et_surtout_pas_zero():
    """`None` veut dire *on ne sait pas*, jamais *c'est gratuit*."""
    assert tarification_pour({"pricing_skus": {"quelque_chose": "1"}}, "480p") is None


def test_le_catalogue_video_lit_l_image_de_depart_dans_la_fiche():
    """Quatre modèles sur vingt-huit ne prennent pas d'image : la fiche le dit."""
    avec = OpenRouterVideo._lire_fiche(
        {
            "id": "maison/anime",
            "name": "Maison Anime",
            "supported_frame_images": ["first_frame", "last_frame"],
            "supported_durations": [4, 5],
            "supported_resolutions": ["480p"],
            "supported_aspect_ratios": ["1:1"],
            "pricing_skus": {"video_tokens_without_audio": "0.0000035"},
        }
    )
    assert avec.accepte_une_image is True
    assert avec.identifiant == "OpenRouter:maison/anime"
    assert avec.durees == (4, 5)

    sans = OpenRouterVideo._lire_fiche({"id": "maison/texte", "name": "Texte"})
    assert sans.accepte_une_image is False


def test_ce_que_le_depot_a_mesure_voyage_jusqu_a_l_ecran():
    """*Un modèle proposé sans avoir été assez mesuré me le dit* (US-440)."""
    fiche = OpenRouterVideo._lire_fiche(
        {
            "id": "bytedance/seedance-2.0-mini",
            "name": "ByteDance: Seedance 2.0 Mini",
            "supported_frame_images": ["first_frame"],
            "pricing_skus": {"video_tokens_without_audio": "0.0000035"},
        }
    )
    assert "8 tirages" in fiche.mesure


# ── Ce qui se relit sur le disque ───────────────────────────────────────────


def test_un_clip_se_relit_entier_apres_un_aller_retour_sur_le_disque():
    clip = Clip(
        travail="t-1",
        secondes=5,
        prix_annonce=0.0945,
        prix_formule="… × 27000 jetons",
        images=120,
        cadence=24.0,
        recupere=True,
    )
    relu = Clip.depuis_json(clip.en_json())
    assert relu == clip


def test_une_generation_d_avant_a9_se_relit_sans_clip():
    """Aucune ligne du disque n'a été réécrite : `None` est la vérité d'avant."""
    from atelier.domaine.generation import Generation

    ancienne = Generation(
        identifiant="vieille", modele="essai:x", demande={}, parametres_resolus={}
    )
    assert Generation.depuis_json(ancienne.en_json()).clip is None


# ── Par l'atelier entier, routes comprises ──────────────────────────────────


@pytest.fixture
def atelier_video(tmp_path, double, animateur):
    """L'atelier du produit, monté sur les deux doubles.

    **Le fournisseur d'images est là aussi**, et il sert à une seule chose : il
    faut une image dans la bibliothèque pour qu'un clip ait de quoi partir. Un
    clip ne se commande pas dans le vide — c'est la première conséquence
    pratique de « son entrée est obligatoire ».
    """
    from atelier.services import Atelier

    return Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabrique_animateur=lambda: animateur,
    )


@pytest.fixture
def client_video(atelier_video):
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application

    with TestClient(creer_application(atelier_video)) as client:
        yield client


def un_sprite(client) -> str:
    """Une image dans la bibliothèque, produite par le double d'images."""
    reponse = client.post(
        "/api/generations",
        json={"modele": "essai:rend-du-png", "prompt": "un voyageur", "variations": 1},
    )
    identifiant = reponse.json()["identifiant"]
    for _ in range(200):
        generation = client.get(f"/api/generations/{identifiant}").json()
        if generation["statut"] in ("reussie", "echouee"):
            break
    assets = client.get("/api/assets").json()["assets"]
    return assets[0]["identifiant"]


def test_l_ecran_recoit_le_prix_du_jour_sa_formule_et_ce_qui_est_mesure(client_video):
    """Trois choses à la fois, et aucune n'est déductible des deux autres.

    Le prix dit ce qu'on engage, la formule le rend vérifiable, et la mesure dit
    **à quel point le modèle est éprouvé** (US-440). Un écran qui n'aurait que
    le prix ferait passer une hypothèse pour un résultat.
    """
    lignes = client_video.get("/api/clips/models?secondes=5").json()["modeles"]
    par_nom = {ligne["identifiant"]: ligne for ligne in lignes}
    assert SANS_IMAGE.identifiant not in par_nom  # absent, pas grisé

    mele = par_nom[MELE.identifiant]
    assert mele["prix"]["montant"] == pytest.approx(0.0945, abs=1e-4)
    assert "video_tokens" in mele["prix"]["formule"]
    assert mele["prix"]["nature"] == "estimation"
    assert "8 tirages" in mele["mesure"]
    assert mele["grise"] is None

    sans_tarif = par_nom[SANS_TARIF.identifiant]
    assert sans_tarif["prix"]["montant"] is None
    assert "prix n'a pas pu être relu" in sans_tarif["grise"]


def test_le_prix_suit_la_duree_demandee(client_video):
    """Une seconde de plus n'est pas le même prix : il se calcule sur le réglage."""
    quatre = client_video.get("/api/clips/models?secondes=4").json()["modeles"]
    six = client_video.get("/api/clips/models?secondes=6").json()["modeles"]
    prix = lambda lignes: next(  # noqa: E731
        l["prix"]["montant"] for l in lignes if l["identifiant"] == MELE.identifiant
    )
    assert prix(quatre) < prix(six)


async def test_commander_un_clip_part_du_sprite_de_la_bibliotheque(
    atelier_video, client_video, animateur
):
    """*Le sprite part comme image de départ.*

    Et il ne part pas tel quel : un sprite de 48 px envoyé à un modèle qui rend
    du 480 px lui demanderait d'inventer tout ce qu'il ne voit pas. Ce qui part
    est le sprite agrandi sur la toile du format demandé.

    **RV5/RV6** : `POST /clips` a été retirée (21 septembre 2026) ; ce que
    l'écran fait désormais par `preparer_serie`/`demarrer_serie`, un essai
    serveur qui n'a besoin ni de série ni de personnage le fait par
    `commander_un_clip`, l'utilitaire d'essai qui appelle directement
    `animation.commander`.
    """
    sprite = un_sprite(client_video)
    clips = await commander_un_clip(
        atelier_video,
        modele=MELE.identifiant,
        prompt="Idle 2 s, puis marche.",
        asset=sprite,
        secondes=5,
    )
    # **Une liste, même à un seul clip** : la réponse a la même forme qu'on en
    # demande un ou huit, et aucun appelant n'a deux cas à traiter.
    corps = clips[0]
    assert corps["clip"]["travail"] == "travail-1"
    assert corps["parametres_resolus"]["image_de_depart"] == "obligatoire, jointe"

    _, demande = animateur.soumissions[0]
    from PIL import Image

    with Image.open(io.BytesIO(demande.image)) as envoyee:
        assert envoyee.size == (480, 480)  # la toile du 480p carré


async def test_un_clip_commande_se_voit_dans_la_liste_et_se_sert_en_video(atelier_video, client_video):
    sprite = un_sprite(client_video)
    identifiant = (
        await commander_un_clip(atelier_video, modele=MELE.identifiant, prompt="marche", asset=sprite)
    )[0]["identifiant"]
    await atelier_video.animation.attendre_tout()

    clips = client_video.get("/api/clips").json()["clips"]
    assert [c["identifiant"] for c in clips] == [identifiant]

    video = client_video.get(f"/api/clips/{identifiant}/video")
    assert video.status_code == 200
    assert video.headers["content-type"].startswith("video/")


@pytest.mark.skipif(
    decodeur.indisponible() is not None,
    reason="le décodeur de clips manque",
)
async def test_la_galerie_montre_un_clip_par_une_image_prelevee_dedans(atelier_video, client_video):
    """*La galerie montre un clip par une image prélevée dedans, jamais par une
    tuile en erreur.*"""
    sprite = un_sprite(client_video)
    identifiant = (
        await commander_un_clip(atelier_video, modele=MELE.identifiant, prompt="marche", asset=sprite)
    )[0]["identifiant"]
    await atelier_video.animation.attendre_tout()

    image = client_video.get(f"/api/clips/{identifiant}/frames/0")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"

    # Et une image qui n'existe pas se refuse en clair, sans tuile cassée.
    assert client_video.get(f"/api/clips/{identifiant}/frames/999").status_code == 400


async def test_recuperer_par_la_route_ne_recommande_rien(atelier_video, client_video, animateur):
    sprite = un_sprite(client_video)
    identifiant = (
        await commander_un_clip(atelier_video, modele=MELE.identifiant, prompt="marche", asset=sprite)
    )[0]["identifiant"]

    reprise = client_video.post(f"/api/clips/{identifiant}/recover")
    assert reprise.status_code == 200
    assert len(animateur.soumissions) == 1


async def test_recuperer_quand_le_lien_a_expire_ne_leve_pas_et_ne_repaie_pas(
    service, animateur
):
    """*Le fournisseur a expiré le lien* (B2) — `recuperer` répond quand même.

    C'est le geste que l'écran des dépenses appelle sur « récupérer sans
    repayer » : ce n'est pas la requête qui échoue, c'est le rapatriement, et
    la route doit pouvoir rendre 200 avec une raison plutôt que de lever.
    **Aucun essai ne couvrait une seconde panne** — celui d'à côté rattrape un
    clip dont la reprise réussit ; ici, elle échoue aussi.
    """
    animateur.echec_au_telechargement = AppelRefuse(
        "le clip n'a pas pu être téléchargé (401)", statut=401, consomme=0.041
    )
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()
    premiere = service.lire(generation.identifiant)
    assert premiere.emplacements[0].statut == Statut.ECHOUEE
    assert premiere.cout_usd == pytest.approx(0.041)

    # Le second échec ne refacture rien — `consomme=0.0`, comme un lien qui a
    # expiré sans qu'aucun appel n'atteigne le fournisseur.
    animateur.echec_au_telechargement = AppelRefuse(
        "le lien de téléchargement a expiré (410)", statut=410, consomme=0.0
    )
    rattrapee = await service.recuperer(generation.identifiant)

    assert rattrapee.emplacements[0].statut == Statut.ECHOUEE
    assert "expiré" in rattrapee.emplacements[0].raison
    # **La première facture doit survivre à la seconde panne** — c'est le cœur
    # du critère « ne repaie pas » : additionner un échec à zéro ne doit jamais
    # effacer ce qu'un échec précédent avait déjà consommé.
    assert rattrapee.cout_usd == pytest.approx(0.041)
    # Toujours récupérable ensuite : le numéro du travail n'a pas bougé, et
    # rien de neuf n'a été soumis au fournisseur — seule la récupération a
    # été retentée.
    assert rattrapee.clip.travail == "travail-1"
    assert len(animateur.soumissions) == 1
    assert len(animateur.recuperations) == 2


async def test_commander_sans_image_de_la_bibliotheque_se_refuse_avant_de_payer(
    atelier_video, animateur
):
    with pytest.raises(ErreurAtelier, match="pas-la"):
        await commander_un_clip(atelier_video, modele=MELE.identifiant, prompt="marche", asset="pas-la")
    assert animateur.soumissions == []


# ── Ce que l'écran de commande demande au serveur ───────────────────────────
#
# Le côté serveur d'`A9` était écrit et éprouvé avant l'écran ; ce qui suit est
# ce que l'écran a fait apparaître. **Le serveur ne connaissait ni personnage,
# ni pose, ni mouvement** — la demande portait un texte libre. Ce lien-là est ce
# que la tranche ajoute, et il vaut la peine d'être mesuré : c'est lui qui fait
# qu'un texte anglais ne se retape jamais, et qu'un lot de quatre clips reste
# quatre dépenses.


def un_personnage(client, nom: str = "Michel") -> str:
    """Un personnage du projet ouvert, sans aucune image."""
    return client.post(
        "/api/characters", json={"nom": nom, "description": "un voyageur"}
    ).json()["personnage"]["identifiant"]


def test_l_image_de_depart_est_celle_de_la_case_quand_la_case_en_porte_une(
    atelier_video, client_video,
):
    """*L'image de départ se propose : la case visée si elle porte une image.*

    C'est le cas où le produit sait le mieux ce qu'il fait : l'attitude et
    l'angle ont déjà été validés en fixe, et le clip les suit au lieu de
    repartir d'une posture neutre.

    **RV5/RV6** : la route `GET /clips/start-image` a été retirée (21
    septembre 2026, aucun appelant restant). Le service qu'elle exposait,
    `production.image_de_depart`, reste — c'est lui qu'on appelle ici
    directement, ce que fait aussi `ServiceTravaux.preparer`.
    """
    personnage = un_personnage(client_video)
    sprite = un_sprite(client_video)
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "marche"},
    )

    recu = atelier_video.production.image_de_depart(
        atelier_video.bibliotheque.courant, personnage, "marche"
    )
    assert recu["origine"] == "case"
    assert recu["asset"]["identifiant"] == sprite
    assert "case visée" in recu["raison"]


def test_sans_image_dans_la_case_c_est_le_portrait_qui_se_propose(atelier_video, client_video):
    """*Le portrait sinon.*

    Le produit n'a pas d'objet portrait, et n'en invente pas un : le portrait
    est **la première image que le personnage promeut en référence** — celle
    qu'il montre déjà de lui à chacun de ses appels.
    """
    personnage = un_personnage(client_video)
    sprite = un_sprite(client_video)
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "repos"},
    )
    client_video.put(
        f"/api/characters/{personnage}/references",
        json={"asset": sprite, "promue": True},
    )

    # La case *course* est vide : c'est le portrait qui vient.
    recu = atelier_video.production.image_de_depart(
        atelier_video.bibliotheque.courant, personnage, "course"
    )
    assert recu["origine"] == "portrait"
    assert recu["asset"]["identifiant"] == sprite
    assert "montre de lui" in recu["raison"]


def test_une_case_vide_part_du_repos_dans_la_meme_direction(atelier_video, client_video):
    """*En cascade* (16 septembre 2026) : la marche vers le nord part du repos
    vers le nord, pas du repos vers le sud ni du portrait."""
    objectif = {"sorties": [
        {"nature": "animation", "pose": p, "direction": d}
        for p in ("repos", "marche") for d in ("sud", "nord")
    ]}
    assert client_video.put("/api/universe", json={"vue": "vue-dessus-34"}).status_code == 200
    cree = client_video.post(
        "/api/characters", json={"nom": "Michel", "description": "un voyageur", "objectif": objectif}
    )
    assert cree.status_code == 201, cree.text
    personnage = cree.json()["personnage"]["identifiant"]
    images = {}
    for direction in ("sud", "nord"):
        sprite = un_sprite(client_video)
        reponse = client_video.put(
            f"/api/assets/{sprite}/character",
            json={"personnage": personnage, "pose": "repos", "direction": direction},
        )
        assert reponse.status_code == 200, reponse.text
        images[direction] = sprite
    assert images["sud"] != images["nord"]
    client_video.put(
        f"/api/characters/{personnage}/references",
        json={"asset": images["sud"], "promue": True},
    )

    for direction in ("sud", "nord"):
        recu = atelier_video.production.image_de_depart(
            atelier_video.bibliotheque.courant, personnage, "marche", direction
        )
        assert recu["origine"] == "reference", recu
        assert recu["asset"]["identifiant"] == images[direction]


def test_un_personnage_sans_la_moindre_image_le_dit_au_lieu_de_rendre_un_cadre_vide(
    atelier_video, client_video,
):
    """Un clip part toujours d'une image : quand il n'y en a aucune, l'écran
    doit pouvoir écrire pourquoi plutôt que d'afficher un carré gris."""
    personnage = un_personnage(client_video, "Perceval")
    recu = atelier_video.production.image_de_depart(
        atelier_video.bibliotheque.courant, personnage, "repos"
    )
    assert recu["origine"] == "aucune"
    assert recu["asset"] is None
    assert "n'a encore aucune image" in recu["raison"]


async def test_le_mouvement_choisi_ecrit_le_texte_et_l_ecran_ne_le_retape_pas(
    atelier_video, client_video, animateur
):
    """*Le mouvement se choisit dans la liste d'`A6`, et le texte qui part se
    lit avant l'envoi.*

    L'écran envoie **le mouvement**, pas le texte qu'il vient d'afficher. Deux
    chemins vers le même texte anglais finiraient par en envoyer un troisième —
    et c'est un appel payé qui le dirait.
    """
    sprite = un_sprite(client_video)
    clips = await commander_un_clip(atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite)

    _, demande = animateur.soumissions[0]
    connus = client_video.get("/api/movements").json()["mouvements"]
    marche = next(m for m in connus if m["identifiant"] == "marche")
    assert demande.texte == marche["texte"]
    # Et la génération garde lequel, pour qu'`A10` sache quoi tailler dedans.
    assert clips[0]["demande"]["mouvement"] == "marche"


async def test_un_mouvement_inconnu_se_refuse_avant_de_payer(atelier_video, client_video, animateur):
    sprite = un_sprite(client_video)
    with pytest.raises(ErreurAtelier, match="danse-de-la-pluie"):
        await commander_un_clip(
            atelier_video, modele=MELE.identifiant, mouvement="danse-de-la-pluie", asset=sprite
        )
    assert animateur.soumissions == []


async def test_un_clip_sans_texte_ni_mouvement_se_refuse_avant_de_payer(
    atelier_video, client_video, animateur
):
    sprite = un_sprite(client_video)
    with pytest.raises(ErreurAtelier, match="part d'un texte"):
        await commander_un_clip(atelier_video, modele=MELE.identifiant, asset=sprite)
    assert animateur.soumissions == []


# **RV5/RV6** : `POST /clips` avait un lot en son sein (`nombre`) ; le nouveau
# circuit le fait par une série de travaux — `preparer_serie` puis
# `demarrer_serie` (`atelier/services/travaux.py`) —, et c'est ce que ces
# essais exercent maintenant, un travail par clip du lot. `_lot_de_clips`
# rejoue exactement ce que faisait l'ancienne route : une case, une image de
# départ déjà posée (pour que plusieurs clips n'en paient chacun une), et le
# mouvement « marche ».


async def _lot_de_clips(atelier_video, client_video, sprite, nombre, cle):
    personnage = un_personnage(client_video, f"Lot-{cle}")
    client_video.put(
        f"/api/assets/{sprite}/character",
        json={"personnage": personnage, "pose": "marche"},
    )
    projet = atelier_video.bibliotheque.courant
    commune = {
        "cle": cle,
        "personnage": personnage,
        "modele_video": MELE.identifiant,
        "mouvement": "marche",
    }
    serie = await atelier_video.travaux.preparer_serie(
        projet, commune, [{"pose": "marche", "direction": ""}], nombre
    )
    await atelier_video.travaux.demarrer_serie(projet, serie["serie"]["cle"])
    await atelier_video.travaux.attendre_tout()
    finis = [
        atelier_video.travaux.lire(projet, t["identifiant"])
        for t in serie["travaux"]
    ]
    return [atelier_video.animation.lire(t["clip"]).en_json() for t in finis]


async def test_un_lot_lance_autant_de_clips_que_demande_et_chacun_est_une_depense(
    atelier_video, client_video, animateur
):
    """*Le nombre de clips à lancer se choisit à chaque fois — un est le défaut.*

    Et **chacun est une génération à part**, avec sa dépense et son numéro de
    travail : quatre clips coûtent quatre fois, et l'écran des dépenses doit le
    dire quatre fois.
    """
    sprite = un_sprite(client_video)
    lot = await _lot_de_clips(atelier_video, client_video, sprite, 4, "lot-quatre")

    assert len(lot) == 4
    assert len({c["identifiant"] for c in lot}) == 4
    assert len({c["clip"]["travail"] for c in lot}) == 4
    assert len(animateur.soumissions) == 4
    # **Et ils savent qu'ils sont du même geste.** C'est ce qui permettra d'en
    # garder un et de jeter les autres sans rapprocher trois clips sur l'heure
    # et le texte — un rapprochement qui se tromperait le jour où l'auteur
    # relance exactement la même chose.
    lots = {c["clip"]["lot"] for c in lot}
    assert len(lots) == 1 and lots != {""}
    # Et un défaut à un, sans qu'on ait à l'écrire.
    seul = await _lot_de_clips(atelier_video, client_video, sprite, 1, "lot-un")
    assert len(seul) == 1


async def test_un_lot_demesure_se_refuse_avant_de_payer(atelier_video, client_video, animateur):
    """Le geste paie N fois : il a une borne, et elle se dit en clair."""
    with pytest.raises(TravailRefuse, match="1 à 8"):
        await _lot_de_clips(atelier_video, client_video, un_sprite(client_video), 40, "lot-demesure")
    assert animateur.soumissions == []


async def test_garder_un_clip_et_jeter_les_autres_est_un_seul_geste_et_il_se_defait(
    atelier_video, client_video,
):
    """*Garder un clip et jeter les autres est un seul geste, et il est
    annulable.*"""
    sprite = un_sprite(client_video)
    lot = await _lot_de_clips(atelier_video, client_video, sprite, 3, "lot-garder")
    garde, *autres = [c["identifiant"] for c in lot]

    rendu = client_video.post(
        "/api/clips/keep", json={"garde": garde, "jette": autres}
    ).json()
    assert rendu["garde"]["clip"]["jete"] is False
    assert [c["clip"]["jete"] for c in rendu["jetes"]] == [True, True]

    # Un seul geste rend les deux.
    repris = client_video.post("/api/clips/restore", json={"clips": autres}).json()
    assert [c["clip"]["jete"] for c in repris["clips"]] == [False, False]


async def test_un_clip_jete_reste_au_journal_des_depenses(atelier_video, client_video):
    """*Le journal garde ce qui a été payé, y compris les clips jetés.*

    C'est le premier invariant du produit, et c'est ici qu'il compte le plus :
    un lot de trois clips coûte trois fois, et un auteur qui n'en verrait plus
    qu'un au journal croirait avoir payé une fois.
    """
    sprite = un_sprite(client_video)
    lot = await _lot_de_clips(atelier_video, client_video, sprite, 3, "lot-journal")
    garde, *autres = [c["identifiant"] for c in lot]
    client_video.post("/api/clips/keep", json={"garde": garde, "jette": autres})

    # Les trois sont toujours des clips connus de l'atelier, jetés compris.
    clips = client_video.get("/api/clips").json()["clips"]
    assert {c["identifiant"] for c in clips} == {c["identifiant"] for c in lot}
    jetes = [c for c in clips if c["clip"]["jete"]]
    assert {c["identifiant"] for c in jetes} == set(autres)
    # Et l'écran des dépenses les compte toujours, tous les trois.
    journal = client_video.get("/api/spending").json()
    payes = {a["identifiant"] for a in journal["appels"]}
    assert {c["identifiant"] for c in lot} <= payes


async def test_un_clip_arrive_garde_sa_place_au_rechargement(atelier_video, client_video):
    """⚠️ *La galerie était vide alors que trois clips payés étaient là.*

    Vu au navigateur le 4 septembre 2026. Ce que la grille montre à côté de la
    bibliothèque est **le chantier** : les emplacements qui attendent encore une
    issue. Un clip est réussi dès qu'il arrive, donc il en sortait — et rien ne
    prenait le relais, parce qu'un clip n'entre pas en bibliothèque. Sa tuile
    disparaissait à l'arrivée, et il ne restait rien de l'appel payé.

    C'est le même défaut que celui de la planche qui attend un choix, réparé en
    `R6`, et c'est la même ligne qui le répare.

    **Jeté, il s'en va** : c'est très exactement ce que le geste veut dire.
    """
    sprite = un_sprite(client_video)
    lot = await _lot_de_clips(atelier_video, client_video, sprite, 2, "lot-rechargement")

    chantier = client_video.app.state.atelier.generations.chantier()
    assert {g.identifiant for g in chantier} == {c["identifiant"] for c in lot}

    garde, jete = [c["identifiant"] for c in lot]
    client_video.post("/api/clips/keep", json={"garde": garde, "jette": [jete]})
    chantier = client_video.app.state.atelier.generations.chantier()
    assert {g.identifiant for g in chantier} == {garde}


async def test_un_atelier_qui_porte_un_clip_se_rouvre(atelier_video, client_video):
    """⚠️ **L'atelier refusait de démarrer**, et aucun essai ne pouvait le voir.

    Trouvé au navigateur le 4 septembre 2026. À l'ouverture, l'atelier donne un
    asset aux images produites avant que les assets existent : il voyait un
    emplacement réussi sans asset, tentait d'en faire une image, et le détourage
    levait *cannot identify image file* sur le fichier vidéo. **Plus d'atelier
    du tout** — pas une tuile cassée : l'application ne démarrait pas.

    Les essais ne pouvaient pas l'attraper parce qu'ils montent un atelier neuf
    et ne le rouvrent jamais. Celui-ci le rouvre, et c'est tout son objet.
    """
    sprite = un_sprite(client_video)
    await commander_un_clip(atelier_video, modele=MELE.identifiant, mouvement="marche", asset=sprite)
    # **Arrivé, et c'est la condition du défaut** : un clip encore en vol n'a
    # pas de fichier sur le disque, donc rien que le rattrapage puisse essayer
    # de lire comme une image.
    await atelier_video.animation.attendre_tout()
    clips = client_video.get("/api/clips").json()["clips"]
    assert clips[0]["statut"] == "reussie"

    # Le geste du démarrage, sur un atelier qui porte déjà un clip arrivé.
    await atelier_video.ouvrir()

    # Et le clip n'est pas devenu une image : il n'en est pas une.
    assets = client_video.get("/api/assets").json()["assets"]
    clips = client_video.get("/api/clips").json()["clips"]
    assert len(clips) == 1
    assert clips[0]["identifiant"] not in {a["generation"] for a in assets}


async def test_garder_celui_qu_on_avait_jete_est_le_meme_geste_dans_l_autre_sens(
    atelier_video, client_video,
):
    """On garde un clip, puis on change d'avis : le même bouton le ramène, sans
    qu'il faille se rappeler qu'il avait été écarté."""
    sprite = un_sprite(client_video)
    lot = await _lot_de_clips(atelier_video, client_video, sprite, 2, "lot-retour")
    premier, second = [c["identifiant"] for c in lot]

    client_video.post("/api/clips/keep", json={"garde": premier, "jette": [second]})
    rendu = client_video.post(
        "/api/clips/keep", json={"garde": second, "jette": [premier]}
    ).json()
    assert rendu["garde"]["clip"]["jete"] is False
    assert rendu["jetes"][0]["clip"]["jete"] is True


async def test_un_montant_absent_de_la_reponse_ne_se_lit_pas_comme_un_clip_gratuit(
    service, animateur
):
    """*Le montant enregistré dit s'il a été relu ou estimé.*

    Un fournisseur muet sur le prix ferait enregistrer zéro, et le total du
    projet serait faux **vers le bas**, silencieusement. Le produit écrit zéro
    en disant qu'il ne sait pas — un trou qu'on voit vaut mieux qu'un trou qu'on
    ne voit pas.
    """
    vrai = animateur.recuperer

    async def muet(travail):
        produit = await vrai(travail)
        from dataclasses import replace

        return replace(produit, consomme=0.0, montant_relu=False)

    animateur.recuperer = muet
    generation = await service.commander(MELE.identifiant, demande())
    await service.attendre_tout()

    relue = service.lire(generation.identifiant)
    assert relue.clip.montant_relu is False
    assert "n'a pas dit ce que ce clip a coûté" in relue.clip.montant_dit
    # Et un clip ordinaire dit l'inverse, dans les mêmes mots.
    ordinaire = await service.commander(MELE.identifiant, demande())
    animateur.recuperer = vrai
    await service.recuperer(ordinaire.identifiant)
    assert service.lire(ordinaire.identifiant).clip.montant_dit == (
        "montant relu chez le fournisseur"
    )


def test_l_adaptateur_distingue_un_cout_absent_d_un_cout_nul():
    """Chez OpenRouter, `usage.cost` absent et `usage.cost: 0` ne disent pas la
    même chose, et l'adaptateur est le seul endroit qui puisse le voir."""
    from atelier.fournisseur.port import ClipProduit

    assert ClipProduit(octets=b"", consomme=0.0).montant_relu is True


def test_l_image_de_depart_d_un_clip_part_sur_le_gris_neutre_quel_que_soit_le_sujet():
    """*Renversé le 10 octobre 2026* : l'image de départ ne part plus sur le
    fond franc le plus éloigné du sujet (RT3) — la mort du nain est partie sur
    du vert pur quand son texte demandait un gris neutre, et le clip a fondu
    du vert au gris sur ses cinq premières images. Sans couleur demandée, la
    toile est le gris neutre, quelles que soient les couleurs du sujet ; une
    couleur demandée est tenue telle quelle.
    """
    import io

    from PIL import Image

    from atelier.domaine.fond import GRIS_NEUTRE_VIDEO, rvb
    from atelier.image.clip import composer_entree

    def toile_de(couleur, fond=""):
        sujet = Image.new("RGBA", (40, 60), (0, 0, 0, 0))
        sujet.paste(Image.new("RGBA", (20, 40), couleur), (10, 10))
        tampon = io.BytesIO()
        sujet.save(tampon, format="PNG")
        with Image.open(io.BytesIO(composer_entree(tampon.getvalue(), (480, 480), fond=fond))) as toile:
            return toile.convert("RGB").getpixel((0, 0))

    gris = rvb(GRIS_NEUTRE_VIDEO.couleur)
    assert toile_de((200, 60, 60, 255)) == gris
    assert toile_de((30, 220, 40, 255)) == gris
    assert toile_de((230, 40, 230, 255)) == gris
    assert toile_de((200, 60, 60, 255), "#00ffff") == (0, 255, 255), "la couleur demandée est tenue"
