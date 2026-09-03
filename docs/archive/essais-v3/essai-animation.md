# Séance d'essais — la recette d'animation

> **Ce document ne décide rien.** C'est un mode d'emploi : comment mener, en une
> demi-journée et pour moins d'un euro, la séance d'essais qui ouvre la V3.
> Écrit le 1<sup>er</sup> septembre 2026, avant qu'une seule ligne de code de la V3
> soit écrite. Il se referme le jour où la séance a rendu son verdict.

---

## Ce que cette séance décide, et pourquoi elle passe avant tout le reste

La V3, c'est l'animation : un personnage qui marche, une torche qui brûle, une pièce
qui tourne. Pour animer quelque chose, il faut **plusieurs dessins du même sujet à
plusieurs instants**, et il faut que ce soit vraiment le même sujet — même taille,
mêmes couleurs, même tête.

L'atelier sait déjà demander **plusieurs dessins d'un coup**. Il envoie au modèle une
feuille quadrillée vide — des cases dessinées d'un trait clair sur fond neutre — et le
modèle remplit les cases. L'atelier redécoupe ensuite la feuille et range chaque case
comme une image à part. Ça s'appelle **le pliage** dans le dépôt, et ça sert
aujourd'hui à obtenir huit attitudes différentes en un seul appel payant plutôt qu'en
huit.

**Ce qui est prouvé** : le modèle sait remplir huit cases avec **huit choses
différentes**.

**Ce qui n'est pas prouvé du tout** : qu'il sache remplir huit cases avec **les huit
étapes d'un même geste**. C'est une demande d'une tout autre nature. Rien dans le
dépôt ne le dit, parce qu'aucune image d'animation n'y existe encore.

Toute la V3 repose sur cette réponse. La séance coûte **moins d'un euro** et ne demande
**aucune ligne de code**. C'est la raison pour laquelle elle passe avant tout.

---

## Avant de commencer — trois vérifications

1. **L'atelier démarre.** Double-clic sur `lancer-atelier.bat`, à la racine du projet.
   Un navigateur s'ouvre sur `http://127.0.0.1:8420`.
2. **La clé est en place.** Le fichier `.env`, à la racine, contient une ligne qui
   commence par `OPENROUTER_API_KEY=`. Sans elle, rien ne part.
3. **Le budget.** Une feuille coûte **entre un et deux centimes** selon le nombre
   d'images qu'on y joint. La séance complète en demande une quinzaine : **moins
   d'un euro au total**. Ce n'est pas une figure de style, c'est le prix relevé dans
   le dépôt.

---

## Étape 1 — Un projet jetable, et pourquoi il faut qu'il soit jetable

**Ne fais pas la séance dans un vrai projet.** La liste des attitudes qu'un jeu réclame
— le *plan de poses* — appartient au projet, et la séance va y ajouter huit fausses
attitudes qui ne servent qu'à l'essai. Dans un vrai projet, elles resteraient là.

1. Crée un projet nommé **« Essai animation »**.
2. Déclare sa vue — la façon dont le jeu regarde le monde. Prends
   **« De côté — plateforme »** (le produit la présente avec ses exemples : Mario,
   Celeste, Hollow Knight). Deux raisons : c'est la vue qui demande le moins d'angles
   après la vue de face, donc la moins chère ; et un pas de marche vu de côté est le
   seul où l'on voit vraiment les jambes se croiser — de face, on ne saurait pas dire
   si le modèle a compris.
3. **Retire l'angle « gauche ».** Cette vue propose deux angles, droite et gauche —
   et chaque attitude demande donc **deux** images au lieu d'une, ce qui double toute
   la séance pour rien. Onglet **Codex**, colonne de gauche, **« Les directions »** :
   sur la ligne *gauche*, clique le **×**. Le geste est réversible — un lien
   *« revenir à ce que la vue propose »* apparaît juste en dessous —, et les images
   déjà faites gardent leur angle.

   > **Pourquoi ça ne coûte rien.** Dans un jeu vu de côté, la gauche est le **miroir
   > exact** de la droite : aucun studio ne la dessine, le moteur du jeu retourne
   > l'image. Payer les deux serait payer deux fois la même chose.
4. Fabrique **un personnage**, un seul. Celui de la séance est choisi et décrit en
   annexe, à la fin de ce document : **le voyageur à la lanterne**. Ses réglages y sont
   prêts à recopier.

### Générer la première attitude — les clics, un par un

**Avant tout : vérifie que l'attitude « repos » existe.**
Onglet **Codex**, rubrique **« Leurs poses »**. Si elle n'y est pas, tape son nom dans le
champ et fais **Entrée** — écrire un nom crée l'attitude, sans formulaire et sans un
centime. Sur sa ligne, trois choses à régler :

- son **nom** : `repos` ;
- la case **« ce que "repos" dit au modèle »** — c'est l'anglais qui part réellement.
  Écris-y : `idle stance, standing still, full body, arm hanging down with the lantern` ;
- **images demandées** : `1`.

**A · Écris la description du personnage sur sa fiche. C'est la marche qu'on rate, et
elle bloque tout.**

Onglet **Codex**, va sur le personnage. Dans la colonne de gauche, la case
**Description** — celle qui dit *« ce qu'il faut redire au modèle à chaque image de ce
personnage »*. Colle-y le bloc anglais donné plus bas dans cette annexe.

Le produit appelle ça **le signalement**, et il en fait une promesse : *elle part avec
chaque image de ce personnage et ne se retape jamais*.

> **Pourquoi c'est bloquant, et pourquoi c'est le bon endroit.** Le champ de l'atelier
> n'est pas un champ libre quand une case est visée : il **reçoit le signalement**, et lui
> seul. Signalement vide, champ vide, bouton *Générer* gris avec sa raison — *aucun
> prompt*. Le produit va jusqu'à écrire la réparation dans son refus : *« rien ne dit ce
> qu'il faut dessiner — écrivez le signalement de la chose sur sa fiche, ou décrivez le
> sujet dans le champ ».*
>
> Et l'écrire **là** plutôt que dans le champ n'est pas un détail de confort : à l'étape 3,
> la feuille de huit cases emporte le signalement une fois pour toutes. Sans lui, elle
> partirait en disant seulement *walk cycle frame 3 of 8* — **sans jamais dire de quoi**.
> La séance échouerait alors pour une raison qui n'a rien à voir avec l'animation.

**B · Ouvre l'établi du personnage.**
Sur sa fiche, bouton **« Ouvrir son établi »**.

**C · Arme la case — et vise une seule direction.**
L'établi montre une ligne par attitude, et **sous chacune, une ligne par direction**.
La ligne *repos* annonce `0 / 2` : elle demande deux images, une par direction. Clique
**« Fabriquer »** sur la sous-ligne **droite**, pas sur *repos* — une seule image, un seul
appel, et c'est le côté vers lequel le dessin de référence regarde déjà.

L'infobulle dit : *prépare le prompt dans l'atelier — rien n'est dépensé ici.* C'est la
règle du produit : **la matrice arme, l'atelier tire.**

**D · Reste où tu es — la barre qui paie est en bas de l'écran**, et elle marche depuis
l'établi comme depuis la galerie. Elle montre trois choses : la **cible** (`POUR` suivi du
personnage et de son attitude), le **coût attendu**, et une ligne repliée **« réglages de
l'appel »**.

**E · Déplie « réglages de l'appel »** et vérifie quatre réglages :

- le **modèle** — prends-en un bon, et payant. C'est le témoin : on veut le meilleur du
  modèle, pas son économie ;
- les **proportions** : `1:1` ;
- les **variations** : `1` ;
- l'**échelle** : `personnage`. C'est elle qui décide que le sujet occupe toute sa case
  **et** quels artworks partent avec lui. Une échelle fausse envoie les images d'une
  autre famille sans que rien ne le dise.

**F · Le texte doit maintenant être là tout seul.**
Sous le champ, une ligne dit d'où il vient : *« proposé, d'après son signalement · la
consigne de l'attitude part à côté · modifiable · défaire › »*. Traduction : le texte
vient de la fiche du personnage (étape A), et **la consigne de l'attitude — l'anglais du
plan de poses — part sur une ligne séparée**, sans que tu aies à la recopier.

Si le champ est encore vide, c'est que l'étape A n'a pas été faite. N'écris rien ici :
retourne l'écrire sur la fiche, sinon tu la retaperas à chaque appel de la séance.

**N'ajoute jamais le style** : la bible le porte et il part tout seul.

**G · Clique « Générer ».**
⚠️ **Ce bouton ne paie pas.** Depuis E14, il ouvre l'écran de confirmation. C'est voulu :
il n'envoie plus, il fait relire.

**H · L'écran de confirmation — c'est là qu'on lit avant de payer.**
Il montre le **texte exact, mot pour mot**, et **chaque image qui partira**, ligne par
ligne, avec sa provenance.

> **Le contrôle qui décide de toute la séance : ton dessin doit apparaître dans cette
> liste.** S'il n'y est pas, arrête-toi — quelque chose est mal réglé en amont, et
> payer maintenant ne mesurerait rien.

Le bouton du bas annonce le vrai prix : **« Payer et lancer $0,0… »**. Clique.

**I · Promeus l'image qui revient — quatre clics, sans changer d'onglet.**

Attends d'abord que l'image soit arrivée : la ligne *repos · droite* de l'établi doit
passer de `0 / 1` à `1 / 1`. Tant qu'elle affiche zéro, il n'y a rien à promouvoir et
l'atelier ne proposera rien.

1. **Reste sur l'onglet Codex**, sur le personnage — l'écran où tu es déjà.
2. En haut à gauche, sous son nom, clique le lien **« sa fiche › »**. *(Ses deux voisins
   sont « la vitrine › » et « le calibrage › ».)*
3. La fiche a **cinq blocs** ; ouvre le troisième, **« Ses images de référence »**. Son
   titre annonce combien d'images sont déjà retenues.
4. Tout en bas du bloc, sous un intertitre **« proposées, d'après ce qui est fait »**, une
   ligne t'attend : à gauche sa provenance — *« le corps retenu de repos »* —, à droite sa
   raison — *« ce à quoi il ressemble une fois passé par le style du jeu »* —, et au bout
   un lien **« retenir › »**. **Clique dessus.**

**Comment savoir que c'est fait :** la ligne quitte les propositions et remonte dans la
liste du dessus, avec une croix au bout pour défaire. Le compte du bloc augmente d'une
unité.

À partir de cet instant, chaque appel visant ce personnage emporte cette image en disant
**« voilà le sujet »**. C'est la pièce qui manquait.

### La liste à cocher avant de passer à l'étape 2

Ne commande aucune feuille tant que ces six lignes ne sont pas vraies. Chacune, si elle
manque, fait rater la séance pour une raison qui n'a rien à voir avec l'animation.

- [ ] Le projet **« Essai animation »** existe, et c'est lui qui est ouvert.
- [ ] Sa **vue** est déclarée : *De côté — plateforme*.
- [ ] Sa **taille de pixel** est 64.
- [ ] Les **quatre cases de la bible** qui se remplissent à la main sont écrites — monde,
      époque, trait, éclairage. Les trois autres restent vides.
- [ ] Le dessin est sur le tableau d'inspiration, **désigné concept art** du personnage
      **et promu artwork officiel** de la famille *personnages*.
- [ ] La **première attitude est générée, et son image est promue** sur le personnage.
      *C'est la ligne qu'on oublie, et c'est la plus importante des six.*

---

## Étape 2 — Fabriquer les fausses attitudes

C'est l'astuce de toute la séance, et elle ne demande rien à personne : **on fait passer
les étapes d'un mouvement pour des attitudes**.

Une feuille quadrillée sort avec **une case par attitude cochée**, et chaque case
emporte le petit texte anglais que l'attitude porte. Donc huit attitudes nommées
« étape 1 » à « étape 8 » donnent **huit cases qui décrivent chacune un moment du pas**.

**Où, exactement.** Onglet **Codex**, rubrique **« Leurs poses »**. C'est le seul endroit
du produit où l'on écrit l'anglais d'une attitude — une attitude ajoutée depuis l'établi
(*« une attitude pour elle seule… »*) ne porte qu'un nom, sans texte anglais, et ne
servirait donc à rien ici.

**Fais d'abord de la place.** Le plan neuf arrive avec six attitudes. Garde **repos** — elle
porte ton témoin — et retire les cinq autres d'un clic sur leur **×** au bout de la ligne.
Rien n'est perdu : *les images déjà faites restent*. Sans ce ménage, l'établi mélangera une
*marche* d'origine avec les huit étapes de la marche qu'on fabrique, et on s'y perdra.

**Puis ajoute les huit, une par une.** Tape le nom dans le champ, **Entrée** — écrire un nom
crée l'attitude, sans un centime. Chaque ligne porte ensuite trois champs, de gauche à
droite : le **nom**, le **texte anglais** (*« ce que X dit au modèle »*), et le nombre
d'**images demandées**. Mets **1** partout : une attitude, une case.

| Attitude | Le texte anglais qui part avec la case |
|---|---|
| étape 1 | `walk cycle, frame 1 of 8: contact, left foot forward` |
| étape 2 | `walk cycle, frame 2 of 8: down, weight on left foot` |
| étape 3 | `walk cycle, frame 3 of 8: passing, right leg swinging through` |
| étape 4 | `walk cycle, frame 4 of 8: up, left leg straight, body highest` |
| étape 5 | `walk cycle, frame 5 of 8: contact, right foot forward` |
| étape 6 | `walk cycle, frame 6 of 8: down, weight on right foot` |
| étape 7 | `walk cycle, frame 7 of 8: passing, left leg swinging through` |
| étape 8 | `walk cycle, frame 8 of 8: up, right leg straight, body highest` |

> Ce découpage en huit — contact, appui, passage, sommet — n'est pas inventé : c'est le
> cycle de marche standard des animateurs depuis toujours. Si le modèle connaît quelque
> chose, il connaît ces mots-là.

---

## Étape 3 — Les trois manches, dans cet ordre

**Une règle qui vaut pour les trois, et sur laquelle il ne faut pas économiser :
chaque configuration se commande deux fois.** Un modèle d'image ne rend jamais deux
fois la même chose. Un seul tirage confond *ce que le modèle sait faire* avec *la
chance qu'on a eue*. L'écart entre les deux tirages est une mesure à lui tout seul, et
c'est la règle qu'appliquent déjà tous les essais du dépôt.

### Manche 1 — Comment il faut dire le mouvement *(4 feuilles)*

Un seul modèle, le meilleur du banc. Huit cases. Deux façons de demander, deux tirages
chacune.

**Façon A — une phrase par case.** C'est le chemin normal du produit, sans rien détourner.
Les clics :

> ### ⚠️ Le bouton à ne surtout pas cliquer
>
> Le panneau de droite du codex offre un bouton **« Fabriquer ce qui manque »**, et il
> annonce lui-même ce qu'il ferait : *« 8 planches, une par pose »*. C'est **huit appels
> payés**, une feuille par attitude — l'exact inverse de ce qu'on veut, qui est **un seul
> appel dont les huit cases sont les huit étapes**.
>
> Il n'est pas fautif : il sert à remplir un vrai personnage. Mais ici il ressemble
> beaucoup au geste juste, il est gros, et il est à côté. Ne le clique pas.

1. Ouvre l'établi du personnage (Codex → le personnage → **« Ouvrir son établi »**).
2. **Coche la case à gauche de chacune des huit étapes.** L'infobulle le dit : *cochées
   ensemble, elles partent en une seule planche.*
3. Dès la deuxième cochée, un bloc paraît en bas de la liste : **« 8 attitudes, un seul
   appel »**, avec le bouton **« Fabriquer ensemble › »**. Clique-le. *(Rien n'est encore
   dépensé — ça arme, comme *Fabriquer*.)*
4. Le champ se remplit du signalement, comme à l'étape 1. Clique **« Générer »**.
5. **Sur l'écran de confirmation, vérifie le compte de cases avant de payer.** Il doit
   annoncer **huit**. S'il en annonce deux ou seize, quelque chose est coché de travers, et
   c'est le seul moment où ça se rattrape gratuitement.

Chaque case part avec son propre texte, celui du tableau ci-dessus.

**Façon B — le cycle décrit en une seule fois.** Coche les mêmes huit attitudes. Sur
l'écran de confirmation — celui qui montre le texte exact avant de payer —, clique
**« Reprendre le texte › »** : le texte composé descend dans le champ et devient
modifiable. Remplace-le entièrement par une description du cycle entier, du genre :

```
A walk cycle of the same character, 8 frames, drawn in the empty cells of the grid.
Read the cells left to right, then the next row. Each cell is one step of the same
walk, same character, same size, same colours, seen from the same side.
```

Le bouton ne touche qu'au texte : la feuille quadrillée part quand même, et le prix
ne bouge pas.

### Manche 2 — Combien d'étapes tiennent sur une feuille *(4 feuilles)*

Garde la façon qui a le mieux marché en manche 1. Refais-la avec **quatre attitudes
seulement**, puis avec **six**. Deux tirages chacune.

Ce qu'on cherche : plus il y a de cases, plus chacune est petite. À un moment le sujet
devient trop petit pour rester lui-même. On veut savoir où est ce moment.

### Manche 3 — Quels modèles y arrivent *(6 à 8 feuilles)*

La recette gagnante, sur **trois ou quatre modèles différents**, deux tirages chacun.
Un modèle qui coûte trois fois moins cher et qui tient le sujet vaut mieux qu'un
champion qui le perd.

---

## Étape 4 — Où regarder les résultats

### La feuille brute — c'est elle qu'on juge

**Attention : la feuille quadrillée n'entre jamais dans la bibliothèque.** L'atelier la
découpe et ne range que les morceaux. C'est délibéré, et c'est écrit dans le code.

Mais elle reste sur le disque. Va dans :

```
donnees\generations\
```

Trie par date de modification : **le dossier le plus récent est ton dernier appel.**
Dedans, le fichier `0-brut.png` **est la feuille telle qu'elle est revenue du modèle**.
C'est ce fichier-là qu'il faut ouvrir et regarder en grand. Les autres fichiers
numérotés sont les morceaux découpés.

### L'écran de calibrage — la mesure gratuite qu'il ne faut pas rater

Sur la rangée du personnage, trois petits liens se suivent : *sa fiche ›*, *la vitrine ›*,
**le calibrage ›**. Clique le troisième.

Le calibrage empile toutes les attitudes du personnage **l'une sur l'autre, à la taille
qu'elles auront dans le jeu**, en transparence.

C'est exactement l'outil qu'il faut ici, et il ne coûte rien : huit vignettes côte à
côte ne montrent pas qu'une étape est plus petite que les autres — **huit silhouettes
empilées, si.** Si les huit contours se superposent proprement, le modèle a tenu la
taille. S'ils forment un éventail, il ne l'a pas tenue, et aucun recalage ne
rattrapera ça.

Le lien voisin, **la vitrine ›**, montre les mêmes étapes en grand et à la même échelle,
sur le fond que le jeu décrit. C'est là qu'on juge le reste : les couleurs, le visage, le
détail qui a bougé. Lui non plus ne coûte rien.

> Ces deux écrans ne servent que si les étapes sont bien entrées dans la bibliothèque.
> Quand le découpage refuse — voir le piège juste en dessous —, il n'y a rien à empiler,
> et c'est la feuille brute qui répond à toutes les questions.

---

## ⚠️ Le piège à connaître avant de payer

**Le découpage automatique peut refuser la feuille entière — et c'est justement sur une
animation que ça risque d'arriver.**

Voici pourquoi. Quand la feuille part vide, l'atelier ne sait pas ce qui va revenir. Pour
la redécouper, il ne se sert **pas** du quadrillage qu'il a lui-même dessiné : il cherche
les **taches de dessin** sur fond transparent et compte combien il en trouve. S'il n'en
trouve pas exactement le nombre demandé, il **refuse le lot entier** : rien n'entre dans
la bibliothèque, et l'argent est dépensé quand même.

Or une marche, ça déborde. Une jambe tendue ou un bras qui balance peut toucher la case
voisine, et deux étapes qui se touchent ne font plus qu'une seule tache. Compte faux,
lot refusé.

**Ce qu'il faut en retenir pour la séance : ce n'est pas grave.** La feuille brute reste
sur le disque même quand le lot est refusé, et c'est elle qu'on vient juger. Tu n'as rien
perdu. Note simplement le refus dans ton relevé — **c'est un résultat**, pas un incident.

**Et ce qu'il faut en retenir pour la V3** — à inscrire au plan, pas à faire maintenant :
une feuille d'animation doit être redécoupée **sur le quadrillage qu'on a envoyé**, jamais
en cherchant des taches. L'atelier connaît ce quadrillage puisqu'il l'a dessiné ; il sait
déjà faire exactement ça pour un autre usage. C'est un branchement, pas une invention.

---

## Étape 5 — Le relevé

Une ligne par feuille. Recopie ce tableau dans un fichier à côté de toi, ou dans
`essais/journal_animation.txt`.

| Manche | Façon | Cases | Modèle | Tirage | Sujet tenu ? | Accessoires tenus ? | Progression ? | Ordre bon ? | Déplié ou refusé | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | A | 8 | | 1 | | | | | | |
| 1 | A | 8 | | 2 | | | | | | |
| 1 | B | 8 | | 1 | | | | | | |
| … | | | | | | | | | | |

Les cinq colonnes de jugement, et ce qu'il faut y écrire :

- **Sujet tenu ?** Est-ce le même personnage dans les huit cases — même taille, mêmes
  couleurs, même visage ? *La question la plus importante des cinq : si la réponse est
  non, les autres ne servent à rien.*
- **Accessoires tenus ?** La lanterne, le sac, le couchage roulé, la ceinture, le
  capuchon — combien en reste-t-il à la huitième case ? Perdre un accessoire et perdre le
  personnage sont deux échecs différents, et le second est beaucoup plus grave.
- **Progression ?** Les cases racontent-elles un pas, ou sont-ce huit poses sans rapport
  tirées au hasard ?
- **Ordre bon ?** L'étape 4 est-elle bien dans la quatrième case ? Un mouvement dont deux
  étapes sont interverties saute à l'œil dès qu'on le fait bouger — donc très tard.
- **Déplié ou refusé** — voir le piège ci-dessus.

---

## Étape 6 — Comment on conclut

Trois issues possibles, et chacune dit quoi faire ensuite. Il n'y en a pas de quatrième.

**1 · Ça marche** — le sujet tient, les cases racontent le pas, l'ordre est bon.
→ La V3 se construit telle qu'elle a été cadrée. On sait quelle façon de demander
retenir, combien d'étapes par feuille, et quels modèles. On commence.

**2 · Ça marche à moitié** — le sujet tient, mais l'ordre se mélange, ou une case sur
huit est ratée.
→ **La V3 tient quand même**, et c'est même le cas prévu. Deux réponses, toutes deux
déjà décidées : on numérote les cases sur la feuille vide qu'on envoie, et l'écran de
travail laisse remettre les étapes dans l'ordre à la main, en les faisant glisser. Le
produit accompagne, il ne refuse pas.

**3 · Ça ne marche pas** — le personnage change d'une case à l'autre.
→ **Le mannequin passe en tête.** C'est l'idée étudiée le 31 août : un pantin articulé
qu'on met en position, dont on tire une image, et qu'on envoie au modèle pour lui dicter
la géométrie du corps. On refait alors exactement la même séance, avec des postures
fabriquées à la main dans un outil gratuit du navigateur (`posemy.art`), pour savoir si
le modèle obéit à une image de posture. Le détail est dans `docs/archive/essais-v3/etude-mannequin.md`.

Dans les trois cas, la séance a rendu ce qu'on lui demandait, et elle a coûté moins qu'un
café.

---

## Si tu veux comparer beaucoup de modèles

La manche 3 faite à la main est fastidieuse : changer de modèle, renvoyer, recommencer.
Le dépôt a une meilleure façon de faire, et elle est déjà écrite douze fois : un petit
programme autonome dans `essais/`.

Prends `essais/essai_identite.py` comme modèle — c'est lui qui a trouvé par accident, le
26 août, le comportement sur lequel toute la V3 est bâtie. Un essai de ce dossier :

- lit la clé dans `.env` et ne demande rien d'autre ;
- lit `essais/catalogue.json` pour n'envoyer à chaque modèle **que** les réglages qu'il
  déclare accepter ;
- écrit ses images dans `essais/resultats/`, avec un relevé chiffré à côté ;
- **saute ce qui est déjà fait** — relancer ne repaie jamais deux fois.

Ensuite, `essais/planches.py` monte les planches de comparaison : le même sujet à travers
tous les modèles, côte à côte. C'est le format qui départage.

---

## Ce que cette séance ne mesure pas, et c'est volontaire

- **Le recalage.** Faire que les étapes se suivent sans que le personnage sautille est le
  travail de la V3, pas de la séance. La séance dit seulement s'il y a quelque chose à
  recaler.
- **L'aperçu animé.** On juge les feuilles à l'œil, en image fixe. C'est suffisant : huit
  poses sans rapport se reconnaissent sans les faire bouger.
- **Le mannequin**, sauf en issue n° 3. Le mesurer d'emblée doublerait la séance pour
  répondre à une question qui ne se pose peut-être pas.

---
---

# Annexe — Le personnage de la séance

## Qui c'est

**Le voyageur à la lanterne.** Une silhouette encapuchonnée vue de côté, tournée vers la
droite, debout au repos. Grande cape à capuchon bleu-canard qui couvre la tête et le dos ;
long manteau ocre serré par une ceinture de cuir brun ; sac à dos de cuir avec un
couchage roulé sanglé dessus, dont on voit la spirale ; bottes brunes. Une lanterne
allumée pendue au bout du bras, qui jette une lueur chaude. Un seul œil visible, peau
claire.

Le dessin : contour foncé net sur toute la silhouette, aplats francs, deux ou trois tons
par matière, aucun dégradé, aucun tramage. Le personnage fait **environ soixante-quatre
pixels de haut** — c'est aussi la taille par défaut du produit, et ça tombe bien.

## Une mise en garde, et c'est un choix assumé

Ce personnage **n'est pas simple**. Il porte cinq choses qui peuvent se perdre en route :
le capuchon, la ceinture, le sac, le couchage roulé, la lanterne. Un sujet dépouillé
serait un test plus facile à lire.

**On le garde quand même, pour deux raisons.** D'abord parce que c'est un vrai
personnage de jeu, et que la V3 devra tenir des vrais personnages, pas des bonshommes
d'essai. Ensuite parce que la lanterne, tenue au bout du bras, **balance quand on
marche** : c'est exactement le genre de détail qui distingue un modèle qui a compris le
mouvement d'un modèle qui recopie huit fois la même pose.

En échange, le relevé gagne une colonne : **les accessoires ont-ils tenu ?** Perdre la
lanterne et perdre le personnage sont deux échecs différents, et il ne faut pas les
confondre.

## Le montage du personnage, en quatre gestes

Le dessin existe déjà — il n'y a aucune raison de le repayer. Mais il y a **deux façons
très différentes** de montrer une image à un modèle, et confondre les deux est l'erreur
la plus chère que ce dépôt ait payée.

- **« Voilà l'allure »** — l'image inspire. Elle dit avec quoi c'est dessiné, quelles
  couleurs, quel trait. C'est le rôle d'une carte du tableau d'inspiration et d'un
  artwork officiel.
- **« Voilà le sujet »** — l'image dit *ce personnage-ci, exactement lui*. C'est ce qui
  fait qu'un personnage se ressemble d'une pose à l'autre. **Seule une image de la
  bibliothèque, promue sur la chose du jeu, joue ce rôle-là.**

Une carte collée sur le tableau ne peut pas jouer le second rôle, et ce n'est pas un
oubli : une carte n'entre pas dans la bibliothèque, donc rien ne pourrait dire de quoi
descend l'image qui en sortirait.

**Le prix de la confusion est écrit dans le dépôt** : sur vingt-huit appels payés d'un
vrai projet, **dix-sept étaient partis sans une seule image du personnage**. C'est le
frottement le plus cher qu'on ait corrigé ici.

Les quatre gestes, donc, dans cet ordre :

1. **Colle le dessin sur le tableau d'inspiration** du projet — l'écran *Univers*,
   la toile.
2. **Désigne-le concept art du personnage**, et **promeus-le artwork officiel** de la
   famille *personnages*. Le produit **calcule alors la palette** du projet à partir de
   ses couleurs : tu n'as pas un seul code couleur à taper. Les deux désignations ne
   coûtent rien en double — l'atelier dédoublonne, l'image part **une fois**.
3. **Génère la première attitude du personnage** — le repos, une seule image, pleine
   taille. La carte part en *allure*, donc ce qui revient est le personnage passé par le
   style du jeu.
4. **Promeus cette image-là sur le personnage.** L'atelier te le propose de lui-même sur
   sa fiche, avec sa raison écrite : *« le corps retenu de repos — ce à quoi il ressemble
   une fois passé par le style du jeu »*. Accepte. **À partir de cet instant, chaque
   appel visant ce personnage emporte son image en disant « voilà le sujet ».**

Le troisième geste coûte un appel, et il vaut largement son prix — voir ci-dessous.

## Pourquoi cette première image est aussi le témoin de l'expérience

En science, on ne lit pas un résultat sans témoin : il faut la même chose mesurée dans
les conditions les plus faciles, pour savoir à quoi comparer.

Cette première attitude **est** ce témoin. Une seule case, pleine taille, tout le soin du
modèle sur un seul dessin. C'est le mieux que le modèle sache faire sur ce personnage.

Ensuite seulement on lui demande huit cases petites. Et la question devient lisible :
*combien perd-on entre la meilleure condition et la condition de travail ?*

Et si le témoin lui-même est raté — si le modèle ne sait pas rendre ce personnage sur une
seule image confortable —, **la séance s'arrête là**, pour deux centimes. Il n'y aurait
aucun sens à lui en demander huit d'un coup.

## Les sept cases de la bible du projet

Le style du jeu vit dans la bible et part tout seul avec chaque appel. **On n'écrit donc
jamais le style dans le prompt** — seulement le sujet.

| Case | Ce qu'on y écrit |
|---|---|
| **Monde** (*World*) | `a quiet pre-industrial fantasy world of long roads, forests and cold nights` |
| **Époque** (*Era*) | `medieval fantasy, before gunpowder` |
| **Rendu** (*Rendering technique*) | **laisser vide** — voir ci-dessous |
| **Trait** (*Line and shading*) | `hard dark outline around every silhouette, flat shading, two or three tones per material, no dithering, no gradients, no anti-aliasing` |
| **Éclairage** (*Lighting*) | `flat neutral daylight, plus the warm glow of a carried lantern; no cast shadows except a thin dark line under the feet` |
| **Vue** (*View and framing*) | **laisser vide** — voir ci-dessous |
| **Technique** (*Technical constraints*) | **laisser vide** — voir ci-dessous |

**Pourquoi trois cases restent vides, et c'est important.** Ce sont les trois seules où
l'atelier écrit une phrase de lui-même : le rendu dit la grille de pixels, la vue dit la
caméra, la technique dit le calage. Il les compose à partir de réglages qu'on a déjà
donnés — la taille de pixel et la vue du jeu. Y écrire quelque chose fait **partir deux
phrases sur le même sujet**, et le dépôt a déjà payé pour ça : une phrase de vue écrite à
la main a contredit la consigne de la feuille sur vingt-huit générations d'un vrai
projet.

**Les deux autres réglages :** taille de pixel **64** (le défaut, et la hauteur du
sprite) ; barème inchangé — un personnage occupe toute sa case.

## Le texte du personnage

Le sujet, et rien que le sujet, en anglais :

```
a hooded traveller standing at rest, seen from the side, facing right;
deep teal hooded cloak covering the head and falling down the back;
ochre long coat closed by a brown leather belt;
brown leather backpack with a rolled bedroll strapped on top;
brown boots; a lit lantern hanging from the near hand
```

Et la même chose, en une ligne, pour la case anglaise de la première attitude — celle du
repos :

```
idle stance, standing still, full body, arm hanging down with the lantern
```

---
---

# Ce que la séance a trouvé sur le produit lui-même

Relevé au fil du montage, le 1<sup>er</sup> septembre 2026. **Ce ne sont pas des résultats
d'essai** : ce sont des défauts d'usage rencontrés en préparant la séance, sur des écrans
livrés. Ils ne sont ni cadrés ni planifiés, et ils n'appartiennent pas à la V3.

## 1 · On promeut une image qu'on n'a jamais vue

Le bloc **« Ses images de référence »** de la fiche est **entièrement textuel**. Une
proposition s'y lit *« le corps retenu de repos »*, et on l'accepte d'un lien **retenir ›**
— sans qu'aucune vignette ne paraisse. On retient donc en référence permanente, pour toutes
les générations à venir de cette chose, **une image que l'écran refuse de montrer**.

C'est d'autant plus frappant que le produit sait le faire à côté : la matrice de l'établi
affiche les vignettes de chaque case, servies par une route qui existe déjà.

**Le coût :** on accepte sans vérifier, ou l'on va vérifier ailleurs et l'on revient. Sur
l'image la plus structurante du personnage — celle qui dira *voilà le sujet* à chaque appel
payé —, c'est exactement là qu'il ne faut pas avancer à l'aveugle.

## 2 · Le chemin de la promotion ne se devine pas

Pour retenir cette image il faut : rester sur le codex, cliquer *sa fiche ›*, ouvrir le
troisième des cinq blocs, descendre sous un intertitre en petites capitales, et cliquer un
lien de dix pixels. **Rien à l'écran ne dit que ce geste existe, ni qu'il est nécessaire.**

Or il est nécessaire : sans lui, chaque image d'un personnage repart sans le personnage.
Le dépôt chiffre déjà ce que ça coûte — *dix-sept appels payés sur vingt-huit étaient partis
sans une seule image*.

## 3 · Une infobulle promet plus qu'elle ne tient

Le bouton **Fabriquer** annonce *« prépare le prompt dans l'atelier »*. Il ne le prépare que
si la chose visée porte un signalement. Sans signalement, le champ reste vide, *Générer* est
gris, et la personne devant l'écran cherche la panne — alors que la phrase du serveur la
nomme parfaitement : *« écrivez le signalement de la chose sur sa fiche »*. **Cette
phrase-là n'est simplement jamais montrée avant le clic.**

---
---

# Résultats — manche 1, façon A, premier tirage

**1<sup>er</sup> septembre 2026.** Personnage : le voyageur à la lanterne. Modèle :
`openai/gpt-image-2` chez OpenRouter. Une phrase par case, huit cases.

| | |
|---|---|
| Témoin (repos, une image) | **$0,0122** |
| Planche de huit étapes | **$0,0223** |
| Refus du dépliage | **aucun** — 8 sujets trouvés, 8 images rangées |

Les mesures qui suivent ont été prises avec le découpeur de l'atelier lui-même, sur la
planche brute `donnees/generations/cb3ebb37…/0-brut.png`.

## 1 · Le sujet tient — et c'est la question qui décidait de tout

| Mesure | Résultat |
|---|---|
| Hauteur des huit sujets | 347 à 353 px — **écart de 1,7 %** |
| Ligne de sol, rangée du haut | 421 px pour les quatre — **identique au pixel** |
| Ligne de sol, rangée du bas | 884 et 885 px — **un pixel d'écart** |
| Largeur | 176 à 184 px — écart de 4,5 % |
| Accessoires | capuchon, ceinture, sac, couchage roulé, lanterne allumée : **les cinq, dans les huit cases** |

C'est beaucoup mieux qu'espéré, et ça change une prévision de la V3 : **le recalage entre
étapes, qu'on annonçait comme le gros morceau, n'aura presque rien à corriger** sur une
planche comme celle-ci. Le modèle pose déjà ses sujets à la même taille sur la même ligne
de sol.

## 2 · Il y a du mouvement, et il est au bon endroit

Chaque case ramenée sur son bas-centre, puis comparée à la suivante — part de la
silhouette qui change :

| | Silhouette entière | Tiers bas (les jambes) |
|---|---|---|
| Moyenne | 14,1 % | **26,9 %** |
| Minimum | 10,6 % | 18,6 % |
| Maximum | 17,0 % | 33,8 % |

Huit copies de la même pose auraient donné deux à cinq pour cent. **Le modèle a bien
dessiné huit choses différentes, et la différence est dans les jambes.**

## 3 · Mais ce n'est pas encore un cycle

Trois signes concordants, et le troisième est le plus net :

- **La hauteur ne suit aucun rythme** : 350, 351, 353, 350, 352, 347, 348, 347. Dans une
  marche, le corps monte aux étapes 4 et 8 et descend aux 2 et 6 — c'est ce balancement qui
  fait qu'un personnage marche au lieu de glisser. Ici la plus haute est l'étape 3, et
  l'amplitude tient dans six pixels sur trois cent cinquante.
- **La largeur varie de 4,5 % seulement, sans rythme.** Une marche écarte les jambes puis
  les referme ; la largeur devrait respirer.
- **Le bras à la lanterne ne bouge pas d'un pixel** dans les huit cases. C'était le détail
  qu'on s'était donné à surveiller, et il tranche.

**La lecture honnête** : le modèle a dessiné huit *poses de marche différentes*, pas huit
*instants d'une même marche*. C'est déjà beaucoup — mais monté bout à bout, ça donnera un
personnage qui s'agite, pas un personnage qui avance.

## 4 · La surprise : le modèle n'a pas suivi la disposition du gabarit

On lui a envoyé une planche vide de **trois colonnes sur trois lignes**, huit cases
dessinées. Il a rendu **quatre colonnes sur deux lignes**.

Le compte est juste, la grille est régulière, les sujets sont alignés et régulièrement
espacés — mais **la mise en page n'a pas été recopiée**. Or c'est très exactement
l'observation du 26 août 2026 qui fonde toute l'approche de la V3 : *le modèle reproduit la
structure de son image de référence*. Sur cet essai-ci, **elle ne se confirme pas**. Ce que
le modèle a obéi, c'est le **nombre** et la **régularité** — pas l'**arrangement**.

**Et ça renverse une correction que ce document proposait d'inscrire au plan.** Le dépliage
a survécu **parce qu'il cherche des taches de dessin et non le quadrillage envoyé**. Si
l'atelier avait redécoupé sur la grille qu'il avait dessinée — ce qui semblait
manifestement plus sûr —, **il aurait tout coupé de travers**. La détection par taches
n'est pas un pis-aller : c'est ce qui rend le produit robuste à un modèle qui range les
cases comme il veut.

## 5 · Un défaut qui n'est pas du modèle : l'atelier fabrique de la poussière

Comptage des pixels opaques **isolés** — sans aucun voisin opaque — avant et après le
traitement de l'atelier :

| | Image payée, recadrée | Après grille 64 px + palette 23 couleurs |
|---|---|---|
| Étape 1 | **0** | 6 |
| Étape 2 | **0** | 4 |
| … | **0 partout** | 2 à 6 selon l'étape |

Deux à six pixels perdus sur environ mille trois cents : sur une image fixe, personne ne
les voit. Mais **ils ne tombent pas au même endroit d'une étape à l'autre** — donc dès que
l'animation tourne, ils scintillent. C'est le type même du défaut qui n'existe que quand ça
bouge, et que la V3 devra traiter au montage.

## 6 · Ce que la manche 1 laisse à faire

- **Le second tirage de la façon A**, sans rien changer. Un seul tirage confond ce que le
  modèle sait faire avec la chance qu'on a eue.
- **La façon B** — le cycle décrit en une seule fois, par *Reprendre le texte*. C'est elle
  qui doit répondre à la faiblesse trouvée : une phrase par case décrit huit **poses** ; il
  faut essayer un texte qui décrit un **mouvement continu**, et voir si le balancement
  apparaît.

---

# Résultats — manche 1, façon A, second tirage, et ce qu'ils apprennent ensemble

## La recette n'est pas stable

Même texte, mêmes réglages, même modèle. Mesuré sur les deux planches brutes :

| | Tirage 1 | Tirage 2 |
|---|---|---|
| Jambes — écart moyen entre cases voisines | 26,9 % | **16,0 %** |
| La paire la plus faible | 18,6 % | **3,7 %** — les étapes 3 et 4 sont presque identiques |
| Largeur du sujet | 176 à 184 px | **161 à 162 px** — quasi constante |
| Hauteur du sujet | 347 à 353 px | 270 à 272 px |

**La façon A donne un jour huit poses de marche, un autre jour huit variations sur place.**
C'est exactement ce que la règle des deux tirages existe pour découvrir : un seul tirage
aurait fait conclure — dans un sens ou dans l'autre — sur un coup de dé.

## ⚠️ Le post-traitement de l'atelier aplatit l'animation

Les huit images livrées font **toutes exactement 64 px de haut, ligne de sol au pixel 64,
axe vertical au pixel 32**. Écart entre les huit : **zéro**.

Ce n'est pas le modèle. C'est le recadrage du produit, qui prend **chaque étape sur sa
propre boîte opaque** puis la ramène à la taille de pixel du projet. Deux étapes qui
mesuraient 350 et 353 px sur la planche mesurent toutes deux 64 px après.

**Conséquence : le balancement vertical d'une marche — celui qui fait qu'un personnage
marche au lieu de glisser — est détruit avant que le moindre recalage puisse intervenir.**

**Exigence pour la V3, précise :** les étapes d'une même bande se recadrent sur une **boîte
commune**, jamais chacune sur la sienne. Une bande est un tout ; la recadrer case par case
la met à plat.

*Et l'honnêteté oblige à ajouter ceci* : sur ces deux planches-là, il n'y avait presque rien
à sauver. Le balancement produit par le modèle vaut 6 px sur 353 au premier tirage — **un
seul pixel** une fois ramené à 64 — et 2 px sur 272 au second, soit **zéro**. Les deux
défauts sont réels et indépendants : il faudra corriger le recadrage **et** trouver une
recette qui produise un vrai cycle.

## Ce qu'on peut faire à la main aujourd'hui, et ce qu'on ne peut pas

**On ne peut pas reprendre le dépliage d'une planche pliée.** C'est écrit dans le code, et
c'est délibéré : *« aucun geste de découpe n'est demandé à l'auteur — on ne découpe jamais à
la main ce qu'on a demandé plié »*. La planche n'entre même pas en bibliothèque.

**Mais on peut tout reprendre en important la planche brute comme image ordinaire.** Elle
devient un asset, et alors :

1. la barre des tables lui donne son **détourage réglable** ;
2. l'écran **Découpe** s'ouvre depuis sa fiche, en deux modes — *zones opaques* et *grille
   fixe* (colonnes × lignes qu'on donne) ;
3. en mode zones opaques, **les rectangles proposés sont calculés d'après les passes de
   détourage de l'asset** : régler le détourage change la proposition ;
4. on ajoute, retire et redessine les rectangles à la main, puis on découpe — chaque
   morceau hérite de la recette.

C'est la V3 en miniature, et ça dit ce qu'elle devra offrir nativement sur une planche
pliée.

---

# Résultats — façon B, et la conclusion de la manche 1

**Façon B** : la ligne *LES CASES de la planche* corrigée sur l'écran de confirmation, pour
demander en toutes lettres un **cycle continu**, un **corps qui monte et descend** aux
étapes nommées, et un **bras qui balance avec la lanterne**. Passée sans refus, huit cases,
$0,0223.

## Ce que le modèle tient, sur les trois tirages

Sans faute, et c'est acquis :

| | Tirage 1 | Tirage 2 | Tirage 3 |
|---|---|---|---|
| Écart de hauteur entre les huit sujets | 1,7 % | 0,7 % | **1,4 %** |
| Ligne de sol, par rangée | au pixel | au pixel | **au pixel** |
| Les cinq accessoires, dans les huit cases | oui | oui | **oui** |

## Ce qu'il ne fait pas — même quand on le lui demande mot pour mot

**Le balancement du corps.** Hauteurs du tirage 3 : 288, 287, 287, 284, 284, 284, 284, 284.
On avait demandé *le plus haut aux étapes 4 et 8, le plus bas aux 2 et 6* : les étapes 4 et
8 sont parmi les plus **petites**, et le groupement suit les rangées de la grille, pas le
rythme de la marche. Sur boîte commune, le balancement vaut **4 px sur 288 — un seul pixel
une fois ramené à 64**.

**Le balancé du bras.** La flamme de la lanterne suivie case par case, en pourcentage de la
largeur du sujet :

| | Amplitude horizontale de la flamme |
|---|---|
| Tirage 1 (façon A) | 2,4 points de % |
| Tirage 2 (façon A) | 1,4 point de % |
| **Tirage 3 (façon B, demandé explicitement)** | **1,5 point de %** |

Soit deux à quatre pixels sur cent quatre-vingts. **C'est du bruit, pas un balancé** — un
bras qui balance déplacerait la lanterne de quinze à vingt-cinq pour cent de la largeur. La
consigne explicite n'a **rien** changé ; elle a même donné la plus petite des trois.

**Et la disposition de la grille n'est pas pilotable.** Les tirages 1 et 2 ont rendu **4×2**
alors que le texte demandait *exactly 3 columns and 3 rows* ; le tirage 3 a rendu **3×3**
alors qu'on avait retiré cette phrase. Trois tirages, deux dispositions, et la corrélation
est **inversée**. Ni le gabarit ni le texte ne décident : c'est le modèle qui range.

## La conclusion de la manche 1

Le modèle **sait tenir un personnage** sur huit cases, remarquablement bien. Il **ne sait pas
lui faire exécuter un mouvement continu** : il dessine huit *poses*, jamais huit *instants*.
Et on ne peut pas le lui apprendre par le texte — c'est le résultat de la façon B, et c'est
le plus solide des trois tirages puisqu'il portait la demande explicite.

**Ce n'est aucune des trois issues prévues par ce document**, et c'est la quatrième :
*le sujet tient parfaitement, l'ordre n'est pas en cause, mais le mouvement n'est pas un
mouvement.*

**Elle désigne le mannequin, et pour une raison plus précise qu'on ne l'avait écrite.** Le
pantin articulé n'est pas nécessaire pour la **cohérence** — le modèle la tient tout seul,
mieux qu'espéré. Il est nécessaire pour la **chorégraphie** : dire à quel instant quel
membre est où. C'est exactement ce que les mots ne savent pas dire, et c'est exactement ce
que trois tirages payés viennent de démontrer.

## Ce qui reste à faire avant de trancher pour de bon

**Un seul essai, et il change de rang : la manche 3 passe devant la manche 2.**

Tester quatre ou six cases par planche (manche 2) affinerait une recette qui a un défaut
**structurel** — moins de cases ne feront pas apparaître un balancement. En revanche,
`openai/gpt-image-2` est peut-être simplement mauvais à cet exercice précis. **Deux ou trois
autres modèles, en façon A, deux tirages chacun** : une quinzaine de centimes, et la réponse
devient définitive.

Si aucun modèle ne produit de balancement, la V3 s'ouvre sur le mannequin.

---
---

# Résultats — la manche 3, le banc de modèles

**1<sup>er</sup> septembre 2026.** Sept modèles, deux tirages chacun, **$1,0470** dépensés,
treize planches obtenues (un tirage de `qwen` a dépassé le délai — non facturé).

**Le protocole est reproductible et il n'a rien réinventé** : le prompt de 2 147 caractères
et les trois images jointes sont **relus dans la génération du premier tirage** ; le gabarit
est redessiné par le module du produit. Chaque modèle a donc reçu **exactement** ce que
`gpt-image-2` avait reçu. Scripts : `essais/essai_animation.py`,
`essais/juger_animation.py`, `essais/balancement_ou_derive.py`.

## ⚠️ La conclusion précédente était fausse, et c'est le banc qui la corrige

`docs/archive/essais-v3/essai-animation.md` concluait, sur trois tirages d'un seul modèle : *« le modèle sait
tenir un personnage, il ne sait pas lui faire exécuter un mouvement — et on ne peut pas le
lui apprendre par le texte »*, et cette conclusion désignait le mannequin.

**Elle généralisait un modèle à tous les modèles.** Trois modèles du banc font travailler le
corps, et l'un d'eux le fait franchement. **Le problème n'était pas la méthode : c'était
`gpt-image-2`.**

## La mesure qui décide, et pourquoi c'est elle

Une case plus courte qu'une autre peut vouloir dire deux choses opposées : un **balancement**
— le corps se tasse et se détend, la hauteur change plus que la largeur — ou une **dérive
d'échelle** — le modèle a dessiné le même sprite en plus petit, hauteur et largeur ensemble.

Le juge est donc le **rapport hauteur / largeur** de chaque case. Constant, rien ne bouge.
Variable, le corps se déforme, donc il y a du mouvement. Et la distinction a des
conséquences opposées : **une dérive d'échelle se rattrape sans un centime**, c'est du
recalage ; **un balancement absent ne se fabrique jamais après coup.**

## Le classement

| Modèle | Forme | Jambes | Balanc. | Prix | Lecture |
|---|---|---|---|---|---|
| **qwen/qwen-image-3-pro** | **16,0 %** | **35,5 %** | **10,3 px** | $0,049 | le corps travaille vraiment |
| **google/gemini-3-pro-image** | 9,1 % | 15,6 % | 3,8 px | $0,139 | vraie déformation, peu de dérive |
| **google/gemini-3.1-flash-image** | 8,2 % | 18,6 % | 3,5 px | $0,069 | vraie déformation, moitié prix |
| bytedance/seedream-4.5 | 5,7 % | 36,6 % | 1,7 px | $0,040 | jambes vives, corps figé |
| openai/gpt-image-2 | 4,8 puis 1,0 % | 23–27 % | 1 px | $0,022 | instable, et faible |
| x-ai/grok-imagine-image-quality | 0,5 % | 8,5 % | 0,0 px | $0,080 | **huit copies** |
| bytedance/seedream-5-0-pro | 1,1 et 1,3 % | 8–11 % | 0,5 px | $0,096 | **huit copies** |
| black-forest-labs/flux.2-pro | — | — | — | $0,075 | compte faux deux fois sur deux |

*Forme = écart du rapport hauteur/largeur entre les huit cases. Balanc. = balancement
vertical du sommet du crâne, ramené à une hauteur de 64 px.*

## Ce que le vainqueur coûte en échange

`qwen-image-3-pro` gagne largement, et il a trois défauts qu'il faut connaître :

- **18 % de dérive d'échelle** entre ses huit cases — le plus haut du banc. C'est du travail
  pour le recalage de la V3, **mais c'est précisément ce que le recalage sait faire** : le
  produit trouve déjà une échelle et un décalage entre deux images.
- **273 secondes** pour une planche, contre 11 pour `gemini-3.1-flash`.
- **Un tirage sur deux a dépassé le délai.** Un seul tirage exploitable, donc *un seul
  échantillon* : sa première place demande à être confirmée.

## ⚠️ Le refus par le compte a frappé quatre planches sur treize

`flux.2-pro` deux fois, `seedream-4.5` et `gemini-3.1-flash` une fois chacun : **neuf sujets
au lieu de huit**. Ce n'est pas un défaut de détection — les modèles ont réellement rendu
neuf sprites, en **complétant la grille 3×3** dont le gabarit ne dessinait que huit cases.
`flux.2-pro` a même **redessiné les traits noirs du quadrillage** dans son image.

Dans l'atelier, ces quatre planches sont **refusées : l'argent est parti, rien n'entre**.
Soit **31 % des appels perdus**, sur un geste dont c'est le régime normal.

**Deux exigences pour la V3 en sortent :**

1. **Le compte doit cesser de refuser sur une planche d'animation.** Neuf sujets quand on en
   voulait huit, c'est une planche **utilisable** dont il faut écarter une case — c'est un
   geste, pas une perte. La règle « seul le compte refuse » a été écrite pour un lot de
   poses, où une case en trop n'a pas de sens ; ici elle jette du travail payé.
2. **Le gabarit doit dessiner la grille entière**, ou pas de grille du tout. Une grille à
   trous invite à la compléter, et trois modèles sur sept l'ont fait.

## Ce que ça change pour la V3

Le mannequin **redescend d'un rang**. Il reste la meilleure réponse pour une chorégraphie
précise — dire à quel instant quel membre est où —, mais il n'est plus le **passage obligé**
qu'un seul modèle mal choisi faisait croire.

**La V3 peut s'ouvrir sur ce qui était prévu** : la planche, la découpe, le recalage,
l'aperçu. Avec deux corrections nées de ce banc — le recadrage sur boîte commune, et le
compte qui propose au lieu de refuser — et **le choix du modèle porté au rang de décision de
produit**, puisque c'est lui, et non la méthode, qui décide si une animation existe.

---

# ⚠️ Cette dernière phrase est fausse, et deux bancs de plus l'ont corrigée

**Le choix du modèle n'est pas ce qui décide.** `gpt-image-2`, celui que le produit utilise
déjà, reste le meilleur rapport, et il n'y a rien à changer de ce côté.

Un banc de **vingt-neuf demandes envoyées au même modèle**, le 1<sup>er</sup> septembre 2026,
l'a vérifié en changeant la demande au lieu du modèle : le nombre de cases, six façons
d'écrire la consigne, et ce qu'on joint comme images. Les **cent dix-sept planches** des deux
bancs ont ensuite été montées en animations et **regardées une par une par l'auteur**, qui
les a notées *mauvais*, *moyen* ou *bon*.

## ⚠️ Et ce jugement a fait tomber la mesure qui pilotait tout

Les bancs se conduisaient à la **forme** — de combien le rapport hauteur/largeur du
personnage change d'une case à l'autre. Confrontée aux notes, **elle ne prédit rien** : les
planches qu'elle rejetait contiennent autant de bonnes marches (10 %) que celles qu'elle
retenait (9 %), et sa valeur moyenne est **plus haute sur les mauvaises planches que sur les
bonnes**. Elle confondait *un corps qui marche* avec *un personnage dessiné à des tailles
différentes* — et le second cas est bien plus fréquent.

**Tout classement de cette page qui s'appuie sur la forme est donc à jeter**, y compris celui
de la manche 3 juste au-dessus. Les classements refaits sur les notes sont dans
`docs/v3-animation.md` ; les animations tournent, avec leur note, dans
`essais/rapport-animation.html`.

## Ce que les notes disent

- **une bonne planche sur dix**, et une sur douze si l'on exige en plus qu'elle soit
  découpable. C'est la loterie, chiffrée : le produit doit être bâti sur *« on en commande
  plusieurs, on regarde, on garde la bonne »* ;
- **le prompt du produit gagne la comparaison des consignes** : 27 % de bonnes planches,
  contre 9 % pour une consigne d'essai plus détaillée et **0 % pour cinq réécritures de
  fond**. Décrire *un mouvement* ne marche pas ; énumérer *chaque instant* marche, et le
  produit écrit déjà l'énumération ;
- **le paragraphe qui interdit de redessiner le quadrillage est décisif** : avec lui, 0
  planche sur 26 a le quadrillage redessiné ; sans lui, 47 sur 53. Il ne faut pas y toucher ;
- **une planche au quadrillage redessiné passe quand même le contrôle du compte**, et
  l'atelier en tire huit carrés opaques sans rien refuser. Il manque un contrôle de
  remplissage.

## Deux pistes vivantes, et une rétractation

Ce que la version précédente de cette annexe donnait pour mort ne l'est pas :

- **retirer la clause `same proportions, same size`** — je l'avais déclarée sans effet sur la
  foi de la mesure. Sur les notes, à modèle et prompt constants : **5 bonnes planches sur 15
  avec la clause remplacée, contre 2 sur 11 avec la clause**. Ce n'est pas une preuve — un
  tel écart sort du hasard sans peine — mais c'est redevenu la meilleure piste ;
- **moins de cases sur la planche** : 2 bonnes sur 6 à quatre cases, contre 9 sur 101 à huit.
  Le personnage est deux fois plus grand et a la place de se déformer. Six tirages ne
  décident rien, et cette piste n'a **jamais été essayée avec le paragraphe protecteur**.

En revanche **le guide de marche dessiné par le programme ne fait rien à huit cases** — 2
bonnes sur 8 avec lui, 3 sur 7 sans lui.

**Trois branches de huit tirages, environ soixante-quinze centimes, trancheraient les deux
pistes.** Le détail est dans `docs/v3-animation.md`.
