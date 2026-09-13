---
name: reconstruction-spec
description: >-
  Explore un dépôt de code inconnu de façon systématique et en produit une spécification
  de reconstruction complète — un document qui permet de réécrire l'application de zéro :
  modèle de données, workflows, pipelines, interfaces, réglages, API, et les invariants de
  conception avec la panne que chacun évite. Livré en un fichier HTML autonome — polices
  intégrées, feuille d'impression, lisible hors ligne — et publiable en Artifact quand un lien
  partageable est utile. Déclenche ce skill dès que quelqu'un demande de documenter, cartographier,
  auditer ou expliquer une application ou une base de code en entier — « fais-moi un document
  complet sur ce que fait l'app », « documente ce projet », « spec technique », « comment ça
  marche exactement », « je veux pouvoir la refaire », « onboarding doc », « reverse engineering »,
  « architecture overview », « document all the features » — même s'ils ne disent ni « spec »
  ni « skill ». Ne s'applique pas à la documentation d'UN module ou d'UNE fonction : c'est un
  outil de couverture exhaustive.
---

# Spécification de reconstruction

Produire un document qui permet à quelqu'un — humain ou modèle — de **réécrire l'application
sans avoir accès au code d'origine**. C'est une barre bien plus haute qu'un README ou qu'un
tour d'horizon : tout ce qui manquerait obligerait à redécouvrir un choix par l'échec.

Le test à garder en tête tout du long : *si je supprimais le dépôt et ne gardais que ce
document, qu'est-ce qui serait perdu ?* Ce qui reste dans la réponse est ce qu'il faut écrire.

## Le principe qui gouverne tout le reste

**Le code est la source de vérité, pas la documentation existante.** Les `docs/`, README et
commentaires de haut niveau d'un projet vivant sont presque toujours en retard sur le code —
parfois de plusieurs refontes. Lis-les pour comprendre l'intention d'origine et repérer le
vocabulaire du domaine, jamais pour décrire le comportement actuel.

En revanche, **les commentaires qui expliquent *pourquoi* sont l'or du dépôt**. Un commentaire
qui dit « on relit l'empreinte sur le site plutôt que de la recopier du local, sinon la
synchronisation suivante signale des fiches que personne n'a touchées » vaut dix diagrammes :
il contient une règle, sa raison, et la panne qu'elle évite. C'est de cette matière que sort
la meilleure section du document.

---

## Phase 1 — Reconnaissance (large et bon marché)

L'objectif est de savoir **où regarder** avant de dépenser du contexte à lire.

```bash
ls -la && cat package.json          # ou pyproject.toml, go.mod, Cargo.toml, composer.json
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) \
  -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./dist/*" | sort
wc -l <tous les fichiers source> | sort -rn | head -60
```

Le classement par nombre de lignes est le meilleur plan de lecture qui existe : les cinq plus
gros fichiers d'un projet portent presque toujours son cœur métier, et un fichier de 40 lignes
au nom prometteur est en général une façade.

Note au passage : scripts npm/make (ils révèlent les outils de maintenance), fichiers de
configuration, `.env.example`, Dockerfile, dossier de tests.

## Phase 2 — Lecture ciblée

Ordre de lecture qui construit la compréhension au moindre coût — chaque étape éclaire la
suivante :

1. **Point d'entrée** (`server.ts`, `main.py`, `index.js`) — séquence de démarrage, tâches de
   fond, ce qui est monté. La séquence de démarrage révèle souvent des garde-fous qui disent
   beaucoup sur les pannes déjà rencontrées.
2. **Modèle de données** — schéma, migrations, modèles ORM. Lis-le **en entier**, commentaires
   compris.
3. **Surface d'API** — routeurs, contrôleurs. C'est le contrat, et c'est court.
4. **Types et contrats partagés** — souvent l'endroit le plus dense en règles métier. Dans une
   application à base de modèles de langage, c'est aussi là que vivent les prompts.
5. **Cœur métier** — les gros services, un par un, en entier.
6. **Interface** — composant racine, navigation, puis les 3 ou 4 écrans principaux.
7. **Périphérie** — scripts de maintenance, tests, déploiement.

### Discipline de contexte

Une lecture intégrale de tout le dépôt sature le contexte avant la rédaction. La règle :

- **Fichiers critiques** (le cœur, le schéma, les contrats) → lecture intégrale, quitte à
  découper en tranches : `sed -n '1,300p'` puis `sed -n '300,600p'`.
- **Tous les autres** → l'en-tête et la signature suffisent :
  ```bash
  sed -n '1,40p' fichier.ts          # doc de tête : le « pourquoi » du module
  grep -n "^export \|^def \|^class " fichier.ts   # ce qu'il expose
  ```
- **Lectures indépendantes en parallèle**, plusieurs appels dans un même tour.
- Si une sortie est tronquée pour cause de volume, ne relance pas la même commande : découpe.

Cet en-tête + signatures suffit dans l'immense majorité des cas parce que les modules bien
écrits expliquent leur raison d'être en tête de fichier — précisément l'information dont le
document a besoin.

Détail par écosystème dans `references/exploration.md` (à lire si le dépôt n'est ni JS/TS ni
Python, ou si l'architecture résiste).

## Phase 3 — La chasse aux invariants

C'est ce qui distingue une spécification de reconstruction d'un résumé, alors garde-la
délibérée plutôt qu'accidentelle. Pendant la lecture, tiens une liste à part de tout ce qui
relève de la forme : *« il faut faire X, sinon Y arrive »*.

Où ça se trouve :
- les commentaires longs, ceux qui racontent un incident ;
- les noms de garde-fous : `ensure*`, `assert*`, `guard`, `refuseIf*`, `isStuck`, `releaseStuck*` ;
- les valeurs nommées en constantes plutôt qu'écrites en dur — chacune est un arbitrage ;
- les `catch` qui n'échouent pas, et les commentaires qui expliquent pourquoi ;
- les messages d'erreur rédigés avec soin : ils nomment une panne réelle ;
- l'historique git sur les fichiers les plus modifiés (`git log --oneline -- <fichier>`).

Chaque invariant s'écrit en **deux colonnes** : la règle, et ce qui arrive quand on l'enfreint.
Sans la seconde, c'est une préférence de style que le reconstructeur écartera. Avec elle, c'est
un fait, et il la respectera.

Vise 12 à 25 invariants. En dessous de 10, tu n'as probablement pas assez lu les commentaires.

## Phase 4 — Rédaction

Le gabarit complet, section par section, avec ce que chacune doit contenir, est dans
`references/document.md`. **Lis-le avant d'écrire** — c'est là que se trouve le détail qui rend
le document reconstructible.

Les règles qui comptent le plus, à garder en tête :

**Les nombres sont le livrable.** Un seuil, un poids, un délai, un plafond, une taille de lot :
ce sont les valeurs qu'un reconstructeur ne peut pas deviner et qu'il mettra des semaines à
retrouver. « Le score pondère cinq critères » ne sert à rien ; « contenu 32, titre 20, méta 18,
structure 15, complétude 15, plafonné à 45 en présence d'un bloquant » se réimplémente.

**Décris les contrats, pas la prose.** Formes de charge utile, formats d'événements, colonnes,
énumérations d'états, codes de retour. Un exemple concret bat trois phrases de description.

**Documente l'invisible.** Ce qui ne se voit pas dans une capture d'écran est justement ce qui
se perd : politiques de reprise, mise en cache et sa durée de validité, idempotence, exclusion
mutuelle, ce qui se passe au redémarrage, ce qui est délibérément *non* fait.

**Écris dans la langue de l'utilisateur**, et emploie le vocabulaire du domaine tel que le code
l'emploie. Si le dépôt dit « fiche » et « lot », n'écris pas « entité » et « batch ».

**Termine par un ordre de construction.** Les modules dans l'ordre qui minimise les reprises.
C'est court, et c'est la première chose que lira quelqu'un qui reconstruit vraiment.

## Phase 5 — Livraison

1. **Charge le skill `artifact-design`** avant d'écrire la moindre ligne de HTML. Le document
   est long et consulté par recherche visuelle : il lui faut un sommaire latéral, une hiérarchie
   typographique réelle et des tableaux lisibles.
2. **Honore le système visuel de l'application documentée** s'il en a un (couleurs, polices de
   son interface). Le document appartient alors au produit, et c'est aussi la façon la plus
   sûre d'échapper aux palettes génériques.
3. **Écris le fichier par morceaux.** Un document de cette taille passe mal en une seule
   écriture, et les documents *heredoc* cassent sur du HTML volumineux. Écris `p01.html`,
   `p02.html`… avec l'outil d'écriture de fichier, puis `cat p*.html > document.html`.
4. **Fabrique l'export autonome — c'est le livrable.** Un document de reconstruction se
   garde, se copie dans un dépôt, s'ouvre hors ligne et s'imprime. Un seul fichier qui
   contient tout est la bonne forme ; ne la réserve pas à une demande explicite :
   ```bash
   node <chemin-du-skill>/scripts/export_standalone.cjs <document.html> [sortie.html]
   ```
   Le script ajoute le squelette HTML manquant (le fichier source n'a ni `<head>` ni
   `<meta charset>` : ouvert depuis le disque, il afficherait les accents en caractères de
   remplacement), intègre les polices Google en base64 pour que le fichier fonctionne hors
   ligne, et injecte une feuille d'impression. Compte 1 à 2 Mo, dont l'essentiel en polices.
   Livre-le avec l'outil d'envoi de fichier, et propose de le déposer dans le dépôt
   documenté (`docs/`) plutôt que de le laisser dans un répertoire temporaire.
5. **Publie aussi en Artifact** quand le document a une audience — c'est ce qui donne un lien
   partageable et une lecture confortable sans téléchargement. Publie d'abord, vérifie par
   calcul (voir plus bas), corrige, republie, puis exporte : l'export fige l'état du fichier
   source, il doit venir après les corrections. Si l'utilisateur a dit vouloir un fichier et
   non un artefact, l'étape 4 suffit — la vérification par calcul, elle, reste due.

### Vérifier sans capture d'écran

Le rendu visuel n'est pas toujours disponible. Ces contrôles se font par calcul et attrapent
les vraies pannes :

```js
// Les trois états de thème doivent résoudre : système, clair forcé, sombre forcé.
// Une couleur définie uniquement dans un bloc @media ne s'applique pas à l'état non marqué —
// c'est le bug classique de l'artefact illisible.
document.documentElement.setAttribute('data-theme','light'); getComputedStyle(document.body).backgroundColor
```
Contrôle aussi : les polices réellement chargées (`[...document.fonts]`), le débordement
horizontal (`scrollWidth > innerWidth`), et le contraste des libellés secondaires — ce sont
eux qui passent sous 4,5:1, jamais le texte courant.

**Quand aucun navigateur ne peut ouvrir le fichier** — un Artifact privé demande une session
authentifiée, et les outils de prévisualisation refusent souvent un `file://` hors du dossier
du projet. Les mêmes pannes s'attrapent alors en lisant le CSS avec Node, et c'est plus rapide :

- **Les trois jeux de jetons définissent-ils les mêmes noms ?** Extrais les `--nom:` de
  `:root`, du bloc `@media (prefers-color-scheme: dark)` et du bloc `:root[data-theme="dark"]`,
  puis compare les trois ensembles. Un nom présent dans un seul, c'est le thème cassé.
- **Reste-t-il des couleurs littérales hors des blocs de jetons ?** Cherche `#rrggbb` dans le
  CSS situé après les jetons : il ne doit y en avoir aucune.
- **`body` a-t-il un fond depuis un jeton ?** Sans lui, la page emprunte le fond de son hôte.
- **Contraste** : calcule les ratios directement depuis les valeurs des jetons, pour chaque
  thème et pour chaque paire réellement employée (texte secondaire sur fond de tableau,
  accent sur son lavis, pastilles d'alerte). C'est un calcul de dix lignes et il attrape ce
  qu'un coup d'œil ne voit pas.
- **Équilibre des balises** : compte les ouvrantes et les fermantes de `section`, `div`,
  `table`, `p`, `pre`, `svg`. Un document assemblé par `cat` de morceaux se déséquilibre
  facilement, et le navigateur répare en silence ce que l'export ne réparera pas.

### Sur le PDF

Ne promets pas de PDF fidèle : selon les postes, le navigateur en mode sans affichage
n'embarque pas les polices web et le texte retombe sur une police système. Le bon conseil est
d'ouvrir le HTML autonome et d'imprimer depuis le navigateur — la feuille d'impression est
déjà dans le fichier. Si tu génères quand même un PDF, vérifie les polices réellement
embarquées avant de l'annoncer comme conforme, et dis-le si elles manquent.

---

## Calibrer l'effort

Le dépôt de référence de ce skill faisait 47 000 lignes et 140 fichiers, et a donné 21
sections. Adapte :

- **< 5 000 lignes** — une passe de lecture, document de 8 à 12 sections, pas de sous-références.
- **5 000 à 50 000 lignes** — le protocole complet ci-dessus.
- **> 50 000 lignes** — demande à l'utilisateur de délimiter le périmètre avant de commencer.
  Un document qui couvre tout superficiellement ne reconstruit rien ; mieux vaut trois modules
  traités à fond.

Si le dépôt a plusieurs applications (monorepo), demande laquelle avant de lire.

## Ce qui fait rater ce travail

- **Paraphraser les noms de fichiers.** « `syncService` gère la synchronisation » n'apprend
  rien. Ce qui compte, c'est *comment* il tranche, et sur quels critères.
- **Omettre les nombres** pour alléger le texte. Ce sont eux le livrable.
- **Faire confiance aux `docs/`.** Vérifie chaque affirmation dans le code avant de la reprendre.
- **Lire tout le dépôt intégralement**, saturer le contexte, et rédiger de mémoire au moment
  où la précision compte le plus.
- **Une section « invariants » faite de généralités.** « Bien gérer les erreurs » n'est pas un
  invariant. « Un échec de publication doit laisser une trace persistante sur la fiche, sinon
  le bilan disparaît au redémarrage du serveur » en est un.
