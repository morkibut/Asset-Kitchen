# 09 — Génération audio pour jeux 2D indé (SFX, musique, voix)

> Recherche technique — septembre 2026. Contrainte forte : **open source uniquement**, et **licence des poids ET des sorties compatible avec un jeu vendu**. Cible : GPU 8 Go VRAM ou CPU seul, API en dernier recours. Les outils propriétaires (Suno, Udio, ElevenLabs, Soundraw) ne sont cités que comme **référence** et sont marqués `[PROPRIÉTAIRE]`.
>
> Méthode : licences vérifiées directement sur les dépôts GitHub / fiches Hugging Face (code et poids séparément). Quand une information n'a pas pu être confirmée, elle est marquée « à vérifier ».

---

## 1. Problèmes / verrous

1. **Le piège des licences de poids.** Beaucoup de modèles audio « open source » ont un code MIT/Apache mais des **poids CC-BY-NC** (AudioCraft/MusicGen/AudioGen/MAGNeT/JASCO/MelodyFlow, MMAudio, F5-TTS, AudioLDM 2, Tango 2, TangoFlux, MusicLDM…). Un jeu vendu est un usage commercial : ces modèles sont **inutilisables** pour Damien, même s'ils sont techniquement excellents. Il faut une liste blanche stricte.
2. **La licence « communautaire » Stability.** Stable Audio Open 1.0 et Small sont sous *Stability AI Community License* : gratuit (y compris commercial) tant que l'organisation fait **moins de 1 M$ de chiffre d'affaires annuel** ; les **sorties appartiennent à l'utilisateur**. Au-delà, licence Entreprise. Acceptable pour un studio indé, mais ce n'est pas de l'Apache 2.0 : la licence est révocable et interdit d'entraîner un « modèle de fondation » concurrent.
3. **Générer des SFX courts, propres, « jeu »** (saut, coup, coffre, UI, pas). Les modèles text-to-audio produisent 10–47 s de son avec queue de silence, bruit de fond, transitoires mous. Il faut découper, nettoyer, normaliser, et souvent préférer une **synthèse procédurale** (sfxr) pour le style pixel-art.
4. **Musique en boucle parfaite, contrôlée (tempo, tonalité, style 8/16-bit).** Les modèles audio directs (ACE-Step, Stable Audio Open) font de la musique « réaliste » difficile à boucler et peu « chiptune » ; la voie **symbolique (MIDI) + rendu par synthé chip/SoundFont** donne un contrôle total et une boucle mathématiquement parfaite, mais demande un moteur de rendu.
5. **Budget mémoire : 8 Go VRAM, ou CPU seul.** Un seul modèle GPU à la fois ; YuE (7B) ou ACE-Step 4B XL sont hors budget ; il faut des variantes small/turbo/quantisées, et des solutions CPU (Stable Audio Open Small, Kokoro, sfxr, MIDI+SoundFont).
6. **Voix de personnages** : clonage vocal et TTS expressif sont dominés par des modèles non commerciaux (XTTS, F5-TTS, Fish/OpenAudio, IndexTTS). Les alternatives commerciales open (Kokoro, Chatterbox, Dia, Qwen3-TTS, VoxCPM) existent mais il faut vérifier la langue (français) et la CPU-compatibilité.
7. **Outillage sous GPL.** `pedalboard` (Spotify) est GPL-3 (JUCE, VST3 SDK, Rubber Band) ; Piper est passé en GPL-3 (espeak-ng) ; Furnace, MilkyTracker, LMMS, SuperCollider sont GPL. Compatible avec un projet open source, mais cela impose la licence du backend (ou l'isolation en sous-processus).
8. **Contrôle qualité automatique** : trier des dizaines de générations (CLAP), détecter silence / clipping / boucle qui claque, sans écoute humaine systématique.
9. **Formats et intégration moteur** : export ogg/wav mono 16-bit, 44,1 kHz, audio-sprites, variations (pitch/random), métadonnées de provenance (modèle, licence, prompt, seed) — indispensable pour prouver la traçabilité d'un asset vendu.

---

## 2. Solutions par problème

### 2.1 SFX par IA (text-to-audio)

Légende licences : **✅** commercial OK · **⚠️** conditions · **❌** non commercial.

| Nom | URL | Licence code / poids / sorties | Langage | Type | Maturité | VRAM / CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Stable Audio Open Small** | huggingface.co/stabilityai/stable-audio-open-small | MIT (stable-audio-tools) / **Stability Community ⚠️** (<1 M$ CA) / sorties possédées ✅ | Python | Diffusion latente 341 M (ARC post-training, 8 steps) | Sorti mai 2025, stable | ~2 Go GPU ; **CPU/Arm OK** (« 11 s d'audio en < 8 s sur smartphone » ; ~75 ms sur H100) | 2 | Excellent pour SFX courts, foley, boucles de batterie ; 11 s max, stéréo 44,1 kHz ; prompts anglais ; pas de voix | Entraîné sur Freesound (CC0/CC-BY) + FMA, filtré Audible Magic → provenance propre. **Choix n°1 SFX IA.** |
| **Stable Audio Open 1.0** | huggingface.co/stabilityai/stable-audio-open-1.0 | MIT / **Stability Community ⚠️** / ✅ | Python | Diffusion latente 1,1 B, T5 | Juin 2024, stable | ~6 Go fp16 (tient en 8 Go) ; CPU possible mais lent (100 steps, minutes) | 2 | Jusqu'à 47 s stéréo 44,1 kHz ; meilleur en SFX/ambiances qu'en musique ; pas de voix | Fine-tuning possible avec stable-audio-tools (MIT). Pour ambiances longues (pluie, forêt, caverne). |
| **EzAudio** | github.com/haidog-yaqub/EzAudio | MIT (code) / poids annoncés MIT **à vérifier** (données AudioSet) | Python | DiT text-to-audio, inpainting, ControlNet | Interspeech 2025, recherche | ~4–6 Go (estimé) | 3 | 16 kHz seulement ; édition/inpainting utile | Provenance des données (YouTube/AudioSet) = risque juridique diffus ; usage secondaire. |
| **Bark** (Suno) | github.com/suno-ai/bark | MIT / MIT ✅ | Python | GPT text-to-audio (voix + bruits + musique) | 2023, figé | 12 Go full, ~8 Go small, 2 Go mini ; CPU lent | 2 | Rires, soupirs, effets « vocaux » ; imprévisible ; 13 s max ; 24 kHz | Bon pour grognements/monstres, pas pour SFX précis. |
| **ACE-Step 1.5 – Text2Samples LoRA** | github.com/ace-step/ACE-Step-1.5 | MIT / MIT ✅ | Python | DiT musique + LoRA « samples » | 2026 | ≤ 6 Go (turbo 2B quantisé) | 3 | Samples/one-shots musicaux (kicks, stabs) plutôt que foley | Complément pour SFX « musicaux » (jingle victoire, stinger). |
| AudioGen / AudioCraft | github.com/facebookresearch/audiocraft | MIT / **CC-BY-NC 4.0 ❌** | Python | AR 1,5 B, 16 kHz | Stable | ~6 Go | 2 | Bon SFX 16 kHz | **Exclu** (poids NC). Référence de qualité seulement. |
| TangoFlux / Tango 2 | huggingface.co/declare-lab/TangoFlux | « non-commercial research only » ❌ / CC-BY-NC-SA ❌ | Python | Flow-matching 44,1 kHz, 30 s | 2025 | ~6 Go | 2 | Très rapide, bonne qualité | **Exclu** (hérite de la licence SAO + WavCaps). |
| AudioLDM / AudioLDM 2 | huggingface.co/cvssp/audioldm2 | ❌ (AudioLDM 1 : « UK research exception » ; AudioLDM 2 : CC-BY-NC-SA) | Python | Diffusion 16 kHz | Stable, diffusers | 8 Go | 2 | Moyen, 16 kHz | **Exclu**. |
| MMAudio | github.com/hkchengrex/MMAudio | MIT / **CC-BY-NC ❌** | Python | Vidéo→audio + texte→audio, 44 kHz, 8 s | 2025 | ~6 Go fp16 | 3 | SOTA video-to-audio | **Exclu**. Utile seulement en R&D interne. |
| ThinkSound (Alibaba) | github.com/FunAudioLLM/ThinkSound | Apache 2.0 mais « **commercial use NOT permitted** » ❌ + VAE SAO | Python | V2A avec chain-of-thought | 2025 | > 8 Go | 4 | — | **Exclu**. |
| AudioX | github.com/ZeyueT/AudioX | CC-BY-NC ❌, sorties tatouées | Python | Any-to-audio | 2025 | ? | 3 | — | **Exclu**. |
| Make-An-Audio 2 | github.com/Text-To-Audio/Make-An-Audio-2 | Non précisée, dépôt inactif | Python | — | Abandonné | — | — | — | À ignorer. |
| ElevenLabs SFX v2 `[PROPRIÉTAIRE]` | elevenlabs.io/docs/api-reference/text-to-sound-effects | API payante ; usage commercial selon plan | REST | text→SFX 0,5–30 s, paramètre `loop` | Production | API | 1 | Très bonne qualité, boucles natives | Référence / plan B API. |

**Comparaison et recommandation.** Sur le critère « licence commerciale + 8 Go + CPU », il ne reste que deux vrais candidats : **Stable Audio Open Small** (rapide, CPU-compatible, 11 s, parfait pour bruitages) et **Stable Audio Open 1.0** (47 s, ambiances). Tous deux sont sous la licence communautaire Stability (gratuite < 1 M$ CA/an, sorties possédées) : à documenter dans l'app, avec un rappel du seuil de revenus. Bark (MIT) sert d'appoint pour les bruits vocaux (rires, cris de monstres). Tout le reste (AudioGen, Tango, AudioLDM, MMAudio, ThinkSound, AudioX) est disqualifié par les poids. **En pratique, pour du pixel art, la synthèse procédurale (2.3) doit être la voie par défaut et l'IA la voie « réaliste »**.

### 2.2 Musique (audio direct)

| Nom | URL | Licence code / poids / sorties | Langage | Type | Maturité | VRAM / CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **ACE-Step 1.5** | github.com/ace-step/ACE-Step-1.5 · huggingface.co/ACE-Step/Ace-Step1.5 | **MIT / MIT ✅** ; fiche HF : « you can strictly use the generated music for commercial purposes » | Python | DiT 2B (turbo 8 steps / sft 50 steps) + LM 0,6B/1,7B/4B ; XL 4B | Sorti 28 janv. 2026, XL avril 2026, v0.1.8 mai 2026, très actif | **2B turbo : ≤ 6 Go (quantisation + offload, HF annonce < 4 Go)** ; XL ≥ 12 Go ; CPU/MPS/ROCm/XPU supportés (lent) | 3 | Chanson complète < 10 s sur RTX 3090 ; contrôle **BPM, tonalité/gamme, durée 10–600 s, signature rythmique**, instrumental, repaint, cover, LoRA (8 morceaux ≈ 1 h sur 3090) ; 50+ langues | Données : « musique sous licence + royalty-free + synthétique MIDI→audio ». **Choix n°1 musique IA.** |
| **ACE-Step v1** | github.com/ace-step/ACE-Step | Apache 2.0 / Apache 2.0 ✅ | Python | DiT 3,5 B | Mai 2025, stable | 8 Go min ; 3090 : 4,7 s / min d'audio ; M2 Max 26 s/min | 3 | Bonne, moins contrôlable que 1.5 | Remplacé par 1.5. |
| **DiffRhythm / DiffRhythm 2** | github.com/ASLP-lab/DiffRhythm · github.com/ASLP-lab/DiffRhythm2 | Apache 2.0 / Apache 2.0 ✅ | Python | Diffusion latente ; v2 semi-autorégressive (oct. 2025) | Actif | **8 Go min** (décodage par chunks) ; base 1 m 35 / full 4 m 45 | 3 | Chansons entières avec paroles (.lrc), prompt style ou audio de référence, mode instrumental | Moins de contrôle tempo/tonalité qu'ACE-Step. Données d'entraînement non documentées. |
| **Stable Audio Open 1.0** | (voir 2.1) | ⚠️ Community | Python | Diffusion 47 s | Stable | ~6 Go | 2 | Instrumental court, boucles de batterie, textures ; pas de structure de chanson | Bon pour **stingers et boucles d'ambiance** ; 47 s permet une boucle de 2–4 mesures propre. |
| **Magenta RealTime (v1 / v2)** | github.com/magenta/magenta-realtime · huggingface.co/google/magenta-realtime | Apache 2.0 / **CC-BY 4.0 ✅** (attribution) | Python (JAX) ; v2 : MLX + C++ | LLM audio 800 M (v1) ; v2 : 230 M small / 2,4 B base | v1 juin 2025 ; v2 2025–2026 (date exacte à vérifier) | v1 : Colab TPU gratuit, GPU **à vérifier sur 8 Go** ; v2 : Apple Silicon temps réel, NVIDIA hors-ligne | 4 | Musique instrumentale continue par chunks de 2 s, contexte 10 s, 48 kHz ; v2 accepte texte, audio, **MIDI** ; ~200 ms de latence | Entraîné sur 190 k h (v1) / 71 k h (v2) de « stock music » → provenance propre. Idéal pour **musique adaptative / transitions**. |
| **InspireMusic** (Alibaba) | github.com/FunAudioLLM/InspireMusic | Apache 2.0 / Apache 2.0 ✅ | Python | AR Qwen2.5 + flow-matching, 1,5 B | 2025 | non documenté (~8–10 Go estimé fp16) | 3 | Text-to-music, continuation, 24 k mono / 48 k stéréo, plusieurs minutes | Données non documentées ; moins actif qu'ACE-Step. |
| **HeartMuLa-oss-3B** | github.com/HeartMuLa/heartlib | Apache 2.0 / Apache 2.0 ✅ | Python | LM musique 3 B + HeartCodec 12,5 Hz | Janv.–fév. 2026 | Multi-GPU recommandé ; mono-GPU via lazy loading (8 Go **à tester**) ; RTF ≈ 1 | 4 | Paroles + tags, 240 s ; annonce « comparable à Suno » (7B interne) | Prometteur mais lourd ; données non documentées. |
| **YuE** | github.com/multimodal-art-projection/YuE | Apache 2.0 / Apache 2.0 ✅ (attribution demandée) | Python | 7 B + 1 B, chant | Juin 2025 | **24 Go** pour 2 sessions, 80 Go pour chanson complète ; 4090 : 360 s pour 30 s | 4 | Chansons chantées, ICL | **Hors budget 8 Go** (forks exllamav2 quantisés existent, qualité réduite). |
| **SongGen** | github.com/LiuZH-19/SongGen | Apache 2.0 ✅ | Python | AR 1,3 B, 30 s, anglais | Recherche | ~6 Go | 3 | Recherche, 2 000 h de données | Secondaire. |
| MusicGen (small/medium/large/melody), MAGNeT, MelodyFlow, JASCO | github.com/facebookresearch/audiocraft | MIT / **CC-BY-NC 4.0 ❌** | Python | AR 300 M / 1,5 B / 3,3 B ; 32 kHz | Stable | 2 / 6 / 12 Go | 2 | Très bonne qualité, conditionnement mélodie (melody), accords/batterie (JASCO 10 s) | **Exclus** malgré des données licenciées (Shutterstock/Pond5). Référence de fonctionnalités. |
| MusicLDM | huggingface.co/ucsd-reach/musicldm | CC-BY-NC-SA ❌ | Python | 0,2 B, 16 kHz | 2023 | 4 Go | 2 | Faible | Exclu. |
| Riffusion (v1) | github.com/riffusion/riffusion | MIT code / poids SD 1.5 OpenRAIL-M | Python | Spectrogrammes SD | 2022, obsolète | 4 Go | 2 | Qualité faible, 5 s | Historique. |
| Suno v5, Udio, Soundraw, Stable Audio 2.5, ElevenLabs Music `[PROPRIÉTAIRE]` | — | API / abonnement | — | — | Production | — | 1 | Meilleure qualité du marché ; droits selon plan payant | Référence. |

**Comparaison et recommandation.** **ACE-Step 1.5** domine : licence MIT sur code et poids, déclaration explicite d'usage commercial des sorties, données d'entraînement décrites (licenciées + libres + synthétiques), variante turbo 2B qui tient en < 6 Go, et — point décisif pour un jeu — **contrôle direct du BPM, de la tonalité et de la durée**, ce qui facilite la boucle. DiffRhythm 2 (Apache) est l'alternative pour les chansons chantées. Magenta RealTime (poids CC-BY 4.0, données « stock music ») est la seule option **musique continue/adaptative** ouverte ; l'attribution est à ajouter aux crédits du jeu. Stable Audio Open reste utile pour des boucles courtes et des stingers. MusicGen, malgré ses données propres, est exclu par ses poids NC.

### 2.3 Synthèse procédurale rétro (sans IA, CPU, instantané)

| Nom | URL | Licence | Langage | Type | Maturité | CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **sfxr** (DrPetter) | drpetter.se/project_sfxr.html | MIT ✅ | C++ | Synthé paramétrique 8-bit (~24 paramètres) | 2007, référence | < 1 ms | 1 | Le « son pixel-art » canonique : coin, laser, explosion, powerup, hit, jump, blip | Format binaire .sfs ; toutes les variantes ci-dessous partagent ses paramètres. |
| **jsfxr** | github.com/chr15m/jsfxr (sfxr.me) | **Unlicense (domaine public) ✅** | JavaScript (npm, ESM/CJS) | Port sfxr, presets, sérialisation JSON + b58 | Actif | Instantané, **côté serveur Node OK** (`toBuffer`, `toWave`) | 1 | Identique à sfxr | Le plus simple à piloter par programme : un objet JSON de paramètres → WAV. |
| **jfxr** | github.com/ttencate/jfxr | BSD-3 ✅ (sons libres, sans attribution) | JavaScript/TypeScript (lib npm) | Sfxr étendu : filtres, « bit crunch », enveloppes | Actif (305 commits) | Instantané | 1 | Plus de paramètres que sfxr, JSON | Bibliothèque `/lib` réutilisable côté front React. |
| **rfxgen** (raylib) | github.com/raysan5/rfxgen | zlib/libpng ✅ | C | Sfxr-like, **CLI batch** (.rfx 104 octets → .wav/.raw/.h) | v5.0 nov. 2025 | Instantané | 1 | Ondes carrée/dent de scie/sinus/bruit ; presets coin, laser, explosion, powerup, hit, jump, blip | Idéal en sous-processus depuis FastAPI ; fichier .rfx compact pour stocker les « recettes ». |
| **Bfxr2** | github.com/increpare/bfxr2 (bfxr.net) | MIT ✅ (Bfxr v1 : Apache 2.0, Flash, remplacé mars 2025) | JavaScript | Sfxr + bruit rose + **générateur de pas** (port Pure Data de « obiwannabe ») | Bêta active | Instantané | 2 | Plus de formes d'onde, mixer | Le générateur de pas est une brique précieuse (pas sur terre/bois/métal). |
| sfx_gen | github.com/topics/sfxr | (à vérifier) | C | Sfxr autonome | Petit | Instantané | 1 | — | Alternative C à rfxgen. |
| ChipTone (SFB Games) | sfbgames.itch.io/chiptone | **Gratuit mais propriétaire, non open source** | Web | Synthé rétro riche | Stable | — | — | — | Référence UX seulement. |
| LabChirp | labbed.net/software/labchirp | Freeware propriétaire (Windows) | — | — | — | — | — | — | Référence seulement. |
| usfxr | github.com/zeh/usfxr | (archivé 2020) | C# Unity | Port sfxr | Mort | — | — | — | Montre l'intérêt d'un runtime in-game. |
| **Port Python sfxr** | — | **n'existe pas de façon maintenue** (aucun dépôt Python sur le topic GitHub `sfxr` ; PyPI `sfxr` introuvable) | Python | — | — | — | 2 | — | **À développer** (cf. §5) : ~400 lignes NumPy en portant jsfxr. |

**Recommandation.** Pour le style pixel-art, **sfxr est la solution par défaut** : gratuit, instantané, 100 % CPU, licence triviale, sons « attendus » par les joueurs de jeux rétro. Deux intégrations : (a) **jfxr/jsfxr dans le front React** (prévisualisation instantanée via Web Audio, aucun aller-retour serveur), (b) **rfxgen CLI ou port Python** côté FastAPI pour l'export batch et la génération pilotée par LLM (§3). Bfxr2 apporte le générateur de pas et le bruit rose pour les SFX « organiques ».

### 2.4 Musique symbolique (MIDI), trackers, rendu chiptune

| Nom | URL | Licence code / poids | Langage | Type | Maturité | VRAM / CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Text2midi** | github.com/AMAAI-Lab/Text2midi | MIT ✅ (poids sur HF ; données MidiCaps 168 k, dérivées de Lakh) | Python | FLAN-T5 → décodeur MIDI | AAAI 2025 | GPU ou **CPU** supportés (~2–4 Go) | 2 | Texte → MIDI multi-pistes avec **tonalité, tempo, style, accords** | La sortie est du MIDI (pas de son copié) : le risque « données » est faible et le rendu est à vous. |
| **Anticipatory Music Transformer** (Stanford CRFM) | github.com/jthickstun/anticipation | Apache 2.0 ✅ (Lakh MIDI) | Python | GPT-like MIDI small/medium/large | 2023, maintenu | ~2–4 Go, CPU possible | 3 | Génération, **accompagnement d'une mélodie**, infilling | Excellente brique pour « donne-moi une mélodie, il ajoute basse/accords ». |
| **NotaGen** | github.com/ElectricAlexis/NotaGen | MIT ✅ | Python | LM notation ABC 110 M/244 M/516 M | 2025 | 8 Go inférence (large) ; small en CPU | 3 | Classique/orchestral par « période-compositeur-instrumentation » ; ABC → MusicXML/MIDI | Pour les thèmes orchestraux (RPG, boss). |
| Magenta (MusicVAE, MelodyRNN, GrooVAE, magenta.js) | github.com/magenta/magenta | Apache 2.0 ✅ | Python/TensorFlow ; JS | VAE/RNN mélodies, batterie | **Archivé (lecture seule) janv. 2026** | CPU | 2 | Petits modèles, style limité mais **tournent dans le navigateur** (magenta.js) | Toujours utilisable, plus maintenu. |
| Composer's Assistant | github.com/m-malandro/composers-assistant-REAPER | Recherche (licence à vérifier) | Python + REAPER | Infilling MIDI multipiste | 2023–2025 | CPU | 3 | — | Inspiration pour l'infilling. |
| **FluidSynth** | github.com/FluidSynth/fluidsynth | LGPL-2.1 ✅ (lien dynamique OK) | C (pyfluidsynth) | Synthé SoundFont 2/3, **rendu MIDI → WAV en CLI** (`fluidsynth -F out.wav font.sf2 song.mid`) | Très mature | CPU | 1 | Qualité = qualité du SoundFont ; GeneralUser GS (licence libre), FluidR3 (MIT), SoundFonts « 8-bit/chiptune » CC0 | **Moteur de rendu par défaut** côté serveur. |
| **FamiStudio** | github.com/BleuBleu/FamiStudio | MIT ✅ | C# (.NET) | Éditeur NES/Famicom + expansions ; **import MIDI**, export WAV/OGG/MP3/NSF/ROM/FamiTone2 ; **CLI** (`FamiStudio in.mid midi-import … wav-export`) | v4.5.1 mai 2026, très actif | CPU | 2 | Son NES authentique (2A03 + VRC6/7, FDS, N163…) | **Pipeline MIDI → NES** clé en main. |
| **Furnace** | github.com/tildearrow/furnace | GPL-2+/GPL-3 ⚠️ (sous-processus) | C++ | Tracker multi-chips (NES, Game Boy, SN76489, YM2612, SID, SNES, Amiga…) ; export WAV/VGM ; mode `-console` | v0.6.8.3 juin 2025, très actif | CPU | 3 | Son 8/16-bit de toutes les machines ; format .fur ; import .dmf DefleMask | Export WAV en ligne de commande (`-output`, à vérifier avec `furnace -help`). |
| **OpenMPT / libopenmpt** | github.com/OpenMPT/openmpt | **BSD-3 ✅** | C++ | Tracker + bibliothèque de lecture MOD/XM/S3M/IT ; `openmpt123` rend en WAV | Très mature | CPU | 2 | Lecture in-game des modules (Godot/Unity via bindings) | Meilleure licence des trackers. |
| MilkyTracker | github.com/milkytracker/MilkyTracker | GPL-3 | C++ | Tracker XM/MOD | Stable | CPU | 2 | Style Amiga | Alternatif. |
| **Bosca Ceoil Blue** | github.com/YuriSizov/boscaceoil-blue | MIT ✅ | GDScript (Godot 4.3) + GDSiON | Séquenceur simple, 300+ instruments synthé, export WAV/MIDI/.ceol | v3.1.2 actif | CPU | 1 | Très facile, son chiptune/FM | GDSiON (synthé) réutilisable ; import .ceol côté jeu Godot. |
| LMMS | github.com/LMMS/lmms | GPL-2 | C++ | DAW libre avec synthés chip (SID, Nescaline…) | Stable | CPU | 3 | — | Trop lourd à automatiser. |
| DefleMask | deflemask.com | **Propriétaire** | — | Tracker | — | — | — | — | Référence. |
| **Tone.js** | github.com/Tonejs/Tone.js | MIT ✅ | TypeScript (Web Audio) | Synthés (PulseOscillator, FMSynth, NoiseSynth…), Transport, effets, **rendu hors-ligne** (`Tone.Offline`) | v14.7 stable ; `tone@next` en dev | CPU navigateur | 2 | Chiptune crédible (pulse 12,5/25/50 %, triangle, bruit) | Rendu **client** d'un MIDI en WAV sans serveur. |
| Sonic Pi | github.com/sonic-pi-net/sonic-pi | MIT ✅ (SuperCollider GPL sous-jacent) | Ruby/C++ | Live coding, rendu WAV headless | v4.6 juin 2025 | CPU | 3 | — | Pour prototypage. |
| Strudel / TidalCycles | codeberg.org/uzu/strudel | AGPL-3 ⚠️ | JavaScript | Patterns live-coding Web Audio | Déplacé sur Codeberg juin 2025 | Navigateur | 3 | — | AGPL contaminant pour un front : éviter. |
| Csound / Pure Data (libpd) / SuperCollider / Faust | csound.com, puredata.info, supercollider.github.io, faust.grame.fr | LGPL-2.1 / BSD-3 / GPL-3 / LGPL-2.1 | C/C++ | Langages de synthèse | Très matures | CPU | 4 | Puissants, courbe d'apprentissage | Faust (LGPL) compile des DSP en C++/WASM : utile pour des effets custom. |
| Abundant Music | github.com (miroirs) — original de Per Nyblom | Licence à vérifier (JS, ancien) | JavaScript | Générateur procédural de compositions (seed → MIDI) | 2013, dormant | CPU | 2 | Musique « générique » mais structurée | Inspiration pour un générateur procédural maison. |

**Comparaison et recommandation.** La voie symbolique est celle qui répond le mieux au brief « chiptune contrôlable » : **Text2midi ou Anticipatory Music Transformer** (MIT/Apache, CPU) produisent un MIDI avec tempo/tonalité connus ; le rendu se fait **soit par FluidSynth + SoundFont chiptune** (générique, LGPL), **soit par FamiStudio CLI** (NES authentique, MIT), **soit par Tone.js dans le navigateur** (prévisualisation immédiate). La boucle est parfaite par construction (nombre de mesures entier). OpenMPT/libopenmpt (BSD-3) est la meilleure option si l'on veut livrer des modules XM/IT lus en temps réel dans le jeu (poids minuscule, musique adaptative par canaux).

### 2.5 Voix (TTS, conversion, effets)

| Nom | URL | Licence code / poids | Langage | Type | Maturité | VRAM / CPU | Cx | Qualité / limites | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Kokoro-82M** | github.com/hexgrad/kokoro | Apache 2.0 / Apache 2.0 ✅ | Python ; **ONNX** (kokoro-onnx, MIT, int8 ≈ 80 Mo) | TTS 82 M, voix prédéfinies | Actif (v1.0) | **CPU temps réel** ; MPS/GPU | 1 | 9 langues dont **français** ; pas de clonage ; très naturel pour sa taille | **Choix n°1 voix narratives/PNJ** en CPU. |
| **Chatterbox** (Resemble AI) | github.com/resemble-ai/chatterbox | **MIT / MIT ✅** | Python | TTS 500 M ; Turbo 350 M ; **Nano 110 M (CPU 3× temps réel sur 8 cœurs)** ; Multilingual V3 | 2025, actif | ~4 Go GPU ; Nano CPU | 2 | Clonage voix, **paramètre « exaggeration »** (émotion), tags `[laugh]` ; 23 langues dont français | Sorties tatouées (PerTh, inaudible) : à mentionner. |
| **Dia 1.6B** (Nari Labs) | github.com/nari-labs/dia | Apache 2.0 / Apache 2.0 ✅ | Python | TTS dialogue `[S1]/[S2]`, non-verbal `(laughs)` | 2025 | **4,4 Go fp16** ; GPU seulement (CPU « à venir ») | 2 | Anglais uniquement ; très expressif | Pour cinématiques anglaises. |
| **Qwen3-TTS** | huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base | Apache 2.0 / Apache 2.0 ✅ | Python | 0,6 B / 1,7 B ; clonage 3 s ; **« voice design » par description** ; streaming 97 ms | Janv. 2026 | 0,6 B ≈ 3 Go ; 1,7 B ≈ 5 Go | 2 | 10 langues dont français | Le « voice design » (« vieux nain bourru ») est parfait pour les personnages. |
| **VoxCPM2** (OpenBMB) | github.com/OpenBMB/VoxCPM | Apache 2.0 / Apache 2.0 ✅ | Python ; **GGUF/llama.cpp** | 2 B tokenizer-free, 48 kHz | Avril 2026 | ~8 Go GPU ; GGUF pour CPU | 3 | 30 langues, voice design + clonage ; RTF 0,3 sur 4090 | Juste à la limite des 8 Go ; GGUF utile. |
| **Orpheus 3B** | huggingface.co/canopylabs/orpheus-3b-0.1-ft | Apache 2.0 ✅ | Python (Llama 3.2) | TTS LLM, tags d'émotion, streaming | 2025 | ~8 Go fp16 ; **GGUF quantisés** (llama.cpp) | 2 | Anglais principalement | Très expressif ; passe en 4-bit sur 8 Go. |
| **Kyutai TTS** | github.com/kyutai-labs/delayed-streams-modeling | MIT/Apache code ; poids **CC-BY 4.0 ✅** | Python / Rust / MLX | TTS streaming ~1–2 B | 2025 | GPU ; Rust prod | 3 | **Anglais + français** ; clonage limité aux embeddings fournis | Attribution requise. |
| **Bark** | github.com/suno-ai/bark | MIT ✅ | Python | TTS + bruits | 2023 | 8–12 Go | 2 | 13 langues, imprévisible | Effets vocaux de monstres. |
| **Piper** → piper1-gpl | github.com/OHF-Voice/piper1-gpl | **GPL-3 ⚠️** (espeak-ng) ; voix : **licence par voix** (MODEL_CARD : CC-BY, CC0, Apache… certaines restrictives) | Python/C++ (ONNX) | TTS léger 34 langues (fr_FR) | Archivé rhasspy oct. 2025, repris | **CPU / Raspberry Pi** | 1 | Robotique mais propre | Utilisable en sous-processus ; vérifier chaque voix. |
| Parler-TTS | github.com/huggingface/parler-tts | Apache 2.0 ✅ (à re-vérifier pour les checkpoints v1) | Python | TTS piloté par description | 2024 | ~4 Go | 2 | Anglais | Peu maintenu. |
| RVC (voice conversion) | github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI | MIT ✅ ; modèles de base sur VCTK (« sans souci de droits ») | Python | Conversion de timbre, temps réel 90–170 ms | Actif | GPU faible / **CPU possible** | 3 | Clonage : n'utiliser que des voix consenties | Pour décliner une voix en N personnages. |
| F5-TTS | github.com/SWivid/F5-TTS | MIT / **CC-BY-NC ❌** (Emilia) | Python | Clonage zero-shot | Actif | 4 Go | 2 | Excellent | **Exclu.** |
| Fish Speech / OpenAudio S1, S2 Pro | github.com/fishaudio/fish-speech | « Fish Audio Research License » ❌ (S1-mini : CC-BY-NC-SA) | Python | 4 B, 80 langues, 15 000 tags d'émotion | Actif | > 8 Go | 3 | Top qualité | **Exclu.** |
| IndexTTS 2 / 2.5 (Bilibili) | github.com/index-tts/index-tts | « bilibili Model Use License » ❌ | Python | Contrôle émotion + durée | Actif | ~6 Go | 3 | — | **Exclu** (contact commercial requis). |
| XTTS v2 (Coqui) | huggingface.co/coqui/XTTS-v2 | **Coqui Public Model License ❌ (non commercial)** | Python | Clonage 6 s, 17 langues | Coqui fermé, fork idiap | 4 Go | 2 | — | **Exclu.** |
| ElevenLabs `[PROPRIÉTAIRE]` | elevenlabs.io | API | — | TTS + SFX + voice design | — | — | 1 | Référence qualité | Plan B API. |

**Effets « voix de monstre » par DSP (sans IA)** : pitch-shift + formant (librosa `pitch_shift`, ISC ; `pyrubberband`/Rubber Band GPL ; `torchaudio` BSD), ring modulator (multiplication par une sinusoïde 30–80 Hz → robot/démon), bitcrush + downsample (voix 8-bit « Animalese »), distorsion tanh, réverbe convolutive (scipy), vocodeur simple, « chorus détuné » pour les voix multiples. `pedalboard` (GPL-3) fournit tout cela clé en main mais impose GPL au processus qui l'importe : à isoler en microservice ou à remplacer par librosa/scipy/torchaudio.

**Recommandation.** **Kokoro** (CPU, français, Apache) pour 80 % des besoins ; **Chatterbox** (MIT, émotion, clonage, Nano en CPU) pour les voix de personnages ; **Qwen3-TTS 0,6 B** ou **VoxCPM2** pour le « voice design » par description ; Dia pour les dialogues anglais. Exclure XTTS, F5-TTS, Fish/OpenAudio, IndexTTS. Pour les jeux pixel-art, la tendance « bip-bip Animalese » se fait par DSP, pas par TTS.

### 2.6 Traitement, outillage, contrôle qualité

| Nom | URL | Licence | Langage | Usage | Notes |
|---|---|---|---|---|---|
| **pyloudnorm** | github.com/csteinmetz1/pyloudnorm | MIT ✅ | Python | LUFS ITU-R BS.1770-4, normalisation loudness/peak, LRA (v0.2.0 janv. 2026) | Cible jeu : SFX −16 à −12 LUFS, musique −14 à −16, true-peak −1 dBTP. |
| **librosa** | librosa.org | ISC ✅ | Python | `beat_track`, `onset_detect`, `pitch_shift`, `time_stretch`, `effects.trim`, zero-crossings | Cœur du loop-maker et des variations. |
| **torchaudio** | pytorch.org/audio | BSD-2 ✅ | Python | I/O, resampling, effets (`sox_effects` déprécié → `torchaudio.functional`) | Déjà présent avec les modèles. |
| soundfile / pydub | — | BSD-3 / MIT ✅ | Python | Lecture/écriture WAV/FLAC/OGG ; manipulation simple | pydub dépend de ffmpeg. |
| **ffmpeg** | ffmpeg.org | LGPL-2.1 (GPL si options) ⚠️ | C | Conversion ogg/wav/mp3, `loudnorm`, `silenceremove`, `atrim` | Appeler en sous-processus (pas de contamination). |
| SoX | sourceforge.net/projects/sox | GPL-2 | C | Effets CLI | Remplaçable par ffmpeg/librosa. |
| pedalboard | github.com/spotify/pedalboard | **GPL-3 ⚠️** | Python | Réverbe, compresseur, pitch, VST3 ; 300× plus rapide que pySoX | Isoler en microservice si le backend n'est pas GPL. |
| **CLAP** (LAION) | github.com/LAION-AI/CLAP · huggingface.co/laion/clap-htsat-unfused | Code CC0 ; checkpoint HF **Apache 2.0 ✅** | Python (transformers `ClapModel`) | Score de similarité texte↔audio pour **trier N générations** ; **CPU OK** | Modèles « music » et « general » disponibles. |
| Web Audio API / Howler.js / audiosprite | howlerjs.com | MIT ✅ | JavaScript | Prévisualisation, audio-sprites (un fichier + table de timecodes) | Howler lit les sprites nativement. |
| libopenmpt | lib.openmpt.org | BSD-3 ✅ | C++ | Lecture de modules dans le jeu | Godot : GDExtension communautaire. |

---

## 3. Idées malines / astuces

1. **LLM → paramètres sfxr (la brique la plus rentable).** Les ~24 paramètres de sfxr (wave_type, p_base_freq, p_freq_ramp, p_env_attack/sustain/decay/punch, p_vib_*, p_arp_*, p_duty*, p_lpf_*, p_hpf_*, p_repeat_speed) sont un espace petit, borné [0–1] et sémantiquement lisible. Un LLM local (Qwen/Llama via Ollama) avec un **schéma JSON strict** et quelques exemples few-shot (« coffre qui s'ouvre = square, base_freq 0,35, arp_mod +0,4, decay 0,3 ») produit des sons cohérents à la description. Boucle : 8–16 candidats → rendu jsfxr/rfxgen (ms) → **score CLAP** contre la description → top-3 à l'utilisateur. Coût quasi nul, 100 % CPU, licence Unlicense/zlib.
2. **Mutations et « familles » de SFX.** À partir d'une recette sfxr validée, générer des variantes (±5 % base_freq, ±10 % decay, seed de bruit) pour éviter la répétition (pas, coups) : c'est la fonction « mutate » de sfxr, exposée par jsfxr.
3. **MIDI IA → SoundFont chiptune = 8/16-bit contrôlable.** Text2midi/AMT génèrent un MIDI avec tempo et tonalité explicites ; on rend ensuite avec (a) un SoundFont « NES/Game Boy » via FluidSynth, (b) FamiStudio CLI pour un rendu 2A03 authentique (et un NSF jouable sur vraie console), (c) Tone.js (pulse 12,5/25/50 %, triangle, noise) côté navigateur. Même MIDI → trois « skins sonores » (NES, SNES-like, orchestral) sans re-générer.
4. **Boucle parfaite par construction.** Générer N mesures entières à BPM fixe (ACE-Step 1.5 accepte BPM + durée ; en MIDI c'est trivial), couper à `N × 4 × 60/BPM` secondes, puis crossfade court (10–30 ms) entre fin et début ou coupe au zero-crossing le plus proche. Vérifier avec `librosa.beat.beat_track` que la grille tombe juste.
5. **« Stems » par prompt.** ACE-Step 1.5 en instrumental + repaint permet de générer une version « calme » et une version « combat » sur la même base (cover/repaint), utile pour la musique adaptative ; Magenta RealTime fait des transitions continues par changement de prompt.
6. **SAO Small en CPU comme « générateur de foley »** puis **post-traitement 8-bit** : downsample 11–22 kHz, quantification 8 bits, filtre passe-bas → un son réaliste devient « pixel ». Très efficace pour les ambiances (feu, eau, vent).
7. **Recettes plutôt que fichiers.** Stocker la recette (JSON sfxr, MIDI + SoundFont, prompt + seed + modèle + version) à côté du WAV : régénération gratuite, traçabilité de licence, et export « projet » léger.
8. **Audio-sprites automatiques** : concaténer les SFX d'une catégorie avec 100 ms de silence, produire la table JSON (Howler/Phaser/Godot), en un seul ogg.
9. **CLAP comme filet de sécurité de prompt** : un score bas signale un prompt mal compris par SAO (par ex. « sword slash » → bruit blanc) et déclenche une reformulation automatique.
10. **DSP « voix de monstre » composable** : pipeline déclaratif (pitch −7 demi-tons → ring mod 45 Hz → bitcrush 6 bits → réverbe caverne) appliqué à une voix Kokoro/Chatterbox : des dizaines de personnages sans clonage ni modèle lourd.

---

## 4. Pipelines d'assemblage recommandés

### 4.1 Pipeline « SFX »

```
Description utilisateur ("coffre en bois qui s'ouvre, style 16-bit")
        │
        ├─► Voie A — procédural (défaut pixel-art, CPU, < 100 ms)
        │     LLM local → JSON sfxr (×12) → jsfxr/rfxgen → CLAP rerank → 3 propositions
        │     └─ mutate/variations → normalisation LUFS → export wav/ogg
        │
        ├─► Voie B — IA réaliste (GPU 8 Go ou CPU lent)
        │     Stable Audio Open Small (11 s, 8 steps) ×4 seeds
        │     → trim silence (librosa.effects.trim) → coupe onset → CLAP rerank
        │     → (option) « pixelisation » : downsample + 8-bit + LPF
        │     → LUFS/peak → export
        │
        └─► Voie C — API (plan B) : ElevenLabs SFX v2 [PROPRIÉTAIRE]
```

- **GPU 8 Go** : SAO Small résident (~2 Go) + CLAP (~0,6 Go) ; SAO 1.0 chargé à la demande pour les ambiances de 30–47 s (fp16 ≈ 6 Go, décharger avant de charger un modèle musique).
- **CPU seul** : voie A illimitée ; SAO Small en CPU (quelques secondes à quelques dizaines de secondes par son selon le processeur — la référence Arm est « < 8 s sur smartphone ») ; SAO 1.0 déconseillé en CPU.
- **API** : ElevenLabs pour les sons que ni sfxr ni SAO ne réussissent (voix de foule, objets très spécifiques).

### 4.2 Pipeline « musique »

```
Brief ("boucle exploration, 110 BPM, la mineur, chiptune NES, 16 mesures")
        │
        ├─► Voie symbolique (recommandée pour chiptune, CPU)
        │     Text2midi / Anticipatory MT → MIDI (tempo, tonalité fixés)
        │     → quantisation, coupe à N mesures, transposition éventuelle
        │     → rendu : FluidSynth + SoundFont chip | FamiStudio CLI (NES) | Tone.js (preview)
        │     → boucle parfaite (longueur = mesures entières) → LUFS → ogg
        │     → export bonus : .mid, .nsf, .fms, .xm (via OpenMPT si module)
        │
        ├─► Voie audio directe (GPU 8 Go, style « réaliste »/lo-fi/orchestral)
        │     ACE-Step 1.5 turbo 2B (instrumental, BPM/key/durée) ×3
        │     → détection de grille (librosa.beat) → coupe/crossfade → CLAP → LUFS → ogg
        │     Alternatives : Stable Audio Open 1.0 (boucles ≤ 47 s), DiffRhythm 2 (chanson chantée),
        │                    Magenta RealTime (musique continue, poids CC-BY → crédit à ajouter)
        │
        └─► API [PROPRIÉTAIRE] : Suno / Udio / Stable Audio 2.5 / Soundraw (référence)
```

- **GPU 8 Go** : ACE-Step 1.5 turbo 2B + LM 0,6 B (≤ 6 Go) ; ne pas co-résider avec SAO 1.0. DiffRhythm base en mode chunké si besoin de chant.
- **CPU seul** : voie symbolique intégrale ; ACE-Step 1.5 tourne en CPU mais compter plusieurs minutes par morceau (M2 Max : ~26 s par minute d'audio pour v1).
- **Apple Silicon** : Magenta RealTime 2 small (230 M) temps réel.

### 4.3 Pipeline « voix »

```
Texte + fiche personnage ("gobelin nasillard, français")
   → TTS : Kokoro (CPU, fr) | Chatterbox (émotion, clonage, MIT) | Qwen3-TTS 0,6B (voice design)
   → (option) RVC pour décliner un timbre consenti
   → DSP personnage : pitch/formant, ring-mod, bitcrush, réverbe (librosa/scipy/torchaudio)
   → trim, LUFS −16, export ogg mono
   → (option pixel-art) « Animalese » : syllabes → bips sfxr à hauteur variable
```

- **GPU 8 Go** : Chatterbox 500 M ou Qwen3-TTS 1,7 B ; Dia (4,4 Go) pour l'anglais.
- **CPU seul** : Kokoro ONNX int8, Chatterbox Nano, Piper (GPL, sous-processus, vérifier licence de la voix).
- **API** : ElevenLabs (référence).

---

## 5. Ce qu'il faudrait développer soi-même

1. **`pysfxr`** : port NumPy de jsfxr (synthé + presets + mutate) — ~400 lignes, licence MIT ; sinon wrapper autour de `rfxgen` CLI ou de `node -e` avec jsfxr. Un port Python maintenu n'existe pas.
2. **Générateur « LLM → sfxr »** : schéma JSON (pydantic), few-shot par catégorie (UI, combat, mouvement, environnement), échantillonnage ×N, rerank CLAP, exposé en endpoint FastAPI ; front React avec jfxr pour l'édition fine et l'écoute instantanée.
3. **Loop-maker** : détection de tempo/grille, coupe à la mesure, zero-crossing, crossfade, test de continuité (énergie et spectre aux bords), score « boucle propre ».
4. **Post-processeur commun** : trim silence, dé-clic, fade, LUFS/true-peak, détection clipping/silence/DC offset, conversion ogg/wav (ffmpeg), audio-sprites + table JSON, export batch avec nommage par convention (`sfx_jump_01.ogg`).
5. **Rendu chiptune serveur** : orchestration FluidSynth (SoundFonts sélectionnés CC0/MIT), FamiStudio CLI (import MIDI → export WAV/NSF), et un mini-synthé NumPy « NES-like » (pulse/triangle/noise + enveloppes) pour ne dépendre d'aucun binaire.
6. **Gestionnaire de modèles GPU** : file de jobs, un seul modèle résident, chargement/déchargement fp16, fallback CPU, quantisation (bitsandbytes/GGUF) ; profils « 8 Go » / « CPU » / « API ».
7. **Registre de provenance et de licence** : pour chaque asset, modèle + version + licence + seuil (Stability < 1 M$), prompt, seed, recette ; génération automatique d'un fichier `CREDITS.md` (attribution CC-BY pour Magenta RT, Kyutai ; mention PerTh Chatterbox).
8. **Bibliothèque d'effets DSP « personnage »** en pur Python (scipy/numpy) pour éviter la GPL de pedalboard : pitch/formant, ring-mod, bitcrush, réverbe convolutive (RI CC0), compresseur simple.
9. **Prompts et presets** : bibliothèque de prompts SAO/ACE-Step testés (« 8-bit », « retro game », « coin pickup », « lo-fi hip hop loop 85 bpm ») avec leurs scores CLAP moyens, pour guider l'utilisateur.
10. **Évaluation continue** : jeu de 50 descriptions de référence, génération périodique, CLAP + écoute humaine, pour suivre les régressions lors des mises à jour de modèles.

---

## 6. Sources

- Stable Audio Open Small — https://huggingface.co/stabilityai/stable-audio-open-small · annonce Stability/Arm — https://stability.ai/news/stability-ai-and-arm-release-stable-audio-open-small-enabling-real-world-deployment-for-on-device-audio-control · article ARC — https://arxiv.org/abs/2505.08175
- Stable Audio Open 1.0 — https://huggingface.co/stabilityai/stable-audio-open-1.0 · Stability AI Community License — https://stability.ai/license · stable-audio-tools (MIT) — https://github.com/Stability-AI/stable-audio-tools
- AudioCraft (MusicGen/AudioGen/MAGNeT/JASCO/MelodyFlow) — https://github.com/facebookresearch/audiocraft · https://huggingface.co/facebook/musicgen-small · https://huggingface.co/facebook/jasco-chords-drums-melody-1B · https://huggingface.co/facebook/melodyflow-t24-30secs
- TangoFlux — https://huggingface.co/declare-lab/TangoFlux · Tango 2 — https://huggingface.co/declare-lab/tango2
- AudioLDM — https://github.com/haoheliu/AudioLDM · AudioLDM 2 — https://huggingface.co/cvssp/audioldm2 · MusicLDM — https://huggingface.co/ucsd-reach/musicldm
- MMAudio — https://github.com/hkchengrex/MMAudio · ThinkSound — https://github.com/FunAudioLLM/ThinkSound · AudioX — https://github.com/ZeyueT/AudioX · EzAudio — https://github.com/haidog-yaqub/EzAudio · Make-An-Audio 2 — https://github.com/Text-To-Audio/Make-An-Audio-2
- ACE-Step v1 — https://github.com/ace-step/ACE-Step · ACE-Step 1.5 — https://github.com/ace-step/ACE-Step-1.5 · https://huggingface.co/ACE-Step/Ace-Step1.5
- YuE — https://github.com/multimodal-art-projection/YuE · DiffRhythm — https://github.com/ASLP-lab/DiffRhythm · DiffRhythm 2 — https://github.com/ASLP-lab/DiffRhythm2
- Magenta RealTime — https://github.com/magenta/magenta-realtime · https://huggingface.co/google/magenta-realtime · https://huggingface.co/google/magenta-realtime-2 · Magenta (archivé) — https://github.com/magenta/magenta
- InspireMusic — https://github.com/FunAudioLLM/InspireMusic · SongGen — https://github.com/LiuZH-19/SongGen · HeartMuLa — https://github.com/HeartMuLa/heartlib · https://huggingface.co/HeartMuLa/HeartMuLa-oss-3B
- Anticipatory Music Transformer — https://github.com/jthickstun/anticipation · Text2midi — https://github.com/AMAAI-Lab/Text2midi · NotaGen — https://github.com/ElectricAlexis/NotaGen
- sfxr — https://www.drpetter.se/project_sfxr.html · jsfxr — https://github.com/chr15m/jsfxr · jfxr — https://github.com/ttencate/jfxr · rfxgen — https://github.com/raysan5/rfxgen · Bfxr — https://github.com/increpare/bfxr · Bfxr2 — https://github.com/increpare/bfxr2 · usfxr — https://github.com/zeh/usfxr · topic sfxr — https://github.com/topics/sfxr
- FluidSynth — https://github.com/FluidSynth/fluidsynth · FamiStudio — https://github.com/BleuBleu/FamiStudio (CLI : Docs/docs/cmdline.md) · Furnace — https://github.com/tildearrow/furnace · OpenMPT/libopenmpt — https://github.com/OpenMPT/openmpt · Bosca Ceoil Blue — https://github.com/YuriSizov/boscaceoil-blue · Tone.js — https://github.com/Tonejs/Tone.js · Sonic Pi — https://github.com/sonic-pi-net/sonic-pi · Strudel — https://github.com/tidalcycles/strudel (→ codeberg.org/uzu/strudel)
- Kokoro — https://github.com/hexgrad/kokoro · kokoro-onnx — https://github.com/thewh1teagle/kokoro-onnx · Chatterbox — https://github.com/resemble-ai/chatterbox · Dia — https://github.com/nari-labs/dia · Qwen3-TTS — https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base · VoxCPM — https://github.com/OpenBMB/VoxCPM · Orpheus — https://huggingface.co/canopylabs/orpheus-3b-0.1-ft · Kyutai — https://github.com/kyutai-labs/delayed-streams-modeling · Bark — https://github.com/suno-ai/bark
- Piper — https://github.com/rhasspy/piper (archivé) · piper1-gpl — https://github.com/OHF-Voice/piper1-gpl · voix — https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md
- F5-TTS — https://github.com/SWivid/F5-TTS · Fish Speech — https://github.com/fishaudio/fish-speech · IndexTTS — https://github.com/index-tts/index-tts · XTTS v2 — https://huggingface.co/coqui/XTTS-v2 · RVC — https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
- pedalboard — https://github.com/spotify/pedalboard · pyloudnorm — https://github.com/csteinmetz1/pyloudnorm · CLAP — https://github.com/LAION-AI/CLAP · https://huggingface.co/laion/clap-htsat-unfused
- ElevenLabs SFX API `[PROPRIÉTAIRE]` — https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
