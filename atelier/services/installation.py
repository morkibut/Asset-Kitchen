# -*- coding: utf-8 -*-
"""Ce qu'on branche une fois sur cette machine (B15).

Le seul service du produit qui **regarde le disque en dehors du dossier de
travail** : il faut bien examiner un chemin avant d'accepter d'y ranger quoi que
ce soit. Trois règles le tiennent, et elles ne se renégocient pas :

- **il ne déplace rien.** Choisir un dossier écrit une adresse dans
  `installation.json`, et l'atelier la lit **au démarrage suivant**. Ce qui est
  déjà rangé reste exactement où il est, et revenir en arrière, c'est retaper
  l'ancien chemin. Déménager des gigaoctets sous une base SQLite ouverte aurait
  été le seul geste vraiment irréversible de toute la V4 ;
- **il ne crée rien tout seul.** Poser un dossier qui n'existe pas est
  **refusé**, avec sa raison ; le créer est un second appel, que l'écran
  propose par un bouton à part. Sur Windows, un chemin se tape à la main, et
  `C:\\Uesrs\\…` est une faute de frappe qu'on fait vraiment ;
- **il n'efface rien.** Il mesure ce que le disque porte, poste par poste, et
  dit ce qu'un nettoyage libérerait. Le nettoyage lui-même n'est pas de cette
  tranche — voir `docs/tranches/V4.md` § B15.

⚠️ **Aucune valeur de secret ne traverse ce module.** Le tiroir vit dans
`atelier.reglages` et `atelier.domaine.secret` depuis F3 ; ici on ne sait que
*où* le fichier de secrets habite, jamais ce qu'il contient.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from atelier import reglages
from atelier.depot import Fichiers
from atelier.domaine.installation import (
    AdresseRefusee,
    Disque,
    Dossier,
    Installation,
    Poste,
    lire_adresse,
)
from atelier.fournisseur.maison import BASE_PAR_DEFAUT
from atelier.services.bibliotheque import ServiceBibliotheque

# **Les noms que l'atelier pose à la racine de son dossier de travail.** Ils
# servent à dire *ce dossier porte déjà un atelier* — un renseignement, jamais
# un refus : on peut très bien pointer vers un dossier qu'on vient de recopier à
# la main, et c'est même le chemin normal d'un déménagement.
CE_QUE_L_ATELIER_RANGE = (
    "generations",
    "projets",
    "atelier.sqlite3",
    "atelier.json",
    "catalogue.json",
    "collections.json",
    "etiquettes.json",
    "mouvements.json",
    "prereglages.json",
    "recettes.json",
    "agent.json",
)


class ServiceInstallation:
    """Les quatre étapes du tour du propriétaire, côté serveur.

    Il ne tient aucun état : tout se relit à chaque question, comme le tiroir à
    secrets et pour la même raison — un réglage posé doit servir au premier
    appel suivant, sans redémarrer quoi que ce soit.
    """

    def __init__(self, fichiers: Fichiers, bibliotheque: ServiceBibliotheque) -> None:
        self._fichiers = fichiers
        self._bibliotheque = bibliotheque

    # ── Ce que l'écran affiche ───────────────────────────────────────────────

    def etat(self) -> Installation:
        """Les quatre réponses, prises au même instant.

        **Un seul aller-retour pour quatre étapes** : quatre appels auraient
        laissé le sommaire annoncer un état et l'étape ouverte en montrer un
        autre.
        """
        jeux = tuple(p.nom for p in self._bibliotheque.projets())
        # **Le dossier en service, et celui qui est réglé.** Ils sont le même
        # presque toujours ; ils diffèrent entre le clic de *Ranger ici* et le
        # redémarrage, et c'est précisément le moment où l'écran doit être clair
        # — l'atelier écrit encore ici, et rangera là.
        #
        # ⚠️ **Un réglage posé, pas seulement deux chemins différents.** Un
        # atelier monté sur une racine explicite — tous les essais du dépôt, et
        # chaque atelier jetable — diffère du défaut sans que personne n'ait
        # rien choisi ; annoncer là un déménagement aurait été un mensonge, et
        # un mensonge inquiétant.
        en_service = self._fichiers.racine
        origine = reglages.origine_du_dossier()
        regle = reglages.dossier_de_travail()
        change = origine != "defaut" and regle.resolve() != en_service.resolve()
        return Installation(
            dossier=str(en_service),
            origine_du_dossier=origine,
            dossier_au_prochain_demarrage=str(regle) if change else "",
            disque=self.disque(),
            # **Il ne suit pas le dossier de travail, et c'est écrit à l'écran.**
            # La planche se contredit là-dessus : son étape 2 le met « à côté de
            # l'application », l'arbre de son étape 4 le range dans le dossier
            # de travail. On garde l'étape 2 — un fichier de secrets qui
            # déménagerait avec un réglage disparaîtrait au premier changement
            # d'adresse.
            fichier_env=str(reglages.FICHIER_ENV),
            comfy=reglages.adresse_comfy(BASE_PAR_DEFAUT),
            origine_de_l_adresse=reglages.origine_de_l_adresse(),
            premiere_ouverture=self.premiere_ouverture(),
            jeux=jeux,
        )

    def premiere_ouverture(self) -> bool:
        """Le tour doit-il se dérouler tout seul ?

        **Deux conditions, et la seconde est celle qui protège** —
        `ServiceBibliotheque.neuf()`, écrite en E19 et **réemployée telle
        quelle** : *aucune image nulle part, un seul jeu, et il porte encore le
        nom que le produit lui a donné*. En écrire une seconde ici aurait fait
        deux définitions d'*atelier neuf*, et elles auraient divergé au premier
        geste qui referme l'une sans refermer l'autre.

        ⚠️ **Et un drapeau, ce qu'E19 refusait justement.** Sa raison tient
        toujours pour la question qu'elle posait — *cet atelier est-il neuf ?*
        est un fait du disque, et un drapeau s'en désaccorderait. Celle-ci est
        une autre question : *a-t-on déjà proposé ce tour ?* Aucun fait du
        disque n'y répond, **par construction** — passer les quatre étapes ne
        laisse aucune trace, c'est même tout ce que « passer » veut dire. La
        planche l'exige en toutes lettres : *« il ne revient plus de lui-même,
        même si tout a été passé »*. Le drapeau vit dans `installation.json`,
        donc hors du dossier de travail : remettre `donnees/` à zéro ne le
        touche pas, et c'est voulu — le dossier de travail choisi non plus.
        """
        if reglages.tour_deja_fait():
            return False
        return self._bibliotheque.neuf()

    def tour_fait(self) -> None:
        """Le tour a été passé ou terminé — il ne se rouvrira plus tout seul."""
        reglages.poser_installation(tour_fait=True)

    # ── Le dossier de travail ────────────────────────────────────────────────

    def examiner(self, chemin: str) -> Dossier:
        """Ce qu'un chemin est, **sans rien y écrire de définitif**.

        L'écriture d'essai est un fichier temporaire créé puis effacé dans le
        dossier visé : c'est le seul moyen honnête de savoir si l'atelier
        pourra y écrire. `os.access(W_OK)` ment sur Windows — il regarde
        l'attribut « lecture seule » et ignore les droits réels — et un dossier
        annoncé inscriptible qui ne l'est pas se découvre à la première image
        reçue, c'est-à-dire après avoir payé.
        """
        propre = (chemin or "").strip()
        if not propre:
            return Dossier("", False, False, False)
        cible = Path(propre).expanduser()
        if not cible.exists():
            return Dossier(str(cible), False, False, False)
        if not cible.is_dir():
            return Dossier(str(cible), True, False, False)
        return Dossier(
            chemin=str(cible),
            existe=True,
            est_un_dossier=True,
            inscriptible=_peut_ecrire(cible),
            contenu=tuple(
                nom for nom in CE_QUE_L_ATELIER_RANGE if (cible / nom).exists()
            ),
        )

    def poser_dossier(self, chemin: str) -> Dossier:
        """Choisir où l'atelier rangera tout — **au prochain démarrage**.

        Ne déplace rien, n'efface rien, ne crée rien. Un chemin inutilisable est
        refusé avec sa raison plutôt que corrigé en silence : `AdresseRefusee`
        n'est pas la bonne exception ici, c'est le `Dossier` rendu qui porte le
        refus, et la route en fait un 400. L'écran, lui, a besoin des quatre
        faits pour savoir s'il propose *Créer ce dossier* ou autre chose.
        """
        dossier = self.examiner(chemin)
        if dossier.utilisable:
            reglages.poser_installation(dossier=dossier.chemin)
        return dossier

    def creer_dossier(self, chemin: str) -> Dossier:
        """Créer le dossier visé — **un geste à part, et il ne le pose pas**.

        Deux gestes distincts pour deux effets distincts : celui-ci fait exister
        un dossier vide, l'autre décide que l'atelier y rangera ses fichiers.
        Les confondre ferait d'une faute de frappe un dossier semé quelque part
        **et** un atelier qui pointe dessus.

        Il ne crée que ce qui manque (`exist_ok`), et il ne touche jamais à ce
        qui est déjà là.
        """
        propre = (chemin or "").strip()
        if not propre:
            return Dossier("", False, False, False)
        cible = Path(propre).expanduser()
        try:
            cible.mkdir(parents=True, exist_ok=True)
        except OSError:
            # Un droit refusé, un disque absent, un nom impossible : le verdict
            # que rend `examiner` dit déjà ce qui cloche, en français.
            pass
        return self.examiner(str(cible))

    # ── ComfyUI ──────────────────────────────────────────────────────────────

    def poser_comfy(self, adresse: str) -> str:
        """Où chercher ComfyUI. **Prend effet tout de suite**, contrairement au
        dossier : rien n'est ouvert sur cette adresse-là, il n'y a qu'un
        adaptateur à refabriquer, et `_maison()` s'en charge au premier appel
        suivant.

        L'adresse est normalisée avant d'être écrite (`lire_adresse`) pour que
        deux écritures de la même adresse ne fassent pas deux adresses — c'est
        cette comparaison-là qui décide si le moteur gardé se refabrique.
        """
        propre = lire_adresse(adresse)
        reglages.poser_installation(comfy=propre)
        return propre

    def oublier_comfy(self) -> str:
        """Revenir à l'adresse d'origine, sans avoir à la retaper.

        Écrit une chaîne vide plutôt que de retirer la clé : `_reglage` traite
        les deux pareil — *rien de posé* — et une clé qui disparaît d'un fichier
        JSON se relit moins bien qu'une clé vide, quand on l'ouvre à la main
        pour comprendre.
        """
        reglages.poser_installation(comfy="")
        return reglages.adresse_comfy(BASE_PAR_DEFAUT)

    # ── Ce que le disque porte ───────────────────────────────────────────────

    def disque(self) -> Disque:
        """La mesure du dossier de travail, poste par poste.

        ⚠️ **Elle parcourt l'arbre entier**, et c'est assumé : il n'existe aucun
        total tenu à jour dans le produit, et en inventer un obligerait chaque
        écriture d'image à le maintenir — un chiffre en double, donc un chiffre
        qui finit par mentir (`docs/DESIGN.md`, règle 5 : *un chiffre affiché est
        un chiffre compté*). Un seul écran la demande, et jamais pendant qu'on
        fabrique.

        ⚠️ **La planche annonce une ligne « Silhouettes » qui n'a aucun fichier
        derrière elle** : le détourage ne pose pas de masque sur le disque, il
        vit dans le rendu. Les postes ci-dessous sont ceux qui existent.
        """
        octets = {nom: 0 for nom in _POSTES}
        racine = self._fichiers.racine
        if racine.is_dir():
            for chemin in racine.rglob("*"):
                try:
                    if not chemin.is_file():
                        continue
                    octets[_poste_de(chemin, racine)] += chemin.stat().st_size
                except OSError:
                    # Un fichier qui disparaît pendant qu'on compte, un lien
                    # cassé : on compte ce qui reste plutôt que de refuser la
                    # mesure entière.
                    continue
        return Disque(
            postes=tuple(
                Poste(nom, octets[nom], recalculable)
                for nom, recalculable in _POSTES.items()
                if octets[nom] > 0
            )
        )


# ── Les postes de la mesure ──────────────────────────────────────────────────
#
# **`recalculable` est la seule colonne qui compte.** Une image reçue d'un
# fournisseur a été payée et ne se refait pas ; un rendu se refait en
# millisecondes depuis elle (T2). Les additionner ferait croire qu'on peut
# libérer les deux.

RECU = "Les images et les clips reçus"
RENDUS = "Les rendus"
FRAMES = "Les images tirées des clips"
TABLEAU = "Le tableau d'inspiration"
FICHES = "Les fiches et l'index"
RESTE = "Le reste"

_POSTES: dict[str, bool] = {
    RECU: False,
    RENDUS: True,
    FRAMES: True,
    TABLEAU: False,
    FICHES: False,
    RESTE: False,
}


def _poste_de(chemin: Path, racine: Path) -> str:
    """À quel poste ce fichier-là appartient — **par son nom et sa place**.

    Aucune correspondance approximative : `-brut.` et `-rendu.png` sont les deux
    seules conventions de nom du dépôt (`atelier/depot/fichiers.py`), et le
    dossier `<rang>-images` est la seule autre chose qui grossit.
    """
    nom = chemin.name
    if nom.endswith("-rendu.png"):
        return RENDUS
    if "-brut." in nom:
        return RECU
    if chemin.parent.name.endswith("-images"):
        return FRAMES
    if chemin.parent.name == "tableau" or chemin.parent.parent.name == "tableau":
        return TABLEAU
    if nom.endswith(".json") or nom == "atelier.sqlite3":
        return FICHES
    return RESTE


def _peut_ecrire(dossier: Path) -> bool:
    """Peut-on vraiment écrire là ? **On essaie, on n'interroge pas.**

    `os.access(dossier, os.W_OK)` rend vrai sur Windows pour des dossiers où
    l'écriture échoue : il ne regarde que l'attribut « lecture seule ». Le seul
    moyen honnête est de poser un fichier et de le retirer — et l'on ne laisse
    rien derrière : `NamedTemporaryFile` s'efface à la fermeture.
    """
    try:
        with tempfile.NamedTemporaryFile(dir=dossier, prefix=".atelier-essai-"):
            return True
    except OSError:
        return False


__all__ = ["AdresseRefusee", "CE_QUE_L_ATELIER_RANGE", "ServiceInstallation"]
