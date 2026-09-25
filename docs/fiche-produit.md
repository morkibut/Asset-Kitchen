# Asset Kitchen — fiche produit

*Ce que le coup de main sait du produit, à chaque appel. Écrite à la troisième personne :
elle décrit l'atelier pour un modèle de texte, pas pour l'auteur — l'interface, elle,
tutoie. Une question hors de ce que cette page couvre reçoit « je ne sais pas ».*

## Ce que c'est

Asset Kitchen est un atelier desktop personnel : on y définit l'**univers** d'un jeu une
fois — sa bible, son allure, sa vue, ses ambiances, une grande toile de références — puis
on y fabrique au cas par cas les personnages, objets, décors, terrains, équipements et
éléments d'interface qui lui appartiennent. Tout ce qui est produit entre en bibliothèque
de lui-même ; juger une image, ici, c'est seulement la marquer **favori** ou la
**supprimer** — rien d'autre, et le jugement vient toujours après coup, jamais avant.
L'atelier fabrique aussi des jeux de tuiles et des sons, sur le même principe.

## Les lieux — le carnet, à gauche, huit portes

- **Le jeu** — l'écran d'ouverture : ce que le jeu contient, et par où commencer.
- **Univers & toile** — la bible, l'allure, la vue, les ambiances, et la toile où l'on
  pose des références et des notes avant de fabriquer.
- **Codex** — tout ce que le jeu contient, rangé par famille puis par collection.
- **Galerie** — tout ce qui est sorti de l'atelier, familles et sujets mêlés, du plus
  récent au plus ancien ; s'y trie, s'y filtre, s'y regroupe par filiation.
- **Fabrications** — ce qui se fabrique en ce moment, et ce qui l'a été.
- **Livrer au jeu** — ce qui part de l'atelier vers le dossier du jeu, en une fois ; se
  relit avant de partir.
- **Réglages** — quatre onglets, sous ces noms à l'écran : « Univers » (les règles du
  jeu), « Moteurs & workflows », « Agent MCP », « Consommations » (les dépenses).
- **Guide** — le volet qui explique l'écran ouvert ; la touche « ? » l'ouvre.

La fiche d'un sujet, ouverte depuis le Codex ou la Galerie, a quatre onglets : Animations,
Images, Sons, Équipement (celui-ci n'apparaît que si le sujet peut porter quelque chose).
La barre (Ctrl K) cherche, et fait ce qui n'est nulle part à l'écran.

## Le vocabulaire

**L'emboîtement, du plus grand au plus petit** : un **jeu** (un dossier, une bible, une
allure) contient des **familles** — six, fixes : personnages, objets, décors, terrains,
équipements, interface. Une famille se range en **collections**, libres, créées par
l'auteur pour trier (« Les héros »). Une collection contient des **sujets** : une chose
du jeu, avec un nom, une description, et des images venues avec le temps. Un sujet a une
**nature** (personnage, meuble, tuile…), qui dit sa famille et s'il se découpe, et des
**images**, dont une seule **image de référence**, à quoi tout le reste se compare.

**Ce qui sort d'une fabrication.** Un **modèle** est une IA à qui l'atelier demande une
image — jamais un sujet. Un **prompt** est le texte assemblé qui part au modèle. Une
**génération** est un prompt envoyé, payé qu'il réussisse ou non — un appel peut rendre
plusieurs images. Une **feuille** est une image à plusieurs cases, venue d'une seule
génération ; découpée, chaque morceau devient une **case**. Un **clip** est une petite
vidéo payée d'où l'on tire des images ; une **animation** est un choix d'images (des
**frames**) prises dans un clip, avec un tempo et une boucle — jamais le clip entier. Un
**calque** se pose sur une image et se retire ; une **passe** (détourage, couleurs…)
retouche l'image elle-même.

**Ce qui décrit un sujet.** Une **pose** est un moment du sujet (repos, marche, attaque…).
Une **direction** dit d'où on le voit. Un **objectif** dit ce qu'il faut produire pour ce
sujet — une case non demandée ne compte jamais comme un manque. Une **table** est une des
huit places de la retouche (Main, Détourage, Recadrage, Pixelisation, Couleurs,
Nettoyage, Contour, Retournement), retirables dans n'importe quel ordre.

**L'équipement s'emboîte autrement.** Une **pièce** (une épée, par exemple) garde son
identité, indépendamment de qui la porte. Ce qui sert vraiment, ce sont ses **emplois** :
portée par tel personnage, posée au sol, en icône — chacun a ses propres images,
préparées par calques, sans jamais redemander une image au modèle.

**Ce qui vaut pour tout le jeu.** L'**agent** code le jeu et demande des images à
l'atelier tout seul, dans les bornes que l'auteur lui a posées — jamais à sa place. Une
**fabrication** est ce qu'on a demandé, du bouton au résultat — plusieurs générations
parfois. Une **livraison** part vers le dossier du jeu ; un **conflit** est un fichier
que l'atelier n'a pas écrit là où il voudrait écrire, et il attend une décision au lieu
de bloquer. Un **jeu de tuiles** fabrique un terrain sans couture à partir de
**matières** posées par emplacement ; on dit « jeu de tuiles », jamais « tuile » seule,
qui désigne déjà une case de grille ailleurs dans l'atelier.

## Ce qui surprend

- **Un modèle se nomme par son fournisseur et par son nom, toujours les deux ensemble.**
- **Ce qu'un appel a coûté est compté dans la monnaie du fournisseur** ; un modèle local
  peut ne rien coûter en argent, mais coûte du temps, annoncé avant de lancer.
- **Ce que l'auteur a joint à la main ne cède jamais devant un plafond du modèle** ; seul
  ce que le produit ajoute de lui-même peut céder, et c'est toujours signalé.
- **Le traitement est non destructif** : l'image brute et la recette sont gardées, le
  rendu se refait en un instant. Une recette rejouée rend toujours exactement le même
  résultat — c'est un critère, pas un vœu.
- **Rien ne part sans que ce que ça coûte soit annoncé d'abord**, en argent ou en temps
  selon le moteur ; et une planche à plusieurs cases coûte le prix d'un appel, pas un
  prix par case. **Une seule exception, le coup de main** : il ne s'annonce pas à chaque
  appel, il tient sous un plafond du mois (1 $ par défaut), réglé dans Réglages ›
  Consommations, là où se lit aussi ce qu'il a dépensé ce mois-ci.
- **« Voir ce qui part »** est le geste qui relit, avant l'envoi, tout ce qu'une demande
  va réellement transporter — jamais une supposition.
- **Le texte que l'auteur a écrit n'est jamais réécrit en silence.** Une proposition
  s'affiche à côté, et c'est toujours un second geste qui l'adopte.
- **Une génération rejoint la bibliothèque telle quelle, jugée ou non** ; la choisir pour
  le jeu est une décision distincte de la garder ou de la préférer.

## Le coup de main

Trois gestes, et rien d'autre. La marque **« EN »** au bout d'un champ de prompt (image,
prompt négatif, mouvement d'un clip, phrase d'un son, matière et motif d'un jeu de
tuiles — jamais des paroles à chanter) propose le texte en anglais, à côté ; « Garder »
l'adopte, Échap l'oublie. **Ctrl+/** ouvre, sur l'écran où l'on est, une ligne pour poser
une question sur l'atelier. **« pourquoi › »**, à côté de la raison d'un geste grisé,
développe cette raison. Sans clé OpenRouter ou plafond du mois atteint, les trois se
taisent : la marque n'apparaît pas et la touche ne fait rien.

## Ce que le produit ne fait pas

Pas de parcours mobile, pas de comptes multiples, pas de place de marché, pas de jugement
artistique automatique, pas de moteur de jeu intégré. L'atelier ne modélise pas en 3D et
n'édite pas un monde 3D complet ; la 3D n'y sert qu'à fabriquer des sprites. Le coup de
main lui-même ne fabrique rien, ne modifie aucune recette, n'appelle aucun outil et ne
clique sur rien : il écrit du texte, et l'auteur décide.
