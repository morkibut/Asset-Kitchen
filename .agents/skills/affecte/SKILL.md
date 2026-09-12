---
name: affecte
description: Classer les tranches d'un plan par difficulté ([VERY-EASY] à [VERY-HARD]), choisir les modèles OpenAI disponibles et leur réflexion pour économiser les jetons, puis écrire ou mettre à jour le compagnon d'affectation du plan. Utilise sur /affecte, pour choisir le modèle d'une tâche ou déléguer économiquement, et après création ou extension d'un plan. Sépare les raccords simples des décisions critiques.
---

# /affecte

Un plan dit quoi livrer et dans quel ordre. Son compagnon indique quel modèle peut
prendre chaque morceau, avec le moins de contexte et de réflexion nécessaires.
Le classement repose sur le code existant, pas sur l'importance commerciale de l'écran.

## Trouver le plan et préserver les décisions

Par défaut, lire `docs/PLAN.md`, puis le plan de chantier qu'il désigne. Suivre un chemin
explicitement demandé par l'auteur. Plusieurs plans ne nécessitent une question que si
ni le dépôt ni la conversation ne désignent celui qui est actif.

Lire le compagnon existant. Conserver les étiquettes déjà ajustées ; ne classer que les
ajouts ou les morceaux dont le contrat a changé. Un changement de catalogue de modèles
modifie l'affectation d'exécution, pas automatiquement la difficulté.

Les anciens noms Haiku, Sonnet et Opus sont des affectations historiques. Les convertir
vers les modèles OpenAI disponibles à difficulté et réflexion comparables, en indiquant
la date du changement. Ne pas présenter cette correspondance comme un benchmark mesuré.

## Mesurer avant de classer

Pour chaque tranche ou morceau :

- relever les routes, données et composants déjà présents ;
- identifier le contrat, schéma, algorithme ou raccord à ajouter ;
- repérer les invariants et essais existants à préserver ;
- compter les points d'intégration concernés, sans confondre volume de fichiers et difficulté.

Distinguer les essais lus des essais réellement exécutés. Une route prête à afficher
abaisse souvent le travail UI ; une modification de données cachée dans un écran le relève.

## Choisir parmi les modèles réellement disponibles

Lire les capacités de l'outil qui exécutera la mission : noms exacts et réflexions permises.
Un modèle proposé pour une nouvelle tâche dans l'application n'est pas forcément disponible
pour un sous-agent. Ne pas créer une tâche utilisateur pour contourner cette différence.

Grille de départ pour l'environnement OpenAI ; les exemples s'appliquent uniquement quand
ils sont disponibles et restent subordonnés aux préférences explicites de l'auteur :

| Étiquette | Modèle de départ | Réflexion | Critère |
|---|---|---|---|
| VERY-EASY | GPT-5.3 Codex Spark, sinon GPT-5.6 Luna | faible | report mécanique, résultat exact connu, aucune décision de contrat |
| EASY | GPT-5.6 Luna | faible à moyenne | expose des données et routes existantes, sans invariant nouveau |
| MEDIUM | GPT-5.6 Terra | élevée | parcours avec état, règle métier ou algorithme standard, périmètre borné |
| HARD | GPT-6 Astra ou modèle principal adapté | élevée | forme durable de données, invariant partagé, dépense, secret, disque du jeu ou sous-système nouveau |
| VERY-HARD | GPT-6 Astra ou modèle principal adapté | très élevée | plusieurs couches à coordonner et régression complexe à diagnostiquer |

`gpt-5.6-sol` peut remplacer Terra pour une mission de portée comparable si c'est le
modèle disponible ou préféré. Les valeurs textuelles de réflexion se traduisent vers
celles qu'accepte l'outil (`low`, `medium`, `high`, `xhigh`, etc.).
Ne pas choisir `max` par défaut, ni inventer une estimation d'économie ou un tarif.

Si Spark est absent de l'outil de sous-agents, choisir Luna. Si toute une famille est
absente, prendre le plus petit modèle disponible qui satisfait le contrat et consigner
ce choix. Ne jamais prétendre avoir lancé le modèle seulement recommandé.

En cas de doute, prendre l'étiquette basse et extraire le point dur. Si plus d'un tiers
des tranches sont HARD ou VERY-HARD, vérifier qu'on n'a pas classé toute une tranche sur
sa seule décision difficile. Conserver ce classement quand les contrats le justifient.

## Séparer la décision du report

Chaque morceau doit pouvoir se décrire en une ligne.

- Un point dur qui monte : invariant, cause inconnue, contradiction entre contrats.
- Un morceau qui descend : raccord UI, adaptation d'appels, libellés, tests fondés sur
  des critères fixés, une fois la décision prise.

La décision critique est confiée au modèle adapté sur un périmètre court. Ses conclusions
deviennent le contrat fourni au modèle léger qui réalise les raccords. La relecture
transversale des données, de l'interface et des dépenses reste au modèle principal ;
ne pas relancer une revue lourde identique pour chaque report mécanique déjà vérifié.

## Écrire le compagnon

Écrire à côté du plan `docs/PLAN-<nom>-affectation.md`, avec ces sections :

1. Plan concerné, date, modèles réellement disponibles et préférence de l'auteur.
2. Mesures avant classement : déjà présent, à ajouter, points d'intégration, essais.
3. Tableau des tranches : identifiant, difficulté, modèle exact, réflexion, justification
   en une phrase ; total par difficulté.
4. Points durs qui montent, avec tranche et mission précise.
5. Morceaux qui descendent, avec tranche et mission précise.
6. Règles d'exécution et choix de repli quand un modèle manque.

Le compagnon ne change ni le contenu ni l'ordre du plan. Éviter les futurs noms de fichiers
ou fonctions dans les tableaux de missions : décrire le résultat et le contrat. Les chemins
du code déjà mesuré peuvent servir de preuve, sans devenir un découpage d'implémentation.

Ajouter au plan une seule référence au compagnon si elle manque. Confirmer le chemin écrit,
sans recopier tous les tableaux dans la conversation.

## Exécuter sans gaspiller le contexte

Avant le codage, consulter l'affectation ; ne pas la déduire après coup du modèle utilisé.
Vérifier que les conventions du dépôt portent cette règle en substance ; ne pas réécrire
une formulation existante ajustée à la main.

Quand la délégation est autorisée et disponible :

- annoncer une fois le choix, puis lancer le sous-agent avec le modèle et la réflexion ;
- fournir un prompt autonome, court : objectif, fichiers possédés, contrat déjà décidé,
  critères, commandes de vérification et changements voisins à préserver ;
- éviter de transmettre l'historique complet pour un raccord simple ; avec un modèle
  explicite, employer un fork vide ou limité si l'outil le demande ;
- ne paralléliser que des missions indépendantes avec du travail utile en parallèle ;
- ne pas multiplier les agents, relectures et relances pour une micro-modification ;
- après un échec, diagnostiquer : préciser la mission ou isoler le point difficile avant
  d'escalader, sans répéter indéfiniment le même essai.

Sans délégation disponible, ne pas annoncer un changement du modèle de la session que
l'outil ne peut pas effectuer. Si l'auteur a autorisé de poursuivre ici, continuer avec
le modèle actif et le dire brièvement ; sinon fournir le prompt pour le modèle recommandé.
Ne pas redemander une autorisation déjà donnée, ni arrêter une boucle autonome pour une
simple différence de modèle.

## Limites

Une affectation n'autorise aucune dépense externe, modification d'installation, publication
ou action destructive supplémentaire. Aucun pourcentage d'économie n'est promis sans mesure.
Ne pas reclasser à la hausse parce qu'un écran est vaste, ni à la baisse parce qu'il semble
simple : c'est le contrat à modifier qui tranche.
