# Gabarit du document

Sommaire de ce fichier :
- [Structure des sections](#structure-des-sections)
- [Ce que chaque section doit contenir](#ce-que-chaque-section-doit-contenir)
- [Règles de rédaction](#règles-de-rédaction)
- [Éléments visuels qui gagnent leur place](#éléments-visuels-qui-gagnent-leur-place)
- [Exemples : avant / après](#exemples--avant--après)

---

## Structure des sections

L'ordre suit la construction, pas la découverte : chaque section s'appuie sur les précédentes.
Numérote-les — ici la numérotation encode une dépendance réelle, elle n'est pas décorative.

| № | Section | Toujours ? |
|---|---------|-----------|
| 01 | Vue d'ensemble & principes directeurs | oui |
| 02 | Architecture technique & arborescence | oui |
| 03 | Modèle de données | oui |
| 04 | Cycle de vie de l'objet central (machine à états) | s'il y en a un |
| 05… | **Un module par section**, dans l'ordre des dépendances | — |
| n-5 | Interfaces, écran par écran | s'il y a une UI |
| n-4 | Réglages (exhaustif) | oui |
| n-3 | API / surface publique (exhaustif) | s'il y en a une |
| n-2 | Outils en ligne de commande | s'il y en a |
| n-1 | Tests & déploiement | oui |
| n | **Invariants de conception** + ordre de construction | oui |

Les sections « modules » sont le corps du document. Une par sous-système réel : ce qui a son
propre vocabulaire, ses propres tables ou son propre cycle de vie. Découper par dossier donne
un mauvais document ; découper par responsabilité donne le bon.

---

## Ce que chaque section doit contenir

### 01 — Vue d'ensemble & principes directeurs

Deux blocs. D'abord **ce que l'outil fait**, en verbes d'action, une ligne par capacité — un
lecteur doit savoir en trente secondes s'il est au bon endroit.

Ensuite, et c'est le vrai contenu : **les principes qui expliquent les décisions du code**.
Quatre à six, extraits de ce que tu as lu, pas inventés. Un bon principe est contestable : si
personne ne pourrait raisonnablement décider l'inverse, il ne dit rien.

> Faible : « Le code est modulaire et maintenable. »
> Bon : « Ce qui se calcule ne se demande jamais à un modèle — longueurs, valeurs autorisées,
> dates de fêtes, sélection de produits en stock. Un modèle y serait plus cher et moins fiable. »

### 02 — Architecture technique

Tableau de la pile (couche, choix, rôle). Arborescence commentée — **commentée**, une
arborescence nue n'apprend rien. Séquence de démarrage numérotée, y compris les garde-fous qui
s'exécutent au lancement. Mentionne le modèle de migration s'il est inhabituel (additif
idempotent, versionné, absent).

### 03 — Modèle de données

La table centrale, **colonne par colonne**, avec le rôle de chacune. Les autres tables en une
ligne chacune plus leurs points notables. Pour toute colonne portant du JSON, donne la forme
réelle. Signale les colonnes dont l'existence est elle-même une décision (« ce champ existe
parce que le statut est écrasé à chaque traitement et ne survit pas au redémarrage »).

### 04 — Cycle de vie

Diagramme d'états + tableau : état, signification, qui l'attribue, transitions possibles.
Nomme la donnée qui décide de la transition — c'est ce qu'on redemande toujours.

### 05… — Modules

Chaque section de module contient, dans cet ordre :
1. une phrase qui dit **la règle centrale** du module ;
2. le déroulé, étape par étape, avec entrées et sorties ;
3. les valeurs numériques (seuils, plafonds, délais, tailles) ;
4. les cas particuliers et ce qui les déclenche ;
5. ce que le module refuse de faire, et pourquoi.

Pour un pipeline ou une chaîne de traitement, une étape par bloc, avec pour chacune : ce
qu'elle consomme, ce qu'elle produit, si elle est facultative, et son coût relatif.

### Interfaces

Écran par écran. Pour chaque écran : sa fonction, ses filtres et tris disponibles, ses actions,
et les états qu'il sait afficher. Les tableaux de correspondance onglet → contenu sont plus
utiles que des paragraphes.

### Réglages

**Exhaustif**, sans exception — c'est une section de référence, pas de lecture. Nom du réglage,
valeur par défaut, effet. Ajoute les variables d'environnement dans le même format.

### API / surface publique

**Exhaustif** aussi. Regroupe par domaine, une ligne par route : méthode, chemin, ce qu'elle
fait, particularités (flux d'événements, code de conflit, corps binaire).

### Invariants de conception

Un tableau à trois colonnes : numéro, règle, **ce qui arrive quand on l'enfreint**. La
troisième colonne est la raison d'être de la section : elle transforme une liste de conseils
en liste de faits.

Termine par l'ordre de construction : les modules dans l'ordre qui minimise les reprises, en
une phrase.

---

## Règles de rédaction

**Le passé des pannes est une information, pas une anecdote.** Quand un commentaire raconte un
incident chiffré — « 206 fiches optimisées, aucune donnée arrivée sur le site » — reprends le
chiffre. C'est ce qui fait qu'une règle est suivie plutôt que contournée.

**Une affirmation par phrase, vérifiable.** Si tu ne peux pas pointer la ligne de code qui la
soutient, ne l'écris pas.

**Pas de conditionnel de politesse.** « Le studio relit systématiquement ce qu'il vient de
publier » — pas « il serait souhaitable de relire ».

**Les tableaux battent les paragraphes** pour tout ce qui est énumérable : colonnes, routes,
réglages, états, seuils. Réserve la prose à ce qui a besoin d'être expliqué.

**Signale ce que tu n'as pas pu vérifier.** Un document de reconstruction qui présente une
supposition comme un fait fait perdre plus de temps qu'il n'en fait gagner. Une note courte
suffit : « le comportement en cas de X n'est pas déterminable à la lecture ».

---

## Éléments visuels qui gagnent leur place

Peu, et chacun pour une raison :

- **Une machine à états** en SVG en ligne, si l'objet central en a une. Les transitions sont
  pénibles à décrire en prose et évidentes en image.
- **Des rails d'étapes** en HTML/CSS pour les pipelines — plus robustes qu'un SVG et capables
  de porter le détail par étape (modèle employé, coût, entrées/sorties).
- **Des tableaux de décision** pour les arbitrages à plusieurs branches (situation → issue →
  effet). Souvent plus clair qu'un organigramme.

Évite les diagrammes d'architecture en boîtes-et-flèches : ils occupent beaucoup de place pour
répéter l'arborescence commentée.

Pour un SVG en ligne, utilise les variables CSS du document dans les attributs de présentation
(`fill="var(--accent)"`) — elles fonctionnent, et le diagramme suit alors les deux thèmes sans
duplication.

---

## Exemples : avant / après

**Un module**

> Résumé : « Le service de publication envoie les fiches vers WordPress et gère les erreurs. »
>
> Spécification : « La publication est idempotente : republier ne réécrit pas le contenu, elle
> rejoue l'envoi. Avant départ, cinq transformations — conversion des objets média en
> identifiants, booléens rendus dans la forme d'origine du champ, retrait des clés que le site
> n'expose pas, retrait de toute URL dans un champ image, auto-réparation de type sur rejet.
> Après envoi, la fiche est relue : le site accepte des requêtes en écartant des clés et répond
> 200, donc l'absence d'erreur ne prouve rien. »

**Un invariant**

> Faible : « Il faut valider les données avant de les envoyer. »
>
> Bon : « Le nom canonique d'un champ de profil *est* la clé envoyée au site. S'il diffère du
> champ réel, le site l'écarte en silence et répond 200 — 206 fiches ont été produites sans
> qu'aucune donnée n'arrive, et le décalage n'a été découvert qu'après 25 échecs de publication. »

**Un réglage**

> Faible : « `ttl` — durée de cache. »
>
> Bon : « `factsTtlDays` — 0 à 365, défaut 90. Durée de validité du dossier factuel.
> **Principal levier de coût** : les faits sur une entité ne changent pas entre deux itérations
> du prompt, et la recherche web est l'étape la plus chère. À 0, elle est repayée à chaque
> passage. »
