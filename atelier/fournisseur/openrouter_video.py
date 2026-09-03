# -*- coding: utf-8 -*-
"""L'adaptateur vidéo d'OpenRouter — le même compte, la même clé, l'autre port.

Arrivé en A9 (V3). Il est **à côté** de l'adaptateur d'images et non dedans,
parce qu'il implémente un autre port : on soumet, on attend, on télécharge, et
le travail survit à une fermeture de l'atelier. Il porte le même `nom` que lui,
et ce n'est pas un détail — c'est ce nom qui qualifie chaque modèle enregistré,
donc `OpenRouter:bytedance/seedance-2.0-mini` se relit des mois plus tard comme
n'importe quel modèle d'image, et une seule facture les couvre tous.

**Trois pièges, tous payés une fois, tous enfermés ici.**

- **Les modèles vidéo ne sont pas dans la liste des modèles.** `GET /models`
  rend 423 modèles de texte et rien d'autre ; les vidéo se demandent
  explicitement, `GET /videos/models`. Une absence dans une liste filtrée par
  défaut n'est pas une absence, et l'avoir cru a coûté une demi-journée.
- **Les adresses de téléchargement demandent la clé.** Elles s'appellent
  `unsigned_urls`, ce qui laisse croire le contraire ; les télécharger sans
  en-tête rend 401, après avoir payé le clip.
- **Le montant facturé est dans la réponse d'attente**, sous `usage.cost`, et
  pas dans le journal de facturation interrogé avec le numéro du travail —
  celui-là veut l'identifiant de *génération*, qui est un autre champ. Confondre
  les deux a fait porter à dix-sept clips payés la mention « montant non relu ».
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx

from atelier.domaine.animation import (
    MESURES_DU_DEPOT,
    DemandeClip,
    ModeleVideo,
    Tarification,
)
from atelier.domaine.catalogue import nommer
from atelier.domaine.erreurs import AppelRefuse, FournisseurIndisponible, SansCle
from atelier.domaine.secret import Secret, ce_qui_manque
from atelier.fournisseur.openrouter import BASE, CLE, _panne, _raison, _type_media
from atelier.fournisseur.port import ClipProduit, EtatTravail

VIDEOS = f"{BASE}/videos"
CATALOGUE = f"{VIDEOS}/models"

DELAI_CATALOGUE = 30.0
DELAI_APPEL = 120.0
# **Un clip se fait attendre.** Mesuré le 2 septembre 2026 : 107 s en moyenne et
# jusqu'à 301 s au pire chez `seedance-1-5-pro`. Le plafond est large parce que
# le dépasser ne libère rien — le clip continue de se fabriquer chez le
# fournisseur et sera facturé —, il rend seulement la main à l'auteur.
ATTENTE_MAX = 900.0
# Entre deux coups d'œil. Ni trop court — ces appels ne coûtent rien mais ne
# servent à rien non plus —, ni trop long devant une attente de deux minutes.
CADENCE_ATTENTE = 5.0

# Les mots d'OpenRouter, et ils ne sortent pas de ce fichier.
_STATUT_FINI = "completed"
_STATUTS_ECHOUES = ("failed", "cancelled", "canceled", "error", "expired")

# **L'ordre dans lequel un tarif se cherche.** `{r}` est la résolution demandée.
# Trois règles, et chacune évite un montant faux :
# 1. le tarif de l'image-vers-vidéo passe avant le générique — c'est ce que le
#    produit fait, toujours, et il est parfois moins cher ;
# 2. « sans audio » passe avant « avec » — le produit ne demande jamais de son ;
# 3. le tarif de la résolution demandée passe avant le tarif sans résolution.
_PAR_SECONDE = (
    "image_to_video_duration_seconds_{r}",
    "duration_seconds_without_audio_{r}",
    "duration_seconds_{r}",
    "cents_per_video_output_second_{r}",
    "cents_per_second_output_{r}",
    "duration_seconds_without_audio",
    "duration_seconds",
    "cents_per_video_output_second",
    "cents_per_second_output",
)
_PAR_JETON = ("video_tokens_without_audio", "video_tokens")


class OpenRouterVideo:
    """Implémente `PortAnimateur`."""

    nom = "OpenRouter"

    def __init__(self, cle: str | None = None) -> None:
        self._cle = (cle or "").strip()

    # ── Ce qu'il demande pour travailler ─────────────────────────────────────

    def secrets(self) -> tuple[Secret, ...]:
        """La même place que l'adaptateur d'images : **un compte, une clé**."""
        return (CLE,)

    def indisponible(self) -> str | None:
        return ce_qui_manque(self.nom, self.secrets(), {CLE.nom: self._cle})

    # ── Le catalogue ─────────────────────────────────────────────────────────

    async def catalogue_video(self) -> list[ModeleVideo]:
        """`GET /videos/models` — relu au démarrage, jamais recopié en dur.

        Comme celui des images, il ne demande pas de clé : on voit ce qui existe
        avant d'en avoir une.
        """
        try:
            async with httpx.AsyncClient(timeout=DELAI_CATALOGUE) as client:
                reponse = await client.get(CATALOGUE)
                reponse.raise_for_status()
                brut = reponse.json()
        except httpx.HTTPStatusError as erreur:
            raise AppelRefuse(
                f"le catalogue vidéo a répondu {erreur.response.status_code}",
                statut=erreur.response.status_code,
            ) from None
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"catalogue vidéo injoignable — {_panne(erreur)}"
            ) from None

        return [self._lire_fiche(fiche) for fiche in brut.get("data", [])]

    @classmethod
    def _lire_fiche(cls, fiche: dict[str, Any]) -> ModeleVideo:
        chez_lui = fiche["id"]
        # **Le tarif dépend de ce qu'on demande**, et le catalogue ne le sait pas
        # encore. On garde donc le tarif de la résolution que le produit demande
        # par défaut ; un autre réglage se relit à la volée (`tarification_pour`).
        tarif = tarification_pour(fiche, "480p")
        return ModeleVideo(
            identifiant=nommer(cls.nom, chez_lui),
            nom=fiche.get("name") or chez_lui,
            fournisseur=cls.nom,
            chez_lui=chez_lui,
            durees=tuple(int(d) for d in (fiche.get("supported_durations") or ())),
            resolutions=tuple(
                str(r) for r in (fiche.get("supported_resolutions") or ())
            ),
            proportions=tuple(
                str(p) for p in (fiche.get("supported_aspect_ratios") or ())
            ),
            # **La seule façon honnête de le savoir sans payer.** Un modèle qui
            # ne déclare pas de première image ne peut pas partir d'un sprite :
            # quatre des vingt-huit sont dans ce cas, et le produit le dit au
            # lieu de le découvrir à l'appel.
            accepte_une_image="first_frame"
            in (fiche.get("supported_frame_images") or ()),
            mesure=MESURES_DU_DEPOT.get(chez_lui, ""),
            tarification=tarif,
            tarifs_declares=tuple(sorted(fiche.get("pricing_skus") or {})),
        )

    # ── L'appel, en deux temps ───────────────────────────────────────────────

    async def soumettre(self, modele: ModeleVideo, demande: DemandeClip) -> str:
        """`POST /videos` — rend le numéro du travail, **sans attendre le clip**.

        C'est ici et nulle part ailleurs que la dépense s'engage. La méthode
        rend dès qu'OpenRouter a accepté, pour que le numéro s'écrive sur le
        disque avant la première seconde d'attente : c'est ce numéro qui permet
        de récupérer un clip payé au lieu de le repayer.
        """
        if not self._cle:
            raise SansCle()

        try:
            async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
                reponse = await client.post(
                    VIDEOS, json=self.corps_appel(modele, demande), headers=self._entete
                )
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"fournisseur injoignable — {_panne(erreur)}"
            ) from None

        if reponse.status_code >= 400:
            raise AppelRefuse(_raison(reponse), statut=reponse.status_code)

        billet = reponse.json()
        travail = str(billet.get("id") or "")
        if not travail:
            # Sans numéro, le clip est peut-être en train de se fabriquer et
            # d'être facturé, et rien ne permettra d'aller le chercher. On le dit
            # comme tel plutôt que de laisser croire à un simple échec.
            raise AppelRefuse(
                "le fournisseur n'a pas rendu de numéro de travail — "
                "un clip peut avoir été lancé sans qu'on puisse le récupérer"
            )
        return travail

    async def etat(self, travail: str) -> EtatTravail:
        """Où en est ce travail. Ne télécharge rien, ne coûte rien."""
        brut = await self._lire_travail(travail)
        return _etat_de(travail, brut)

    async def recuperer(self, travail: str) -> ClipProduit:
        """Le clip fini et **ce qu'il a coûté**. Ne relance jamais rien.

        Autant de fois qu'on veut tant qu'OpenRouter garde le travail : ce geste
        rapatrie un clip déjà payé, il n'en commande aucun.
        """
        brut = await self._lire_travail(travail)
        # **Le montant se lit avant tout le reste**, exactement comme côté image :
        # un travail terminé a été facturé, et lever avant cette ligne ferait
        # disparaître du journal le montant qu'on cherchera à expliquer.
        annonce = (brut.get("usage") or {}).get("cost")
        cout = float(annonce or 0.0)
        etat = _etat_de(travail, brut)
        if etat.echoue:
            raise AppelRefuse(etat.raison, consomme=cout)
        if not etat.fini:
            raise AppelRefuse(f"le clip n'est pas prêt — {etat.raison}", consomme=cout)

        octets = await self._telecharger(brut, cout)
        return ClipProduit(
            octets=octets,
            consomme=cout,
            type_media=_type_media_video(octets),
            travail=travail,
            generation=str(brut.get("generation_id") or ""),
            montant_relu=annonce is not None,
        )

    async def attendre(
        self, travail: str, *, attente_max: float = ATTENTE_MAX
    ) -> ClipProduit:
        """Le clip, une fois prêt. Le confort des scripts, pas le chemin de l'écran.

        L'atelier, lui, écoute et laisse la main : c'est le service qui décide
        quand regarder. Cette méthode existe pour les essais et les scripts, qui
        n'ont personne à qui rendre la main.
        """
        reste = attente_max
        while True:
            etat = await self.etat(travail)
            if etat.fini or etat.echoue:
                return await self.recuperer(travail)
            if reste <= 0:
                raise FournisseurIndisponible(
                    f"le clip n'est pas arrivé en {attente_max:.0f} s — "
                    f"il continue de se fabriquer, et le travail {travail} le retrouve"
                )
            await asyncio.sleep(CADENCE_ATTENTE)
            reste -= CADENCE_ATTENTE

    # ── Ce qui part réellement ───────────────────────────────────────────────

    @staticmethod
    def corps_appel(modele: ModeleVideo, demande: DemandeClip) -> dict[str, Any]:
        """Ce qui part, enregistré tel quel comme paramètres résolus.

        L'image de départ est comptée, pas recopiée, par l'appelant : on
        n'enregistre jamais des mégaoctets de base64 dans un journal.
        """
        corps: dict[str, Any] = {
            "model": modele.envoi,
            "prompt": demande.texte.strip(),
            "duration": demande.secondes,
            "resolution": demande.resolution,
            "aspect_ratio": demande.proportions,
            # **Jamais de son.** Le produit fabrique des sprites ; une bande son
            # ne sert à rien, se paie chez plusieurs modèles, et la retirer est
            # ce qui fait passer d'un tarif « avec audio » à un tarif « sans ».
            "generate_audio": False,
            # **L'image de départ, pas une inspiration.** C'est la différence de
            # nature entre ce port et l'autre : `frame_images` impose la première
            # image du clip, là où `input_references` propose une ressemblance.
            "frame_images": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:"
                        + _type_media(demande.image)
                        + ";base64,"
                        + base64.b64encode(demande.image).decode("ascii")
                    },
                    "frame_type": "first_frame",
                }
            ],
        }
        corps.update(dict(demande.options))
        return corps

    # ── Le fil ───────────────────────────────────────────────────────────────

    @property
    def _entete(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._cle}",
            "Content-Type": "application/json",
            "X-Title": "Asset Kitchen",
        }

    async def _lire_travail(self, travail: str) -> dict[str, Any]:
        if not self._cle:
            raise SansCle()
        if not travail:
            raise AppelRefuse("ce clip n'a pas de numéro de travail à interroger")
        try:
            async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
                reponse = await client.get(f"{VIDEOS}/{travail}", headers=self._entete)
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"fournisseur injoignable — {_panne(erreur)}"
            ) from None
        if reponse.status_code >= 400:
            raise AppelRefuse(_raison(reponse), statut=reponse.status_code)
        return reponse.json()

    async def _telecharger(self, brut: dict[str, Any], cout: float) -> bytes:
        """La vidéo finie. **Les adresses d'OpenRouter demandent la clé.**

        Elles s'appellent `unsigned_urls`, et les appeler sans en-tête rend 401
        — un clip produit et perdu au dernier pas, le 2 septembre 2026. Le coût
        voyage jusqu'ici pour qu'un échec de téléchargement reste **un échec
        payé** : le clip existe chez le fournisseur, il a été facturé, et la
        reprise ira le chercher.
        """
        adresses = brut.get("unsigned_urls") or brut.get("urls") or []
        if not adresses:
            raise AppelRefuse(
                "le fournisseur dit le clip prêt mais n'en donne aucune adresse",
                consomme=cout,
            )
        adresse = str(adresses[0])
        entete = self._entete if "openrouter.ai" in adresse else None
        try:
            async with httpx.AsyncClient(timeout=DELAI_APPEL) as client:
                reponse = await client.get(adresse, headers=entete)
                reponse.raise_for_status()
                return reponse.content
        except httpx.HTTPStatusError as erreur:
            raise AppelRefuse(
                f"le clip n'a pas pu être téléchargé ({erreur.response.status_code})",
                statut=erreur.response.status_code,
                consomme=cout,
            ) from None
        except httpx.HTTPError as erreur:
            raise FournisseurIndisponible(
                f"clip injoignable — {_panne(erreur)}"
            ) from None


# ── Lecture des déclarations du catalogue ────────────────────────────────────


def tarification_pour(fiche: dict[str, Any], resolution: str) -> Tarification | None:
    """Comment ce modèle facture un clip **de cette résolution-là**, ou rien.

    Les fournisseurs nomment leurs tarifs comme ils veulent — vingt-huit modèles
    en donnent seize noms différents, certains en dollars et d'autres en
    centimes. Toute cette variété s'arrête ici : ce qui en sort est « à la
    seconde » ou « au jeton », avec un montant en dollars.

    `None` veut dire *on ne sait pas*, et surtout pas *c'est gratuit* : le modèle
    sera grisé avec les noms que le fournisseur déclarait.
    """
    sku = fiche.get("pricing_skus") or {}

    def montant(cle: str) -> float | None:
        try:
            valeur = float(sku[cle])
        except (KeyError, TypeError, ValueError):
            return None
        # **Les centimes sont un piège**, et il ne se voit qu'en lisant le nom :
        # `cents_per_second_output` vaut cent fois moins qu'il n'en a l'air, et
        # une annonce cent fois trop chère ferait renoncer à un clip à trois
        # centimes.
        return valeur / 100 if "cents_" in cle else valeur

    for motif in _PAR_SECONDE:
        cle = motif.format(r=resolution)
        valeur = montant(cle)
        if valeur is not None:
            return Tarification(genre="seconde", montant=valeur, libelle=cle)
    for cle in _PAR_JETON:
        valeur = montant(cle)
        if valeur is not None:
            return Tarification(genre="jeton", montant=valeur, libelle=cle)
    return None


def _etat_de(travail: str, brut: dict[str, Any]) -> EtatTravail:
    """Le vocabulaire d'OpenRouter traduit en trois faits, et il s'arrête ici."""
    statut = str(brut.get("status") or "")
    if statut == _STATUT_FINI:
        return EtatTravail(travail=travail, fini=True)
    if statut in _STATUTS_ECHOUES:
        detail = brut.get("error") or {}
        message = detail.get("message") if isinstance(detail, dict) else detail
        raison = f"le fournisseur a abandonné le clip — {message}" if message else ""
        return EtatTravail(
            travail=travail,
            echoue=True,
            raison=raison or "le fournisseur a abandonné le clip",
        )
    return EtatTravail(travail=travail, raison="le fournisseur le fabrique encore")


# Les signatures des conteneurs vidéo qu'un fournisseur rend vraiment. Lues
# **sur les octets** et jamais supposées, pour la raison de leur équivalent
# côté image : un fichier mal étiqueté traverse tout le produit sans que rien
# ne l'arrête, et se fait refuser au dernier pas.
def _type_media_video(octets: bytes) -> str:
    if octets[4:8] == b"ftyp":
        return "video/mp4"
    if octets.startswith(bytes.fromhex("1a45dfa3")):
        return "video/webm"
    return "application/octet-stream"
