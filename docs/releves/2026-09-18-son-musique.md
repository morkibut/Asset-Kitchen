# Musique de jeu en local via ComfyUI — mise à jour du 18 septembre 2026

> Complète `revue-externe-2026-09-02/research/09-audio.md` (§2.2 et §4.2) sans le répéter.
> Machine : Windows 11, RTX 3080 Laptop 8 Go, ~32 Go de RAM. Critère absolu : poids **et** sorties utilisables dans un jeu vendu.
> Légende : ✅ usage commercial OK · ⚠️ OK sous conditions · ❌ interdit. « Non vérifié » = pas de source trouvée.

## 0. Ce qui a changé depuis le 2 septembre

1. **YuE2 existe.** Sorti le 9 septembre 2026, et pris en charge nativement par ComfyUI le 11 septembre. La revue du 2 septembre ne connaissait que YuE v1 (7B, 24 Go).
2. **La licence de YuE2 a été assouplie le 16 septembre** : les créateurs individuels peuvent vendre ce qu'ils génèrent, mais les entreprises doivent demander une licence (détails au §1.2).
3. **Trois modèles musicaux tournent maintenant nativement dans ComfyUI 0.36.0** : YuE2, ACE-Step 1.5 (et XL), MiniMax Music 3. Stable Audio 3 Medium est aussi natif, selon le constat fait sur la machine.
4. **Sur la machine, il y a deux installations de ComfyUI.**
   - La bonne est dans `C:\Users\damie\AppData\Local\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI`. Elle est en version **0.36.0** et contient `comfy_extras/nodes_yue2.py` et `nodes_ace.py` (ACE-Step 1.5).
   - L'ancienne est dans `AppData\Local\Programs\@comfyorgcomfyui-electron`. Elle est en version 0.3.72 et n'a ni YuE2 ni ACE-Step 1.5. Il ne faut pas s'y fier.
   - Correction au brief : un nœud audio est déjà installé, **`custom_nodes/comfyui_stableaudio_open`**.

---

## 1. YuE2

### 1.1 Fiche

| Point | Constat | Source |
|---|---|---|
| Existe sous ce nom ? | **Oui.** Il s'appelle « YuE2-3B » et est publié par m-a-p / HKUST (équipe de YuE v1). Version v0.1.6, sortie le 9 sept. 2026. | [GitHub](https://github.com/multimodal-art-projection/YuE) · [release yue2-v0.1.6](https://github.com/multimodal-art-projection/YuE/releases/tag/yue2-v0.1.6) · [HF m-a-p/YuE2-3B](https://huggingface.co/m-a-p/YuE2-3B) |
| Architecture | Le modèle écrit d'abord une partition (mélodie et accords, au format ABC) et des jetons sémantiques. Une seconde étape en tire l'audio (« flow matching »), puis le VAE produit un stéréo 48 kHz. | [HF](https://huggingface.co/m-a-p/YuE2-3B) |
| Taille | 3B. Le checkpoint fait 7,8 Go en bf16 et **3,96 Go en int8** (`yue2_3b_int8_convrot`). SheetSage2 (1,39 Go) ne sert qu'aux reprises. | [Comfy-Org/YuE2](https://huggingface.co/Comfy-Org/YuE2) (liste des fichiers via l'API HF) |
| Qualité annoncée | En gardant la meilleure de 8 générations, il obtient 6,96 au classement SongBench, devant Suno v5 (6,87) et Suno v6 (6,56). Il devance nettement LeVo 2, MiniMax Music 3, HeartMuLa, ACE-Step 1.5 et DiffRhythm 2. **Ces chiffres sont ceux des auteurs, sur des chansons chantées.** | [HF](https://huggingface.co/m-a-p/YuE2-3B) · [WildSongBench](https://huggingface.co/datasets/m-a-p/WildSongBench) |
| Modes | Trois modes : `cot=full` (mélodie + accords), `melody` (mélodie seule) et `off` (aucune partition). S'y ajoutent la **reprise** d'un morceau existant (par transcription SheetSage2 → ABC) et l'**édition de la partition** avant rendu. | [generation-and-covers.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/references/generation-and-covers.md) |
| Audio de référence (ICL) | **Non.** La doc le dit : « no request field for `reference_audio`, … `bpm`, `negative_prompt`, an edit interval ». La seule entrée audio passe par la transcription en ABC. | idem |
| Contrôle du BPM / de la tonalité | Aucun champ dédié. On les écrit dans le style (« 96 BPM ») ou on les impose dans la partition ABC. | idem |
| Durée | Nœud ComfyUI `max_duration` : 0,04 à 900 s, 360 s par défaut. La génération peut s'arrêter avant. | `comfy_extras/nodes_yue2.py` ([ComfyUI](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_yue2.py)) |
| Langues | Officiellement **anglais et chinois** (fiche HF : `zh`, `en`). Paroles en **français : non vérifié**. Un guide signale en plus des erreurs d'écriture de fichier sous Windows avec des paroles en coréen, japonais ou chinois. | [HF](https://huggingface.co/m-a-p/YuE2-3B) · [earngenix](https://www.earngenix.com/workflows/yue2-comfyui-install-guide) |
| **Instrumental seul** | **Non prévu.** Aucun mode sans voix n'est documenté. Sur le forum HF, les parades testées (`[Instrumental]`, `[instrument solo]` répétés, LoRA communautaire `Mothersuperior/YuE2-instrumental-cot-full-loras`) donnent des résultats mitigés : **la voix revient souvent au bout de 20 à 60 s**. Aucun mainteneur n'a répondu. | [discussion Comfy-Org/YuE2 #3](https://huggingface.co/Comfy-Org/YuE2/discussions/3) |
| Pistes séparées (stems) | **Non.** Il sort un mix stéréo. | [HF](https://huggingface.co/m-a-p/YuE2-3B) |
| LoRA | Pas faisable pour l'instant (les jetons sémantiques ne sont pas publiés). | [comfyui-wiki](https://comfyui-wiki.com/en/news/2026-09-11-yue2-3b) |

### 1.2 Licence : ⚠️ (et ❌ si le jeu est vendu par une société)

- Le code est sous **Apache 2.0**.
- Les poids sont sous **CC BY-NC 4.0**, avec une « additional creator permission » datée du **16 septembre 2026** ([MODEL_LICENSE](https://github.com/multimodal-art-projection/YuE/blob/main/MODEL_LICENSE)). En substance :
  - les *personal users, content creators and musicians acting in an individual capacity* peuvent générer puis « publish, distribute, sell, license or otherwise monetize those outputs », sans frais ni royalties ;
  - en revanche, « The individual creator permission does not authorize commercial use of the model weights by companies ». Une société doit demander une licence ;
  - enfin, « Generated outputs are not subject to the model weights' NonCommercial restriction solely because they were generated with YuE2 ».
- Ce que ça veut dire pour le jeu :
  - Damien vend le jeu **en son nom propre** : c'est permis par le texte actuel.
  - Le jeu est vendu par **une société** (SAS, studio, ou même éditeur) : il faut une licence. La situation d'une micro-entreprise n'est **pas tranchée par le texte**.
- Risques :
  - la permission a deux jours ; elle peut encore bouger ;
  - plusieurs sites tiers (AlphaSignal, earngenix, la fiche HF elle-même) affichent encore « outputs cannot be used commercially ».
- À faire : **archiver MODEL_LICENSE** (le fichier, son hash, la date) avec chaque morceau généré.

### 1.3 Est-ce que ça tourne sur 8 Go ?

| Indice | Valeur | Source |
|---|---|---|
| Besoin officiel | GPU 24 Go, Linux. Pic mesuré de 11,2 Go (et 14,1 Go au contexte maximal) **en bf16, sans quantisation**. | [HF](https://huggingface.co/m-a-p/YuE2-3B) |
| Temps de référence | RTX 4090 : 71 s de calcul pour 215 s de musique. | idem |
| ComfyUI natif | La PR #16250 a été fusionnée le 11/09/2026 et est incluse dans la version v0.36.0 (15/09). | [PR #16250](https://github.com/comfyanonymous/ComfyUI/pull/16250) · [releases](https://github.com/comfyanonymous/ComfyUI/releases) |
| Carte 8 Go | Un utilisateur dit que ça tourne « sans aucun problème » sur une **RTX 3070 Ti (8 Go) avec 128 Go de RAM**. Il ne précise ni la variante (bf16 ou int8) ni le temps. | commentaire dans la PR #16250 |
| Vitesse sous ComfyUI | Sur une RTX 3090, 2 min de musique demandent environ 2 min de calcul (≈ temps réel). Le nœud « Generate Music » occupe peu le GPU. | idem |
| Défaut connu de l'int8 | Un utilisateur obtient **du bruit pur** avec l'int8 et les réglages par défaut. Non résolu au 12/09. | idem |
| Autres défauts connus | Échecs occasionnels de la génération ABC. Pic de VRAM pendant la synthèse audio. Un seul job à la fois dans la file. | [AlphaSignal](https://alphasignal.ai/news/comfy-org-brings-yue2-music-generation-natively-into-comfyui-workflows) · PR |

**Estimation pour 60 s de musique sur la 3080 Laptop (non vérifié, à mesurer)** :
- Scénario favorable : l'int8 (≈ 4 Go de poids) tient en VRAM et la RAM absorbe le reste. Compter **1,5 à 3 min** (ABC + musique + VAE), car un GPU portable est environ 1,5 à 2 fois plus lent qu'une 3090 sur un travail limité par la mémoire.
- Scénario défavorable : le bf16 déborde sur la RAM partagée de Windows (le « sysmem fallback »), et le calcul devient **5 à 10 fois plus lent**.
- Premier essai : int8, `max_duration` = 60, puis 3 à 4 seeds. Vérifier que ce n'est pas du bruit, et relever le pic de VRAM (Gestionnaire des tâches).
- Il n'existe **pas de GGUF ni d'exl2** pour YuE2 (non trouvé). L'int8 « convrot » de Comfy-Org est la seule quantisation disponible dans ComfyUI.

### 1.4 Nœuds ComfyUI

- **Natifs (à utiliser)** : `EmptyYuE2LatentAudio`, `YuE2GenerateABC`, `YuE2GenerateMusic` et `SheetSage2AudioToABC`. Workflows officiels : `audio_yue2_text2music.json` et `audio_yue2_music_cover.json`.
- **Tiers (inutiles désormais)** : ScryptHunter/ComfyUI-YuE2 (actif le 14/09), nvmax/ComfyUI-YuE2, piscesbody/ComfyUI-YuE2 et EmeraldApple-AI/ComfyUI-YuE2 (tous de septembre 2026). ComfyUI_YuE (v1) n'est pas à jour.

### 1.5 Modèles proches, au cas où

- **YuE v1** (Apache 2.0 ✅, 7B + 1B) est conservé sur la branche `YuE-v1`. Il demande 24 Go ou plus, avec des variantes « GPU poor » ([YuEGP](https://github.com/deepbeepmeep/YuEGP)).
- **Le successeur réel, c'est YuE2.**

---

## 2. Écrire un prompt pour YuE2

Il y a deux champs, **style** et **lyrics**, plus l'ABC en option.

**Le style** est une liste de mots-clés séparés par des virgules : langue, genre, voix, instruments, BPM, ambiance. Exemple officiel : `"English, warm female vocal, contemporary pop, 96 BPM, piano, rounded electric bass, restrained drums, clear diction"`.

**Les paroles** sont découpées en sections : `[Intro]`, `[Verse]`, `[Pre-Chorus]`, `[Chorus]`, `[Interlude]`, `[Bridge]`, `[Outro]`. Voir l'exemple officiel [tonight-awake.json](https://huggingface.co/m-a-p/YuE2-3B/blob/main/examples/tonight-awake.json).

Deux consignes officielles à garder en tête :
- « Put only the words intended to be sung in the lyrics field ».
- Mettre le tempo et la mesure **dans l'ABC**, et les décrire de la même façon dans le style ([generation-and-covers.md](https://github.com/multimodal-art-projection/YuE/blob/main/skills/yue2-music/references/generation-and-covers.md)).

⚠️ **YuE2 est fait pour la chanson.** Pour la musique de jeu (surtout instrumentale), les exemples ci-dessous sont des **tentatives** : la voix risque de s'inviter (§1.1). Son vrai usage dans le jeu, c'est **un morceau chanté** (générique, chanson de taverne, thème de fin).

| Usage | style | lyrics |
|---|---|---|
| Village (chanson de taverne) | `English, folk, medieval tavern song, warm male vocal, lute, fiddle, tin whistle, frame drum, cheerful, 100 BPM, 6/8` | `[Intro]` puis `[Verse]` et 4 vers, `[Chorus]` et 4 vers, `[Outro]` |
| Thème de fin (générique) | `English, orchestral ballad, soft female vocal, piano, strings, choir pads, bittersweet, 72 BPM` | `[Intro]` `[Verse]` … `[Chorus]` … `[Bridge]` … `[Chorus]` `[Outro]` |
| Combat (tentative instrumentale) | `instrumental, epic orchestral battle, taiko drums, staccato strings, brass stabs, 150 BPM, D minor, no vocals` | `[Intro]` `[Instrumental]` `[Instrumental]` `[Outro]` — résultat incertain |
| Boss | `instrumental, dark symphonic metal, choir, distorted guitars, timpani, 170 BPM, C minor` | idem — choisir plutôt ACE-Step |
| Menu, victoire, exploration | — | **Ne pas utiliser YuE2** → ACE-Step 1.5 ou Stable Audio 3 |

---

## 3. ACE-Step 1.5 dans ComfyUI (le cheval de trait pour l'instrumental)

- **Licence : MIT sur le code et les poids ✅.** La fiche HF dit que les sorties sont utilisables commercialement (déjà vérifié le 2/09). Les XL sont aussi sous MIT ([HF xl-turbo](https://huggingface.co/ACE-Step/acestep-v15-xl-turbo)).
- **Natif dans ComfyUI.** Les nœuds sont `TextEncodeAceStepAudio1.5`, `EmptyAceStep1.5LatentAudio` et `ReferenceTimbreAudio` (référence de timbre, expérimental) ([nodes_ace.py](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_ace.py) · [doc Comfy](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)).
- **Entrées de l'encodeur** : `tags`, `lyrics`, `seed`, **`bpm` (10–300)**, **`duration` (jusqu'à 2000 s)**, **`timesignature` (2/3/4/6)**, `language` (dont `fr`), **`keyscale` (par ex. « A minor »)**. En avancé : `generate_audio_codes` (active le LM ; plus lent, meilleur), `cfg_scale`, `temperature`.
- **Fichiers à télécharger** ([Comfy-Org/ace_step_1.5_ComfyUI_files](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files)) :

| Choix pour 8 Go | Fichier | Taille |
|---|---|---|
| Tout-en-un (simple) | `checkpoints/ace_step_1.5_turbo_aio.safetensors` | 10,0 Go (sur disque ; ComfyUI décharge par morceaux) |
| **Séparé (recommandé sur 8 Go)** | `diffusion_models/acestep_v1.5_turbo.safetensors` | 4,79 Go |
| | `text_encoders/qwen_0.6b_ace15.safetensors` (le LM léger) | 1,19 Go |
| | `vae/ace_1.5_vae.safetensors` | 0,34 Go |
| XL (déconseillé) | `acestep_v1.5_xl_turbo_bf16` | 9,97 Go ; ≥ 12 Go de VRAM avec déchargement |

- **VRAM** : le tableau officiel donne pour **6–8 Go : DiT 2B turbo + LM 0.6B** ([README](https://github.com/ace-step/ACE-Step-1.5)).
- **Vitesse** : moins de 10 s par chanson complète sur une 3090. Sur une 3080 Laptop, compter **quelques dizaines de secondes pour 60 s** (estimation non vérifiée).
- **Ce que les nœuds natifs ne font pas** : ni repaint, ni extend, ni cover ([doc Comfy](https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1-5)). Pour ces fonctions, il faut des nœuds tiers :
  - [ace-step/ACE-Step-ComfyUI](https://github.com/ace-step/ACE-Step-ComfyUI) (MIT, dernier commit en mars 2026) ;
  - [ComfyUI_RyanOnTheInside](https://github.com/ryanontheinside/ComfyUI_RyanOnTheInside) (MIT, guideurs extend/repaint) ;
  - [kaola-ace-step](https://github.com/kana112233/ComfyUI-kaola-ace-step) (Lego).
  - Les modes `extract`, `lego` et `complete` exigent le modèle **base** (50 pas).
- **Activité du projet** : dernière release v0.1.8 le 18/05/2026 et dernier commit le 03/09/2026. Rien de neuf côté modèles depuis XL (avril).
- **Le prompt** ([tutoriel du dépôt ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5), doc anglaise) :
  - `tags` (la « caption ») décrit le style, les instruments, l'ambiance et le timbre ;
  - `lyrics` sert de « script temporel » : `[Intro] [Verse] [Chorus] [Bridge] [Outro] [Build] [Drop] [Breakdown] [Instrumental] [Guitar Solo] [Fade Out] [Silence]`, avec des modificateurs (`[Chorus - anthemic]`) ;
  - **pour de l'instrumental, écrire `[Instrumental]`** ;
  - la caption et les tags doivent aller dans le même sens.

| Usage | tags | lyrics | bpm / key / mesure / durée |
|---|---|---|---|
| Village | `cozy village theme, acoustic guitar, flute, light hand percussion, pizzicato strings, warm, pastoral, JRPG` | `[Intro]` `[Instrumental]` `[Outro]` | 96 / G major / 4 / 64 s (= 25,6 mesures → prendre 60 s = 24 mesures) |
| Exploration (boucle) | `ambient exploration, soft pads, celesta, harp arpeggios, sparse percussion, calm, mysterious, loopable` | `[Instrumental]` | 90 / D minor / 4 / 64 s (= 24 mesures) |
| Combat | `JRPG battle theme, driving drums, electric bass, staccato strings, brass, energetic, heroic` | `[Intro - short]` `[Instrumental]` `[Build]` `[Instrumental]` | 150 / E minor / 4 / 64 s (= 40 mesures) |
| Boss | `epic boss battle, choir, taiko, distorted guitar, orchestral hits, dark, intense` | `[Intro]` `[Instrumental]` `[Breakdown]` `[Build]` `[Drop]` | 165 / C minor / 4 / 96 s |
| Menu | `title screen, gentle piano, strings, nostalgic, hopeful, minimal` | `[Instrumental]` | 80 / F major / 4 / 48 s (= 16 mesures) |
| Victoire (jingle) | `victory fanfare, brass, timpani, snare roll, triumphant, short jingle` | `[Instrumental]` `[Fade Out]` | 120 / C major / 4 / 6–8 s (= 3–4 mesures) — sinon Stable Audio 3 |

Pour choisir la durée : mesures × 4 × 60 / BPM. La durée exacte facilite la boucle, voir le §5.

---

## 4. Autres modèles musicaux locaux (juin → septembre 2026)

| Modèle | Date | Licence poids / sorties | 8 Go ? | Intérêt pour le jeu |
|---|---|---|---|---|
| **YuE2-3B** | 9 sept. | ⚠️ CC BY-NC + permission aux individus (§1.2) | int8 plausible, à mesurer | Chansons (meilleure qualité ouverte) |
| **ACE-Step 1.5 / XL** | janv. / avril | ✅ MIT | ✅ 2B turbo | **Instrumental contrôlé (BPM, tonalité, durée)** |
| **Stable Audio 3 Medium** (1,4B) / **Small-Music** (433M, CPU) | 17 mai 2026 (HF) | ⚠️ `stable-audio-community` (gratuit sous 1 M$ de CA ; même régime que SAO 1.0). Stability dit l'avoir entraîné sur de la musique **sous licence**. | ✅ 5,1 à 6,5 Go (120 s) | **Inpainting et continuation** (pour réparer une jointure de boucle), jusqu'à 380 s. Natif dans ComfyUI (d'après le constat sur la machine). [GitHub](https://github.com/Stability-AI/stable-audio-3) · [annonce](https://stability.ai/news-updates/meet-stable-audio-3-the-model-family-built-for-artistic-experimentation-with-open-weight-models) · [doc Comfy](https://docs.comfy.org/tutorials/audio/stable-audio/stable-audio-3) |
| **MiniMax Music 3** | 7 août | ⚠️ « Community License » : commercial OK, mais **il faut afficher « MiniMax-Music3 » de façon visible dans l'interface** du produit commercial. Une autorisation écrite est exigée au-delà de 20 M$ de CA. Le dépôt Comfy-Org indique « apache-2.0 » : c'est la licence d'origine qui compte. | Oui selon la fiche (déchargement couche par couche). Mais l'encodeur texte fait **9,2 Go même en int8** : le calcul sera lent. | Chansons de 5 min max, 32 kHz, balise `[Instrumental]`. Natif dans ComfyUI (`MiniMaxMusic3TextEncode`). [HF](https://huggingface.co/MiniMaxAI/MiniMax-Music3) · [LICENSE](https://huggingface.co/MiniMaxAI/MiniMax-Music3/blob/main/LICENSE) · [Comfy-Org](https://huggingface.co/Comfy-Org/MiniMax-Music-3) |
| **Magenta RealTime 2** (230M / 2,4B) | 4 juin | ✅ CC-BY 4.0 (crédit à mettre) | Sur NVIDIA : **seulement en différé**, via Python. Le temps réel est réservé à Apple Silicon. Pas de nœud ComfyUI. | Musique continue ; peu utile sous Windows. [GitHub](https://github.com/magenta/magenta-realtime) · [HF](https://huggingface.co/google/magenta-realtime-2) |
| LeVo 2 / SongGeneration 2 (4B) | 1er mars | Licence Tencent spécifique, **non vérifiée** (dépôt inaccessible) | ❌ 10 Go minimum | Il sait faire de l'instrumental pur et des pistes séparées, mais il est hors budget. [gaga.art](https://gaga.art/blog/songgeneration-2/) |
| WanSong (~25B) | juillet (rapport technique) | Licence contradictoire selon les sources, **non vérifié** | ❌ | Hors budget. |

---

## 5. Boucles sans couture et musique adaptative

**Aucun modèle ne produit nativement une boucle parfaite.** La méthode fiable consiste à **générer puis réparer la jointure** :

1. **Figer la grille.** Avec ACE-Step, régler `bpm` + `timesignature` + `duration` = N mesures exactes (+ 1 à 2 mesures de marge).
2. **Trouver les temps.**
   - `librosa.beat` (ISC ✅) suffit.
   - **beat_this** (CPJKU) : code **et poids sous MIT ✅**, et il détecte aussi les **premiers temps de mesure** (downbeats) ([README](https://github.com/CPJKU/beat_this)). Les auteurs précisent que certaines données d'entraînement sont sous licence restrictive, à chacun de juger.
   - **madmom** : code BSD, mais **modèles CC BY-NC-SA ❌** ([README](https://github.com/CPJKU/madmom)). À écarter.
3. **Choisir le point de boucle.**
   - **PyMusicLooper** (MIT ✅, [GitHub](https://github.com/arkrow/PyMusicLooper)) cherche automatiquement les meilleurs points de boucle et exporte les métadonnées de boucle.
   - Sinon, couper au premier temps de mesure et faire un fondu enchaîné de 50 à 200 ms.
4. **Réparer la jointure.** Mettre la fin avant le début (rotation), puis **régénérer la zone de jointure** :
   - par *inpainting* avec **Stable Audio 3** (`inpaint_mask_start/end_seconds`) ;
   - ou par **repaint** avec ACE-Step (`repainting_start/end`, via un nœud tiers).
   - Le résultat devient une boucle dont la couture est générée plutôt que collée. Méthode non éprouvée publiquement : à tester.
5. **Musique adaptative.**
   - **Couches d'intensité** : avec ACE-Step, générer la même piste avec seed, BPM, tonalité et durée identiques et des tags différents (calme, puis tendu, puis combat). Ou bien générer une base, puis ajouter des couches avec `lego` (modèle base, nœud tiers). Enfin, **séparer les pistes** pour les mixer dans le moteur de jeu.
   - **Stingers et transitions** : jingles de 2 à 8 s avec ACE-Step ou Stable Audio 3, **à la même tonalité et au même BPM**, calés sur le premier temps de mesure dans le moteur.
   - **Continuation** : fonction *continuation* de Stable Audio 3 ; `extend` d'ACE-Step (nœud tiers).
6. **Séparation de pistes en local.**

| Outil | Licence | Nœud ComfyUI |
|---|---|---|
| Demucs (htdemucs) | MIT, code et poids ✅. Données : MUSDB + 800 morceaux. | [audio-separation-nodes-comfyui](https://github.com/christian-byrne/audio-separation-nodes-comfyui) (MIT, 614★, actif en août 2026) : batterie / basse / voix / autres, plus recalage de tempo et découpe |
| BS-RoFormer / MelBand-RoFormer | Code MIT ([lucidrains](https://github.com/lucidrains/BS-RoFormer), [ZFTurbo](https://github.com/ZFTurbo/Music-Source-Separation-Training)). **Licences des poids : chacune différente, non vérifiées** (souvent entraînés sur MUSDB). | Via [python-audio-separator](https://github.com/nomadkaraoke/python-audio-separator) (MIT) |
| ACE-Step `extract` | ✅ MIT | Nœud tiers, modèle base |

Ces outils servent pendant la production et ne sont pas livrés avec le jeu. Le risque est faible, mais il faut **noter le modèle de séparation dans la provenance**.

---

## 6. Recommandation

| Besoin | Modèle | Pourquoi | Risques |
|---|---|---|---|
| **Boucles instrumentales (village, exploration, menu, combat, boss)** | **ACE-Step 1.5 turbo 2B + LM 0.6B**, natif dans ComfyUI | ✅ MIT. BPM, tonalité, mesure et durée sont réglables, ce qui permet de couper sur la mesure. `[Instrumental]` est fiable. Tient en 6 à 8 Go. | Qualité inférieure à YuE2 et au XL. Repaint et extend demandent un nœud tiers. |
| Jingles de victoire, stingers, réparation des jointures | **Stable Audio 3 Medium** (ou Small-Music en CPU) | Inpainting et continuation, 5 à 6,5 Go | ⚠️ Licence communautaire (sous 1 M$ de CA) : la documenter |
| **Morceaux chantés** (taverne, générique) | **YuE2 int8**, natif | Meilleure qualité ouverte, partition modifiable | ⚠️ Licence réservée aux individus. Faisabilité sur 8 Go non mesurée. Bug de bruit avec l'int8. Anglais et chinois seulement. Aucun contrôle strict du BPM. |
| Couches adaptatives | ACE-Step (même seed/BPM/tonalité) + Demucs | ✅ | Temps de travail |
| À éviter sur cette machine | MiniMax Music 3 (encodeur de 9 Go, mention obligatoire dans l'interface), LeVo 2, WanSong, XL | — | — |

**Pourquoi pas YuE2 pour la musique de jeu, contrairement au souhait de l'auteur ?** Trois raisons.
1. Il **ne sait pas faire d'instrumental fiable** : la voix revient.
2. Il **n'a pas de contrôle BPM/tonalité en paramètre** : ça passe par l'ABC, ce qui complique la boucle.
3. **La licence dépend du statut juridique du vendeur.**

Il reste excellent pour 1 à 3 morceaux chantés. Le socle de la bande-son, lui, doit être ACE-Step 1.5.

**Premier essai proposé (gratuit, local)** :
1. Télécharger ACE-Step 1.5 turbo en fichiers séparés (≈ 6,3 Go) et le checkpoint YuE2 int8 (3,96 Go).
2. Générer une boucle d'exploration de 60 s avec chaque modèle.
3. Relever le temps de calcul et le pic de VRAM.
4. Pour YuE2, vérifier que la sortie n'est pas du bruit.
