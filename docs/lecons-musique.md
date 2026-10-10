# Leçons de musique — la bande originale de Cœur de Pierre

*Relevé du 10 au 11 octobre 2026, sur une soirée de production réelle : un écran
d'accueil, un camp en trois humeurs et une chanson, tous rendus par ACE-Step 1.5 sur
une RTX 3080 portable (8 Go). L'auteur a jugé chaque tour à l'oreille ; ce qui suit
est ce que ces jugements ont appris. Se lit avant de toucher aux gabarits de musique
(`atelier/audio/texte.py`), aux moteurs ACE (`atelier/audio/graphes.py`) ou au niveau
de sortie (`atelier/audio/traitement.py`).*

## Le résultat qui a été validé

**L'intro retenue** : moteur **XL turbo**, **60 s**, 72 BPM, 4/4, ré mineur, graine 6400.

- Légende : un chant de travail de mineurs nains. Basses très graves à l'unisson,
  rugueuses. Marteaux sur l'enclume, pioches, bottes. Tambours sur cadre, timbales,
  contrebasse en bourdon, tuba et cors graves. Une immense salle de pierre à long écho.
  Références : Tolkien, *The Hobbit — Misty Mountains Cold*, Moria.
- Paroles : une langue naine inventée, balisée en sections :
  - `[Intro - lone deep bass voice humming]`
  - `[Verse - deep male voices in unison, hammer strikes]`
  - `[Chorus - powerful low choir, horns, stomping]` « BARAK DUN! BARAK DUN! »
  - `[Outro - last hammer strike]`
- Ce qui s'entend : 12 s de voix seule, puis tout entre d'un coup à 18 s, un plateau
  puissant, une vraie retombée.

Il a fallu cinq versions pour y arriver. Chacune corrigeait un des défauts ci-dessous.

## Ce qui a raté, et pourquoi

| Tentative | Ce qui est revenu | La cause |
|---|---|---|
| v1 — légende en mots d'ambiance, sans structure, instrumental | des **nappes** sans mélodie ni carrure | le moteur prend « ambient, drone, pad, sparse » au mot ; sans balises de sections il n'a pas de plan |
| mode rapide (compositeur coupé) | une pâte floue | le compositeur 1.7b écrit le plan du morceau ; sans lui, 40 s de calcul pour rien d'utilisable |
| « D dorian mode » dans la légende | ignoré | ACE ne connaît que majeur/mineur ; une couleur modale se dit en mots (« modal, ancient ») |
| « no drums », « without piano » | les tambours et le piano **arrivaient** | le moteur n'entend pas la négation : il lit le mot qui suit |
| v2 — guide officiel mais toujours instrumental | propre, mais loin des références (Skyrim, Witcher, Hobbit) | **ces références sont chantées** : sans voix, aucune légende ne s'en approche |
| v3 — grand chœur épique hollywoodien | spectaculaire, pas « nain » | les nains de Tolkien sont des basses graves et lentes, pas un chœur de film |
| turbo (2B, 8 pas) | rendu correct mais terne, **saturé** (crête vraie +0,5 à +1 dBTP, jusqu'à 18 échantillons coupés) | le décodeur sort au-delà de 1,0 et `SaveAudio` (FLAC entier) coupe à l'écriture |
| morceaux de 150 s pour explorer | 3 à 4 min de calcul par prise, 15 min par tour de 4 | on cherche une direction : une minute suffit à l'entendre |
| file locale sur 150 s | annonce de 8 min pour un tour qui en prenait 17 | l'estimation ne savait ni la durée demandée ni le moteur |

## Ce qui marche

1. **XL turbo (4B) par défaut.** Comparé au même morceau, même graine, sur turbo, base
   et XL, l'auteur a trouvé le XL « bien meilleur à l'oreille à tous les niveaux ». Il
   dépasse les 8 Go de la carte, mais ComfyUI déborde en mémoire vive sans planter. Il
   calcule en **~1 min 20 pour 60 s**, compositeur compris, à peu près le temps du turbo.
   Le *base* (50 pas, cfg 6) garde l'arc du turbo, mais il prend 25 % de plus et ne
   s'entend pas mieux que le XL. ⚠️ Les mesures (LUFS, écart de volume) donnaient le
   *base* gagnant. **L'oreille a tranché contre elles** : une mesure de volume ne dit
   rien du grain des voix.
2. **Des voix, dans une langue inventée.** Des syllabes naines (« Dum gor, Khaz-ur
   ba-rak, BARAK DUN ») chantées par le chœur donnent la couleur que les références
   demandent, sans paroles à comprendre. En français, le moteur chante, mais il faut une
   prise de secours en anglais.
3. **Une légende à la manière du guide officiel**, en anglais, et sur plusieurs plans :
   - genre et usage ;
   - qui chante et comment (« very deep bass male voices, slowly, in unison, gruff ») ;
   - les instruments **et les gestes** (marteaux, pioches, bottes) ;
   - la salle (« vast stone hall, long natural echo ») ;
   - l'humeur en 3 ou 4 mots ;
   - deux ou trois références.
   On n'y met ni tempo, ni tonalité, ni négation. Une évolution se décrit dans le temps
   (« then erupts into… ») plutôt que par deux styles qui se contredisent.
4. **Une structure courte en balises** `[Section - descripteur]`, avec les paroles sous
   chaque section chantée et `[Instrumental]` sous les autres. Pour une minute :
   intro voix seule → couplet → refrain → retombée. Le « coup » d'entrée de tout
   l'orchestre est ce qui fait un écran d'accueil.
5. **Explorer en tours de deux essais de 60 s, sur la même graine.** Deux directions
   comparées à armes égales, une écoute d'une minute chacune, ~3 min de calcul par tour.
   La version longue ne se calcule qu'une fois la direction validée.
6. **Une marge de −4 dB avant l'écriture, puis −16 LUFS avec un limiteur à −1 dBTP.**
   Après la marge, plus aucune crête coupée (crêtes à −4 et −5 dBFS). Le niveau se règle
   ensuite sans écrêter.
7. **Une seule identité sonore pour tout le jeu.** La légende de l'intro retenue devient
   le style du projet : les autres pistes (camp, chanson) en reprennent les timbres et
   la salle, et ne changent que l'humeur et le rythme.

## Ce qui reste ouvert

- La **reprise d'un son** (cover) n'existe que sur les poids du turbo : pas encore de
  reprise en XL.
- Le **compositeur 4b** que le gabarit officiel associe au XL (8,4 Go) n'a pas été
  essayé ; le 1.7b déjà installé écrit les mêmes codes.
- L'oreille reste juge : **aucune mesure n'a su prédire la préférence de l'auteur**. Les
  mesures servent à écarter un défaut (saturation, silence en tête, morceau plat), pas
  à choisir.
