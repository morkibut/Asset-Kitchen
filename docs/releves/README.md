# Les relevés — ce que le produit *est*, mesuré

> **Ce dossier n'a pas d'opinion.** Il ne décide rien, il ne propose rien : il établit ce que
> l'atelier fait réellement, avec des chiffres et des preuves. Chaque affirmation porte sa source —
> le fichier et la ligne, ou le comptage effectué.
>
> **Il existe parce qu'une refonte pensée depuis l'usage aura besoin d'atterrir.** Partir de ce
> qu'on veut obtenir est la bonne méthode ; mais au moment de trancher, il faudra savoir ce que le
> produit sait déjà faire, ce que le modèle peut exprimer, et ce que chaque écart coûterait. Ces
> chiffres-là ne se retrouvent pas de mémoire.

---

## Ce qu'il y a dedans

| Fichier | Ce qu'il établit | Comment il a été fait |
|---|---|---|
| **`2026-09-04-le-parcours-voulu.md`** | **Le parcours que l'auteur veut**, dans ses mots, écran par écran — et les deux défauts structurels que sa visite révèle | sa relecture du produit, le 4 septembre 2026 |
| **`2026-09-04-interface-mesuree.md`** | **L'état mesuré de l'interface** : ce qui signale un clic, la charge de texte écran par écran, les parcours qui ne se dessinent pas, les mots employés à la place des signes, l'état des quatorze défauts de l'audit d'août, la palette du jeu. Plus six sondages sur l'état de l'art, un brief consolidé et deux relectures adverses | douze lectures parallèles du code et des sources, plus trois passes de synthèse et de critique |
| **`2026-09-04-modele-equipement.md`** | **Une relation manquante dans le modèle** : une pièce d'équipement n'appartient à personne, et trois griefs d'usage en découlent | lecture du serveur |
| **`2026-09-04-carte-des-ecrans.md`** | **Le graphe des écrans** : 42 surfaces sur 5 niveaux, ce que chacune fait, comment on y entre et comment on en sort. Puis une carte cible **non validée**, et les deux relectures qui la démontent | huit lectures parallèles du code, plus une synthèse et deux critiques |

> ⚠️ **La carte cible de `2026-09-04-carte-des-ecrans.md` n'est pas retenue.** Ses deux relectures lui
> reprochent de répondre au *manque de lien* sans répondre à la *complexité* — le produit en sortirait
> avec **plus** d'écrans qu'il n'en a — et de casser trois règles écrites du produit. **Ses parties I
> et IV valent, sa partie III est un brouillon.** Lire les quatre dans l'ordre, ou aucune.

**Un document long ne se lit pas d'un bout à l'autre.** `2026-09-04-interface-mesuree.md` fait
1 900 lignes : c'est une **référence qu'on ouvre au sommaire**, pas une lecture de début de séance.

---

## Ce qui est décidé vit ailleurs, et il ne faut pas les confondre

| Document | Ce qu'il porte |
|---|---|
| `docs/DESIGN.md` | **le système de design**, réécrit de zéro le 4 septembre 2026 — ce à quoi l'atelier doit ressembler |
| `docs/design-decisions.md` | **le journal des décisions**, datées, avec leur raison et leur coût. On l'ouvre pour rouvrir une décision |
| `docs/archive/vocabulaire-a-fermer.md` | **un mot par geste** : les 179 libellés du produit ramenés à un vocabulaire fermé |
| `docs/parcours.html` | **le parcours en une image** : les trois lieux, les trois profondeurs, la règle de lecture et le budget d'écrans (41 → 22 → 11). Deuxième version, après sept relectures qui ont démoli la première |
| `docs/archive/design-preview-refonte.html` | **le spécimen vivant** du système : polices, palette, formes de contrôle, et une maquette d'écran |
| `docs/archive/DESIGN-avant-refonte-2026-09-04.md` | **le système d'avant**, qui décrit encore le code tant que la refonte n'est pas livrée |

---

## La règle de travail, depuis le 4 septembre 2026

**Le développement de la V3 tourne en parallèle, et une seconde piste de design part de l'usage
sans regarder le code.** Ce dossier et les documents de design sont donc les **seuls** endroits où
l'on écrit : aucune modification de l'interface, du serveur ou des données ne sort de ce chantier.

Deux défauts trouvés en chemin sont **consignés et non réparés**, exprès :

- **`--color-signal-sourd` est déclaré et n'existe pas** — deux boutons actifs de l'écran des tables
  n'ont aucun fond, et rien ne lève d'erreur. Voir
  `docs/archive/DESIGN-chassis-chaud-2026-09-04.md` § Et un défaut à réparer avant tout le reste.
  ✔ **Réparé par `B0`, le 6 septembre 2026** : les deux boutons sont passés sur un jeton qui
  existe. Le défaut avait été fermé *dans le document* en réécrivant la table sans lui, et il
  restait ouvert dans le code — ce que le contrôle des deux sens a trouvé.
- **Le figement de deux secondes** quand on éteint un champ de style, faute d'état d'attente. Voir
  `2026-09-04-le-parcours-voulu.md`.

---

## Comment s'en servir quand on dessine sans regarder le code

Trois questions, trois endroits :

1. **« Est-ce que le produit sait déjà faire ça ? »** → `docs/PRD.md` pour l'intention,
   `2026-09-04-interface-mesuree.md` pour ce que le code tient réellement. Les deux divergent par
   endroits, et c'est noté à chaque fois.
2. **« Est-ce que le modèle peut exprimer ça ? »** → `2026-09-04-modele-equipement.md` pour le cas
   déjà trouvé, `docs/ARCHITECTURE.md` pour le reste. Une relation qui n'existe pas dans le modèle
   ne se rattrape pas au dessin.
3. **« Pourquoi c'était comme ça ? »** → `docs/design-decisions.md`. Beaucoup de choses qui
   paraissent absurdes ont une raison mesurée derrière — et certaines de ces raisons sont tombées le
   4 septembre 2026, avec leur remplaçante écrite.

**Et une quatrième, qui compte autant** : *qu'est-ce qu'on perdrait ?* La section **« Ce qu'il ne
faut pas perdre »** du brief consolidé liste dix-neuf acquis, chacun avec ce qu'il a coûté. C'est la
partie la plus facile à détruire sans s'en apercevoir.
