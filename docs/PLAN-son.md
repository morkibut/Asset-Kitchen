# Le son — plan

> Demandé par l'auteur le 18 septembre 2026 : fabriquer en local, par ComfyUI, tous les sons
> d'un jeu — bruitages, ambiances, interface, musique, voix — et les livrer à Godot. Le dépôt
> sait déjà importer, régler, juger et livrer **un** son (AU14) ; ce plan en fait un pan entier
> de l'atelier. Le comment est dans [archi-son.md](archi-son.md) ; les recherches sourcées dans
> `docs/releves/2026-09-18-son-*.md`.
>
> Quel modèle sur quelle tranche : [PLAN-son-affectation.md](PLAN-son-affectation.md).
>
> **Où en est le chantier (19 septembre 2026, branche `feat/son`, worktree
> `.claude/worktrees/son`).** SN0, SN1, SN2, SN3, SN4, SN5 et SN8 sont écrits, **serveur et
> écrans**, vérifiés au navigateur sur l'atelier jetable (`essais/atelier_jetable_son.py`, ComfyUI
> doublé) et relus en croisé. Une case cochée ci-dessous est tenue. Ce qui reste ouvert attend un
> vrai ComfyUI avec ses poids (le banc SN0), ou une tranche suivante. SN6 (les sons d'un sujet)
> est écrit à son tour, serveur et écrans, tenu par les essais, pas encore revu au navigateur ;
> il a fermé les deux écarts connus avec la maquette : une série et ses jeux se retrouvent après
> un rechargement (depuis l'emplacement d'un sujet, et dans « Un son » sous « Séries
> précédentes »), et « Livrer au jeu › Sons » range les sons par famille.

## Décisions d'architecture

- **Tout est local et gratuit en argent.** Le coût d'un son est du temps de calcul, et l'écran
  l'annonce avant de lancer, à partir des mesures du banc.
- **L'atelier ne touche pas à ComfyUI** (décision du 3 septembre 2026). Stable Audio 3, ACE-Step
  1.5 et YuE2 sont natifs dans la version installée (0.36.0) : l'auteur télécharge les poids,
  l'atelier les cherche, et dit précisément ce qui manque, où le poser et d'où il vient.
- **L'atelier fournit ses méthodes sonores.** Plus besoin de coller un export ComfyUI pour faire
  un bruitage : les profils des moteurs retenus sont livrés, dérivés des modèles de workflow
  officiels. Coller son propre workflow reste possible.
- **Sept familles**, sous ces clés exactes : `bruitage`, `interface`, `ambiance`, `musique`,
  `jingle`, `chanson`, `voix`. Elles fixent le moteur par défaut, la durée, le nombre de tirages,
  le niveau visé et le format de livraison ([archi-son.md §3](archi-son.md)). La maquette les
  montre en six boutons (« chanson et jingle » partagent le leur, avec un choix dedans).
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
| *Second secours, facultatif* | `stable-audio-open-1.0.safetensors` + `t5-base.safetensors` | `checkpoints`, `text_encoders` | à relever |

Stable Audio Open 1.0 passe par les nœuds **natifs** de ComfyUI : la copie au format diffusers
déjà présente (utilisée par MySpriteAi par un nœud tiers) ne lui sert pas.

Le modèle de réécriture de Stable Audio 3 Medium (`qwen3.5_2b_bf16`, 4,6 Go) n'est pas
nécessaire : il est coupé (voir les décisions). **Le second encodeur d'ACE-Step
(`qwen_1.7b_ace15`, 3,7 Go) reste une question pour le banc** : ComfyUI ne reconnaît
l'encodeur d'ACE-Step 1.5 que par son chargeur à deux fichiers ; le profil livré y met le
petit encodeur deux fois et coupe les « codes audio » que le grand écrit — le nœud les décrit
comme ce qui améliore la qualité. Si le banc l'entend, il faudra le télécharger ; le banc
essaie les deux quand le fichier est là.

Les liens sont dans les notes des modèles de workflow officiels (dans ComfyUI : Modèles →
Audio) et dans les relevés. La licence de Stable Audio 3 est à accepter sur la page
`stabilityai/stable-audio-3-small-sfx`, avec les conditions Gemma de son encodeur.

## Les tranches

### SN0 · Le banc des moteurs, sur la machine

> Lancé le 19 septembre 2026 : [le relevé](releves/2026-09-19-son-banc.md). 152 tirages
> audibles, YuE2 int8 sans bruit pur ; reste l'écoute de l'auteur.

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

- [x] Chaque moteur retenu produit un son audible sur la 3080 Laptop, ou le banc dit pourquoi
      (fichier manquant, mémoire, **bruit pur de YuE2 int8** — un défaut signalé ailleurs).
- [x] Le temps de calcul et le pic de mémoire sont relevés par moteur et par durée : c'est ce
      que l'écran annoncera.
- [ ] Le banc dit si ComfyUI décharge seul un moteur quand le suivant arrive. *(Pas mesuré : le
      banc libère la carte lui-même entre deux moteurs ; les pics restent sous 7,1 Go sur 8.)*
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

- [x] L'auteur l'a parcourue et validée ; les écrans des tranches suivantes la suivent.

### SN1 · Un bruitage depuis une phrase, sans coller de workflow

**Bloquée par** : SN0.

L'atelier livre ses profils sonores (Small-SFX, Medium, ACE-Step 1.5, YuE2, Stable Audio Open
1.0 par les nœuds natifs). Le format de profil apprend les liaisons qui manquent : paroles,
tempo, tonalité, mesure, et **une durée libre dans un intervalle** (la graine existait déjà,
posée par le chantier des moteurs locaux ; le nombre de tirages n'est pas une liaison — une série,
ce sont N travaux, voir SN3)
(aujourd'hui, une durée doit figurer dans une liste déclarée ; une musique de 16 mesures à
90 BPM dure 42,67 s). Le profil de Stable Audio 3 Medium coupe la réécriture du texte. Le
diagnostic nomme chaque fichier absent, son dossier et sa source.

- [ ] Sur un ComfyUI qui a les poids, un bruitage se lance depuis une phrase et revient
      écoutable, sans rien importer.
- [x] Sur un ComfyUI à qui manque un fichier, le moteur est grisé avec le nom du fichier, son
      dossier et sa page de téléchargement — jamais proposé puis refusé.
- [x] Un workflow collé par l'auteur marche comme avant.

### SN2 · L'univers sonore, et le texte qui part

**Bloquée par** : SN1.

Le bloc sonore de l'univers (époque et matière, rendu, orchestre, humeur, tonalité et tempo de
référence, moteur par famille), les gabarits par moteur et leurs exemples livrés, et la
composition du texte montrée avant le lancement.

- [x] Un pas d'un jeu « fantasy médiévale, rendu 16-bit » part avec `TrackType: SFX`, la
      description, le rendu et la prise de son — et l'écran le montre avant (« Relire avant
      l'envoi »).
- [x] Un univers vide ne contraint rien : la description part seule, avec la prise de son de la
      famille.
- [x] Un texte relu à la main part tel quel.
- [x] Une description en français part telle quelle, et l'écran signale que le moteur comprend
      l'anglais — rien n'est traduit.

### SN3 · Une série de tirages, et les variantes

**Bloquée par** : SN2.

Un geste lance N graines (8 par défaut) ; la série s'écoute en grille, avec ses mesures (dont
le niveau perçu en LUFS, nouveau) ; garder plusieurs tirages forme un jeu de variantes.

- [x] Huit tirages d'un pas reviennent dans une même série, écoutables à la suite au clavier
      (← → passent et font écouter, Espace réécoute, G garde).
- [x] Garder quatre tirages forme un jeu de variantes qui se rouvre avec ses quatre sons.
- [x] Une série coupée en route reprend sans relancer les tirages déjà rendus.
- [x] Aucune mesure n'écarte un tirage d'elle-même : un tirage saturé est signalé, mais se
      garde et se livre si l'auteur le décide.

Garder des tirages applique aussi les réglages de leur famille (mono, niveau visé) en une
nouvelle version de chaque son, visible dans ses versions — c'est le geste de l'auteur qui les
pose, jamais un traitement qui se poserait seul.

### SN4 · Livrer des fichiers que Godot lit tels quels

**Bloquée par** : SN3.

WAV ou OGG selon la famille (l'OGG passe par le ffmpeg déjà présent), le `.import` à côté, le
`AudioStreamRandomizer` d'un jeu de variantes, la scène stable nommée `son.tscn` (elle
s'appelle aujourd'hui `personnage.tscn`, même pour un son), les noms stables
(`sfx_`, `amb_`, `mus_`, `vo_`, `ui_`), le niveau visé par famille, le passage en mono, et
`credits.json`. **Un son sans famille** — importé, ou fabriqué par un workflow collé — garde le
paquet d'AU14 (PCM dans le `.tres`) : l'auteur ou l'agent lui pose une famille (route
`PUT …/family`, outil `set_sound_family`) pour qu'il se livre en fichiers.

- [x] Dans un vrai Godot 4.7 (`--headless --import`), le `.import` écrit par l'atelier survit et
      le son joue en boucle quand il le doit. *(Godot le réécrit s'il est incomplet : l'atelier
      écrit donc la forme complète, gardée octet pour octet — voir `docs/PIEGES.md`.)*
- [x] Un jeu de huit variantes se livre en `AudioStreamRandomizer` réglé pour ne jamais rejouer
      la même variante deux fois de suite (`playback_mode = 0`).
- [x] `credits.json` nomme le moteur, sa licence, la graine et le texte de chaque son.
- [x] Une livraison de son ne crée plus de `personnage.tscn`.

### SN5 · Les ambiances qui bouclent sans couture

**Bloquée par** : SN4.

Repères posés sur un passage par zéro, fondu enchaîné réglable entre la fin et le début, mesure
du raccord qui dit s'il claque ; et si le banc l'a montré possible en natif, **la réparation de
la jointure** par Stable Audio 3 (on refait les deux secondes autour du raccord).

- [ ] Une pluie de 30 s tourne dix fois de suite sans clic audible, et la mesure du raccord le
      confirme. *(Prouvé sur une pluie synthétique ; reste une vraie pluie du banc.)*
- [x] L'écran fait entendre le raccord seul (les deux secondes autour), en boucle.

### SN6 · Les sons d'un sujet

**Bloquée par** : SN4 (ses sons se livrent avec le sujet, sous leurs noms stables).

Un son peut appartenir à un sujet, à un emplacement nommé ; l'onglet « Sons » de la fiche
montre les emplacements de sa famille, remplis ou vides, et on lance une série depuis un
emplacement vide. La livraison d'un sujet emporte ses sons.

- [x] Depuis la fiche d'un héros, l'emplacement « pas » vide lance une série déjà décrite par
      le sujet ; le son gardé y apparaît.
- [x] Un son sans sujet reste un son du jeu, visible dans la galerie.
- [x] Livrer le héros livre ses sons avec lui, sous leurs noms stables.

*(19 septembre 2026 : tenus par `tests/test_sn6_sujet_sons.py` et
`SonsDuSujet.test.tsx`, `SonsALivrer.test.tsx` ; pas encore revus au navigateur sur l'atelier
jetable.)* La forme posée, dont SN7, SN11 et SN12 héritent, est écrite en tête de
`atelier/domaine/sons_du_sujet.py` : un fichier par sujet, des emplacements `{cle, nom,
famille, contenu: {nature: jeu | son, identifiant}, series}` ; un emplacement se désigne par
`{sujet, cle}` ; son nom stable est `<préfixe>_<sujet sans article>_<clé>` (`sfx_pelerin_pas`).
Une série préparée depuis un emplacement porte `emplacement: {sujet, cle}`, et « Garder » y
range dans le jeu de l'emplacement. La livraison du sujet pose ses sons dans `sons/` de la
révision, avec un `AudioStreamPlayer2D` par emplacement dans la scène (celui que la piste
audio de SN7 visera).

### SN7 · Le son calé sur l'animation

**Bloquée par** : SN6.

Un repère sonore se pose sur une image d'une bande ; il désigne un emplacement du sujet. La
salle d'essai des animations le joue ; la livraison ajoute une piste audio à l'`AnimationPlayer`.

- [ ] Le repère « image 3 : pas » de la marche vers le sud se joue à chaque boucle dans la salle
      d'essai, et dans Godot.
- [ ] Changer la cadence d'une bande garde le repère sur la même image.

### SN8 · Les sons d'interface et rétro, sans ComfyUI

**Bloquée par** : SN3.

sfxr **porté en Python** depuis jsfxr (domaine public), sans paquet ajouté : des départs types
(clic, survol, validation, erreur, saut, pièce, explosion…), des curseurs, une mutation pour
tirer des variantes, un son en un instant, sans carte graphique.

- [x] Un clic et sa famille (survol, validation, erreur) se fabriquent en moins d'une seconde
      chacun et se livrent comme les autres sons. *(Pas de curseurs à l'écran : la maquette n'en
      montre pas ; les réglages restent conservés pour refaire un son à l'identique.)*
- [x] Un son sfxr se refait à l'identique depuis ses réglages conservés.

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
