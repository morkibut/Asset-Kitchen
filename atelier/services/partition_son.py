"""SN9 · La partition de YuE2 en deux temps.

Aujourd'hui, une chanson part en un seul envoi : YuE2 écrit sa partition ABC
puis la joue, sans que personne ne la voie passer. Ce module ajoute le geste
en deux temps que demande le produit :

1. **Écrire la partition** — `ecrire` envoie le seul premier étage
   (`atelier.audio.graphes.yue2_partition` : YuE2GenerateABC + PreviewAny) et
   rend le texte ABC, pour relecture. Rien n'est encore un son.
2. **Jouer cette partition** — la partition relue (corrigée ou non) repart
   par la route ordinaire d'un son (`ServiceTravauxAudio.preparer`, famille
   `chanson`, `modele` du profil `yue2-partition-jouee`, `partition` posée à
   la valeur relue) : elle profite de toute la mécanique déjà écrite
   (file locale, reprise, mesures, jugement, livraison). Ce module n'a donc
   rien à en dire de plus : la partition part **telle qu'elle est montrée**,
   jamais recomposée (`atelier.domaine.workflow.composer`, liaison
   `partition`).

Le premier étage, lui, ne produit pas un son : ni mesures, ni jugement, ni
livraison n'ont de sens pour un texte. Il ne passe donc pas par la file
locale partagée (`atelier.services.file_locale`) ni par le registre des
profils (`atelier.services.profils_workflow`, qui ne sait normaliser
qu'une image, une vidéo ou un son) : `ecrire` appelle directement le moteur
ComfyUI et attend sa réponse (décision du 19 septembre 2026 — la mesure du
banc SN0 donne 35 à 47 s pour les deux étages sur cette machine ; le premier
seul est plus court). Une partition écrite reste conservée par son
identifiant, pour être relue après un rechargement de l'écran.
"""
from __future__ import annotations

import asyncio
import json
import time

from atelier.audio.graphes import yue2_partition
from atelier.audio.texte import composer_texte
from atelier.domaine.travail import TravailRefuse
from atelier.domaine.workflow import WorkflowRefuse
from atelier.services.travaux import _hash, _json

# Le double de la mesure la plus longue relevée par le banc SN0 pour les deux
# étages de YuE2 (95 s) : de la marge pour le premier étage seul, jamais
# atteint en pratique.
DELAI_S = 190
INTERVALLE_S = 2


class ServicePartitionSon:
    def __init__(self, atelier):
        self.a = atelier
        self.racine = atelier.fichiers.racine / "partitions_son"

    # ── Le rangement ─────────────────────────────────────────────────────

    def _dossier(self, projet):
        self.a.travaux._projet(projet)  # refuse un jeu qui n'existe plus
        return self.racine / _hash(projet.encode())[:24]

    def _chemin(self, projet, identifiant):
        if not isinstance(identifiant, str) or len(identifiant) != 32 or any(c not in "0123456789abcdef" for c in identifiant):
            raise TravailRefuse("Cette partition n'existe pas dans ce jeu.")
        return self._dossier(projet) / (identifiant + ".json")

    def lire(self, projet, identifiant):
        chemin = self._chemin(projet, identifiant)
        if not chemin.exists():
            raise TravailRefuse("Cette partition n'existe pas dans ce jeu.")
        return json.loads(chemin.read_text(encoding="utf-8"))

    # ── Le fichier de poids déjà résolu ──────────────────────────────────

    def _checkpoint(self):
        """Le nom réellement installé du fichier YuE2, retrouvé sur le profil
        `yue2-partition-jouee` (installé comme les autres méthodes sonores,
        SN1) : si le second étage n'est pas installé, le premier ne l'est
        pas non plus — même fichier de poids."""
        profil = self.a.travaux_audio._profil_recent("yue2-partition-jouee")
        return profil["graphe"]["1"]["inputs"]["ckpt_name"] if profil else None

    # ── Écrire ────────────────────────────────────────────────────────────

    async def ecrire(self, projet, brut):
        """« Écrire la partition » : bloquant — l'appelant attend la réponse
        de ComfyUI. Ne lance jamais le second étage."""
        self._dossier(projet)
        if not isinstance(brut, dict) or set(brut) - {"prompt", "paroles", "tempo"}:
            raise TravailRefuse("La demande de partition contient un réglage inconnu.")
        if brut.get("paroles") is not None and not isinstance(brut["paroles"], str):
            raise TravailRefuse("Les paroles sont un texte.")
        checkpoint = self._checkpoint()
        if checkpoint is None:
            raise TravailRefuse("YuE2 n'est pas installé : installez les méthodes sonores (Réglages › Moteurs).")
        univers = self.a.univers.univers(projet).son
        demande = {"description": brut.get("prompt")}
        if brut.get("tempo") is not None:
            demande["tempo"] = brut["tempo"]
        try:
            compo = composer_texte("chanson", "yue2-partition", demande, univers)
        except ValueError as e:
            raise TravailRefuse(str(e)) from e
        paroles = brut.get("paroles")
        if paroles is None:
            paroles = (compo.get("parametres", {}).get("paroles") or {}).get("valeur", "")
        profil = yue2_partition(checkpoint=checkpoint)
        moteur = self.a.travaux_audio._moteur()
        try:
            numero = await moteur.soumettre_graphe(profil, {"prompt": compo["texte"], "paroles": paroles, "secondes": 1}, [])
        except WorkflowRefuse as e:
            raise TravailRefuse(str(e)) from e
        limite = time.monotonic() + DELAI_S
        etat = None
        while time.monotonic() < limite:
            etat = await moteur.etat(numero)
            if etat.echoue:
                raise TravailRefuse(etat.raison or "YuE2 n'a pas écrit de partition.")
            if etat.fini:
                break
            await asyncio.sleep(INTERVALLE_S)
        else:
            raise TravailRefuse("YuE2 met plus de temps que prévu à écrire la partition ; réessayez dans un instant.")
        try:
            partition = await moteur.texte_de(numero, profil)
        except WorkflowRefuse as e:
            raise TravailRefuse(str(e)) from e
        identifiant = _hash(("partition\0" + projet + "\0" + str(numero)).encode())[:32]
        doc = {"identifiant": identifiant, "projet": projet, "prompt": brut.get("prompt"), "texte_compose": compo["texte"],
               "paroles": paroles, "partition": partition, "travail_comfy": numero, "cree_le": time.time()}
        self.a.fichiers._poser(self._chemin(projet, identifiant), _json(doc))
        return doc
