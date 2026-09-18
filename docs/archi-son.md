# Le son — comment il se fabrique, se range et se livre

> Écrit le 18 septembre 2026, à la demande de l'auteur : imaginer tout ce qu'il faut pour
> fabriquer les sons d'un jeu en local, de la demande à la livraison dans Godot. Les tranches
> sont dans [PLAN-son.md](PLAN-son.md). Les recherches qui fondent les choix, avec leurs
> sources : [musique](releves/2026-09-18-son-musique.md),
> [bruitages](releves/2026-09-18-son-bruitages.md),
> [voix et livraison Godot](releves/2026-09-18-son-voix-et-godot.md).

## 1 · Ce qui existe déjà

Le dépôt sait déjà, depuis AU14 :

- **importer** un son (WAV, OGG, MP3, FLAC) et le garder tel quel, avec son empreinte ;
- le **régler** sans toucher à la source : coupe, silence rogné, fondus, normalisation, gain,
  fréquence, repères de boucle — chaque réglage conservé est une version ;
- le **mesurer** : durée, crête, niveau moyen, silence, saturation, écart au raccord de boucle ;
- le **juger** (retenue, à juger, écartée) ;
- le **fabriquer** par un workflow ComfyUI de nature « audio », dans la file locale partagée
  avec la vidéo et la 3D, repris sans double appel s'il est coupé ;
- le **livrer** à Godot : un WAV, une ressource `AudioStreamWAV`, une scène avec un
  `AudioStreamPlayer`, et un manifeste.

Ce qui manque : **aucun workflow sonore n'est fourni** (l'auteur doit coller un export
ComfyUI), un son est **un seul fichier flottant dans le jeu** (ni sujet, ni famille, ni
variantes), le texte part **tel quel** (aucun univers sonore), il n'y a **ni musique, ni voix,
ni boucle travaillée, ni lien avec les animations**, et la livraison met tout le son **dans le
`.tres`** (lourd pour une musique, et sans les réglages de tempo que Godot sait lire).

## 2 · Ce que la machine sait faire, constaté le 18 septembre 2026

Le ComfyUI qui tourne (Comfy Desktop, **version 0.36.0**, `127.0.0.1:8188`) prend en charge
**sans aucun nœud à installer** les trois familles de modèles retenues : Stable Audio 3,
ACE-Step 1.5 et YuE2. Ses modèles de workflow officiels sont livrés avec lui
(`audio_stable_audio_3_medium`, `audio_ace_step_1_5_split`, `audio_yue2_text2music`,
`audio_yue2_music_cover`…). **Il ne manque que les fichiers de poids.**

La carte est une **RTX 3080 Laptop de 8 Go**, avec 32 Go de mémoire vive. Un seul modèle
sonore à la fois ; la file locale sérialise déjà les calculs.

Une règle du produit tient toujours (*tranché par l'auteur le 3 septembre 2026*) : **l'atelier
ne modifie jamais l'installation de ComfyUI** — ni paquet, ni nœud. Il lit ce qu'il trouve,
dit ce qui manque, et c'est l'auteur qui télécharge. Trois choses demanderaient un nœud à
installer : les voix (§4.5), la séparation de pistes d'une musique, et la réparation de
jointure d'ACE-Step. Chacune est une décision de l'auteur, pas du produit.

Les modèles de workflow officiels ne se prennent pas tels quels : celui de Stable Audio 3
Medium fait **réécrire le texte** par un modèle de langage avant de l'envoyer, ce que le
produit exclut (le texte montré est le texte qui part) ; celui d'ACE-Step charge un second
encodeur de 3,7 Go dont une carte de 8 Go se passe. Les profils livrés coupent les deux.

## 3 · Les sept familles de sons, et leur moteur

Une famille décide du moteur par défaut, de la durée, du nombre de tirages, du format de
livraison et de la façon d'écrire le texte qui part. Dans le code, ses clés sont exactement
`bruitage`, `interface`, `ambiance`, `musique`, `jingle`, `chanson`, `voix` ; le tableau
regroupe chanson et jingle, comme la maquette.

| Famille | Exemples | Moteur par défaut | Secours | Durée | Livré en |
|---|---|---|---|---|---|
| **Bruitage** | coup d'épée, pas, pièce ramassée, sort, porte | Stable Audio 3 Small-SFX | Stable Audio Open 1.0 | 1 à 4 s (plus court : généré à 1 s, puis coupé) | WAV mono |
| **Interface et rétro** | clic, validation, erreur, saut 8-bit | sfxr (calcul, sans IA, instantané) | — (Stable Audio ne descend pas sous 1 s) | 0,05 à 1 s | WAV mono |
| **Ambiance** | forêt, grotte, pluie, ville | Stable Audio 3 Small-SFX (jusqu'à 120 s) | Stable Audio 3 Medium | 20 à 60 s, en boucle | OGG stéréo |
| **Musique** | village, exploration, combat, boss, menu | ACE-Step 1.5 turbo | Stable Audio 3 Medium | 30 à 180 s, en boucle | OGG stéréo + tempo |
| **Chanson et jingle** | chanson de taverne, générique · victoire, défaite | YuE2 (chanté) · ACE-Step (jingle, seul à recevoir une tonalité) | Stable Audio 3 Medium pour un jingle, sans garantie de tonalité | 60 à 240 s · 2 à 8 s (ACE-Step : 2 s au moins) | OGG stéréo |
| **Voix** | réplique d'un PNJ, cri de douleur, cri de gobelin | Qwen3-TTS VoiceDesign puis Chatterbox Multilingual | transformation du son (hauteur, timbre) | 0,3 à 10 s | OGG mono |

**Pourquoi ACE-Step et pas YuE2 pour le fond de la bande-son.** L'auteur a demandé YuE2.
Il existe (sorti le 9 septembre 2026), il est natif dans ComfyUI, et c'est le meilleur modèle
ouvert pour **une chanson chantée**. Mais pour la musique d'un jeu il a trois défauts
mesurés par d'autres : il **ne sait pas faire d'instrumental fiable** (la voix revient au bout
de 20 à 60 s), il **n'a pas de réglage de tempo ni de tonalité** (il faut passer par sa
partition), et il ne chante officiellement qu'**en anglais et en chinois**. ACE-Step 1.5 a
tout cela en réglages directs — tempo, tonalité, mesure, durée, `[Instrumental]` — et c'est
ce qui permet de couper une boucle sur la mesure. YuE2 reste le moteur des chansons.
**Le banc SN0 tranche sur pièces** : les deux font la même boucle d'exploration, l'auteur écoute.

**Les licences, en clair.** *Le 18 septembre 2026, l'auteur a précisé que le jeu n'est pas
vendu : c'est un projet personnel. Les réserves commerciales ci-dessous ne bloquent donc rien ;
elles restent écrites pour le jour où cela changerait, et chaque son garde sa licence dans ses
crédits.*

| Moteur | Ce qu'on a le droit de faire |
|---|---|
| Stable Audio 3 (Small-SFX, Medium), Stable Audio Open 1.0 | Gratuit tant que le vendeur fait moins d'un million de dollars de chiffre d'affaires par an ; les sons appartiennent à celui qui les fabrique. L'encodeur de texte impose aussi d'accepter les conditions Gemma. |
| ACE-Step 1.5 | Libre (MIT), usage commercial des sorties écrit en toutes lettres. |
| YuE2 | Le modèle est non commercial, **sauf** pour une personne qui crée **en son nom propre** : elle peut vendre ce qu'elle génère (permission ajoutée le 16 septembre 2026). **Une société doit demander une licence.** Le texte de la licence part avec chaque morceau, daté. |
| Qwen3-TTS, Chatterbox | Libres (Apache, MIT). Chatterbox marque ses sons d'un filigrane inaudible. |
| sfxr | Portage Python de jsfxr, domaine public (Unlicense) : aucun paquet ajouté. |

Écartés pour licence non commerciale : AudioLDM 2, MMAudio, ThinkSound, Woosh, AudioX,
TangoFlux, MusicGen, IndexTTS, Voxtral, OmniVoice, Higgs 3. Écarté pour l'Europe :
HunyuanVideo-Foley (sa licence exclut l'UE). Écartés pour la carte : MiniMax Music 3 (encodeur
de 9 Go, et mention obligatoire dans l'interface du jeu), LeVo 2, WanSong, ACE-Step XL.

**Le son fabriqué depuis une vidéo n'est pas retenu par défaut.** Aucun modèle « vidéo → son »
n'est vendable depuis la France et tenable sur 8 Go, et aucun n'a été éprouvé sur du pixel art.
Le jeu n'étant pas vendu, **MMAudio** (non commercial, environ 6 Go) devient permis ; il demande
un nœud à installer, donc une décision de l'auteur, et un essai sur un clip de sprite. Même s'il
marche, l'atelier fait mieux pour le jeu : il sait déjà quelle image d'une animation porte le
pied au sol ou la lame qui touche (§6), et un son calé ainsi garde ses variantes.

## 4 · Le chemin d'un son, de la demande au jeu

```
 demande ──► texte qui part ──► tirages ──► écoute et choix ──► réglages ──► livraison
 (auteur,     (univers sonore    (8 graines   (grille, mesures    (coupe,      (fichiers,
  agent,       + famille          par défaut,  qui informent,      boucle,      .import,
  sujet)       + description)     file locale) jamais refusent)    niveau)      variantes, crédits)
```

### 4.1 La demande

Elle vient de l'auteur (Fabrications › Un son, ou la fiche d'un sujet), ou de l'agent qui
développe le jeu Godot (MCP). Elle dit **quoi** (une phrase), **pour quoi** (la famille,
l'emplacement dans un sujet si elle en a un) et **combien** de tirages. Jamais le style : il
vient de l'univers, comme pour les images.

### 4.2 Le texte qui part

Même règle que pour l'image : **on décrit le sujet, l'univers ajoute le style**, et l'écran
montre exactement le texte composé avant de lancer (*Relire avant envoi*). Les modèles sonores
comprennent l'anglais : les morceaux ajoutés par l'atelier sont en anglais, et la description
part **telle qu'elle est écrite**. Rien n'est traduit ni réécrit ; si la description n'est pas
en anglais, l'écran le signale. (Seul le texte d'une réplique de voix est en français, et c'est
voulu.)

**L'univers sonore** — un nouveau bloc de l'univers du jeu, à côté de la bible et de la palette :

| Champ | Exemple | Part vers |
|---|---|---|
| Époque et matière | `medieval fantasy, wood, leather, iron, no modern sounds` | bruitages, ambiances |
| Rendu | `retro 16-bit game` ou `realistic close foley` | bruitages, interface |
| Orchestre | `acoustic folk ensemble: lute, fiddle, flute, frame drum, harp` | musique |
| Humeur générale | `warm, whimsical, slightly melancholic` | musique, ambiances |
| Tonalité et tempo de référence | `D minor`, 90 BPM | musique (les jingles se calent dessus) |
| Moteur par famille | Small-SFX pour les bruitages, ACE-Step pour la musique… | toutes |

**Les gabarits par moteur** — ce que l'atelier compose, en gras ce que dit la demande :

- **Stable Audio 3, bruitage** : `TrackType: SFX.` **source et action** `, ` *époque et matière*
  `, ` *rendu de l'univers* `, one-shot, close-mic'd, dry, no reverb, isolated.` — durée fixée par la famille (1 s pour
  un pas, 2 à 3 s pour un sort). Pas de texte négatif : à guidage 1, il n'a aucun effet.
  Réglages : 8 pas, guidage 1.
- **Stable Audio 3, ambiance** : `TrackType: SFX.` **lieu et éléments** `, continuous, steady,
  field recording, no music, stereo,` *matière et humeur de l'univers*. 30 s par défaut.
- **Stable Audio Open 1.0 (secours)** : le même texte sans `TrackType`, avec le texte négatif
  `low quality, average quality` — utile ici, puisque ce modèle se règle à guidage 7.
- **ACE-Step 1.5, musique** : *tags* = **usage** (`exploration`, `battle`…) + *orchestre* +
  *humeur* ; *paroles* = une structure (`[Intro] [Instrumental] [Outro]`, ou `[Build] [Drop]`
  pour un combat) ; *tempo*, *tonalité*, *mesure* = ceux de l'univers ou de la demande ;
  *durée* = un **nombre entier de mesures** calculé par l'atelier
  (mesures × temps par mesure × 60 / tempo), plus une mesure de marge.
- **YuE2, chanson** : *style* = `English,` **genre et voix** `,` *orchestre* `,` tempo ;
  *paroles* = sections `[Verse] [Chorus] [Bridge] [Outro]`, seulement les mots chantés. Sa
  partition (ABC) s'affiche et se corrige avant le rendu.
- **Voix** : *la voix* = une description en anglais, écrite une fois par personnage
  (`Middle-aged man, warm and slightly nasal, friendly salesman`) ; *le texte* = la réplique en
  français ; *l'émotion* = un curseur (0,4 narrateur, 0,9 cri de douleur).

Des exemples prêts à l'emploi pour chaque famille sont dans les trois relevés (douze bruitages,
six musiques, six voix). Ils deviennent **les exemples livrés** des gabarits.

### 4.3 Les tirages

Un geste lance **une série** : 8 graines par défaut pour un bruitage, une ambiance ou un son
d'interface, 4 pour une musique, un jingle, une chanson ou une voix (chaque morceau prend une à
trois minutes) ; de 1 à 16. Une série fige sa méthode et son texte à sa préparation : la
reprendre après un changement de l'univers ne mélange pas deux textes. Tout est local : **aucun coût en argent**,
seulement du temps, que l'écran annonce à partir des mesures du banc. Les tirages passent par
la file locale existante, un moteur à la fois ; entre deux moteurs, ComfyUI décharge le
précédent (à vérifier au banc : sinon l'atelier le lui demande).

### 4.4 Écouter et choisir

Les tirages d'une série s'écoutent **en grille** : une forme d'onde par tirage, un clic pour
écouter, une touche pour passer au suivant. À côté de chacun, ses mesures : durée utile,
crête, niveau perçu (LUFS), silence de tête et de queue, saturation. **Les mesures informent,
elles ne refusent jamais** — c'est une règle du produit ; seuls un fichier silencieux ou
illisible ne sont pas annoncés prêts. Aujourd'hui, un son saturé est aussi bloqué (ni retenu, ni
livré) : SN3 le ramène à la règle — signalé, mais gardé et livré si l'auteur le décide.

On **garde** un ou plusieurs tirages. Plusieurs tirages gardés d'une même demande forment **un
jeu de variantes** (les huit pas sur l'herbe, les quatre cris du gobelin) : il se livre comme un
seul son que Godot joue au hasard. **Garder applique les réglages de la famille** (mono, niveau
visé) en une nouvelle version de chaque son, visible dans ses versions : c'est le geste de
l'auteur qui les pose, jamais un traitement qui se poserait seul.

Le score automatique « le son ressemble-t-il au texte » (CLAP) **reste au banc** : il
demanderait d'installer PyTorch dans l'atelier. On le réévalue si le banc montre qu'il trie
mieux que l'oreille pressée.

### 4.5 Les voix, à part

Les modèles de voix qui parlent français et se vendent (Qwen3-TTS VoiceDesign, Chatterbox
Multilingual) **ne sont pas natifs dans ComfyUI** : il faut le nœud *TTS Audio Suite*, qui
embarque dix-neuf moteurs et leurs bibliothèques. L'installer dans le ComfyUI actuel est
**déconseillé** : c'est exactement le risque qui a fait trancher la règle du 3 septembre (une
bibliothèque mise à jour pour l'un casse le générateur de l'autre). Deux voies restent, à
choisir par l'auteur le moment venu (tranche SN11) : **un second ComfyUI** réservé aux voix
(rien ne bouge pour l'image et la vidéo), ou ces modèles **dans un petit programme Python à
part**, que l'atelier appelle comme il appelle ComfyUI. La méthode est la même dans les deux cas :

1. **dessiner la voix une fois** par personnage (description → 10 s d'enregistrement) ;
2. garder cet enregistrement comme **voix de référence**, sur la fiche du personnage ;
3. **chaque réplique clone cette référence** — sinon le timbre change d'une réplique à l'autre ;
4. les cris et souffles s'écrivent en onomatopées (« Hnngh… Aaah ! ») avec l'émotion poussée ;
5. une créature part d'une voix humaine, puis **hauteur et timbre** se transforment dans les
   réglages du son (gobelin : +5 demi-tons ; ogre : −6).

### 4.6 Régler

Les réglages d'aujourd'hui restent, et gagnent :

- **le passage en mono** (bruitages, voix) ;
- **le niveau perçu** visé par famille, en LUFS, avec une crête plafonnée à −1 dB ;
- **la boucle sans couture** : repères posés sur un passage par zéro, fondu enchaîné de 20 à
  200 ms entre la fin et le début, et pour une musique, repères **sur une frontière de mesure**
  (le tempo est connu puisqu'on l'a demandé) ;
- **la hauteur** (en demi-tons), pour les créatures et les variantes.

| Famille | Niveau visé | Crête |
|---|---|---|
| Bruitage, interface | crête à −3 dB (le LUFS n'a pas de sens sur 0,2 s) | −1 dB |
| Voix | −18 à −16 LUFS | −1 dB |
| Musique | −18 à −16 LUFS sur la boucle | −1 dB |
| Ambiance | −28 à −24 LUFS | −1 dB |

Ce sont des points de départ d'usage, pas des normes : ils se règlent au mixage, dans le jeu.
Les recherches ne s'accordent pas (le relevé des bruitages vise −20 à −18 LUFS pour une
ambiance, et −16 à −12 LUFS pour un bruitage) : le banc SN0 tranche à l'oreille.

### 4.7 Livrer

La livraison actuelle garde sa forme (révisions, aperçu avant publication, manifeste) et
change de contenu :

| Livré | Aujourd'hui | Demain |
|---|---|---|
| Le son | PCM copié dans le `.tres` | **le fichier** : WAV pour bruitages et interface, OGG pour musique, ambiance et voix |
| Ses réglages Godot | boucle dans le `.tres` | **un `.import` à côté** : boucle, et pour la musique `bpm`, `beat_count`, `bar_beats` |
| Un jeu de variantes | — | un `AudioStreamRandomizer` (`.tres`) qui liste les fichiers, sans répétition, avec une petite variation de hauteur |
| Une musique à couches | — | un `AudioStreamSynchronized` (couches de même durée) |
| Une musique à états | — | un `AudioStreamInteractive` aux noms de clips stables (`exploration`, `combat`) |
| Un son calé sur une animation | — | une piste audio dans l'`AnimationPlayer` de la scène du personnage |
| La scène | `son.tscn` par révision, mais la scène stable s'appelle `personnage.tscn`, même pour un son | la scène stable s'appelle `son.tscn` ; un `AudioStreamPlayer2D` pour un bruitage de sujet, sur le bus de sa famille |
| Les crédits | provenance dans le manifeste | **`credits.json`** : moteur, version, licence, graine, texte ; pour YuE2 le texte de licence daté |

Dans le jeu, les sons prennent des **noms stables** : `sfx_`, `amb_`, `mus_`, `vo_`, `ui_` +
sujet + action, variantes sur deux chiffres ; les voix ont des dossiers `fr/` et `en/`
parallèles aux mêmes noms. Les bus (`Music`, `SFX`, `Voice`, `UI`) sont **proposés** dans le
manifeste ; l'agent Godot les crée, l'atelier n'écrit pas la configuration du projet.

Deux choses restent à prouver avec le vrai Godot 4.7 (les essais existants savent le lancer) :
qu'un `.import` écrit par l'atelier survit à `godot --headless --import`, et l'ordre des
constantes de transition d'un `AudioStreamInteractive`.

## 5 · Ranger : un son appartient à un jeu, et souvent à un sujet

- **Le son reste un objet du jeu**, avec sa source immuable, ses versions de réglages, son
  jugement, comme aujourd'hui.
- Il gagne **une famille** (les six du §3), et peut appartenir à **un sujet** — le personnage,
  l'objet, le lieu — à **un emplacement** nommé : *pas*, *attaque*, *coup reçu*, *mort*,
  *réplique* pour un personnage ; *ramasser*, *utiliser* pour un objet ; *ambiance* pour un
  lieu. L'onglet « Sons » de la fiche d'un sujet, qui existe déjà et dit aujourd'hui « les sons
  ne se rattachent pas encore à un sujet », montre ces emplacements, remplis ou vides.
- **Un jeu de variantes** regroupe plusieurs sons gardés d'une même demande.
- La galerie garde son onglet « Sons », qui se trie et se filtre par famille et par sujet
  comme les images.
- Chaque son dit **d'où il vient** : moteur, version du workflow, graine, texte parti, licence.

## 6 · Le son calé sur l'animation

L'atelier connaît chaque image d'une animation. Sur la bande d'un mouvement, l'auteur (ou
l'agent) pose **un repère sonore** sur une image : « image 3 : pas », « image 5 : impact ».
Le repère désigne un emplacement du sujet, donc un son ou un jeu de variantes. À la livraison,
la scène du personnage reçoit une **piste audio** dans son `AnimationPlayer`, au temps de
l'image (numéro ÷ cadence). La salle d'essai des animations (`RP23`) joue ces sons, et Godot
garde la main sur la variante et le volume.

## 7 · Ce que l'agent peut demander

Les outils actuels (`list_sounds`, `import_sound`, `edit_sound`, `judge_sound`,
`preview_sound_delivery`, `prepare_audio`) gagnent : demander **une série** pour un emplacement
d'un sujet, demander **une musique** avec tempo, tonalité et nombre de mesures, poser **un
repère sonore** sur une animation, et publier. Le cadre de délégation reçoit enfin **les moteurs
sonores permis** (un manque noté en `RP2`), et un plafond en **temps de calcul** local.
