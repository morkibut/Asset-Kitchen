# Le son — plan

> Demandé par l'auteur le 18 septembre 2026 : fabriquer en local, par ComfyUI, tous les sons
> d'un jeu — bruitages, ambiances, interface, musique, voix — et les livrer à Godot. Le dépôt
> sait déjà importer, régler, juger et livrer **un** son (AU14) ; ce plan en fait un pan entier
> de l'atelier. Le comment est dans [archi-son.md](archi-son.md) ; les recherches sourcées dans
> `docs/releves/2026-09-18-son-*.md`.
>
> Quel modèle sur quelle tranche : [PLAN-son-affectation.md](PLAN-son-affectation.md).

## Décisions d'architecture

- **Tout est local et gratuit en argent.** Le coût d'un son est du temps de calcul, et l'écran
  l'annonce avant de lancer, à partir des mesures du banc.
- **L'atelier ne touche pas à ComfyUI** (décision du 3 septembre 2026). Stable Audio 3, ACE-Step
  1.5 et YuE2 sont natifs dans la version installée (0.36.0) : l'auteur télécharge les poids,
  l'atelier les cherche, et dit précisément ce qui manque, où le poser et d'où il vient.
- **L'atelier fournit ses méthodes sonores.** Plus besoin de coller un export ComfyUI pour faire
  un bruitage : les profils des moteurs retenus sont livrés, dérivés des modèles de workflow
  officiels. Coller son propre workflow reste possible.
- **Six familles** — bruitage, interface et rétro, ambiance, musique, chanson et jingle, voix —
  qui fixent le moteur par défaut, la durée, le niveau visé et le format de livraison
  ([archi-son.md §3](archi-son.md)).
- **Moteurs** : Stable Audio 3 Small-SFX pour bruitages et ambiances ; sfxr pour l'interface et
  le 8-bit ; **ACE-Step 1.5 pour la musique** (tempo, tonalité, mesure, instrumental) ;
  **YuE2 pour les chansons** ; ACE-Step aussi pour les jingles (lui seul reçoit une tonalité) ;
  Stable Audio 3 Medium en secours, facultatif ; Qwen3-TTS
  et Chatterbox pour les voix. Le banc SN0 confirme ou renverse ces choix, oreille à l'appui.
- **On décrit le sujet, l'univers ajoute le style**, comme pour l'image : l'univers gagne un
  bloc sonore, et l'écran montre le texte composé avant de lancer.
- **Les mesures informent, elles ne refusent jamais** — seuls un fichier silencieux ou illisible
  ne sont pas annoncés prêts. Aujourd'hui, un son **saturé** est aussi bloqué (ni retenu, ni
  livré) : c'est contraire à la règle du produit, et SN3 le lève.
- **Rien n'est traduit ni réécrit en douce.** La description part telle quelle dans le texte
  composé ; si elle n'est pas en anglais, l'écran le signale. Le modèle de workflow officiel de
  Stable Audio 3 Medium fait réécrire le texte par un modèle de langage : le profil livré coupe
  cette réécriture.
- **Le son d'une animation se cale sur ses images**, pas sur la vidéo : aucun modèle
  « vidéo → son » n'est vendable depuis la France et tenable sur 8 Go.
- **La livraison livre des fichiers**, pas du son copié dans une ressource : WAV ou OGG, leur
  `.import`, des ressources Godot pour les variantes et la musique, et des crédits.

## Ce que l'auteur fait lui-même, avant SN0

Rien n'est payé. Il faut accepter deux licences sur Hugging Face (c'est un geste de l'auteur),
puis télécharger environ **14 Go** (23 Go avec le secours facultatif) dans
`C:\Users\damie\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models\`.

| Pour | Fichier | Dossier | Taille |
|---|---|---|---|
| Bruitages, ambiances | `stable_audio_3_small_sfx.safetensors` | `checkpoints` | 2,3 Go |
| (encodeur de texte de Stable Audio 3) | `t5gemma_b_b_ul2.safetensors` | `text_encoders` | 1,2 Go |
| Musique, jingles | `acestep_v1.5_turbo.safetensors` | `diffusion_models` | 4,8 Go |
| | `qwen_0.6b_ace15.safetensors` | `text_encoders` | 1,2 Go |
| | `ace_1.5_vae.safetensors` | `vae` | 0,3 Go |
| Chansons | `yue2_3b_int8_convrot.safetensors` | `checkpoints` | 4,0 Go |
| *Secours, facultatif* | `stable_audio_3_medium.safetensors` | `checkpoints` | 9,2 Go |

Deux fichiers que les modèles de workflow officiels réclament **ne sont pas nécessaires** : le
second encodeur d'ACE-Step (`qwen_1.7b_ace15`, 3,7 Go — trop lourd à côté du reste sur 8 Go)
et le modèle de réécriture de Stable Audio 3 Medium (`qwen3.5_2b_bf16`, 4,6 Go — coupé, voir
les décisions). Le banc SN0 le confirme.

Les liens sont dans les notes des modèles de workflow officiels (dans ComfyUI : Modèles →
Audio) et dans les relevés. La licence de Stable Audio 3 est à accepter sur la page
`stabilityai/stable-audio-3-small-sfx`, avec les conditions Gemma de son encodeur.

## Les tranches

### SN0 · Le banc des moteurs, sur la machine

**Bloquée par** : les téléchargements de l'auteur.

Un banc hors produit (`essais/banc_son.py`) qui envoie à ComfyUI les modèles de workflow
officiels, convertis en format API, et relève pour chaque tirage : temps de calcul, pic de
mémoire de la carte, fréquence et canaux réels du fichier, silence, crête, niveau perçu, et le
score CLAP (dans un environnement Python à part). Il produit une page d'écoute locale.

Le programme, 8 graines partout : les douze bruitages du relevé sur Small-SFX (dont les deux
ambiances de 30 s, forêt et pluie en grotte, plus une troisième :
`TrackType: SFX. Busy medieval market square, distant chatter without words, cart wheels on
cobblestone, continuous ambience, no music, stereo field recording`) ; la boucle d'exploration
(24 mesures à 90 BPM, soit 64 s) et le thème de combat sur ACE-Step, puis sur YuE2 en tentative
instrumentale ; une chanson de taverne sur YuE2.

- [ ] Chaque moteur retenu produit un son audible sur la 3080 Laptop, ou le banc dit pourquoi
      (fichier manquant, mémoire, **bruit pur de YuE2 int8** — un défaut signalé ailleurs).
- [ ] Le temps de calcul et le pic de mémoire sont relevés par moteur et par durée : c'est ce
      que l'écran annoncera.
- [ ] Le banc dit si ComfyUI décharge seul un moteur quand le suivant arrive.
- [ ] L'auteur a écouté, et tranché **ACE-Step ou YuE2 pour la musique de fond** ; le relevé
      l'écrit dans `docs/releves/`.
- [ ] Le relevé dit si les mots `dry`, `close-mic'd`, `one-shot` changent le son, et si le CLAP
      trie mieux qu'une écoute rapide.
- [ ] Le relevé tranche les niveaux visés, sur lesquels les recherches divergent (une ambiance à
      −26 ou à −19 LUFS ? un bruitage réglé sur sa crête ou sur son niveau perçu ?).

### SNM · La maquette du son

**Bloquée par** : rien — se fait en même temps que SN0.

Une maquette interactive dans `docs/maquettes-atelier-unifie/`, qui part **du geste** et pas de
la liste des réglages : décrire un son → relire le texte → écouter huit tirages en grille →
garder → régler → livrer ; la fiche d'un sujet et ses emplacements sonores ; une musique avec
son tempo et sa boucle ; un repère sonore sur une image d'animation.

- [ ] L'auteur l'a parcourue et validée ; les écrans des tranches suivantes la suivent.

### SN1 · Un bruitage depuis une phrase, sans coller de workflow

**Bloquée par** : SN0.

L'atelier livre ses profils sonores (Small-SFX, Medium, ACE-Step 1.5, YuE2, Stable Audio Open
1.0 par le nœud déjà installé). Le format de profil apprend les liaisons qui manquent : graine,
nombre de tirages, paroles, tempo, tonalité, mesure, et **une durée libre dans un intervalle**
(aujourd'hui, une durée doit figurer dans une liste déclarée ; une musique de 16 mesures à
90 BPM dure 42,67 s). Le profil de Stable Audio 3 Medium coupe la réécriture du texte. Le
diagnostic nomme chaque fichier absent, son dossier et sa source.

- [ ] Sur un ComfyUI qui a les poids, un bruitage se lance depuis une phrase et revient
      écoutable, sans rien importer.
- [ ] Sur un ComfyUI à qui manque un fichier, le moteur est grisé avec le nom du fichier, son
      dossier et sa page de téléchargement — jamais proposé puis refusé.
- [ ] Un workflow collé par l'auteur marche comme avant.

### SN2 · L'univers sonore, et le texte qui part

**Bloquée par** : SN1.

Le bloc sonore de l'univers (époque et matière, rendu, orchestre, humeur, tonalité et tempo de
référence, moteur par famille), les gabarits par moteur et leurs exemples livrés, et la
composition du texte montrée avant le lancement.

- [ ] Un pas d'un jeu « fantasy médiévale, rendu 16-bit » part avec `TrackType: SFX`, la
      description, le rendu et la prise de son — et l'écran le montre avant.
- [ ] Un univers vide ne contraint rien : la description part seule, avec la prise de son de la
      famille.
- [ ] Un texte relu à la main part tel quel.
- [ ] Une description en français part telle quelle, et l'écran signale que le moteur comprend
      l'anglais — rien n'est traduit.

### SN3 · Une série de tirages, et les variantes

**Bloquée par** : SN2.

Un geste lance N graines (8 par défaut) ; la série s'écoute en grille, avec ses mesures (dont
le niveau perçu en LUFS, nouveau) ; garder plusieurs tirages forme un jeu de variantes.

- [ ] Huit tirages d'un pas reviennent dans une même série, écoutables à la suite au clavier.
- [ ] Garder quatre tirages forme un jeu de variantes qui se rouvre avec ses quatre sons.
- [ ] Une série coupée en route reprend sans relancer les tirages déjà rendus.
- [ ] Aucune mesure n'écarte un tirage d'elle-même : un tirage saturé est signalé, mais se
      garde et se livre si l'auteur le décide (aujourd'hui il est bloqué).

### SN4 · Livrer des fichiers que Godot lit tels quels

**Bloquée par** : SN3.

WAV ou OGG selon la famille (l'OGG passe par le ffmpeg déjà présent), le `.import` à côté, le
`AudioStreamRandomizer` d'un jeu de variantes, la scène stable nommée `son.tscn` (elle
s'appelle aujourd'hui `personnage.tscn`, même pour un son), les noms stables
(`sfx_`, `amb_`, `mus_`, `vo_`, `ui_`), le niveau visé par famille, le passage en mono, et
`credits.json`. Le paquet actuel (PCM dans le `.tres`) reste lisible pour ce qui a déjà été livré.

- [ ] Dans un vrai Godot 4.7 (`--headless --import`), le `.import` écrit par l'atelier survit et
      le son joue en boucle quand il le doit.
- [ ] Un jeu de huit variantes se livre en `AudioStreamRandomizer` réglé pour ne jamais rejouer
      la même variante deux fois de suite (`playback_mode = 0`).
- [ ] `credits.json` nomme le moteur, sa licence, la graine et le texte de chaque son.
- [ ] Une livraison de son ne crée plus de `personnage.tscn`.

### SN5 · Les ambiances qui bouclent sans couture

**Bloquée par** : SN4.

Repères posés sur un passage par zéro, fondu enchaîné réglable entre la fin et le début, mesure
du raccord qui dit s'il claque ; et si le banc l'a montré possible en natif, **la réparation de
la jointure** par Stable Audio 3 (on refait les deux secondes autour du raccord).

- [ ] Une pluie de 30 s tourne dix fois de suite sans clic audible, et la mesure du raccord le
      confirme.
- [ ] L'écran fait entendre le raccord seul (les deux secondes autour), en boucle.

### SN6 · Les sons d'un sujet

**Bloquée par** : SN4 (ses sons se livrent avec le sujet, sous leurs noms stables).

Un son peut appartenir à un sujet, à un emplacement nommé ; l'onglet « Sons » de la fiche
montre les emplacements de sa famille, remplis ou vides, et on lance une série depuis un
emplacement vide. La livraison d'un sujet emporte ses sons.

- [ ] Depuis la fiche d'un héros, l'emplacement « pas » vide lance une série déjà décrite par
      le sujet ; le son gardé y apparaît.
- [ ] Un son sans sujet reste un son du jeu, visible dans la galerie.
- [ ] Livrer le héros livre ses sons avec lui, sous leurs noms stables.

### SN7 · Le son calé sur l'animation

**Bloquée par** : SN6.

Un repère sonore se pose sur une image d'une bande ; il désigne un emplacement du sujet. La
salle d'essai des animations le joue ; la livraison ajoute une piste audio à l'`AnimationPlayer`.

- [ ] Le repère « image 3 : pas » de la marche vers le sud se joue à chaque boucle dans la salle
      d'essai, et dans Godot.
- [ ] Changer la cadence d'une bande garde le repère sur la même image.

### SN8 · Les sons d'interface et rétro, sans ComfyUI

**Bloquée par** : SN3.

sfxr par `pyfxr` (BSD) : des départs types (clic, validation, erreur, saut, pièce, explosion),
des curseurs, une mutation pour tirer des variantes, un son en un instant, sans carte graphique.

- [ ] Un clic et sa famille (survol, validation, erreur) se fabriquent en moins d'une seconde
      chacun et se livrent comme les autres sons.
- [ ] Un son sfxr se refait à l'identique depuis ses réglages conservés.

### SN9 · La musique

**Bloquée par** : SN4.

ACE-Step 1.5 : tempo, tonalité, mesure et nombre de mesures (la durée se calcule), boucle coupée
sur une frontière de mesure, livraison OGG avec `bpm`, `beat_count` et `bar_beats`. YuE2 : style,
paroles, partition affichée et corrigeable, et le texte de sa licence daté avec chaque morceau
(le jeu n'est pas vendu : aucune garde de licence à l'écran).
Les jingles se calent sur la tonalité et le tempo de l'univers.

- [ ] Une boucle d'exploration de 24 mesures à 90 BPM tourne sans saut de temps dans Godot.
- [ ] Un jingle de victoire part avec la tonalité et le tempo de l'univers (la provenance le
      montre), et l'auteur l'a écouté contre la boucle d'exploration.
- [ ] Une chanson YuE2 sort avec le texte daté de sa licence dans `credits.json`.

### SN10 · La musique qui s'adapte

**Bloquée par** : SN9.

Des couches de même tempo, tonalité, graine et durée (calme, tension, combat) livrées en
`AudioStreamSynchronized` ; des morceaux et leurs transitions livrés en `AudioStreamInteractive`
aux noms de clips stables. La séparation de pistes (Demucs) demanderait un nœud : hors tranche,
sauf décision de l'auteur.

- [ ] Dans Godot, passer d'« exploration » à « combat » se fait sur la mesure suivante, sans
      coupure.
- [ ] Monter la couche « tension » ne décale pas les autres.

### SN11 · Les voix

**Bloquée par** : SN6, et la décision de l'auteur sur la façon de faire tourner les modèles de
voix ([archi-son.md §4.5](archi-son.md)).

La voix d'un personnage se dessine une fois et se garde sur sa fiche ; chaque réplique la clone ;
cris et souffles par onomatopées ; créatures par hauteur et timbre. Répliques en `fr/` et `en/`
parallèles.

- [ ] Trois répliques du marchand portent la même voix de référence dans leur provenance, et
      l'auteur les a écoutées à la suite.
- [ ] Un cri de gobelin sort d'une voix humaine transformée, et sa recette se rouvre.
- [ ] Une réplique en français et sa traduction anglaise se livrent sous le même nom.

### SN12 · L'agent demande des sons

**Bloquée par** : SN7 (le repère sonore) et SN9.

Les outils MCP pour une série sur un emplacement, une musique avec ses réglages, un repère
sonore, une publication ; les moteurs sonores permis et un plafond de temps de calcul dans le
cadre de délégation.

- [ ] L'agent Godot demande « les pas du héros sur l'herbe », suit la série, et récupère un jeu
      de variantes livré, sans que l'auteur ouvre l'atelier.
- [ ] Un moteur non permis dans le cadre est refusé avec sa raison.

## Questions laissées ouvertes

- ~~**Qui vend le jeu ?**~~ *Tranché par l'auteur le 18 septembre 2026 : le jeu n'est pas vendu,
  c'est un projet personnel.* YuE2 est donc utilisable sans réserve. Les modèles écartés pour
  leur seule licence non commerciale redeviennent possibles — le plus utile est **MMAudio**
  (le son fabriqué depuis la vidéo d'une animation), mais il demande un nœud à installer : il
  suit la même décision que les voix, et reste à éprouver sur du pixel art. HunyuanVideo-Foley
  reste exclu : sa licence ne vaut pas dans l'Union européenne, vente ou non.
- **Les voix** : second ComfyUI ou petit programme à part (SN11). Installer le nœud dans le
  ComfyUI actuel est déconseillé : c'est le risque qui a motivé la règle du 3 septembre.
- **CLAP dans le produit** : seulement si le banc montre qu'il trie mieux que l'oreille.
