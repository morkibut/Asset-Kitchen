"""Les gestes audio de l'auteur, exposés au même stockage pour l'agent."""
from pathlib import Path
from typing import Any
from urllib.parse import quote

from atelier.domaine.son import SonRefuse


def installer_sons(serveur, atelier, refus):
    def meta(titre, verbe="travailler"):
        return {"barre": {"titre": titre, "phrase": "Conserve la source sonore et ses réglages sans génération.",
            "verbe": verbe, "paiement": "gratuit", "ou": "galerie", "route": "", "besoins": []}}

    def vue(project, son):
        base = f"/api/projects/{quote(project, safe='')}/sounds/{son['identifiant']}"
        return {**son, "apercu": base + "/preview.wav?revision=" + str(son["revision"]),
            "forme_onde": base + "/waveform?revision=" + str(son["revision"]),
            "archive": base + "/export.zip?revision=" + str(son["revision"]), "source_url": base + "/source",
            "raccord": base + "/loop-splice.wav?revision=" + str(son["revision"]) if son["mesures"] and son["mesures"]["boucle"]["active"] else None}

    @serveur.tool(name="list_sounds", meta=meta("Retrouver les sons"), description="List sounds in an explicit game project, including generated/imported sources, current revisions, judgments and quality flags. Invalid or silent sources remain listed and are not ready for delivery. No generation.")
    @refus
    async def lister(project: str) -> list[dict[str, Any]]:
        return [vue(project, son) for son in atelier.sons.lister(project)]

    @serveur.tool(name="get_sound", meta=meta("Relire un son"), description="Read a sound's current or immutable past revision, exact trim/fade/normalization/sample-rate/loop recipe, channel measurements, provenance, judgments and listening/waveform URLs. Source is immutable; a silent/invalid signal is never ready.")
    @refus
    async def lire(project: str, sound: str, revision: int | None = None) -> dict[str, Any]:
        return vue(project, atelier.sons.lire(project, sound, revision))

    @serveur.tool(name="import_sound", meta=meta("Importer un son du disque", "creer"), description="Import an explicitly supplied local WAV/OGG/MP3 file_path into the explicit project, preserving its original bytes before CPU decoding. No upload to a provider and no generation. Optional key makes retry idempotent and rejects different bytes under that key. Maximum 256 MiB. Invalid audio remains acquired with a quality warning.")
    @refus
    async def importer(project: str, file_path: str, name: str | None = None, key: str | None = None) -> dict[str, Any]:
        chemin = Path(file_path).expanduser()
        if not chemin.is_file(): raise SonRefuse("Aucun fichier sonore à cet emplacement.")
        if chemin.suffix.lower() not in (".wav", ".ogg", ".mp3"):
            raise SonRefuse("Choisissez un fichier WAV, OGG ou MP3.")
        maximum = 256 * 1024 * 1024
        try:
            if chemin.stat().st_size > maximum: raise SonRefuse("Importez un fichier audio de 256 Mo au plus.")
            with chemin.open("rb") as f: octets = f.read(maximum + 1)
        except OSError as e: raise SonRefuse("Le fichier sonore n’est pas lisible sur le disque.") from e
        if len(octets) > maximum: raise SonRefuse("Importez un fichier audio de 256 Mo au plus.")
        return vue(project, atelier.sons.importer_octets(project, octets, nom=name or chemin.name,
            cle=key, provenance={"nature": "import", "acteur": "agent"}))

    @serveur.tool(name="edit_sound", meta=meta("Retoucher un son"), description="Save a NEW sound revision using the same CPU recipe as the audio editor. Supply current revision to reject concurrent edits. recipe fields: debut/fin (seconds), rogner_silence, seuil_silence_db, marge_silence_ms, fondu_entree_ms/fondu_sortie_ms, normaliser, cible_db, gain_db, taux (Hz or null), boucle, boucle_debut/boucle_fin (seconds in edited sound), boucle_zero, boucle_fondu_ms, mono (mix down to one channel), cible_lufs (perceived loudness target applied as a gain, true peak capped at -1 dBTP; null = off), hauteur_demi_tons (-24..24) with hauteur_garde_duree (false = tape-style, duration changes). A sound with a family exposes recette_proposee. Omitted fields use recipe defaults: send the complete desired recipe when preserving other edits. Channels are preserved; no generation or implicit approval.")
    @refus
    async def regler(project: str, sound: str, revision: int, recipe: dict[str, Any], name: str | None = None) -> dict[str, Any]:
        return vue(project, atelier.sons.regler(project, sound, revision, recipe, nom=name))

    @serveur.tool(name="restore_sound", meta=meta("Restaurer une version sonore"), description="Restore a past sound recipe as a NEW current revision, keeping original bytes and all old revisions. Supply current_revision for concurrency protection and from_revision for the recipe to restore.")
    @refus
    async def restaurer(project: str, sound: str, current_revision: int, from_revision: int) -> dict[str, Any]:
        return vue(project, atelier.sons.restaurer(project, sound, current_revision, from_revision))

    @serveur.tool(name="judge_sound", meta=meta("Juger une version sonore", "juger"), description="Set an explicit sound revision judgment: a-juger, retenue or ecartee. Only one revision is retained; invalid/silent/clipped sounds cannot be retained. Does not delete source data or publish to Godot.")
    @refus
    async def juger(project: str, sound: str, revision: int, judgment: str) -> dict[str, Any]:
        return vue(project, atelier.sons.juger(project, sound, revision, judgment))

    @serveur.tool(name="set_sound_family", meta=meta("Classer un son"), description="Set a sound's family as a NEW revision: bruitage, interface, ambiance, musique, chanson, jingle or voix (null clears it). The family decides delivery: WAV 16-bit for bruitage/interface, OGG Vorbis otherwise, the Godot bus (SFX, UI, Music, Voice) and the stable file prefix (sfx_, ui_, amb_, mus_, vo_). Generated sounds already carry their family. apply_defaults=true also takes the family's proposed recipe (mono, peak or LUFS target); otherwise the recipe is unchanged. Supply current revision for concurrency protection.")
    @refus
    async def classer(project: str, sound: str, revision: int, family: str | None, apply_defaults: bool = False) -> dict[str, Any]:
        return vue(project, atelier.sons.classer(project, sound, revision, family, appliquer_reglages=apply_defaults))

    @serveur.tool(name="preview_sound_delivery", meta=meta("Relire la livraison d'un son", "livrer"), description="Prepare a ready sound revision for the linked Godot project. A sound with a family delivers the file itself (WAV for bruitage/interface, OGG otherwise) under a stable name, its .import (loop points, and bpm/beat_count/bar_beats for music), an AudioStreamPlayer scene son.tscn on the family bus, and credits.json (engine, licence, seed, prompt, date). A sound without family keeps the older package (PCM inside an AudioStreamWAV .tres). Does NOT write to the game. Review file changes and use publish_animation_delivery with the returned token, which shares the existing ownership/conflict/recovery rules. Invalid signals are rejected.")
    @refus
    async def prevoir(project: str, sound: str, revision: int) -> dict[str, Any]:
        return atelier.sons.prevoir_livraison(project, sound, revision)
