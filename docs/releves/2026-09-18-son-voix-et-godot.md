# Voix de jeu en local + livraison audio dans Godot 4.7

Recherche du 18 septembre 2026. Complète `revue-externe-2026-09-02/research/09-audio.md` (§2.5 et §4.3) sans la refaire : on ne répète pas ce qui y est déjà juste, on corrige ce qui a bougé et on ajoute ce qui manquait.

Cadre : Windows 11, ComfyUI Desktop, RTX 3080 Laptop **8 Go**, jeu **vendu**, en français (anglais possible).
Légende licence : ✅ utilisable dans un jeu vendu · ⚠️ utilisable sous condition · ❌ exclu.
« Non vérifié » = je n'ai pas trouvé de source qui le dise.

---

## En bref

- **Le trio qui tient sur 8 Go, parle français et se vend :** **Qwen3-TTS 1,7 B VoiceDesign** (créer la voix par description), **Chatterbox Multilingual V3** (émotion réglable, clonage), **VoxCPM2** (description + clonage, 48 kHz, mais pile à 8 Go). Tous trois Apache/MIT, tous trois dans le nœud ComfyUI **TTS Audio Suite**.
- **Méthode conseillée :** on *dessine* la voix une fois (Qwen3 VoiceDesign), on garde 10 s de cet enregistrement comme **voix de référence**, puis on *clone* cette référence pour toutes les répliques. Sinon la voix du forgeron change d'une réplique à l'autre (pratique d'usage, non vérifiée par une source).
- **Trois corrections à 09-audio :** Kokoro n'a qu'**une** voix française (note B-, sous **CC BY** → crédit obligatoire) ; **VibeVoice** ne supporte officiellement que l'anglais et le chinois ; **Higgs** n'est pas utilisable pour un jeu vendu (v2 : plafond 100 000 utilisateurs ; v3 : licence commerciale à part).
- **Nouveaux venus exclus :** Voxtral TTS (Mistral, CC BY-NC), OmniVoice (poids CC BY-NC), Higgs TTS 3 (non commercial pour un produit). IndexTTS 2.5 toujours exclu et **sans français**.
- **Godot 4.7 :** musique en **Ogg Vorbis** avec `bpm`/`beat_count`/`bar_beats` posés à l'import ; SFX courts en **WAV** ; tout ce qu'il faut livrer tient dans un `.import` à côté du fichier et quelques `.tres` texte (formats détaillés en partie B).

---

## Partie A — Voix de jeu en local

### A1. Modèles de voix (TTS et « voice design »)

| Modèle | Licence poids / sorties | Français | VRAM (8 Go ?) | Émotion / contrôle | Créer une voix par description | Clonage | ComfyUI |
|---|---|---|---|---|---|---|---|
| **Qwen3-TTS 1,7 B VoiceDesign** (janv. 2026) | Apache 2.0 ✅ / sorties libres ✅ | ✅ (10 langues) | 3–6 Go selon taille ✅ | Consignes en langage courant (« parle avec colère ») | ✅ **seulement la 1,7 B** (la 0,6 B n'a pas de VoiceDesign) — *corrige 09-audio* | ✅ (modèle Base, 3 s) | TTS Audio Suite ; DarioFT/ComfyUI-Qwen3-TTS ; flybirdxx ; 1038lab ; filliptm |
| **Chatterbox Multilingual V3** (Resemble) | MIT ✅ / ✅ — sorties **tatouées** (Perth, inaudible, résiste au MP3) | ✅ (23 langues) | ~4,3 Go ✅ | `exaggeration` (0,5 par défaut), `cfg_weight` | ❌ | ✅ | TTS Audio Suite ; Fill-ChatterBox ; workflow officiel comfy.org |
| Chatterbox Turbo 350 M / Nano 110 M | MIT ✅ | ❌ anglais seul | faible / CPU | balises `[laugh] [cough] [chuckle]` | ❌ | ✅ | TTS Audio Suite |
| **VoxCPM2** (avr. 2026) | Apache 2.0 ✅ | ✅ (30 langues) | ~8 Go ⚠️ limite (GGUF pour alléger) | style, rythme, émotion en clonage | ✅ `(description)texte` | ✅ | ComfyUI-VoxCPM, ComfyUI_RH_VoxCPM |
| Kokoro-82M | Apache 2.0 ; voix FR `ff_siwis` **CC BY** ⚠️ (crédit) | ⚠️ 1 voix féminine, note B-, < 11 h de données | CPU ✅ | aucun | ❌ | ❌ | — |
| VibeVoice 1.5 B / Realtime 0.5 B (Microsoft) | MIT ✅, mais Microsoft « ne recommande pas » l'usage commercial ; code TTS retiré en sept. 2025 | ⚠️ officiel : anglais + chinois ; le français « marche » selon TTS Audio Suite (non vérifié par Microsoft) | 5,4 Go (1,5 B) ✅ / 18 Go (7 B) ❌ | peu | ❌ | ✅ | TTS Audio Suite |
| Higgs Audio v2 (Boson) | ⚠️ licence dérivée Llama : commercial si < 100 000 utilisateurs actifs/an, crédit Boson + Meta | ⚠️ non listé officiellement | ~9 Go ❌ | — | ❌ | ✅ | TTS Audio Suite |
| Higgs TTS 3 (2026) | ❌ recherche/non commercial ; la « Creator Use Grant » **exclut explicitement** l'intégration dans un produit | ✅ | ~8 Go | 21 émotions, 9 bruits (toux, rire, pleurs, cri, soupir…) | — | ✅ | TTS Audio Suite |
| Dia 1.6 B / **Dia2 2 B** (Nari Labs) | Apache 2.0 ✅ | ❌ anglais | 4,4 Go ✅ | non verbal `(laughs)` | ❌ | ✅ | oui (non vérifié pour Dia2) |
| IndexTTS 2 / 2.5 (bilibili, 2.5 sortie le 10 août 2026) | ❌ licence bilibili, commercial sur demande | ❌ (zh, en, ja, es, ar) | ~4,7 Go | 8 émotions en vecteur, `duration_factor` | ❌ | ✅ | TTS Audio Suite |
| MOSS-TTS / **MOSS-VoiceGenerator** (fév. 2026) | Apache 2.0 ✅ | ❌ VoiceGenerator : chinois + anglais seulement | 8,5 Go + ❌ | — | ✅ (très bon sur les rôles : « aubergiste jovial ») | ✅ | TTS Audio Suite |
| Maya1 (Maya Research) | Apache 2.0 ✅ | ❌ anglais | 16 Go + ❌ | 20 balises (`<laugh>`, `<sigh>`, `<gasp>`, `<cry>`…) | ✅ | — | non vérifié |
| Kyutai Pocket TTS (janv. 2026) | poids **CC BY 4.0** ⚠️ (crédit) | ⚠️ contradictoire : la fiche HF dit anglais seul, d'autres sources disent 6 langues dont FR | CPU ✅ | — | ❌ | ✅ | non vérifié |
| Voxtral TTS 4 B (Mistral, mars 2026) | ❌ CC BY-NC | ✅ | — | — | — | ✅ | — |
| OmniVoice 0,6 B (k2-fsa) | ❌ poids CC BY-NC (données Emilia) ; code Apache | ✅ (600 langues) | < 2 Go | attributs (âge, grave, chuchoté) + `[laughter] [sigh]` | ✅ | ✅ | TTS Audio Suite |
| Fish Audio S2, Echo-TTS, F5-TTS, XTTS | ❌ (voir 09-audio) | | | | | | TTS Audio Suite |

**Nœud ComfyUI à installer : TTS Audio Suite** (diodiogod, v5.8.10). Il regroupe 19 moteurs (Qwen3, Chatterbox 23 langues, VibeVoice, Higgs, IndexTTS, RVC…), gère les personnages, le minutage SRT et un normaliseur de phonèmes qui traite le français. **Attention :** il propose aussi des moteurs exclus (Fish, Echo, F5, Higgs 3) — il faut les écarter à la main.

Sources :
- Qwen3-TTS VoiceDesign : https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
- nœuds Qwen3 : https://github.com/DarioFT/ComfyUI-Qwen3-TTS · https://github.com/flybirdxx/ComfyUI-Qwen-TTS · https://github.com/1038lab/ComfyUI-QwenTTS · https://github.com/filliptm/ComfyUI-FL-Qwen3TTS
- Chatterbox : https://github.com/resemble-ai/chatterbox · https://comfy.org/workflows/audio-chatterbox_tts_multilingual-20ff6cad791c/ · https://github.com/filliptm/ComfyUI_Fill-ChatterBox
- TTS Audio Suite (tableau des moteurs, VRAM, langues) : https://github.com/diodiogod/TTS-Audio-Suite
- VoxCPM : https://github.com/OpenBMB/VoxCPM
- Kokoro, voix françaises : https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- VibeVoice : https://github.com/microsoft/VibeVoice · https://byteiota.com/microsoft-vibevoice-the-voice-ai-microsoft-pulled-back/
- Higgs v2 : https://huggingface.co/bosonai/higgs-audio-v2-generation-3B-base/blob/main/LICENSE · Higgs TTS 3 : https://huggingface.co/bosonai/higgs-tts-3-4b · https://huggingface.co/bosonai/higgs-tts-3-4b/blob/main/LICENSE
- Dia2 : https://github.com/nari-labs/dia2 · https://huggingface.co/nari-labs/Dia2-2B
- IndexTTS : https://github.com/index-tts/index-tts
- MOSS : https://github.com/OpenMOSS/MOSS-TTS · https://huggingface.co/OpenMOSS-Team/MOSS-VoiceGenerator
- Maya1 : https://www.marktechpost.com/2025/11/11/maya1-a-new-open-source-3b-voice-model-for-expressive-text-to-speech-on-a-single-gpu/ · https://maya1.org/
- Pocket TTS : https://huggingface.co/kyutai/pocket-tts · https://github.com/kyutai-labs/pocket-tts
- Voxtral TTS : https://mistral.ai/news/voxtral-tts/ · https://huggingface.co/mistralai/Voxtral-4B-TTS-2603
- OmniVoice : https://huggingface.co/k2-fsa/OmniVoice · https://github.com/k2-fsa/OmniVoice/blob/master/README.md

**Sur 8 Go, un modèle à la fois.** Qwen3 1,7 B (~5 Go) et Chatterbox (~4,3 Go) ne cohabitent pas confortablement ; VoxCPM2 prend tout seul la carte. Décharger entre deux étapes.

### A2. Cris, grognements, souffles (« barks ») et voix de créatures

**Ce qu'on peut obtenir d'un modèle de voix, en local et vendable :**

| Besoin | Meilleure piste ✅ | Remarque |
|---|---|---|
| Rire, toux, gloussement | Chatterbox Turbo : `[laugh] [cough] [chuckle]` | anglais seul, mais un rire n'a pas de langue |
| Soupir, rire, surprise | Dia / Dia2 : `(laughs)`, `(sighs)`, `(gasps)` | anglais ; Apache |
| « Aïe », « Hah ! », râle d'effort | Chatterbox Multilingual avec un texte d'onomatopée (« Hnngh… Aaah ! ») et `exaggeration` 0,8–1,0 | le texte fait le son ; tirer 8 variantes |
| Cri de guerre, douleur forte | Qwen3 VoiceDesign : décrire l'état dans la consigne + onomatopée dans le texte | rendu inégal ; non vérifié par une source |
| Grognement de bête, rugissement | Pas un modèle de voix : **Stable Audio Open** (déjà dans 09-audio §2.1) ou voix humaine + transformation | |

Les meilleurs pour le non-verbal (Higgs 3 : 9 bruits dédiés ; OmniVoice ; Maya1) sont **exclus** ou trop gros.

**Transformer une voix en créature :**

| Outil | Licence | Usage | Verdict |
|---|---|---|---|
| **RVC / Applio** | MIT ✅ ; modèles de base Applio entraînés sur VCTK (usage public) | Changer le timbre d'une voix vers une voix *consentie*. Nœud RVC dans TTS Audio Suite (100–300 Mo VRAM) | ✅ — n'utiliser que des voix dont on a les droits ; les 20 000 modèles communautaires sont des voix de gens réels, **à exclure** |
| Seed-VC | code **GPL-3** ⚠️, dépôt **archivé** le 21 nov. 2025 ; licence des poids non vérifiée | Conversion zéro-shot, voix chantée | ⚠️ utiliser comme outil séparé (le GPL touche le code, pas le son produit — non vérifié par un juriste) ; préférer RVC |
| DSP sans IA (pitch + formants, ring-mod, bitcrush) | libre (librosa ISC, scipy, torchaudio) | gobelin, démon, robot | ✅ déjà détaillé dans 09-audio §2.5 et §3.10 |

Recette type **gobelin** (DSP) : voix humaine nasillarde → pitch +5 à +7 demi-tons *en gardant* les formants un peu plus hauts → léger bitcrush → accélérer 1,1×. **Ogre/boss** : pitch −5 à −8, formants abaissés, ring-mod 30–50 Hz très discret, réverbe de salle. (Valeurs de départ, à régler à l'oreille — non vérifié par une source.)

Sources : https://github.com/iahispano/Applio · https://docs.applio.org/getting-started/pretrained/ · https://github.com/Plachtaa/seed-vc · https://github.com/nari-labs/dia · https://github.com/resemble-ai/chatterbox

### A3. Six exemples de consignes

Deux champs à chaque fois : **la voix** (consigne de VoiceDesign, qu'on écrit en anglais — le modèle comprend mieux ; le texte, lui, reste en français) et **le texte**. Chatterbox ne prend pas de description : on lui donne un enregistrement de référence produit par Qwen3, et on règle `exaggeration`.

| Cas | Voix (Qwen3 VoiceDesign `instruct` / VoxCPM2 entre parenthèses) | Texte (FR) | Chatterbox (clonage de cette voix) |
|---|---|---|---|
| **PNJ marchand** | `Middle-aged man, warm and slightly nasal voice, fast talker, friendly salesman tone, a hint of a smile` | « Ah, un connaisseur ! Pour vous, ce sera trente pièces… et c'est donné. » | exaggeration 0,6, cfg 0,5 |
| **Héros qui prend un coup** | `Young adult man, strong voice, sudden pain, sharp exhale, short and breathy` | « Hnngh ! » · « Argh… » · « Ouf ! » (une réplique par fichier, 8 tirages chacune) | exaggeration 0,9, cfg 0,3 |
| **Boss qui menace** | `Deep, slow, gravelly male voice, cold and contemptuous, low pitch, speaks with long pauses` | « Tu es venu jusqu'ici… pour mourir à genoux. » | exaggeration 0,7 ; puis DSP pitch −3, réverbe de salle |
| **Narrateur** | `Calm mature voice, neutral warm timbre, clear diction, storytelling pace, no strong emotion` | « Au nord des Salines, le vent ne s'arrête jamais. » | exaggeration 0,4, cfg 0,5 |
| **Cri de gobelin** | `Small creature, high-pitched raspy voice, nasal, aggressive, screeching` | « Kiiiyah ! » · « Grrraah ! » · « Hé hé hé ! » | exaggeration 1,0 ; puis DSP pitch +5, bitcrush léger |
| **Soupir de fatigue** | `Tired adult woman, soft breathy voice, exhausted, long sigh` | « Haaah… » · « Pfff… encore… » | exaggeration 0,5 ; ou Dia/Dia2 `(sighs)` si l'anglais est accepté |

Format VoxCPM2 : `(Deep, slow, gravelly male voice, cold)Tu es venu jusqu'ici…` (syntaxe entre parenthèses selon le README VoxCPM).
Les réglages Chatterbox sont des points de départ (valeurs par défaut 0,5 / 0,5 d'après le README) ; le reste est de l'usage, non vérifié.

---

## Partie B — Livraison dans Godot 4.7

Toutes les références ci-dessous viennent de la doc « stable », qui est la **4.7** au 18 sept. 2026.

### B4. Formats et options d'import

| Format | Pour quoi (doc Godot) | Options d'import (nom exact dans le `.import`) |
|---|---|---|
| **WAV** | SFX courts et répétés (coût CPU le plus bas) | `force/8_bit`, `force/mono`, `force/max_rate`, `force/max_rate_hz` (44100), `edit/trim`, `edit/normalize`, `edit/loop_mode` (0 = lire dans le WAV, 1 = aucun, 2 = avant, 3 = aller-retour, 4 = arrière), `edit/loop_begin`, `edit/loop_end` (**en échantillons**), `compress/mode` (0 PCM, 1 IMA ADPCM, **2 QOA par défaut**) |
| **Ogg Vorbis** | Musique, voix, SFX longs | `loop` (false), `loop_offset` (**secondes**, 0), `bpm` (0), `beat_count` (0), `bar_beats` (4) |
| MP3 | Web/mobile à CPU faible | mêmes options que l'Ogg |

`bpm`, `beat_count`, `bar_beats` ne servent **qu'à la musique interactive** (transitions sur le temps ou la mesure). Mettre `beat_count` = nombre exact de temps du morceau (16 mesures en 4/4 → 64), sinon la boucle et les transitions calées sur la mesure dérapent.

**Poser ces métadonnées hors éditeur — trois voies :**

1. **Écrire le `.import` à côté du fichier** (c'est ce qui se commite ; `.godot/` ne se commite pas). Forme réelle d'un fichier du projet démo officiel :
   ```ini
   [remap]
   importer="oggvorbisstr"
   type="AudioStreamOggVorbis"
   uid="uid://sgfduhhw4pno"
   path="res://.godot/imported/House In a Forest Loop.ogg-1a6a72ae843ad792b7039931227e8d50.oggvorbisstr"

   [deps]
   source_file="res://art/House In a Forest Loop.ogg"
   dest_files=["res://.godot/imported/House In a Forest Loop.ogg-1a6a72ae843ad792b7039931227e8d50.oggvorbisstr"]

   [params]
   loop=true
   loop_offset=0.0
   bpm=0.0
   beat_count=0
   bar_beats=4
   ```
   Le `path` contient un hachage calculé par l'éditeur. **Non vérifié par la doc :** qu'un `.import` réduit à `importer`, `type` et `[params]` soit complété proprement par l'éditeur. Précaution sûre : écrire le fichier, puis lancer `godot --headless --import` (« démarre l'éditeur, attend la fin des imports, et quitte »), puis vérifier que `[params]` a survécu. Pour WAV : `importer="wav"`, `type="AudioStreamWAV"`, extension importée `.sample`.
2. **Charger à l'exécution** : `AudioStreamOggVorbis.load_from_file(chemin)` puis régler `loop`, `bpm`… en code ; `AudioStreamWAV.load_from_file(chemin, options)` accepte un dictionnaire dont les clés sont celles de l'importeur (`"force/max_rate": true`…). Utile pour des sons ajoutés par le joueur, pas pour le jeu livré.
3. **Une ressource `.tres` qui enveloppe le son** (Randomizer, Interactive…) : c'est là qu'on met variations et transitions (B5). Les métadonnées de tempo restent, elles, dans le `.import` du `.ogg`.

**Piège signalé :** dans un jeu exporté, le `.pck` ne contient pas le `.ogg` mais le `.ogg.import` et le fichier converti. Un code qui liste un dossier en cherchant « *.ogg » ne trouve rien ; il faut retirer le suffixe `.import` puis passer par `ResourceLoader` (constaté dans un projet tiers, pas dans la doc).

Sources :
- https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html
- https://github.com/godotengine/godot/blob/master/modules/vorbis/resource_importer_ogg_vorbis.cpp
- https://raw.githubusercontent.com/godotengine/godot/master/editor/import/resource_importer_wav.cpp
- https://docs.godotengine.org/en/stable/classes/class_resourceimporteroggvorbis.html
- https://github.com/godotengine/godot-demo-projects/blob/master/2d/dodge_the_creeps/art/House%20In%20a%20Forest%20Loop.ogg.import
- https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/import_process.html
- https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- https://docs.godotengine.org/en/stable/classes/class_audiostreamwav.html · https://docs.godotengine.org/en/stable/classes/class_audiostreamoggvorbis.html
- piège du `.pck` : https://github.com/MontySteele/GItS/pull/603

### B5. Conteneurs : ce qu'il faut livrer pour qu'un agent Godot branche sans retouche

| Ressource | Rôle | Propriétés à remplir (noms exacts) | Ce que l'atelier doit livrer |
|---|---|---|---|
| **AudioStreamRandomizer** | Un pool de variantes + hauteur/volume aléatoires (pas, coups, cris) | `playback_mode` (0 = aléatoire sans répétition, 1 = aléatoire, 2 = dans l'ordre), `random_pitch` (multiplicateur : tirage entre 1/x et x ; 1,06 ≈ un demi-ton), **`random_pitch_semitones`** (nouveau, défaut 0), `random_volume_offset_db`, `streams_count`, `stream_N/stream`, `stream_N/weight` | les N fichiers (6–8 variantes) + un `.tres` qui les liste ; `playback_mode=0` |
| **AudioStreamInteractive** | Musique adaptative : plusieurs morceaux, transitions sur le temps / la mesure / la fin | `clip_count`, `initial_clip`, `clip_N/name`, `clip_N/stream`, `clip_N/auto_advance` (0 non, 1 oui, 2 retour au clip retenu), `clip_N/next_clip`, et `_transitions` : dictionnaire clé `Vector2i(de, vers)` → `{from_time, to_time, fade_mode, fade_beats, use_filler_clip, filler_clip, hold_previous}` ; `-1` = n'importe quel clip | chaque morceau en Ogg **avec `bpm`/`beat_count`/`bar_beats` dans son `.import`** ; le `.tres` avec des **noms de clips stables** (« exploration », « combat ») que le code appellera |
| **AudioStreamPlaylist** | Enchaîner des morceaux (jukebox) | `fade_time` (0,3 s), `loop` (true), `shuffle`, `stream_count` (64 max), `stream_N` | morceaux avec **une petite queue audio en fin** (la doc le demande, pour le fondu) |
| **AudioStreamSynchronized** | Pistes jouées ensemble, parfaitement calées (couches : base, percus, tension) | `stream_count` (32 max) ; méthodes `set_sync_stream(i, flux)`, `set_sync_stream_volume(i, dB)` (nom sérialisé dans le `.tres` non vérifié) | stems de **durée strictement identique**, même tempo ; le code monte/baisse le volume de chaque couche |

Valeurs de `from_time` : immédiat, prochain temps, prochaine mesure, fin du clip. `fade_mode` : aucun, fondu entrant, sortant, croisé, automatique. L'ordre numérique exact des énumérations n'est pas recopié ici : **l'agent Godot doit écrire les `.tres` avec les constantes nommées via un petit script `@tool`, ou vérifier l'ordre dans la page de classe**, plutôt que de deviner les entiers.

Les noms `clip_N/…` et `_transitions` viennent du code source (`audio_stream_interactive.cpp`), pas de la doc : c'est le format réel d'un `.tres`, mais il peut changer entre versions.

Sources :
- https://docs.godotengine.org/en/stable/classes/class_audiostreamrandomizer.html
- https://docs.godotengine.org/en/latest/classes/class_audiostreaminteractive.html
- https://raw.githubusercontent.com/godotengine/godot/master/modules/interactive_music/audio_stream_interactive.cpp
- https://docs.godotengine.org/en/stable/classes/class_audiostreamplaylist.html
- https://docs.godotengine.org/en/stable/classes/class_audiostreamsynchronized.html
- proposition `random_pitch_semitones` : https://github.com/godotengine/godot-proposals/issues/12874

### B6. Bus, niveaux, mono/stéréo, fréquence, taille

**Bus** (fichier `res://default_bus_layout.tres`, réglage `audio/buses/default_bus_layout`) :

```
Master
 ├─ Music
 ├─ SFX
 │   └─ (option) Footsteps, Combat
 ├─ Voice
 └─ UI
```
Chaque bus envoie vers un bus à sa gauche ; Godot coupe tout seul un bus silencieux. Garder le Master sous 0 dB. Sur le **Web** en mode « Sample » (défaut), pas d'effets de bus (réverbe…) : passer en « Stream », au prix de latence. Sur Voice, un compresseur léger ; sur Music, un « ducking » quand Voice parle (usage, non vérifié par la doc).

**Niveaux :** il n'existe pas de norme publique par catégorie. Les références publiques portent sur **le jeu entier** :
- Sony ASWG-R001 : −24 LUFS pour une console (tolérance ±2), −18 LUFS en portable, crête max **−1 dBTP**.
- Recommandation reprise par Nintendo, Microsoft et G.A.N.G. : −24 LUFS console, −16 LUFS portable.

Cibles **de départ** par fichier (pratique courante, non vérifiée par une norme — à régler au mixage) :

| Catégorie | Cible par fichier | Crête |
|---|---|---|
| Voix | −18 à −16 LUFS | −1 dBTP |
| Musique | −18 à −16 LUFS (intégré sur la boucle) | −1 dBTP |
| SFX | normaliser à la **crête** (−3 à −1 dBFS), le LUFS n'a pas de sens sur un son de 0,2 s | −1 dBTP |
| UI | un peu sous les SFX | −3 dBFS |
| Ambiance | −28 à −24 LUFS | −1 dBTP |

Ne **pas** cocher `edit/normalize` à l'import WAV (il pousse la crête à 0 dB, sans marge).

**Mono / stéréo / fréquence / taille :**
- Voix et SFX **positionnés** : **mono** (un son spatialisé est rendu mono de toute façon — non vérifié dans la doc 4.7). Musique et ambiances : stéréo.
- Fréquence : Godot mixe à **44 100 Hz** par défaut (`audio/driver/mix_rate`). Livrer en 44,1 kHz évite une conversion ; 48 kHz marche aussi. Pour la voix, 22,05 kHz suffit souvent en pixel-art (`force/max_rate`).
- Taille : WAV en **QOA** (défaut, ~1/5 du PCM) pour les SFX ; Ogg qualité 5–6 (≈ 128–160 kb/s stéréo) pour la musique, qualité 3–4 mono pour la voix. (Débits : usage, non vérifié.)

Sources :
- https://docs.godotengine.org/en/stable/tutorials/audio/audio_buses.html
- https://docs.godotengine.org/en/stable/tutorials/audio/audio_streams.html
- https://docs.godotengine.org/en/stable/classes/class_projectsettings.html
- http://gameaudiopodcast.com/ASWG-R001.pdf
- https://vndev.wiki/Guide:Balancing_a_Game's_Loudness
- https://www.audiomediainternational.com/feature/mobile-loudness-an-adaptive-approach

### B7. Arborescence et nommage de `res://audio/`

Aucune convention officielle Godot pour l'audio (non vérifié : je n'en ai pas trouvé). Proposition, alignée sur les usages Godot (snake_case, minuscules, pas d'espace ni d'accent) :

```
res://audio/
├─ music/
│   ├─ exploration/
│   │   ├─ mus_exploration_marais_calme.ogg      (+ .ogg.import avec bpm/beat_count/bar_beats)
│   │   └─ mus_exploration_marais_tension.ogg
│   └─ mus_exploration_marais.tres               (AudioStreamInteractive)
├─ sfx/
│   ├─ combat/
│   │   ├─ sfx_combat_epee_coup_01.wav … _08.wav
│   │   └─ sfx_combat_epee_coup.tres             (AudioStreamRandomizer)
│   ├─ foley/   (pas, portes, objets)
│   └─ ambiance/
├─ voice/
│   ├─ fr/
│   │   ├─ marchand/  vo_fr_marchand_salut_01.ogg
│   │   └─ heros/     vo_fr_heros_douleur_01.ogg … _08.ogg
│   ├─ en/  (même arbre, mêmes noms, seul le préfixe de langue change)
│   └─ barks/   (cris sans langue : vo_barks_gobelin_cri_01.ogg)
├─ ui/          ui_bouton_clic.wav, ui_menu_ouvrir.wav
└─ default_bus_layout.tres   (ou à la racine res://, chemin par défaut)
```

Règles :
- Préfixe de catégorie (`mus_`, `sfx_`, `vo_`, `ui_`, `amb_`) + sujet + action + variante sur **deux chiffres**. Les variantes d'un même son vont dans **un** Randomizer du même nom sans numéro.
- **Voix par langue en dossiers parallèles**, noms identiques : la localisation se fait par remplacement du chemin (`fr` → `en`) ou par les remaps de traduction de Godot (non vérifié pour l'audio dans la doc 4.7).
- Les cris sans paroles sortent de `fr/`/`en/` : on ne les double pas.
- À côté de chaque son généré : sa **recette** (modèle, consigne, graine, licence) — déjà recommandé dans 09-audio §3.7 ; utile ici pour les crédits obligatoires (Kokoro FR, Pocket TTS en CC BY).

---

## Ce qui reste non vérifié

- Qu'un `.import` écrit à la main sans `uid`/`path` soit complété sans perte par `godot --headless --import`.
- L'ordre numérique exact des énumérations `from_time` / `fade_mode` dans un `.tres`.
- La qualité réelle du français de VibeVoice et de Pocket TTS.
- Les nœuds ComfyUI pour Dia2, Maya1 et Pocket TTS.
- Les cibles LUFS par catégorie (usage, pas norme).
