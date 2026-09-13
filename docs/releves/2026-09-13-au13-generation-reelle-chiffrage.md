# AU13 — chiffrer la génération réelle d'un ensemble de tuiles

**Rien n'a été dépensé pour écrire cette note.** C'est une estimation, avec ses sources, et un
script qui attendra un accord explicite avant de payer quoi que ce soit.

## 1. Ce qu'on cherche à prouver, et pourquoi ça demande de payer

AU13 promet qu'on peut demander un ensemble de tuiles à l'agent, juger si les bords se
raccordent, corriger ce qui ne va pas, et l'exporter dans Godot. Tout ce chemin est déjà prouvé
**sauf un point** : personne n'a encore payé un vrai modèle pour dessiner un atlas de tuiles et
regardé si les bords se raccordent vraiment.

Le reste tourne aujourd'hui sur des images fabriquées à la main dans les essais — des carrés de
couleur, jamais un vrai dessin. On ne peut pas juger un raccord sur un carré de couleur. Il faut
un vrai modèle d'image pour savoir si le geste marche en pratique, et un vrai modèle, ça se paie.

## 2. Ce qui part exactement

**Un appel par tirage**, au fournisseur et au modèle par défaut du produit :
`OpenRouter:openai/gpt-image-2`, réglage `quality: low` (`atelier/services/catalogue.py`,
constante `DEFAUT` ; confirmé dans `docs/ARCHITECTURE.md` §4 bis, « seul modèle par défaut »).

Chaque appel envoie :
- un **texte** décrivant un atlas de tuiles de terrain vu de dessus, en 4 colonnes × 4 lignes,
  seize tuiles carrées qui se raccordent bord à bord, pixel art, sans quadrillage ni texte ni
  personnage — un sujet générique, pas le jeu de l'auteur, pour ne pas mélanger deux mesures ;
- **aucune image jointe** dans la version de base du script. Une image jointe (bible du projet,
  planche témoin) est possible mais change le prix — voir plus bas.
- proportions `1:1`, une seule variation par appel.

Rien d'autre ne part : `create_tile_set` ne contacte jamais le fournisseur (`atelier/mcp/tuiles.py`
le dit en toutes lettres — « Import or use image generation before this operation; it never calls
a provider ») ; il découpe seulement l'image déjà payée. Juger, corriger à la main et exporter
sont gratuits eux aussi.

## 3. Le prix total attendu, et ce qui le fait varier

**Il n'y a pas de tarif fixe à citer** — le produit refuse d'en afficher un par principe :
*« ce qui est enregistré est ce que l'appel a consommé, jamais un chiffre annoncé »*
(`docs/PLAN.md`, invariant depuis T1). Ce qui suit est donc une estimation construite sur ce qui a
déjà été payé pour ce modèle-là, pas un devis.

Deux mesures réelles existent dans le dépôt :

- **Vingt-quatre images payées le 30 août 2026** chez `openai/gpt-image-2`, mêmes réglages
  partout : **$0,0063** sans image jointe, **$0,0139** avec une, **$0,0232** avec deux
  (`atelier/services/prix.py`, module qui calcule ce chiffre pour l'écran).
- **Un banc du 31 août 2026** sur des feuilles de 3, 5 et 6 cases, même modèle, même image
  1024×1024 : **$0,0139**, **$0,0534**, **$0,0139** (`essais/mesures_prix_planche.json`). Sa
  conclusion, écrite dans le fichier : *une planche coûte le prix d'UN appel, quel que soit le
  nombre de cases qu'il porte* — et la variance entre deux appels identiques dépasse l'écart dû
  au nombre de cases. Un atlas de tuiles est un seul appel, comme une planche de sprites.

**Estimation retenue : entre $0,006 et $0,05 par tirage**, sans image jointe, la plupart des
points mesurés se logeant plutôt autour de $0,01–$0,02. Joindre une référence (la bible du
projet, pour garder le style) fait grimper ce chiffre — mesuré à $0,0139 pour une image jointe et
$0,0232 pour deux, sur les mêmes réglages. Le script de la section 5 n'en joint aucune par défaut ;
c'est un réglage explicite s'il change.

**Ce que le catalogue déclare** (`essais/prix.json`, relevé chez OpenRouter) : `openai/gpt-image-2`
facture au jeton — texte, image reçue, image rendue — pas à l'image entière. Ce tarif ne se
traduit pas en dollars par image sans connaître le nombre de jetons qu'un appel précis consomme,
et le dépôt ne le devine jamais : c'est pour ça que l'estimation ci-dessus vient de mesures, pas
du tarif déclaré.

## 4. Combien de tirages pour conclure honnêtement

**Huit tirages minimum** — c'est la règle déjà suivie pour tout banc payant du dépôt. Un seul
ensemble réussi ne prouverait pas que le parcours marche à tous les coups (le banc du 31 août
montre un appel identique coûter quatre fois plus qu'un autre : la qualité peut varier pareil) ;
un seul raté ne prouverait pas non plus que ça ne marche jamais.

**Prix de huit tirages : entre $0,05 et $0,40**, le plus probable autour de $0,10–$0,15
d'après les points mesurés ci-dessus. C'est le nombre à proposer, pas le minimum d'un seul essai.

## 5. Ce qu'on saura après, et ce qu'on ne saura toujours pas

**On saura** : est-ce qu'un modèle réel sait dessiner un atlas dont les bords se raccordent assez
pour qu'une carte d'essai tienne debout dans Godot ; combien de tuiles, sur seize demandées,
arrivent utilisables sans retouche ; si les corrections manuelles déjà prouvées (extraire une
case, la refaire, la réintégrer) suffisent à rattraper les ratés ; et un prix par tirage mesuré
pour de vrai, remplaçant l'estimation de cette note.

**On ne saura pas** : si un autre modèle ferait mieux ou moins cher — ce chiffrage ne teste que le
défaut du produit ; si le style d'un vrai jeu (avec sa bible en référence) se comporte pareil —
joindre une référence change le prix et probablement le résultat ; ni si un atlas plus grand (plus
de seize tuiles, plus de terrains) tient la même qualité.

## 6. Ce qui se passe si c'est raté

Les règles du produit s'appliquent sans exception (`docs/PLAN.md`, § « L'argent et l'appel ») :

- **Un identifiant de génération ne facture qu'une fois**, même soumis deux fois — relancer un
  tirage qui a échoué à mi-chemin ne repaie pas ce qui est déjà parti.
- **Un appel qui atteint le modèle et ne rend aucune image utilisable facture quand même** — le
  fournisseur a travaillé, la dépense est réelle et s'inscrit au journal
  (`atelier/fournisseur/openrouter.py`). Seul un refus **avant** l'appel (clé absente, modèle
  grisé) ne coûte rien.
- **Rien n'est jamais relancé tout seul** — un tirage raté reste raté jusqu'à ce que l'auteur (ou
  l'agent, sur sa demande) décide de payer un second appel.
- **Une dépense ne s'efface jamais** — même si l'atlas produit est mauvais et qu'on l'écarte, sa
  ligne de coût reste au journal du projet.
- **L'atlas reste ouvrable même raté** : create_tile_set fonctionne sur n'importe quelle image
  valide, un raccord manqué se corrige localement et gratuitement (extraire la case, la refaire à
  la main ou par un nouvel appel ciblé, la réintégrer) sans repayer l'atlas entier.

Rien de tout cela ne coche AU13. Le critère reste ouvert tant que l'essai réel n'a pas eu lieu.

## Le script prêt à lancer

`essais/essai_au13_generation_reelle.py` — écrit et vérifié à blanc dans cette même séance,
`tests/test_essai_au13_generation_reelle.py` le prouve. Il annonce ce prix avant le premier appel,
refuse de partir sans `--payer`, et demande de retaper le montant affiché avant de dépenser un
centime.
