---
name: autopilote
description: Enchaîner en autonomie les tranches d'un plan, déléguer les missions indépendantes aux modèles OpenAI choisis par /affecte, vérifier l'interface face aux maquettes et commiter les étapes validées. Utilise sur /autopilote ou demande explicite de poursuivre le développement sans s'arrêter. Préfère les modèles légers pour les raccords simples et un contexte court par mission.
---

# /autopilote

Une session normale s'arrête après chaque tranche pour vérifier qu'elle a le bon cap : bon
modèle, bonne décision, bon accord avant de continuer. Ce skill inverse la politique par
défaut, à la demande explicite : tant qu'aucune règle de sécurité permanente n'est en jeu, il
enchaîne — tranche suivante, sous-agent au bon modèle, décision prise sur recommandation,
commit, tranche suivante — sans repasser la main entre deux tranches.

**Ce que ce skill ne change pas** : les règles permanentes sur le destructif, l'irréversible et
ce qui sort du dépôt (force-push, suppression de données, envoi de message, dépense, secrets,
réglages de sécurité) s'appliquent identiquement. L'autonomie porte sur les décisions
d'implémentation et de conception, pas sur ces catégories-là.

## Quand il se déclenche

Uniquement sur demande explicite — la formulation de l'utilisateur ou l'invocation `/autopilote`.
Il ne se déclenche jamais de lui-même en cours de session : le passage en boucle autonome est
une décision de l'utilisateur, pas une inférence.

## Process

### 1. Vérifie le terrain : plan et affectation

Trouve le plan actif (`docs/PLAN.md` ou équivalent du dépôt ; si plusieurs plans coexistent et
qu'aucun n'est clairement celui en cours, pose la question une fois — c'est une inconnue
réelle, pas une décision de conception).

Cherche le fichier d'affectation qui l'accompagne (`docs/PLAN-<nom>-affectation.md` ou
équivalent). **S'il n'existe pas, ou si des tranches neuves n'y figurent pas encore, lance le
skill `/affecte` dessus avant toute chose.** Coder une tranche sans savoir quel modèle elle
demande, c'est deviner à l'œil — exactement ce que `/affecte` existe pour éviter.

### 2. Repère la prochaine tranche

Dans l'ordre du plan, la première tranche ni faite ni bloquée. À défaut de fichier de suivi
dédié, croise l'état du dépôt (tests qui passent déjà, code déjà écrit) avec le plan pour ne
pas refaire ce qui existe.

Relève son étiquette dans le fichier d'affectation (modèle + niveau de réflexion). Si plusieurs
tranches consécutives sont indépendantes l'une de l'autre (pas de dépendance déclarée entre
elles dans le plan), elles partent en parallèle ; sinon, une à la fois, dans l'ordre.

### 3. Délègue les missions bornées au modèle affecté

Le principe de ce skill est que la session appelante reste un chef d'orchestre, pas un
exécutant : chaque tranche part en sous-agent (outil `Agent`), avec :

- **`model`** fixé d'après le compagnon et les modèles proposés par l'outil de sous-agents :
  Spark s'il est disponible ou Luna pour le mécanique, Terra pour les parcours, modèle
  principal pour les points durs, selon la grille de `/affecte`. Ne pas inventer un modèle
  absent ni créer une tâche utilisateur pour contourner son absence.
- Un **prompt autonome et complet** : ce que la tranche livre, ses critères d'acceptation, les
  fichiers ou modules concernés, et — pour une étiquette qui demande une réflexion élevée —
  une ligne qui le dit explicitement, puisque le paramètre `model` seul ne fixe pas la
  profondeur de réflexion.
- Un contexte minimal : contrat déjà décidé, fichiers possédés, critères et vérifications.
  Avec `spawn_agent`, fournir `model` et `reasoning_effort` quand permis, et `fork_turns`
  vide ou limité pour ne pas recopier tout l'historique. Les missions partent en parallèle
  uniquement si elles sont indépendantes ; pas d'argument d'outil fictif.

L'orchestrateur tient les décisions transversales, l'intégration et la revue finale. Une
micro-modification qui ne constitue pas une mission indépendante ne justifie pas un nouvel
agent. Ne pas relancer les missions déjà terminées pour changer leur modèle ; appliquer le
choix économique dès la mission suivante. Un modèle différent du modèle principal n'exige
pas une nouvelle confirmation quand l'auteur a déjà autorisé la délégation et l'autonomie.

### 4. Décisions ouvertes : trancher, pas remonter

Une tranche ou un sous-agent qui bute sur un point non spécifié par le plan (un détail
d'interaction, un nom, un cas limite, un choix visuel) ne s'arrête pas pour demander. Il
tranche, avec cet ordre de priorité :

1. **Ce qui fait avancer le code** — débloque le plus de tranches suivantes, ou complète un
   invariant déjà posé plutôt que d'en ouvrir un nouveau.
2. **Ce qui rapproche l'interface ou la fonctionnalité de la maquette**, quand le projet en a
   une (dossier de maquettes, design de référence, capture approuvée). La maquette est la
   source à consulter en premier sur un choix visuel ou d'interaction — pas une réinvention.
3. À égalité, la lecture la plus simple à vérifier plus tard prime sur la plus habile.

La décision se note en une ligne (message de commit, ou fichier de suivi si le dépôt en a un)
pour rester traçable, mais n'attend pas de réponse pour continuer.

`AskUserQuestion` reste disponible dans cette boucle **seulement** pour une inconnue réelle
qu'aucune lecture du dépôt ne résout (ex. : quel plan est actif à l'étape 1) — jamais pour un
choix de conception ou d'implémentation, qui se tranche par la grille ci-dessus.

### 5. Vérifie avant de déclarer une tranche finie

Avant de passer à la suivante : suite de tests / vérification de types du dépôt si elle existe,
et pour une tranche qui touche l'interface, un aperçu navigateur comparé à la maquette quand il
y en a une. Une tranche qui compile mais casse un test existant n'est pas finie — elle se
corrige avant de continuer, pas après.

### 6. Commit à chaque tranche franchie, jamais un seul commit de fin

Une fois une tranche vérifiée, elle se commit seule — pas regroupée avec la suivante, pas
reportée à la fin de la session. Message court, dans le style déjà présent dans `git log` du
dépôt, qui nomme la tranche. Chaque commit est un point de reprise : si une tranche plus loin
casse quelque chose, l'historique dit exactement où.

Pas de `--no-verify`, pas de `--force`, pas de réécriture d'historique dans cette boucle — les
mêmes règles que pour tout commit s'appliquent.

### 7. Enchaîne jusqu'à quoi

Tranche finie et commitée → tranche suivante, sans repasser la main entre les deux. Le skill
s'arrête et rend la main seulement quand :

- le plan est entièrement fait ;
- toute tranche restante bute sur une vraie inconnue (décision aux enjeux réels, identifiants
  externes, action des catégories permanentes ci-dessus) ;
- une régression ne se corrige pas sans une décision qui dépasse la grille de l'étape 4.

À l'arrêt réel, un compte rendu court : ce qui est fait, ce qui bloque et pourquoi, ce qui
reste — pas un récit de chaque tranche traversée.

## Ce qu'il ne faut pas faire

- Ne pas s'arrêter entre deux tranches pour un accord si rien de destructif ni d'externe n'est
  en jeu — c'est tout le sens du skill.
- Ne pas deviner un modèle à l'œil : `/affecte` existe, l'étape 1 le rappelle.
- Ne pas regrouper le travail de plusieurs tranches dans un seul commit.
- Ne pas laisser une décision de conception remonter en question quand la grille de l'étape 4
  suffit à la trancher.
- Ne pas élargir l'autonomie de ce skill aux catégories permanentes (destructif, irréversible,
  envoi externe) : ces règles-là ne bougent pas, quelle que soit la demande.
