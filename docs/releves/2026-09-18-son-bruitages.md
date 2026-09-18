# Bruitages, ambiances et sons d'interface en local (ComfyUI) — recherche du 18 septembre 2026

> Complète `revue-externe-2026-09-02/research/09-audio.md` (§2.1, 2.3, 2.6, 3, 4.1) sans la refaire.
> Cible : Windows 11, ComfyUI Desktop sans nœud audio, **RTX 3080 Laptop 8 Go**, jeu vendu, auteur en France (UE — ça compte, voir Hunyuan).
> Légende : ✅ commercial OK · ⚠️ sous conditions · ❌ interdit. « non vérifié » = pas trouvé de source directe.
>
> **Constaté sur la machine le même jour, après ce relevé** : le ComfyUI en service est la
> version 0.36.0 ; ACE-Step 1.5 y est natif ; un nœud audio y est déjà installé
> (`comfyui_stableaudio_open`, pour Stable Audio Open 1.0) ; tous les nœuds du modèle de
> workflow officiel de Stable Audio 3 sont natifs.

---

## 0. En une phrase

Depuis le 20 mai 2026, **Stable Audio 3 Small-SFX** est le bon moteur : pris en charge nativement par ComfyUI, entraîné uniquement sur des données sous licence, ~2 Go de VRAM, 8 pas, sorties à nous (licence communautaire Stability, gratuite sous 1 M$ de CA). Côté vidéo-vers-son, **aucun modèle n'est utilisable pour un jeu vendu depuis l'UE** : on synchronise plutôt les bruitages sur les **images clés de l'animation**, que l'atelier connaît déjà.

---

## 1. Corrections et compléments à la recherche du 2 septembre

| Point du 2 sept. | Correction / complément | Source |
|---|---|---|
| « SAO Small = choix n°1 SFX » | **Dépassé.** SAO Small n'a pas de support natif ComfyUI (seulement stable-audio-tools). Remplacé par **Stable Audio 3 Small-SFX** (0,6 Md de paramètres, natif ComfyUI, données sous licence). | https://huggingface.co/stabilityai/stable-audio-open-small/discussions/4 · https://blog.comfy.org/p/stable-audio-3-day-0-support |
| §2.1 ne cite pas Stable Audio 3 | Ajouté (§2). Existence **confirmée** (piste 1 de l'auteur). | https://github.com/Stability-AI/stable-audio-3 · https://arxiv.org/html/2605.17991v1 |
| AudioLDM 2 « CC-BY-NC-SA » | **Confirmé ❌** : la fiche HF porte `cc-by-nc-sa-4.0` ; 16 kHz ; trois variantes (base, large, music). Qu'il tienne en < 5 Go ne change rien (piste 2 tranchée). | https://huggingface.co/cvssp/audioldm2 |
| EzAudio : poids « à vérifier » | La fiche HF `OpenSound/EzAudio` porte **MIT** → poids ✅ ; données AudioSet/YouTube → risque diffus ⚠️. Pas de nœud ComfyUI trouvé (non vérifié). | https://huggingface.co/OpenSound/EzAudio · https://github.com/haidog-yaqub/EzAudio |
| « Port Python de sfxr : n'existe pas » | **Faux.** `pyfxr` (lordmauve) : BSD-3, Cython, roues précompilées Windows sur PyPI, sfxr complet + tons purs + Karplus-Strong. | https://github.com/lordmauve/pyfxr · https://pyfxr.readthedocs.io/en/stable/ |
| CLAP : seul LAION cité | **MS-CLAP** (Microsoft) : MIT, `pip install msclap`, 93,9 % sur ESC50 — mais **archivé le 15 sept. 2026** (lecture seule). | https://github.com/microsoft/CLAP |
| Nouveaux modèles 2026 | **Woosh** (Sony, avril 2026) : code MIT, **poids CC-BY-NC ❌**. **ControlFoley** (Xiaomi, juil. 2026) : poids **CC-BY-NC 4.0 ❌**. | https://github.com/SonyResearch/Woosh · https://huggingface.co/YJX-Xiaomi/ControlFoley |
| « Audiyo » (piste 3) | **Existe** : bibliothèque Apache 2.0 (v0.3.3, 13 commits, 3 étoiles, 11 sept. 2026) ; SAO 1.0 de 13,8 Go (diffusers brut) à 5,86 Go (mode équilibré) ou 3,10 Go. **Intérêt faible** : hors ComfyUI, très jeune, et le chiffre de base est celui de diffusers, pas de ComfyUI. SA3 rend SAO 1.0 secondaire. | https://huggingface.co/blog/Monster-Code/audiyo-release · https://github.com/TeamAudiyo/Audiyo |

---

## 2. Texte-vers-son en local

| Modèle | Poids / sorties | VRAM | Durée max | Qualité SFX | ComfyUI |
|---|---|---|---|---|---|
| **Stable Audio 3 Small-SFX** (mai 2026) | Stability Community ⚠️ (gratuit < 1 M$ CA ; « you own your outputs ») ; accès sur HF soumis à accord ; dépend de l'encodeur **T5Gemma** → conditions Gemma à accepter ⚠️ | **1,69 Go (5 s) → 2,40 Go (120 s)** ; tourne aussi sur CPU | 120 s | Meilleur que SAO et Woosh Flow selon le rapport technique (FAD et CLAP sur SFX de 5 s) ; un testeur trouve SAO 1.0 parfois « meilleur » à l'oreille | **Natif** (ComfyUI ≥ 0.22) ; modèles `stable_audio_3_small_sfx.safetensors` (2,3 Go) → `models/checkpoints/`, `t5gemma_b_b_ul2.safetensors` (1,2 Go) → `models/text_encoders/` ; modèle d'aperçu : Modèles → Audio |
| **Stable Audio 3 Small-Music** | idem ⚠️ | idem | 120 s | Boucles musicales, stingers | Natif |
| **Stable Audio 3 Medium** (1,4 Md) | idem ⚠️ ; + encodeur `qwen3.5_2b_bf16` | **5,07 Go (5 s) · 5,49 Go (30 s) · 6,49 Go (120 s) · 6,52 Go (380 s)** ; ~5,14 Go à 120 s en décodage par morceaux | 380 s (6 min 20) | Orienté musique ; meilleur score SFX du rapport | Natif (`stable_audio_3_medium.safetensors`) |
| Stable Audio 3 Large (2,7 Md) | API seulement | — | — | — | — |
| **Stable Audio Open 1.0** | Stability Community ⚠️ | ~6 Go fp16 (ComfyUI : non mesuré) | 47 s | Bon en SFX et ambiances (« mieux en bruitages qu'en musique » selon la fiche) | **Natif** : `CheckpointLoaderSimple` + `CLIPLoader` (t5-base) + `EmptyLatentAudio` + `KSampler` + `VAEDecodeAudio` ; `stable-audio-open-1.0.safetensors` → `checkpoints/`, `t5-base.safetensors` → `text_encoders/` |
| Stable Audio Open Small | Stability Community ⚠️ | ~2 Go | 11 s | Bon | **Pas de natif** ; remplacé par SA3 Small-SFX |
| ACE-Step 1.5 (Text2Samples) | MIT / MIT ✅ | ≤ 6 Go (turbo) | variable | Échantillons musicaux (kicks, stabs, jingles), pas du foley | ACE-Step est natif dans ComfyUI (v1 confirmé ; 1.5 non vérifié) |
| EzAudio | MIT / MIT ✅, données AudioSet ⚠️ | non vérifié | non vérifié | Correcte, sait faire l'inpainting | Aucun nœud trouvé |
| Bark | MIT ✅ | 2–12 Go | 13 s | Grognements, cris « vocaux » | Nœuds tiers (non vérifié) |
| TangoFlux / Tango 2 | ❌ non commercial | — | — | — | — |
| AudioLDM 2 | ❌ CC-BY-NC-SA | — | — | — | — |
| AudioX | ❌ CC-BY-NC, sorties tatouées | — | — | — | — |
| Woosh (Flow / DFlow) | ❌ CC-BY-NC | — | — | — | — |

Sources : https://github.com/Stability-AI/stable-audio-3 (tableau VRAM, durées, licence) · https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models (sorties possédées, données sous licence) · https://huggingface.co/stabilityai/stable-audio-3-small-sfx (licence, accès sur accord, Gemma, 8 pas) · https://huggingface.co/Comfy-Org/stable-audio-3 (liste des fichiers) · https://docs.comfy.org/tutorials/audio/stable-audio/stable-audio-3 · https://jurn.link/dazposer/index.php/2026/05/22/how-to-install-stable-audio-3-0-small-sfx-safetensors-and-run-it-in-comfyui/ · https://docs.comfy.org/tutorials/audio/stable-audio/stable-audio-1 · https://huggingface.co/stabilityai/stable-audio-open-1.0 · https://github.com/ZeyueT/AudioX · https://huggingface.co/declare-lab/TangoFlux

Points à contrôler sur la machine :
- **Fréquence d'échantillonnage de Small-SFX** : le rapport technique annonce du stéréo 44,1 kHz pour la famille ; une lecture automatique de la fiche HF a donné « 16 kHz » (le `model_config.json` est derrière l'accord) — **à vérifier** au premier rendu.
- **Échantillonneur ping-pong** : un tutoriel dit qu'il faut ajouter un fichier `pingpongsampler_node.py` dans `custom_nodes` ; Comfy parle d'un modèle prêt à l'emploi. **Non tranché** : charger le modèle d'aperçu officiel et voir s'il manque un nœud.
- **ComfyUI Desktop** suit les versions stables : au lancement, SA3 demandait la Nightly. Vérifier que la version Desktop installée est ≥ 0.22.
- Le nœud « Stable Audio Sampler » cité par l'auteur est un **nœud tiers ancien** (`DataCTE/ComfyUI-StableAudioSampler`, pour SAO 1.0) — pas le chemin natif SA3. https://github.com/DataCTE/ComfyUI-StableAudioSampler
- aivideobootcamp.com : guide grand public, rien trouvé qui ne soit déjà sur le dépôt officiel ; non retenu comme source.

---

## 3. Vidéo-vers-son (bruitage synchronisé sur un clip de sprite)

### 3.1 État des modèles

| Modèle | Poids | VRAM | Durée | ComfyUI | Verdict |
|---|---|---|---|---|---|
| **HunyuanVideo-Foley** (Tencent, août 2025) | *Tencent Hunyuan Community License* — **ne s'applique pas dans l'UE, au Royaume-Uni ni en Corée du Sud** ; interdit d'utiliser les sorties « hors territoire » ; exige de signaler un contenu généré par machine | XXL : 20 Go (12 Go déchargé) ; XL : 16 Go (8 Go déchargé) ; fp8 : < 8 Go ; + échange de blocs : < 4 Go (5 s d'audio en ~60 s) | non documentée | Tiers : `phazei/ComfyUI-HunyuanVideo-Foley` (5 nœuds, modèles dans `models/foley/`), `if-ai/…`, `aistudynow/…` | **❌ pour un auteur en France** (aucune licence accordée dans l'UE) |
| **MMAudio** | code MIT, **poids CC-BY-NC 4.0 ❌** ; données AudioSet/VGGSound | ~6 Go fp16 | 8 s (entraînement) | Tiers `kijai/ComfyUI-MMAudio` (fp16/fp8, fichiers `mmaudio_large_44k_v2_fp16`, `mmaudio_synchformer_fp16`, `mmaudio_vae_44k_fp16`, `apple_DFN5B-CLIP…fp16`) | ❌ |
| **ThinkSound** / PrismAudio | « Commercial use is NOT permitted » + VAE SAO | non documentée | — | — | ❌ |
| **ControlFoley** (Xiaomi, juil. 2026) | CC-BY-NC 4.0 ❌ | non documentée | — | Nœuds officiels `YJX-Research/comfyui-controlfoley-official` | ❌ |
| **Woosh-VFlow / DVFlow** (Sony) | CC-BY-NC ❌ | non documentée | — | Non | ❌ |
| **AudioX** | CC-BY-NC ❌, tatoué | — | — | — | ❌ |
| **Kling-Foley** | **poids non publiés** (dépôt = article + jeu d'évaluation) | — | — | — | Inutilisable |
| **LTX-2.3 Foley V2A** (LoRA Lightricks) | *LTX-2 Community License* : gratuit sous 10 M$ de CA ⚠️ ; mais la fiche signale des données FoleyBench **CC-BY-NC-SA** | Base de **22 Md de paramètres** : hors budget 8 Go (GGUF non vérifié) | ~7 s | Flux de travail fourni (nœuds LTX + VideoHelperSuite) | ⚠️ juridiquement flou, ❌ matériellement |
| **MiniMax H3** (août 2026) | ouvert pour le non-commercial ; **licence commerciale payante** (revendue par Comfy) | non documentée | 15 s | Natif | ⚠️ payant, modèle vidéo complet |

Sources : https://github.com/Tencent-Hunyuan/HunyuanVideo-Foley · https://raw.githubusercontent.com/Tencent-Hunyuan/HunyuanVideo-Foley/main/LICENSE · https://github.com/phazei/ComfyUI-HunyuanVideo-Foley · https://github.com/hkchengrex/MMAudio · https://github.com/kijai/ComfyUI-MMAudio · https://github.com/FunAudioLLM/ThinkSound · https://huggingface.co/YJX-Xiaomi/ControlFoley · https://github.com/SonyResearch/Woosh · https://github.com/klingfoley/Kling-Foley · https://huggingface.co/Lightricks/LTX-2.3-22b-LoRA-Foley-V2A · https://ltx.io/model/license · https://comfyui-wiki.com/en/news/2026-08-30-comfy-minimax-license

### 3.2 Et sur du pixel art ?

**Aucune source trouvée** qui mesure ces modèles sur des sprites (non vérifié). Raisons de douter : ils sont entraînés sur des vidéos réelles (VGGSound, AudioSet) ; leur synchroniseur (Synchformer) lit ~25 images/s alors qu'une animation de sprite en a 8 à 12 avec des images tenues ; un clip de sprite est une boucle de 0,5 à 1 s sur fond uni, sans contexte de scène.

### 3.3 Ce qui marche à la place : synchroniser sur les images clés

L'atelier sait déjà quelle image de l'animation porte le contact (pied au sol, lame qui touche, coffre qui s'ouvre). Donc :
1. marquer ces images dans la fiche de l'animation (« image 3 : pas », « image 5 : impact ») ;
2. fabriquer des sons courts isolés (SA3 Small-SFX ou sfxr) ;
3. livrer **les sons + le repère de temps** (image n / fps), pas une vidéo sonorisée. Dans Godot, une piste audio ou une piste de méthode de l'`AnimationPlayer` déclenche le son à l'image voulue.

C'est de toute façon ce qu'il faut pour un jeu : le moteur choisit la variante, la surface sous le pied et le volume au moment de jouer. Un son « cuit » dans le clip empêche tout cela.

Si l'on veut quand même tester le vidéo-vers-son : **MMAudio via kijai** en usage privé d'évaluation seulement (poids non commerciaux : aucun son produit ne doit finir dans le jeu), pour voir ce que donne un sprite. Coût : ~6 Go, gratuit.

---

## 4. Variantes, retouche, transformation d'un son existant

| Besoin | Moyen | Licence | Où |
|---|---|---|---|
| 5 variantes d'un même pas | (a) 5 graines sur le même prompt SA3 ; (b) **son-vers-son** SA3 à bruit faible (`init_noise_level` ~0,8–0,9 d'après le dépôt ; plus bas = plus proche de l'original — non vérifié en ComfyUI) ; (c) **DSP** : hauteur ±1–2 demi-tons, gain ±2 dB, étirement ±5 % (librosa, ISC) | ⚠️ / ISC ✅ | SA3 : dépôt officiel ; ComfyUI : SAO 1.0 accepte un latent encodé (`VAEEncodeAudio` + `KSampler` avec denoise < 1 — nœud natif, réglages non vérifiés) |
| Inpainting (refaire la fin d'un son, prolonger) | **SA3** : un ou plusieurs segments masqués, continuation | ⚠️ | Dépôt SA3 ✅ ; en ComfyUI **non vérifié** |
| Inpainting (alternative) | **EzAudio** (`editing_audio`, masque début/longueur) | MIT ✅ / données ⚠️ | Python seul |
| Changer le style (« même coup, mais métallique ») | Son-vers-son SA3 guidé par le prompt | ⚠️ | Dépôt SA3 |
| Variantes 8-bit | **mutation sfxr** (± petites valeurs sur les paramètres) | BSD-3 / Unlicense ✅ | pyfxr, jsfxr |

Sources : https://github.com/Stability-AI/stable-audio-3 · https://github.com/haidog-yaqub/EzAudio · https://librosa.org

Le plus simple et le plus fiable pour les pas : **une bonne prise × variation DSP à la lecture** (Godot `AudioStreamRandomizer` fait déjà hauteur et volume aléatoires — non vérifié ici, voir la doc Godot).

---

## 5. Synthèse procédurale (sans IA)

| Outil | Licence | Depuis Python | Intérêt |
|---|---|---|---|
| **pyfxr** | BSD-3 ✅ | **Oui, natif** (`pip install pyfxr`, roues Windows) ; sfxr + tons + Karplus-Strong ; préréglages type `jump()`, `explosion()` ; export WAV direct non confirmé → `soundfile`/`scipy.io.wavfile` sur le tampon | **Moteur 8-bit par défaut côté serveur** |
| jsfxr | Unlicense ✅ | Via Node en sous-processus | Aperçu instantané dans l'interface React |
| jfxr | BSD-3 ✅ | Via Node | Plus de réglages (filtres, bitcrush) |
| rfxgen | zlib ✅ | CLI en sous-processus | Recettes `.rfx` de 104 octets |
| Bfxr2 | MIT ✅ | Non (web) | **Générateur de pas** intégré |
| ChipTone | gratuit, **propriétaire** | Non | Référence d'ergonomie seulement ; sons produits utilisables (conditions exactes non vérifiées) |

Sources : https://github.com/lordmauve/pyfxr · https://github.com/chr15m/jsfxr · https://github.com/ttencate/jfxr · https://github.com/raysan5/rfxgen · https://github.com/increpare/bfxr2 · https://sfbgames.itch.io/chiptone

Pour les **sons d'interface** (clic, validation, erreur, survol) sfxr est souvent meilleur que l'IA : attaque nette, zéro souffle, 50 à 300 ms exactement, cohérence d'une famille à l'autre (même onde, hauteurs différentes).

---

## 6. Écrire un prompt qui donne un son court, sec, centré

### 6.1 Ce que disent les sources

- SA3 : structure **source → action → prise de son** (placement du micro, pièce, traitement) ; mettre **`TrackType: SFX`** ; **fixer une durée courte** avant de générer. https://github.com/Stability-AI/stable-audio-3 (guide « prompting », dossier guides de la doc du dépôt)
- Jordi Pons (Stability) : garder les SFX courts ; « 44.1kHz », « high-quality », « Stereo » améliorent le rendu ; générer plusieurs essais par prompt et trier. https://www.jordipons.me/on-prompting-stable-audio/
- SAO 1.0 : négatif recommandé `low quality, average quality` (doc diffusers). https://huggingface.co/docs/diffusers/api/pipelines/stable_audio
- SAO est entraîné sur des descriptions **en anglais** uniquement. https://huggingface.co/stabilityai/stable-audio-open-1.0

### 6.2 Règles pratiques

| Réglage | SA3 Small-SFX | SAO 1.0 |
|---|---|---|
| Pas | **8** | 100 (fiche) ; 50 est courant (non vérifié) |
| CFG | **1,0** | 7 |
| Échantillonneur | ping-pong | dpmpp-3m-sde (sigma 0,3 → 500) |
| **Prompt négatif** | **sans effet à CFG 1** (le négatif ne sert qu'avec un guidage > 1) | utile : `low quality, average quality, reverb, room tone, background noise, music, speech` (les mots après `average quality` : non vérifiés) |
| Durée demandée | UI : 1 s · coup, pas, objet : 1–2 s · sort, créature : 2–4 s · ambiance : 20–60 s | idem ; ne jamais laisser 47 s par défaut pour un bruitage |

Mots qui orientent vers « sec et proche » (tirés du guide SA3 pour la logique micro/pièce ; efficacité mot par mot **non vérifiée**, à mesurer au CLAP) : `one-shot`, `single hit`, `isolated`, `close-mic'd`, `dry`, `no reverb`, `anechoic`, `tight`, `fast decay`, `mono`, `foley`, `sound effect`, `clean`, `44.1kHz high-quality`. Pour une boucle d'ambiance : `continuous`, `steady`, `field recording`, `seamless loop` (ce dernier : non vérifié).

Toujours après génération : couper le silence, fondu de 5 ms, passage en mono pour les bruitages ponctuels (le « centré » se fait au rendu, pas au prompt).

### 6.3 Douze prompts d'exemple (SA3 Small-SFX, anglais)

| # | Catégorie | Durée | Prompt |
|---|---|---|---|
| 1 | Interface — clic | 1 s | `TrackType: SFX. Soft plastic UI button click, single short tick, close-mic'd, dry, no reverb, isolated, fast decay` |
| 2 | Interface — validation | 1 s | `TrackType: SFX. Bright two-note confirmation chime, clean synth bell, rising interval, dry, short tail, game menu sound` |
| 3 | Interface — erreur | 1 s | `TrackType: SFX. Low dull buzzer, short negative error beep, two quick descending tones, dry, isolated` |
| 4 | Coup d'épée | 1,5 s | `TrackType: SFX. Steel sword slash whoosh followed by a sharp metal impact, one-shot, close-mic'd foley, dry, punchy transient` |
| 5 | Impact contondant | 1 s | `TrackType: SFX. Heavy wooden club hitting a leather armor, dull thud, single hit, close-mic'd, no room reverb` |
| 6 | Pas — herbe | 1 s | `TrackType: SFX. Single footstep of a leather boot on dry grass, soft crunch, close-mic'd foley, isolated, dry` |
| 7 | Pas — pierre | 1 s | `TrackType: SFX. Single footstep of a hard boot on stone floor, sharp tap with slight grit, close-mic'd, dry, no echo` |
| 8 | Objet ramassé | 1 s | `TrackType: SFX. Small gold coin pickup, bright metallic clink with a short sparkle, one-shot, clean, dry` |
| 9 | Sort de feu | 2,5 s | `TrackType: SFX. Fireball spell cast, quick whoosh ignition building into a roaring burst of flame, one-shot, punchy, no background` |
| 10 | Créature | 2 s | `TrackType: SFX. Small cave creature hiss and chitter, wet clicking insect-like sounds, non-vocal, close-mic'd, dry` |
| 11 | Ambiance — forêt | 30 s | `TrackType: SFX. Calm forest ambience, gentle wind in leaves, distant birds, steady and continuous, no music, field recording, stereo` |
| 12 | Ambiance — pluie / grotte | 30 s | `TrackType: SFX. Steady rain on stone, water drips echoing in a cave, continuous ambience, no thunder, no music, stereo field recording` |

Pour le 8-bit, ne pas passer par le prompt : **sfxr** (§5), ou en secours `TrackType: SFX. 8-bit retro video game coin pickup, square wave arpeggio, chiptune` puis bitcrush (non vérifié en qualité).

---

## 7. Contrôle qualité automatique, en local

| Contrôle | Outil | Licence | Méthode |
|---|---|---|---|
| Le son correspond-il au texte ? | **LAION-CLAP** (`laion/clap-htsat-unfused` via transformers) | code CC0, poids Apache 2.0 ✅ | similarité texte↔audio ; garder les 2–3 meilleurs sur 8 tirages |
| idem, second avis | **MS-CLAP** (`msclap`) | MIT ✅ — **archivé le 15 sept. 2026** | idem ; figé, donc stable mais sans correctifs |
| Silence / son vide | librosa (`effects.trim`, RMS) | ISC ✅ | rejeter si durée utile < 50 ms ou RMS < −50 dBFS |
| Saturation | numpy | BSD ✅ | rejeter si > 0,1 % d'échantillons à |x| ≥ 0,999 |
| Volume perçu | **pyloudnorm** | MIT ✅ | SFX −16 à −12 LUFS, ambiances ~−20 à −18 LUFS (valeurs d'usage, non normées), crête vraie ≤ −1 dBTP |
| Boucle qui claque | maison (numpy) | — | comparer les 20 derniers ms aux 20 premiers : saut d'échantillon, écart RMS, écart de centroïde spectral ; corriger par fondu enchaîné 20–50 ms ou coupe au passage par zéro |
| Débruitage | **noisereduce** | MIT ✅ | soustraction spectrale, CPU |
| Débruitage (neuronal) | **DeepFilterNet** | MIT ou Apache 2.0 ✅ | conçu pour la voix : tester sur bruitages (non vérifié) |
| Suppression de réverb | **nara_wpe** (WPE) | MIT ✅ | conçu pour la parole ; efficacité sur SFX non vérifiée ; en pratique mieux vaut ne pas générer de réverb (prompt + coupe de queue) |
| Effets tout-en-un | pedalboard | **GPL-3 ⚠️** | à isoler en sous-processus ou éviter |
| Conversion, `loudnorm`, `silenceremove` | ffmpeg | LGPL/GPL ⚠️ | sous-processus uniquement |

Sources : https://huggingface.co/laion/clap-htsat-unfused · https://github.com/microsoft/CLAP · https://github.com/csteinmetz1/pyloudnorm · https://github.com/timsainb/noisereduce/blob/master/LICENSE · https://github.com/Rikorose/DeepFilterNet · https://github.com/fgnt/nara_wpe · https://github.com/spotify/pedalboard

---

## 8. Recommandation par catégorie

| Catégorie | Moteur principal | Secours | Risques |
|---|---|---|---|
| **Interface** (clic, validation, erreur) | **sfxr** via pyfxr (serveur) + jsfxr (aperçu) | SA3 Small-SFX, prompts 1–3 | Presque aucun ; garder une famille cohérente (même onde) |
| **Impacts, coups, armes** | **SA3 Small-SFX** (1–2 s, 8 tirages, CLAP) | SAO 1.0 (CFG 7 + négatif) ; sfxr pour un rendu rétro | Transitoires mous ; queue de réverb → couper |
| **Pas sur surfaces** | **SA3 Small-SFX** : une prise par surface, puis variantes DSP à la lecture | Générateur de pas de Bfxr2 ; son-vers-son SA3 | Répétition audible ; SA3 peut produire plusieurs pas au lieu d'un → demander 1 s, découper à l'onset |
| **Objets ramassés** | **sfxr** (pixel) ou SA3 (réaliste) | ACE-Step Text2Samples (jingles, MIT ✅) | Aucun notable |
| **Magie, sorts** | **SA3 Small-SFX** (2–4 s) | SAO 1.0 ; superposition sfxr + SA3 | Résultats très variables → plus de tirages |
| **Créatures non vocales** | **SA3 Small-SFX** | Bark (MIT) + DSP (hauteur, ring-mod) | Bark imprévisible ; éviter tout clonage de voix réelle |
| **Ambiances en boucle** (forêt, grotte, ville, pluie) | **SA3 Small-SFX** (jusqu'à 120 s) | SAO 1.0 (47 s) ; SA3 Medium si 6 Go libres | Boucle qui claque → fondu enchaîné + contrôle ; éléments saillants (oiseau isolé) qui se répètent à chaque boucle |
| **Éléments** (feu, eau, vent) | **SA3 Small-SFX** | SAO 1.0 | Bruit large bande : CLAP moins discriminant, écouter |
| **Rétro / 8-bit** | **sfxr** (pyfxr) | SA3 + bitcrush / sous-échantillonnage | Aucun |
| **Bruitage calé sur une animation** | Repères d'images clés + sons isolés (SA3 / sfxr), déclenchés par le moteur | — | **Pas de vidéo-vers-son commercial utilisable depuis l'UE sur 8 Go** (HunyuanVideo-Foley exclut l'UE ; MMAudio, ThinkSound, ControlFoley, Woosh, AudioX non commerciaux ; Kling-Foley sans poids ; LTX 22 Md trop gros) |

**Risques transverses**
- **Licence Stability** : gratuite sous 1 M$ de CA annuel, sorties possédées ; au-delà, licence Entreprise. Tracer dans chaque fiche de son : modèle, version, graine, prompt. https://stability.ai/license
- **Conditions Gemma** : l'encodeur T5Gemma de SA3 impose d'accepter les conditions Gemma (non détaillées ici — non vérifié).
- **Accès sur accord** : les poids SA3 et SAO se téléchargent après acceptation sur Hugging Face — c'est à l'auteur de cliquer.
- **Version de ComfyUI Desktop** : SA3 exige ≥ 0.22 ; vérifier avant tout.
- **VRAM partagée** : ne pas garder un modèle d'image chargé en même temps que SA3 Medium (6,5 Go) ; Small-SFX (≤ 2,4 Go) cohabite.

---

## 9. Ce qui reste à mesurer sur la machine (coût : gratuit, local)

1. Charger le modèle d'aperçu SA3 Small-SFX dans ComfyUI Desktop : nœud manquant ? fréquence réelle (44,1 ou 16 kHz) ? temps par son sur la 3080 Laptop.
2. Passer les 12 prompts × 8 graines, trier au CLAP, écouter le top 3 : les mots `dry` / `close-mic'd` / `one-shot` changent-ils quelque chose ?
3. Un essai privé MMAudio sur un clip de sprite, pour savoir si la piste vidéo-vers-son mérite d'être suivie le jour où un modèle commercial sortira.
