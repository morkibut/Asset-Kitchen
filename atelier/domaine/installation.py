# -*- coding: utf-8 -*-
"""Ce qu'on branche une fois sur cette machine — **et jamais un secret** (B15).

Trois objets, et ils répondent à trois questions que l'écran d'installation
pose : *où l'atelier range-t-il ses fichiers ?*, *ce compte-là ouvre quoi ?*, et
*qu'est-ce qui occupe le disque ?*

⚠️ **Rien de ce module ne voit une valeur de secret.** Le tiroir à secrets vit
dans `atelier.domaine.secret` depuis F3, il ne rend que six caractères d'aperçu,
et il n'a pas été touché : ce qui suit décrit une *machine*, pas un compte.

**Ce module ne touche pas au disque non plus.** Il dit ce qu'un chemin est une
fois qu'on l'a regardé ; c'est `atelier.services.installation` qui regarde. La
seule règle vraiment portée ici est celle de l'adresse — un texte que quelqu'un
tape, et qu'il ne faut pas laisser partir tel quel dans une requête.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from atelier.domaine.erreurs import ErreurAtelier

GO = 1024**3
MO = 1024**2


class AdresseRefusee(ErreurAtelier):
    """L'adresse tapée n'est pas une adresse de ComfyUI.

    Elle refuse **avant** la première requête, et elle nomme ce qui cloche.
    Laisser partir un texte quelconque dans une adresse de requête, c'est
    laisser choisir la cible à quelqu'un qui croyait taper un port.
    """

    code = "adresse_refusee"

    def __init__(self, raison: str) -> None:
        # `reglages` et pas un nom neuf : c'est déjà le nom que le produit donne
        # à *l'installation de la machine* (`interface/src/aide.ts:80`), et sa
        # liste est close. En inventer un second aurait fait deux mots pour un
        # écran, dont un qu'aucune porte ne sait ouvrir.
        super().__init__(raison, ou_aller="reglages")


# Les seuls schémas qu'une application locale peut servir. La même liste que
# `atelier.fournisseur.toile.SCHEMAS`, et pour la même raison : `file://` lirait
# le disque, et les autres n'existent pas ici.
SCHEMAS = ("http", "https")


def lire_adresse(texte: str) -> str:
    """Une adresse de ComfyUI, normalisée — ou un refus qui dit pourquoi.

    Quatre règles, et chacune répond à une faute de frappe qu'on fait vraiment :

    - un texte vide veut dire *remets le défaut*, et c'est au service de le
      décider — ici il est refusé, parce qu'une adresse vide n'est pas une
      adresse ;
    - sans schéma, `127.0.0.1:8188` est ajouté d'un `http://` plutôt que refusé :
      c'est ce que l'auteur lit dans ComfyUI, et le lui refuser serait pédant ;
    - un chemin, une requête ou une ancre tombent — l'adaptateur compose ses
      propres chemins (`/system_stats`, `/prompt`), et une base qui en porterait
      un donnerait `…/comfy/system_stats` sans que rien ne le dise ;
    - la barre oblique finale tombe aussi, pour que deux écritures de la même
      adresse ne fassent pas deux adresses différentes — c'est ce qui décide si
      le moteur gardé se refabrique ou non.
    """
    propre = (texte or "").strip()
    if not propre:
        raise AdresseRefusee("une adresse vide ne mène nulle part")
    if "://" not in propre:
        propre = f"http://{propre}"
    decoupee = urlparse(propre)
    if decoupee.scheme not in SCHEMAS:
        raise AdresseRefusee(
            f"« {decoupee.scheme} » n'est pas une adresse web — attendu http ou https"
        )
    if not decoupee.hostname:
        raise AdresseRefusee("il manque le nom de la machine dans cette adresse")
    return f"{decoupee.scheme}://{decoupee.netloc}".rstrip("/")


# ── Ce qu'un dossier est, une fois qu'on l'a regardé ─────────────────────────


@dataclass(frozen=True, slots=True)
class Dossier:
    """Le verdict porté sur un chemin, **avant qu'on y range quoi que ce soit**.

    L'écran a besoin des quatre faits séparément : un dossier qui n'existe pas
    se propose à la création, un dossier non inscriptible ne se propose pas du
    tout, et un dossier déjà plein n'est pas un refus — c'est même le cas normal
    quand on revient sur ses pas après avoir copié ses fichiers à la main.
    """

    chemin: str
    existe: bool
    est_un_dossier: bool
    inscriptible: bool
    #: Ce qui y est déjà, parmi ce que l'atelier y range. Vide : un dossier neuf.
    contenu: tuple[str, ...] = ()

    @property
    def utilisable(self) -> bool:
        """Peut-on poser ce chemin comme dossier de travail, tel quel ?"""
        return self.existe and self.est_un_dossier and self.inscriptible

    @property
    def refus(self) -> str | None:
        """Ce qui empêche, en clair — la phrase que l'écran écrit à côté.

        **Trois refus, jamais un seul mot pour les trois.** « Ce chemin n'existe
        pas » se répare d'un bouton ; « c'est un fichier » se répare en changeant
        de chemin ; « on ne peut pas y écrire » ne se répare pas depuis
        l'atelier, et le dire évite de chercher longtemps.
        """
        if not self.existe:
            return "ce dossier n'existe pas encore"
        if not self.est_un_dossier:
            return "ce chemin désigne un fichier, pas un dossier"
        if not self.inscriptible:
            return "l'atelier n'a pas le droit d'écrire dans ce dossier"
        return None

    def en_json(self) -> dict[str, Any]:
        return {
            "chemin": self.chemin,
            "existe": self.existe,
            "est_un_dossier": self.est_un_dossier,
            "inscriptible": self.inscriptible,
            "contenu": list(self.contenu),
            "utilisable": self.utilisable,
            "refus": self.refus,
        }


# ── Ce que le disque porte ───────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Poste:
    """Une ligne de la mesure du disque : un nom, des octets, et *est-ce jetable*.

    `recalculable` est la seule chose qui compte vraiment ici : une image reçue
    d'un fournisseur a été payée et ne se refait pas, un rendu se refait en
    millisecondes depuis elle. Les mélanger dans un total ferait croire qu'on
    peut libérer les deux.
    """

    nom: str
    octets: int
    recalculable: bool

    def en_json(self) -> dict[str, Any]:
        return {
            "nom": self.nom,
            "octets": self.octets,
            "mo": round(self.octets / MO, 1),
            "recalculable": self.recalculable,
        }


@dataclass(frozen=True, slots=True)
class Disque:
    """Ce que le dossier de travail occupe, poste par poste.

    ⚠️ **Rien ici ne vide quoi que ce soit**, et c'est écrit dans la tranche :
    `B15` mesure, elle n'efface pas. Une suppression de masse pilotée par un
    motif de nom est le piège que `docs/PIEGES.md` a déjà payé une fois, et
    aucun critère de cette tranche ne la demande.
    """

    postes: tuple[Poste, ...] = ()

    @property
    def total(self) -> int:
        return sum(p.octets for p in self.postes)

    @property
    def recalculable(self) -> int:
        """Ce que vider libérerait — **si quelqu'un le vidait un jour**."""
        return sum(p.octets for p in self.postes if p.recalculable)

    def en_json(self) -> dict[str, Any]:
        return {
            "postes": [p.en_json() for p in self.postes],
            "total_mo": round(self.total / MO, 1),
            "recalculable_mo": round(self.recalculable / MO, 1),
        }


# ── Ce qu'un compte ouvre vraiment ───────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Verification:
    """Le résultat du bouton *Vérifier* — **et jamais la valeur essayée**.

    Ce qui sort d'ici traverse le port, arrive à l'écran et s'écrit sur une
    ligne. Une clé n'y a donc rien à faire, sous aucune forme : ni entière, ni
    tronquée autrement que par l'aperçu de six caractères qui existe depuis T1
    et qui, lui, ne passe pas par ici.

    `reserve` est une **phrase**, pas un nombre, et c'est délibéré : un
    fournisseur compte en dollars, un autre en jetons, un troisième ne compte
    rien du tout. Rendre un chiffre nu obligerait l'écran à deviner son unité.
    """

    fournisseur: str
    joignable: bool
    modeles: int
    reserve: str | None = None
    raison: str | None = None

    @property
    def phrase(self) -> str:
        """Ce que l'écran écrit sur une ligne, et il n'en écrit jamais deux.

        La forme de la planche, au mot près quand tout va bien : *« 49 modèles
        trouvés · il reste $4,84 sur ce compte »*. Sans solde lisible, la
        seconde moitié dit qu'elle n'a pas été lue — **jamais un zéro**, qui se
        lirait comme un compte vide.
        """
        if not self.joignable:
            return self.raison or "ce fournisseur n'a pas répondu"
        pluriel = "s" if self.modeles > 1 else ""
        modeles = f"{self.modeles} modèle{pluriel} trouvé{pluriel}"
        return f"{modeles} · {self.reserve or 'le solde n’a pas été lu'}"

    def en_json(self) -> dict[str, Any]:
        return {
            "fournisseur": self.fournisseur,
            "joignable": self.joignable,
            "modeles": self.modeles,
            "reserve": self.reserve,
            "raison": self.raison,
            "phrase": self.phrase,
        }


# ── L'état entier de l'installation ──────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class Installation:
    """Ce que l'écran des quatre étapes affiche, **en un seul aller-retour**.

    Un écran qui pose quatre questions ne doit pas faire quatre appels : les
    quatre réponses viennent du même instant, sinon le sommaire annonce un état
    et l'étape qu'on ouvre en montre un autre.
    """

    #: Le dossier où tout se range aujourd'hui, tel qu'il est vraiment résolu.
    dossier: str
    #: `environnement` | `fichier` | `defaut` — qui a décidé de ce dossier-là.
    origine_du_dossier: str
    #: Ce qu'on trouve dans ce dossier, avec ses tailles.
    disque: Disque
    #: Où le fichier de secrets habite. **Il ne suit pas le dossier de travail.**
    fichier_env: str
    #: Où ComfyUI est cherché, et qui l'a décidé.
    comfy: str
    origine_de_l_adresse: str
    #: Le tour du propriétaire doit-il se dérouler tout seul ?
    premiere_ouverture: bool
    #: Les noms des jeux déjà sur cette machine — la planche les montre.
    jeux: tuple[str, ...] = field(default=())
    #: Le dossier réglé pour le **prochain** démarrage, quand il n'est pas celui
    #: d'aujourd'hui — et la chaîne vide le reste du temps.
    #:
    #: ⚠️ **Deux chemins, parce qu'il y a vraiment deux chemins.** Choisir un
    #: dossier écrit une adresse et ne déplace rien : entre le clic et le
    #: redémarrage, l'atelier écrit *ici* et rangera *là*. Tant que ce champ
    #: n'existait pas, l'écran affichait le dossier en service avec l'origine du
    #: réglage — « `donnees` : il a été choisi ici », alors que le chemin choisi
    #: était un autre. Vu au navigateur le 9 septembre 2026, et invisible aux
    #: essais : chacune des deux valeurs, prise seule, était juste.
    dossier_au_prochain_demarrage: str = ""

    def en_json(self) -> dict[str, Any]:
        return {
            "dossier": self.dossier,
            "origine_du_dossier": self.origine_du_dossier,
            "dossier_au_prochain_demarrage": self.dossier_au_prochain_demarrage,
            "disque": self.disque.en_json(),
            "fichier_env": self.fichier_env,
            "comfy": self.comfy,
            "origine_de_l_adresse": self.origine_de_l_adresse,
            "premiere_ouverture": self.premiere_ouverture,
            "jeux": list(self.jeux),
        }
