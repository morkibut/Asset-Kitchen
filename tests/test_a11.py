# -*- coding: utf-8 -*-
"""A11 — le moteur de la maison, et le prix qui tombe à zéro.

Les critères de `docs/archive/plan-r6-a-v3.02.md` § A11. **Aucun n'appelle un vrai ComfyUI, et
aucun ne fait tourner une carte graphique** : ComfyUI est une application tierce,
on ne peut ni la démarrer dans un essai, ni compter sur sa présence.

## Ce qui est doublé, et ce qui ne l'est pas

Le double est **le serveur ComfyUI**, branché à l'endroit exact où l'adaptateur
ouvre ses requêtes. Tout ce qui est écrit dans le produit est donc exercé pour de
vrai : la construction du montage, la lecture des listes de fichiers installés,
le tri des trois absences, la reprise d'un téléchargement coupé, la conversion
d'une durée en nombre d'images. Ce qui est simulé est **la réponse**, et rien
d'autre.

## Ce que ces essais ne mesurent pas, et ne peuvent pas mesurer

Que le clip qui sort soit beau. Ça s'est mesuré le 3 septembre 2026 en faisant
tourner la vraie carte, et c'est écrit dans `docs/archive/recherche-video-locale/`. ⚠️ Le
rapport y dit une chose qu'aucun essai ne remplacera : *plus le clip est long,
plus la bande se dégrade, et aucune mesure automatique ne le voit — seul l'œil la
voit.* C'est la troisième fois que ce dépôt le constate.
"""

from __future__ import annotations

import json

import httpx
import pytest

from atelier.domaine.animation import (
    MAISON,
    Attente,
    DemandeClip,
    ModeleVideo,
    Tarification,
)
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible
from atelier.depot import Base, Fichiers
from atelier.fournisseur.maison import (
    FICHIERS,
    GO,
    MoteurDeLaMaison,
    modele_de_la_maison,
)
from atelier.fournisseur.montage_maison import (
    GREFFON_PIXEL,
    montage_du_clip,
    sans_greffon_pixel,
)
from atelier.services.animation import ServiceAnimation

from test_a9 import (  # noqa: F401  (les fixtures voyagent par l'import)
    MELE,
    AnimateurDouble,
    animateur,
    atelier_video,
    client_video,
    clip_mp4,
)


# ── Le ComfyUI doublé ────────────────────────────────────────────────────────


TOUT_EST_LA = {
    "diffusion_models": [
        "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf",
        "Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf",
    ],
    "text_encoders": ["umt5_xxl_fp8_e4m3fn_scaled.safetensors"],
    "vae": ["wan_2.1_vae.safetensors"],
    "loras": [
        "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
        "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
        GREFFON_PIXEL,
    ],
}

CHARGEUR = {
    "diffusion_models": ("UnetLoaderGGUF", "unet_name"),
    "text_encoders": ("CLIPLoader", "clip_name"),
    "vae": ("VAELoader", "vae_name"),
    "loras": ("LoraLoaderModelOnly", "lora_name"),
}


class ComfyDouble:
    """Un ComfyUI qui répond, et dont on règle exactement ce qu'il a.

    ⚠️ **Il rend les listes de fichiers sous les deux formes que ComfyUI emploie**,
    en alternance : la liste peut être le premier élément, ou vivre sous
    `options`. Les deux coexistent dans la même version, et n'en lire qu'une rend
    une famille vide — donc *tous ses fichiers manquants* — sur une installation
    complète. Un double qui n'emploierait qu'une forme laisserait passer ça.
    """

    def __init__(self, installes: dict[str, list[str]] | None = None) -> None:
        self.installes = {k: list(v) for k, v in (installes or TOUT_EST_LA).items()}
        self.eteint = False
        self.montages: list[dict] = []
        self.images_deposees: list[bytes] = []
        self.travail = "abc-123"
        self.fini = True
        self.erreur: str | None = None
        self.argv = [
            "ComfyUI\\main.py",
            "--input-directory",
            "",  # posé par la fiche `moteur`
            "--output-directory",
            "",
        ]
        self.appels: list[str] = []
        self._forme = 0

    # ── Ce que le transport lui envoie ───────────────────────────────────────

    def repondre(self, requete: httpx.Request) -> httpx.Response:
        chemin = requete.url.path
        self.appels.append(f"{requete.method} {chemin}")
        if self.eteint:
            raise httpx.ConnectError("connexion refusée", request=requete)

        if chemin == "/system_stats":
            return httpx.Response(
                200,
                json={
                    "system": {"os": "win32", "argv": self.argv},
                    "devices": [
                        {
                            "name": "cuda:0 NVIDIA GeForce RTX 3080 Laptop GPU",
                            "vram_total": 8589410304,
                            "vram_free": 7159483094,
                        }
                    ],
                },
            )
        if chemin.startswith("/object_info/"):
            return self._fichiers_vus(chemin.rsplit("/", 1)[-1])
        if chemin == "/upload/image":
            self.images_deposees.append(requete.content)
            return httpx.Response(200, json={"name": "atelier-entree.png"})
        if chemin == "/prompt":
            self.montages.append(json.loads(requete.content)["prompt"])
            return httpx.Response(200, json={"prompt_id": self.travail})
        if chemin.startswith("/history/"):
            return httpx.Response(200, json=self._histoire(chemin.rsplit("/", 1)[-1]))
        if chemin == "/view":
            return httpx.Response(200, content=clip_mp4())
        return httpx.Response(404, json={"raison": "inconnu"})

    def _fichiers_vus(self, classe: str) -> httpx.Response:
        for famille, (nom_classe, champ) in CHARGEUR.items():
            if nom_classe != classe:
                continue
            noms = self.installes.get(famille)
            if noms is None:
                # Le chargeur n'est pas installé du tout — le greffon GGUF
                # absent, par exemple. ComfyUI rend alors 404.
                return httpx.Response(404, json={})
            self._forme += 1
            entree = (
                [noms] if self._forme % 2 else ["COMBO", {"options": noms}]
            )
            return httpx.Response(
                200, json={classe: {"input": {"required": {champ: entree}}}}
            )
        return httpx.Response(404, json={})

    def _histoire(self, travail: str) -> dict:
        if travail != self.travail:
            return {}
        if self.erreur:
            return {
                travail: {
                    "status": {
                        "status_str": "error",
                        "messages": [
                            [
                                "execution_error",
                                {
                                    "node_type": "KSamplerAdvanced",
                                    "exception_message": self.erreur,
                                },
                            ]
                        ],
                    }
                }
            }
        if not self.fini:
            return {travail: {"status": {"completed": False}}}
        return {
            travail: {
                "status": {"completed": True, "status_str": "success"},
                "outputs": {
                    "19": {
                        "videos": [
                            {
                                "filename": "clip_00001.mp4",
                                "subfolder": "atelier",
                                "type": "output",
                            }
                        ]
                    }
                },
            }
        }


@pytest.fixture
def comfy() -> ComfyDouble:
    return ComfyDouble()


@pytest.fixture
def moteur(comfy: ComfyDouble) -> MoteurDeLaMaison:
    return MoteurDeLaMaison(transport=httpx.MockTransport(comfy.repondre))


def demande(secondes: int = 1) -> DemandeClip:
    return DemandeClip(
        texte="Pixel art game sprite. The character walks in place.",
        image=b"\x89PNG\r\n\x1a\nsprite",
        secondes=secondes,
        resolution="480p",
        proportions="1:1",
    )


# ── « Un prix de zéro n'est pas un prix inconnu » ────────────────────────────


def test_le_montant_du_moteur_de_la_maison_est_zero_et_il_est_certain():
    """*Zéro n'est pas « inconnu »* — et c'est la décision qui a demandé un
    troisième genre de tarif.

    La règle qui grise un modèle dont le tarif n'a pas pu être relu est bonne :
    elle interdit d'engager l'auteur sans savoir ce qu'il engage. Mais elle
    aurait grisé **le seul modèle qui ne dépense rien**, faute de savoir dire la
    différence entre *on ne sait pas* et *ça vaut zéro*.
    """
    modele = modele_de_la_maison()
    prix = modele.prix(demande())
    assert prix.montant == 0.0
    assert prix.connu is True
    assert prix.en_json()["nature"] == "certain"
    # Et la formule dit *pourquoi* c'est gratuit, au lieu de multiplier par zéro.
    assert "carte de la maison" in prix.formule
    assert "×" not in prix.formule


def test_un_modele_dont_le_tarif_est_illisible_reste_grise():
    """La règle d'origine n'est pas affaiblie : `None` grise toujours.

    Il fallait le vérifier dans le même essai que le précédent — c'est la paire
    qui dit que la nouvelle valeur n'a pas mangé l'ancienne.
    """
    sourd = ModeleVideo(
        identifiant="essai:sans-tarif",
        nom="Essai",
        tarification=None,
        tarifs_declares=("un_sku_inconnu",),
    )
    refus = sourd.refus(demande())
    assert refus is not None and "n'a pas pu être relu" in refus


def test_le_moteur_de_la_maison_ne_demande_ni_compte_ni_cle(moteur):
    """**Le seul fournisseur du produit sans secret**, et c'est la moitié de son
    intérêt : rien à déposer, rien à renouveler, rien à fuiter."""
    assert moteur.secrets() == ()


# ── « Le coût affiché est une attente, pas un prix » ─────────────────────────


def test_l_attente_annoncee_distingue_le_premier_tirage_des_suivants():
    """*L'écran dit si c'est le premier tirage — modèle à charger — ou un suivant.*

    Le modèle reste chargé d'un clip à l'autre : le premier paie le chargement,
    les suivants non. Annoncer la valeur des suivants au premier ferait attendre
    le double de ce qui a été promis, et c'est la même faute que d'annoncer un
    prix trop bas.
    """
    modele = modele_de_la_maison()
    premier = modele.attente(demande(1), premier=True)
    suivant = modele.attente(demande(1), premier=False)
    assert isinstance(premier, Attente) and isinstance(suivant, Attente)
    assert premier.secondes > suivant.secondes
    assert premier.en_json()["premier"] is True
    assert "premier tirage" in premier.mesure
    assert "premier tirage" not in suivant.mesure
    # L'attente est **une nature à part**, pas un prix déguisé en secondes.
    assert premier.en_json()["nature"] == "attente"


def test_un_modele_paye_n_annonce_aucune_attente():
    """`None`, et ce n'est pas un trou : ce qu'il coûte est de l'argent.

    Inventer une attente pour un modèle dont personne n'a mesuré la vitesse
    serait pire que de n'en annoncer aucune — l'auteur la lirait comme un fait.
    """
    assert MELE.attente(demande(5)) is None


# ── « L'écran annonce le nombre d'images réel » ──────────────────────────────


def test_les_durees_se_convertissent_en_nombre_d_images_reel():
    """*17, 33, 49 — jamais le compte demandé.*

    Le modèle n'accepte que des comptes de la forme `4n + 1`. Le produit
    convertit et annonce le vrai, comme partout ailleurs : *ce qui est enregistré
    est ce qui s'est passé*.
    """
    modele = modele_de_la_maison()
    assert [modele.images_reelles(s) for s in (1, 2, 3)] == [17, 33, 49]


def test_le_compte_d_images_arrondit_vers_le_haut_et_jamais_vers_le_bas():
    """Un clip plus court que demandé est une seconde d'animation qu'on n'a pas.

    Seize images à seize par seconde ne sont pas un compte acceptable ; le plus
    proche en dessous est treize, soit **huit dixièmes de seconde** au lieu
    d'une. Le geste entier serait à refaire.
    """
    modele = modele_de_la_maison()
    for secondes in (1, 2, 3):
        images = modele.images_reelles(secondes)
        assert (images - 1) % 4 == 0
        assert images >= secondes * modele.images_par_seconde


def test_un_modele_paye_ne_convertit_rien():
    """La contrainte est celle d'un moteur, pas d'un produit. Zéro veut dire
    *la question ne se pose pas pour celui-ci*."""
    assert MELE.images_reelles(5) == 0


# ── « Trois phrases différentes, et seule la première grise » ────────────────


async def test_comfyui_eteint_grise_le_modele_et_dit_quoi_faire(moteur, comfy):
    """La première absence, **et la seule qui grise**.

    L'atelier ne sait pas allumer une fenêtre à la place de l'auteur : rien ne
    peut partir, et le dire est tout ce qu'il peut faire.
    """
    comfy.eteint = True
    etat = await moteur.visiter()
    assert etat.allume is False
    assert etat.grise is not None
    assert "n'est pas allumé" in etat.phrase and "ComfyUI" in etat.phrase


async def test_des_fichiers_absents_ne_grisent_pas_et_disent_leur_taille(moteur, comfy):
    """La deuxième absence : **choisissable, et il dit ce qu'il va rapatrier.**

    Refuser obligerait à sortir de l'atelier pour un téléchargement que l'atelier
    sait faire.
    """
    comfy.installes["diffusion_models"] = []
    etat = await moteur.visiter()
    assert etat.allume is True
    assert etat.grise is None  # ← il reste choisissable
    manquants = {f.nom for f in etat.manquants}
    assert "Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf" in manquants
    assert "il manque" in etat.phrase and "Go" in etat.phrase
    # **Avec sa taille et sa licence**, avant que l'auteur lance quoi que ce soit.
    fiche = etat.en_json()["manquants"][0]
    assert fiche["go"] > 0 and fiche["licence"] == "Apache 2.0"


async def test_le_greffon_absent_avertit_sans_bloquer(moteur, comfy):
    """La troisième absence : **le clip sortira, il sortira lissé.**

    Un clip lissé se juge ; un refus ne se juge pas. C'est pour ça que celle-là
    est un avertissement et non un empêchement.
    """
    comfy.installes["loras"] = [
        n for n in TOUT_EST_LA["loras"] if n != GREFFON_PIXEL
    ]
    etat = await moteur.visiter()
    assert etat.allume is True and etat.grise is None
    assert etat.manquants == ()  # le greffon n'est pas obligatoire
    assert etat.greffon_absent is True
    assert "lissé" in etat.phrase


async def test_les_trois_absences_ne_donnent_jamais_la_meme_phrase(moteur, comfy):
    """Les confondre ferait sortir de l'atelier pour rien, ou laisserait tomber
    une attente de plusieurs minutes sur un geste annoncé comme immédiat."""
    comfy.eteint = True
    eteint = (await moteur.visiter()).phrase
    comfy.eteint = False
    comfy.installes["vae"] = []
    fichiers = (await moteur.visiter()).phrase
    comfy.installes["vae"] = list(TOUT_EST_LA["vae"])
    comfy.installes["loras"] = [n for n in TOUT_EST_LA["loras"] if n != GREFFON_PIXEL]
    greffon = (await moteur.visiter()).phrase
    assert len({eteint, fichiers, greffon}) == 3
    assert all(phrase for phrase in (eteint, fichiers, greffon))


async def test_un_chargeur_absent_compte_ses_fichiers_comme_manquants(moteur, comfy):
    """Un fichier posé dans un dossier que ComfyUI ne lit pas **est un fichier
    absent**, et le disque ne le dirait pas.

    C'est le cas du greffon `ComfyUI-GGUF` non installé : le chargeur n'existe
    pas, donc les deux moitiés du moteur ne sont chargeables par rien.
    """
    comfy.installes["diffusion_models"] = None  # type: ignore[assignment]
    etat = await moteur.visiter()
    assert {f.famille for f in etat.manquants} == {"diffusion_models"}


async def test_l_adaptateur_du_produit_se_garde_et_se_souvient_de_sa_visite(comfy):
    """⚠️ **Le défaut qui ne se voyait qu'en montant le vrai atelier.**

    Le grisé ne sort pas d'un appel : il sort de ce que la dernière visite a vu,
    parce qu'on le demande à chaque peinture d'écran et qu'interroger ComfyUI à
    chaque fois ferait attendre l'interface. Comme tous les autres adaptateurs se
    refabriquent à chaque appel — ils relisent leur clé sur le disque —, celui-ci
    l'a d'abord fait aussi, et **il repartait donc sans mémoire à chaque fois** :
    moteur éteint, le modèle restait proposé, et l'absence se découvrait en
    cliquant sur *Commander*.

    Les essais ne pouvaient pas le voir : ils tiennent leur propre instance. Il a
    fallu monter l'atelier réel pour que le trou paraisse.
    """
    import atelier.services as services

    services._LA_MAISON = None
    try:
        premier = services._maison()
        assert services._maison() is premier  # la même, appel après appel

        premier._transport = httpx.MockTransport(comfy.repondre)  # type: ignore[attr-defined]
        comfy.eteint = True
        await premier.catalogue_video()
        # **Une autre demande d'adaptateur retrouve la visite**, donc le grisé.
        assert services._maison().indisponible() is not None
        assert services._maison().etat_du_moteur().allume is False

        comfy.eteint = False
        await services._maison().catalogue_video()
        # Et garder l'objet ne garde pas sa réponse : le grisé tombe tout seul.
        assert services._maison().indisponible() is None
        assert services._maison().etat_du_moteur().allume is True
    finally:
        services._LA_MAISON = None


async def test_l_installation_complete_ne_dit_rien(moteur):
    """Rien à dire est une réponse, et l'écran n'écrit alors aucune phrase."""
    etat = await moteur.visiter()
    assert etat.allume and not etat.manquants and not etat.greffon_absent
    assert etat.phrase == ""
    assert etat.carte.startswith("cuda:0")


async def test_les_deux_formes_de_liste_de_comfyui_sont_lues(moteur, comfy):
    """⚠️ **Deux formes coexistent** dans la même version de ComfyUI.

    La liste peut être le premier élément, ou vivre sous `options`. N'en lire
    qu'une rend une famille vide — donc tous ses fichiers manquants — sur une
    installation complète. Le double alterne exprès entre les deux.
    """
    premier = await moteur.visiter()
    second = await moteur.visiter()
    assert premier.manquants == () and second.manquants == ()


# ── « Le montage est écrit par le produit » ──────────────────────────────────


def test_le_montage_nomme_ses_etapes_et_ne_sort_qu_une_video():
    """*Le montage envoyé est écrit par le produit, pas importé d'un fichier.*

    Et il ne sort qu'**une** vidéo : le banc enregistrait aussi les images pour
    pouvoir les regarder, le produit n'en veut qu'une — c'est ce qu'un clip payé
    rend, et tout ce qui suit est déjà écrit pour ça.
    """
    montage = montage_du_clip(image="x.png", texte="marche", images=17)
    genres = [etape["class_type"] for etape in montage.values()]
    assert genres.count("SaveVideo") == 1
    assert "SaveImage" not in genres
    # ⚠️ Le nœud de la recette officielle n'existe pas dans un ComfyUI ordinaire.
    assert "PainterI2V" not in genres
    assert "WanImageToVideo" in genres
    # Les deux moitiés du moteur, chacune avec ses deux greffons.
    assert genres.count("UnetLoaderGGUF") == 2
    assert genres.count("KSamplerAdvanced") == 2


def test_les_cotes_du_montage_sont_ramenes_a_des_multiples_de_seize():
    """Une contrainte du modèle, réglée ici et **jamais à l'écran**.

    L'oublier fait échouer le montage sans rien dire d'utile, et une interface
    qui la porterait la porterait deux fois — une par écran.
    """
    montage = montage_du_clip(image="x.png", texte="m", images=17, largeur=490, hauteur=470)
    entrees = montage["14"]["inputs"]
    assert entrees["width"] % 16 == 0 and entrees["height"] % 16 == 0
    assert entrees["width"] == 480 and entrees["height"] == 464


def test_le_montage_sans_greffon_garde_toutes_ses_etapes():
    """Retirer le greffon ne casse pas la chaîne : il passe à force nulle.

    Supprimer les deux étapes obligerait à recâbler ce qui les suivait, et un
    montage à deux formes est un montage qu'on finit par ne plus relire.
    """
    complet = montage_du_clip(image="x.png", texte="m", images=17)
    allege = sans_greffon_pixel(complet)
    assert set(allege) == set(complet)
    assert allege["4"]["inputs"]["strength_model"] == 0.0
    assert allege["4"]["inputs"]["model"] == ["3", 0]
    assert allege["7"]["inputs"]["model"] == ["6", 0]
    # Et l'original n'a pas bougé — l'écran peut demander les deux.
    assert complet["4"]["inputs"]["strength_model"] == 1.0


# ── Les quatre gestes du port ────────────────────────────────────────────────


async def test_soumettre_depose_l_image_puis_envoie_le_montage(moteur, comfy):
    """L'ordre compte : ComfyUI ne connaît l'image que par le nom qu'il lui donne.

    Le produit ne lui passe jamais un chemin de son côté — les deux processus ne
    partagent pas forcément un disque, et le supposer tient jusqu'au jour où
    ComfyUI tourne ailleurs.
    """
    travail = await moteur.soumettre(modele_de_la_maison(), demande(1))
    assert travail == comfy.travail
    assert comfy.appels.index("POST /upload/image") < comfy.appels.index("POST /prompt")
    assert comfy.images_deposees  # l'image est bien partie
    envoye = comfy.montages[0]
    assert envoye["11"]["inputs"]["image"] == "atelier-entree.png"
    assert envoye["14"]["inputs"]["length"] == 17


async def test_soumettre_sans_greffon_envoie_le_montage_allege(moteur, comfy):
    comfy.installes["loras"] = [n for n in TOUT_EST_LA["loras"] if n != GREFFON_PIXEL]
    await moteur.soumettre(modele_de_la_maison(), demande(1))
    assert comfy.montages[0]["4"]["inputs"]["strength_model"] == 0.0


async def test_soumettre_refuse_quand_des_fichiers_manquent(moteur, comfy):
    """Et le refus **nomme les fichiers**, plutôt que de laisser ComfyUI échouer
    trois minutes plus tard sur une étape numérotée."""
    comfy.installes["vae"] = []
    with pytest.raises(AppelRefuse) as panne:
        await moteur.soumettre(modele_de_la_maison(), demande(1))
    assert "wan_2.1_vae.safetensors" in panne.value.raison


async def test_soumettre_moteur_eteint_dit_d_ouvrir_comfyui(moteur, comfy):
    comfy.eteint = True
    with pytest.raises(FournisseurIndisponible) as panne:
        await moteur.soumettre(modele_de_la_maison(), demande(1))
    assert "ouvrez ComfyUI" in panne.value.raison


async def test_l_etat_dit_qu_il_travaille_puis_qu_il_a_fini(moteur, comfy):
    comfy.fini = False
    assert (await moteur.etat(comfy.travail)).fini is False
    comfy.fini = True
    assert (await moteur.etat(comfy.travail)).fini is True


async def test_un_travail_inconnu_de_comfyui_attend_plutot_que_d_echouer(moteur):
    """Absent de l'historique veut dire *il attend son tour*, pas *il a raté*.

    Confondre les deux ferait déclarer échoué un clip qui n'a pas commencé.
    """
    etat = await moteur.etat("un-travail-que-personne-ne-connait")
    assert etat.fini is False and etat.echoue is False


async def test_une_panne_de_memoire_dit_quoi_faire(moteur, comfy):
    """La seule panne dont l'auteur peut faire quelque chose sans quitter
    l'atelier : redescendre d'un cran de durée, et relancer."""
    comfy.erreur = "Allocation on device: CUDA out of memory"
    etat = await moteur.etat(comfy.travail)
    assert etat.echoue is True
    assert "mémoire de la carte est pleine" in etat.raison
    assert "n'a rien coûté" in etat.raison


async def test_recuperer_rend_un_clip_a_zero_dollar_et_le_sait(moteur):
    """*Zéro, et zéro n'est pas « inconnu ».*

    Un clip payé dont la réponse ne portait aucun montant écrit zéro **en disant
    qu'il ne sait pas** ; celui-ci écrit zéro en le sachant, et le journal des
    dépenses distingue les deux.
    """
    produit = await moteur.recuperer("abc-123")
    assert produit.consomme == 0.0
    assert produit.montant_relu is True
    assert produit.type_media == "video/mp4"
    assert produit.octets


async def test_recuperer_un_travail_oublie_dit_qu_il_se_relance(moteur, comfy):
    """ComfyUI redémarré a perdu son historique. Le clip ne coûtait rien : la
    phrase le dit, plutôt que de laisser croire à une perte."""
    with pytest.raises(AppelRefuse) as panne:
        await moteur.recuperer("un-travail-oublie")
    assert "il se relance" in panne.value.raison


# ── Où ComfyUI range ses modèles ─────────────────────────────────────────────


async def test_le_dossier_des_modeles_vient_de_comfyui_et_pas_de_nous(
    moteur, comfy, tmp_path
):
    """**Aucun chemin en dur.** Une installation ailleurs, une seconde instance,
    un disque différent : tout marche, parce que la réponse vient de
    l'application qui sait.

    Ici par le voisin du dossier d'entrée, la disposition d'origine.
    """
    (tmp_path / "models").mkdir()
    (tmp_path / "input").mkdir()
    comfy.argv = ["ComfyUI\\main.py", "--input-directory", str(tmp_path / "input")]
    assert await moteur.dossier_des_modeles() == tmp_path / "models"


async def test_le_fichier_de_chemins_de_comfyui_fait_foi(moteur, comfy, tmp_path):
    """Et quand il déclare un `base_path`, c'est celui-là qui gagne — c'est la
    disposition de l'installation de bureau, où les modèles sont partagés."""
    ailleurs = tmp_path / "partages"
    ailleurs.mkdir()
    config = tmp_path / "chemins.yaml"
    config.write_text(
        "comfy.desktop_0:\n"
        f"  base_path: '{ailleurs}'\n"
        "  is_default: true\n"
        "  'loras': 'loras/'\n",
        encoding="utf-8",
    )
    (tmp_path / "input").mkdir()
    comfy.argv = [
        "ComfyUI\\main.py",
        "--extra-model-paths-config",
        str(config),
        "--input-directory",
        str(tmp_path / "input"),
    ]
    assert await moteur.dossier_des_modeles() == ailleurs


async def test_sans_reponse_de_comfyui_on_n_invente_aucun_chemin(moteur, comfy):
    comfy.eteint = True
    assert await moteur.dossier_des_modeles() is None


# ── « Un téléchargement interrompu se détecte et se reprend » ────────────────


class Hebergeur:
    """Un hébergeur qui coupe, puis qui reprend là où ça s'était arrêté.

    ⚠️ C'est **le seul essai qui reproduise la panne du 3 septembre 2026** : deux
    téléchargements de neuf gigaoctets s'étaient interrompus en silence, et le
    fichier tronqué ressemblait à un fichier absent.
    """

    def __init__(self, taille: int = 3000, coupe_a: int = 1000) -> None:
        self.contenu = bytes(range(256)) * (taille // 256 + 1)
        self.contenu = self.contenu[:taille]
        self.taille = taille
        self.coupe_a = coupe_a
        self.a_coupe = False
        self.debuts: list[int] = []

    def repondre(self, requete: httpx.Request) -> httpx.Response:
        if requete.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(self.taille)})
        debut = 0
        plage = requete.headers.get("Range")
        if plage:
            debut = int(plage.split("=", 1)[1].split("-", 1)[0])
        self.debuts.append(debut)
        if not self.a_coupe:
            self.a_coupe = True
            return httpx.Response(200, content=self.contenu[debut : self.coupe_a])
        return httpx.Response(206, content=self.contenu[debut:])


async def test_un_telechargement_coupe_reprend_ou_il_s_etait_arrete(comfy, tmp_path):
    """*La taille obtenue se compare à celle annoncée*, et rien n'est renommé
    avant l'octet près.

    Renommer plus tôt ferait passer neuf gigaoctets tronqués pour un modèle
    installé, et la panne qui suivrait parlerait d'autre chose.
    """
    hebergeur = Hebergeur()
    modeles = tmp_path / "models"
    modeles.mkdir()
    (tmp_path / "input").mkdir()
    comfy.argv = ["ComfyUI\\main.py", "--input-directory", str(tmp_path / "input")]

    def aiguiller(requete: httpx.Request) -> httpx.Response:
        if requete.url.host == "127.0.0.1":
            return comfy.repondre(requete)
        return hebergeur.repondre(requete)

    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(aiguiller))
    un = FICHIERS[3]  # le VAE, le plus petit
    descendus = await moteur.telecharger([un])

    assert descendus == [un.nom]
    cible = modeles / un.famille / un.nom
    assert cible.read_bytes() == hebergeur.contenu
    # Il a bien repris, et il a repris **au bon endroit**.
    assert hebergeur.debuts == [0, hebergeur.coupe_a]
    # Et le fichier temporaire a disparu : rien ne traîne à moitié descendu.
    assert not list(cible.parent.glob("*.part"))


async def test_un_hebergeur_muet_sur_la_taille_est_refuse(comfy, tmp_path):
    """Sans la taille, **aucun moyen de savoir si ce qu'on a est complet** — et
    supposer que oui est exactement l'erreur qui a coûté deux téléchargements."""
    modeles = tmp_path / "models"
    modeles.mkdir()
    (tmp_path / "input").mkdir()
    comfy.argv = ["ComfyUI\\main.py", "--input-directory", str(tmp_path / "input")]

    async def par_morceaux():
        yield b"peu"
        yield b" importe"

    def aiguiller(requete: httpx.Request) -> httpx.Response:
        if requete.url.host == "127.0.0.1":
            return comfy.repondre(requete)
        # Un contenu envoyé par morceaux : la réponse est parfaitement valide et
        # **ne porte aucune taille**. C'est ce que fait un hébergeur qui diffuse.
        return httpx.Response(200, content=par_morceaux())

    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(aiguiller))
    with pytest.raises(AppelRefuse) as panne:
        await moteur.telecharger([FICHIERS[3]])
    assert "ne dit pas la taille" in panne.value.raison


async def test_un_fichier_deja_complet_ne_se_retelecharge_pas(comfy, tmp_path):
    modeles = tmp_path / "models"
    (modeles / FICHIERS[3].famille).mkdir(parents=True)
    (modeles / FICHIERS[3].famille / FICHIERS[3].nom).write_bytes(b"deja la")
    (tmp_path / "input").mkdir()
    comfy.argv = ["ComfyUI\\main.py", "--input-directory", str(tmp_path / "input")]

    touche = []

    def aiguiller(requete: httpx.Request) -> httpx.Response:
        if requete.url.host == "127.0.0.1":
            return comfy.repondre(requete)
        touche.append(str(requete.url))
        return httpx.Response(200, content=b"")

    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(aiguiller))
    assert await moteur.telecharger([FICHIERS[3]]) == []
    assert touche == []


async def test_sans_dossier_connu_le_telechargement_le_dit(comfy, tmp_path):
    comfy.argv = ["ComfyUI\\main.py"]
    moteur = MoteurDeLaMaison(transport=httpx.MockTransport(comfy.repondre))
    with pytest.raises(AppelRefuse) as panne:
        await moteur.telecharger([FICHIERS[3]])
    assert "où ComfyUI range ses modèles" in panne.value.raison


# ── « Dans la même liste que les modèles payants » ───────────────────────────


@pytest.fixture
async def service_a_deux(tmp_path, comfy) -> ServiceAnimation:
    """Un atelier avec les deux animateurs — c'est là que la tranche se joue."""
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()
    paye = AnimateurDouble()
    local = MoteurDeLaMaison(transport=httpx.MockTransport(comfy.repondre))
    service = ServiceAnimation(
        base=Base(tmp_path / "donnees" / "atelier.sqlite3"),
        fichiers=fichiers,
        animateur=[lambda: paye, lambda: local],
    )
    service.paye = paye  # type: ignore[attr-defined]
    service.local = local  # type: ignore[attr-defined]
    await service.rafraichir()
    return service


async def test_le_local_est_dans_la_meme_liste_que_les_payants(service_a_deux):
    """*Le moteur de la maison apparaît dans la même liste, avec le même geste
    pour le choisir.* Une liste à part en ferait une option de réglages."""
    identifiants = [m.identifiant for m in service_a_deux.modeles()]
    assert "maison/wan-2.2-i2v-14b-pixel" in identifiants
    assert "essai:mele-les-poses" in identifiants


async def test_une_cle_absente_chez_le_paye_ne_grise_pas_le_local(service_a_deux):
    """⚠️ **Le défaut que la tranche existe pour éviter.**

    Avec un seul animateur, *ce qui manque au fournisseur* grisait tous les
    modèles. Avec deux, cette règle appliquée telle quelle griserait **le seul
    modèle qui ne dépense rien** parce qu'une clé manque ailleurs.
    """
    service_a_deux.paye.manque = "aucune clé OpenRouter"
    local = service_a_deux.modele("maison/wan-2.2-i2v-14b-pixel")
    paye = service_a_deux.modele("essai:mele-les-poses")
    assert service_a_deux.grise(paye, demande(5)) == "aucune clé OpenRouter"
    assert service_a_deux.grise(local, demande(1)) is None


async def test_un_animateur_qui_tombe_n_emporte_pas_l_autre(tmp_path, comfy):
    """Une liste, plusieurs sources, **et chacune répond de soi**."""
    fichiers = Fichiers(tmp_path / "donnees")
    fichiers.preparer()

    class Casse:
        nom = "casse"

        def indisponible(self):
            return None

        async def catalogue_video(self):
            raise FournisseurIndisponible("le réseau est coupé")

    service = ServiceAnimation(
        base=Base(tmp_path / "donnees" / "atelier.sqlite3"),
        fichiers=fichiers,
        animateur=[
            lambda: Casse(),
            lambda: MoteurDeLaMaison(transport=httpx.MockTransport(comfy.repondre)),
        ],
    )
    await service.rafraichir()
    assert [m.identifiant for m in service.modeles()] == [
        "maison/wan-2.2-i2v-14b-pixel"
    ]
    assert "réseau est coupé" in (service.etat()["raison"] or "")


async def test_l_etat_dit_ce_qui_manque_a_chaque_moteur_separement(service_a_deux):
    """Une seule phrase pour les deux ferait chercher la panne du mauvais côté."""
    service_a_deux.paye.manque = "aucune clé OpenRouter"
    moteurs = service_a_deux.etat()["moteurs"]
    par_nom = {m["nom"]: m for m in moteurs}
    assert par_nom["essai"]["manque"] == "aucune clé OpenRouter"
    assert par_nom["Maison"]["manque"] is None
    # Et le local a plus à dire que *disponible ou non*.
    assert par_nom["Maison"]["moteur"]["allume"] is True


async def test_un_clip_local_suit_exactement_le_chemin_d_un_clip_paye(
    service_a_deux,
):
    """*Mêmes images extraites, même entrée en bibliothèque, même écran de
    montage.* C'est ce qui fait qu'`A10` n'a rien à apprendre du local.

    Et la dépense enregistrée est **zéro, relu** : le journal ne confond pas avec
    un montant qu'on n'a pas su lire.
    """
    if __import__("atelier.image.clip", fromlist=["x"]).indisponible():
        pytest.skip("le décodeur vidéo n'est pas installé")
    generation = await service_a_deux.commander(
        "maison/wan-2.2-i2v-14b-pixel", demande(1)
    )
    await service_a_deux.attendre_tout()
    relu = service_a_deux.lire(generation.identifiant)
    emplacement = relu.emplacements[0]
    assert emplacement.consomme == 0.0
    assert relu.clip.montant_relu is True
    assert relu.clip.images > 0  # les images ont été extraites, comme chez le payant
    assert relu.clip.travail  # le numéro du travail est écrit, comme chez le payant


async def test_quatre_clips_locaux_partent_ensemble_et_ne_coutent_que_du_temps(
    service_a_deux, comfy
):
    """*La file d'`A9` marche sur le local, et c'est là qu'elle prend son sens.*

    Le geste *en lancer plusieurs et n'en garder qu'un* existe depuis `A9`, et
    il se payait : quatre clips, quatre fois le prix, y compris ceux qu'on jette.
    Le local le rend gratuit, **donc praticable à l'échelle que le payant
    interdisait** — et c'est exactement ce qu'`A12` viendra demander.
    """
    if __import__("atelier.image.clip", fromlist=["x"]).indisponible():
        pytest.skip("le décodeur vidéo n'est pas installé")
    lot = [
        await service_a_deux.commander("maison/wan-2.2-i2v-14b-pixel", demande(1))
        for _ in range(4)
    ]
    await service_a_deux.attendre_tout()

    assert len({generation.identifiant for generation in lot}) == 4
    relus = [service_a_deux.lire(g.identifiant) for g in lot]
    assert all(relu.statut == "reussie" for relu in relus)
    # **Quatre fois zéro reste zéro, et quatre fois relu reste relu.**
    assert sum(e.consomme for relu in relus for e in relu.emplacements) == 0.0
    assert all(relu.clip.montant_relu for relu in relus)
    # Et les quatre sont bien partis chez le moteur, un montage chacun.
    assert len(comfy.montages) == 4


async def test_le_second_tirage_annonce_une_attente_plus_courte_que_le_premier(
    service_a_deux, comfy
):
    """Le modèle reste chargé d'un tirage à l'autre, **et l'écran suit**.

    Continuer d'annoncer l'attente du premier après le premier ferait promettre
    plus long que la réalité ; c'est moins grave que l'inverse, et c'est faux
    quand même.
    """
    modele = service_a_deux.modele("maison/wan-2.2-i2v-14b-pixel")
    avant = service_a_deux.attente(modele, demande(1))
    await service_a_deux.commander("maison/wan-2.2-i2v-14b-pixel", demande(1))
    apres = service_a_deux.attente(modele, demande(1))

    assert avant.premier is True and apres.premier is False
    assert apres.secondes < avant.secondes
    # Et l'attente du premier portait déjà celle des suivants : c'est ce qui
    # permet à l'écran de chiffrer un lot sans inventer le rapport entre les deux.
    assert avant.secondes_suivant == apres.secondes


async def test_le_service_annonce_une_attente_pour_le_local_et_un_prix_pour_l_autre(
    service_a_deux,
):
    local = service_a_deux.modele("maison/wan-2.2-i2v-14b-pixel")
    paye = service_a_deux.modele("essai:mele-les-poses")
    assert service_a_deux.attente(local, demande(1)) is not None
    assert service_a_deux.attente(paye, demande(5)) is None
    assert service_a_deux.annonce(local, demande(1)).montant == 0.0
    assert service_a_deux.annonce(paye, demande(5)).montant > 0


# ── Ce que l'écran reçoit ────────────────────────────────────────────────────


@pytest.fixture
def client_maison(tmp_path, comfy, double, animateur):
    """L'atelier complet, monté sur les deux animateurs.

    **Le pluriel est là pour ça.** Le singulier de `A9` remplace les deux, et
    c'est voulu : un essai qui donne son double veut un atelier dont il connaît
    toutes les réponses, pas une fenêtre ComfyUI ouverte ou non sur la machine
    qui fait tourner les essais.
    """
    from fastapi.testclient import TestClient

    from atelier.api.app import creer_application
    from atelier.services import Atelier

    local = MoteurDeLaMaison(transport=httpx.MockTransport(comfy.repondre))
    atelier = Atelier(
        racine=tmp_path,
        fabrique_fournisseur=lambda: double,
        fabriques_animateurs=[lambda: animateur, lambda: local],
    )
    with TestClient(creer_application(atelier)) as client:
        client.comfy = comfy  # type: ignore[attr-defined]
        yield client


def test_l_ecran_recoit_l_etat_du_moteur_sans_rien_depenser(client_maison):
    """*Le relevé se refait à chaque appel*, pour que le grisé tombe quand
    l'auteur ouvre ComfyUI — sans redémarrer son atelier."""
    rendu = client_maison.get("/api/clips/engine").json()
    assert rendu["allume"] is True
    assert rendu["manquants"] == []
    assert rendu["carte"].startswith("cuda:0")
    assert rendu["go_a_telecharger"] == 0.0


def test_l_ecran_voit_le_moteur_s_allumer_sans_redemarrer(client_maison):
    client_maison.comfy.eteint = True
    assert client_maison.get("/api/clips/engine").json()["allume"] is False
    client_maison.comfy.eteint = False
    assert client_maison.get("/api/clips/engine").json()["allume"] is True


def test_l_ecran_liste_ce_qui_manque_avec_sa_taille_et_sa_licence(client_maison):
    """**Avant de lancer quoi que ce soit.** Vingt-six gigaoctets ne se
    descendent pas dans le dos de quelqu'un."""
    client_maison.comfy.installes["vae"] = []
    rendu = client_maison.get("/api/clips/engine").json()
    assert rendu["go_a_telecharger"] > 0
    fiche = rendu["manquants"][0]
    assert {"nom", "go", "licence", "famille"} <= set(fiche)


def test_la_liste_des_modeles_porte_le_local_avec_son_attente(client_maison):
    """La même liste, le même geste — et **une attente là où les autres ont un
    prix**."""
    rendu = client_maison.get("/api/clips/models").json()
    par_identifiant = {m["identifiant"]: m for m in rendu["modeles"]}
    local = par_identifiant["maison/wan-2.2-i2v-14b-pixel"]
    assert local["de_la_maison"] is True
    assert local["attente"]["nature"] == "attente"
    assert local["duree_conseillee"] and local["raison_de_la_duree"]
    assert par_identifiant["essai:mele-les-poses"]["attente"] is None
    # Et l'écran sait combien d'images sortiront **pour chaque durée offerte**.
    assert local["images_par_duree"]["1"] == 17


def test_l_etat_porte_les_deux_moteurs_separement(client_maison):
    rendu = client_maison.get("/api/clips/models").json()
    noms = {m["nom"] for m in rendu["moteurs"]}
    assert "Maison" in noms and len(noms) == 2


def test_le_telechargement_ne_part_que_sur_demande(client_maison, tmp_path):
    """Il n'y a **pas de version automatique** : c'est un geste que l'auteur
    demande, et la route n'existe que pour ça."""
    modeles = tmp_path / "comfy" / "models"
    modeles.mkdir(parents=True)
    (tmp_path / "comfy" / "input").mkdir()
    client_maison.comfy.argv = [
        "ComfyUI\\main.py",
        "--input-directory",
        str(tmp_path / "comfy" / "input"),
    ]
    client_maison.comfy.installes["vae"] = []
    # Rien n'est parti tant que personne n'a demandé.
    client_maison.get("/api/clips/engine")
    assert not list(modeles.rglob("*"))


def test_un_atelier_sans_moteur_de_la_maison_le_dit_au_lieu_de_se_casser(
    client_video,
):
    """L'atelier des essais d'`A9` n'en a pas, et c'est une réponse valable —
    pas une page cassée."""
    reponse = client_video.get("/api/clips/engine")
    assert reponse.status_code == 404
    assert "moteur de la maison" in reponse.json()["detail"]["raison"]
