# Plan — atelier unifié, de la demande de l'agent au jeu Godot

> PRD source : [PRD.md](PRD.md), US-519 à US-533. Ordre actif annoncé dans [PLAN.md](PLAN.md).
> Branche : `codex/atelier-unifie`, issue de la refonte existante.
> Les objectifs desktop, animation prioritaire, moteurs locaux, asset3d et MCP pour l'agent
> Godot ont été explicitement demandés. Le découpage ci-dessous est proposé en autonomie ;
> les critères non cochés ne sont pas des fonctionnalités livrées.
>
> Affectation : [PLAN-atelier-unifie-affectation.md](PLAN-atelier-unifie-affectation.md).

## Décisions architecturales

- Les API et le MCP sont deux façades des mêmes services. Les contrats existants restent
  compatibles ; les nouvelles capacités ne sont pas codées uniquement dans une façade.
- Les concepts durables sont sujet, objectif, source, résultat, travail et livraison.
  Les formes de données et les frontières sont définies dans
  [l'architecture de l'atelier unifié](archi-atelier-unifie.md).
- Le projet Godot est associé explicitement. Les demandes agentiques sont bornées par son
  cadre de délégation ; le jeu livré fonctionne sans l'atelier.
- Le design papier reste la référence. Les maquettes peuvent changer d'organisation ;
  leur conformité visuelle ne remplace pas la réussite d'un parcours.
- Pas de réécriture générale : réutiliser génération, montage, recettes, exports et MCP.
  Les résultats anciens restent ouvrables. Chaque écran remplacé doit nommer les capacités
  qu'il reprend et fermer l'ancienne porte une fois celles-ci reprises.

## Les cinq jalons lisibles

1. **Une animation existante arrive dans Godot via l'agent** — AU1.
2. **L'agent demande un personnage animé et l'auteur le corrige** — AU2 à AU5.
3. **Les fabrications locales s'enchaînent sans perdre le travail** — AU6 à AU8.
4. **Une source 3D produit plusieurs animations et angles** — AU9 à AU11.
5. **Le même atelier couvre les autres assets, puis tuiles et son** — AU12 à AU14.

Ordre conseillé : AU1 → AU2 → AU3 → AU4 → AU5 → AU6 → AU7 → AU8 → AU9 → AU10 → AU11
→ AU12 → AU13 → AU14. Les dépendances réelles sont indiquées par tranche.
Les tuiles et le son restent en deuxième temps, conformément à la demande.

## AU1 · Une animation existante arrive dans Godot

**User stories** : US-525, US-531, US-533. **Bloquée par** : aucune.

### Ce qu'on livre

Depuis un jeu explicitement associé, l'agent trouve une bande existante, l'exporte et obtient
de quoi la jouer dans une scène Godot. L'interface montre la même sélection et sa livraison.
C'est une première preuve gratuite du trajet complet, avant d'y brancher la génération.

### Critères d'acceptation

- [ ] Une demande MCP retrouve et exporte une animation existante sans appel fournisseur.
- [ ] Le résultat renvoie les fichiers, leurs rôles et les paramètres nécessaires ; Godot
  joue la bande avec le bon ordre, la cadence, la boucle et le pivot.
- [ ] Relancer l'export ne remplace aucun fichier inconnu ; un dossier invalide est expliqué.
- [ ] Une scène de démonstration s'ouvre réellement dans Godot ; son absence sur la machine
  est un contrôle non effectué, jamais une réussite déduite du manifeste.

## AU2 · Le personnage porte les animations utiles au jeu

**User stories** : US-519 à US-521, US-523. **Bloquée par** : AU1.

### Ce qu'on livre

L'auteur ou l'agent définit l'objectif du personnage : fixes, animé ou les deux. Il choisit
les mouvements et directions utiles, importe une référence et voit ce qui reste à produire.

### Critères d'acceptation

- [ ] Une marche dans une direction peut être le seul objectif ; aucune pose fixe n'est exigée.
- [ ] Une référence ne remplit pas une animation ; « non demandé » ne compte pas comme manquant.
- [ ] UI et MCP lisent le même objectif et la même couverture, même après redémarrage.
- [ ] Un ancien personnage rouvre son plan, ses images, bandes et équipements sans perte.

## AU3 · De la demande de l'agent à une nouvelle animation

**User stories** : US-521, US-522, US-526, US-531, US-532. **Bloquée par** : AU2.

### Ce qu'on livre

L'agent demande une animation d'un personnage. L'atelier réutilise ou crée sa référence,
produit un clip avec un moteur existant, prépare une bande et permet de la livrer via AU1.
L'auteur voit la demande, sa source, ses réglages et son état dans le personnage.

### Critères d'acceptation

- [ ] Chemin complet depuis un personnage vide, avec moteur doublé et stockage réel jetable.
- [ ] La méthode doit accepter les références nécessaires ; le cadre de l'agent est relu
  avant soumission et deux demandes concurrentes ne contournent pas ses plafonds.
- [ ] Répéter la clé de demande retrouve le travail ; une fermeture après soumission ne
  déclenche pas une nouvelle fabrication. L'acceptation externe incertaine reste explicite.
- [ ] L'agent reçoit une attente bornée puis un résultat exploitable ; l'UI montre le même état.
- [ ] La livraison provisoire autorisée n'exige pas une intervention humaine à chaque image.

## AU4 · Juger et corriger l'animation sans perdre le contexte

**User stories** : US-523, US-524. **Bloquée par** : AU3.

### Ce qu'on livre

Depuis le personnage, comparer deux versions, ouvrir la bonne bande, corriger son montage
ou une frame, puis retrouver la liste avec la sélection conservée.

### Critères d'acceptation

- [ ] Les actions principales restent visibles dans des fenêtres desktop de 1280 × 800 et
  1600 × 1000, sans imposer plusieurs arbres ni couper un contrôle par un volet.
- [ ] Aperçu à taille de jeu et zoom pixel ; durée, boucle et repère se jugent ensemble.
- [ ] Une correction pendant la lecture est conservée après fermeture et réouverture.
- [ ] Les anciennes capacités de montage et de retouche ont toutes une porte identifiée.

## AU5 · La révision remplace le bon asset dans Godot

**User stories** : US-525, US-533. **Bloquée par** : AU4.

### Ce qu'on livre

L'auteur ou l'agent choisit une révision, prévisualise les fichiers concernés et met à jour
le jeu sans casser les références vers les animations inchangées.

### Critères d'acceptation

- [ ] Remplacer une marche conserve le repos et les autres directions ; les choix d'export
  ne dépendent pas d'un favori modifié dans une autre vue.
- [ ] Une modification manuelle dans le dossier du jeu produit un conflit lisible.
- [ ] Une livraison interrompue n'est pas annoncée terminée ; la précédente reste récupérable.
- [ ] Godot recharge la bonne version ; l'export conserve strictement le descriptif Aseprite.

## AU6 · Plusieurs demandes locales, un travail suivi

**User stories** : US-526, US-532. **Bloquée par** : AU3.

### Ce qu'on livre

Un lot explicite d'animations s'exécute dans une file ; l'auteur continue à retoucher et
l'agent suit les éléments terminés, en attente ou échoués.

### Critères d'acceptation

- [ ] Les étapes GPU appartenant à l'atelier s'ordonnent sans chevauchement involontaire.
- [ ] Aucun verrou interne n'est présenté comme une garantie sur les travaux d'une autre app.
- [ ] Annuler vise seulement le travail possédé ; une annulation indisponible est dite telle.
- [ ] Reprise après redémarrage, résultat partiel et erreur d'un élément ne refont pas les autres.
- [ ] Durées mesurées à froid et à chaud restent distinctes ; le total d'un lot n'est pas
  une multiplication trompeuse du premier démarrage.

## AU7 · Une image par un workflow local nommé

**User stories** : US-522, US-527. **Bloquée par** : AU6.

### Ce qu'on livre

Choisir un premier workflow image configuré, vérifier ses prérequis, fabriquer une référence
ou un asset et le retrouver dans le même personnage et la même bibliothèque.

### Critères d'acceptation

- [ ] Le catalogue expose les paramètres utiles et les capacités de références réelles.
- [ ] Le workflow et sa version voyagent avec le résultat ; une sortie inattendue est refusée
  sans perdre la consommation ni les fichiers déjà reçus.
- [ ] UI et agent suivent le même parcours ; les anciens moteurs restent disponibles.
- [ ] Une installation manquante est expliquée ; aucun paquet ni poids n'est installé implicitement.

## AU8 · Une vidéo par un workflow local choisi

**User stories** : US-522, US-526, US-527. **Bloquée par** : AU7.

### Ce qu'on livre

Passer du montage local unique à plusieurs profils vidéo, choisis selon la capacité,
puis reprendre le même montage et la même livraison.

### Critères d'acceptation

- [ ] L'image de départ obligatoire reste obligatoire ; aucun repli ne la retire.
- [ ] Un profil nouvellement configuré se vérifie, se lance et se rouvre avec sa version.
- [ ] Le travail aboutit à une bande exportable et pas seulement à un fichier vidéo isolé.

## AU9 · Un rendu asset3d existant devient une animation du jeu

**User stories** : US-528, US-531. **Bloquée par** : AU5.

### Ce qu'on livre

Depuis le personnage, consulter les sources 3D existantes, choisir un rendu, l'importer
comme bande, le corriger et l'utiliser dans Godot. Première connexion 3D sans génération.

### Critères d'acceptation

- [ ] L'animation garde le lien vers le personnage, le rendu et les réglages d'origine.
- [ ] Le résultat importé reste consultable après arrêt du serveur 3D.
- [ ] Une API incompatible ou un fichier manquant produit une raison précise.

## AU10 · Une source 3D se fabrique depuis le personnage

**User stories** : US-521, US-526 à US-528, US-531. **Bloquée par** : AU6, AU9.

### Ce qu'on livre

L'auteur ou l'agent lance la fabrication locale d'un modèle et de son squelette depuis
une référence. Le résultat revient dans l'asset, prêt à produire un premier rendu exportable.

### Critères d'acceptation

- [ ] Les étapes lourdes déjà terminées se réutilisent ; chaque identifiant externe se conserve.
- [ ] Les prérequis, la pose technique nécessaire et l'état de la ressource GPU sont expliqués.
- [ ] L'échec ou la fermeture ne perd pas un modèle terminé et ne relance pas le pipeline entier.
- [ ] L'intégration s'éprouve avec asset3d sans modifier automatiquement son environnement.

## AU11 · Un modèle, plusieurs mouvements et directions

**User stories** : US-520, US-523, US-528. **Bloquée par** : AU10.

### Ce qu'on livre

Depuis la même source 3D, choisir une animation, une caméra et les sorties utiles ; fabriquer
les sprites, comparer et livrer. Une image de pose reste une sortie facultative.

### Critères d'acceptation

- [ ] Un nouvel angle ou mouvement ne refabrique ni le modèle ni un squelette déjà réutilisable.
- [ ] Le rendu conserve cadre, pivot et dimensions cohérents entre les directions demandées.
- [ ] Les corrections du squelette réellement utilisées sont identifiées ; un ancien rendu
  ne prétend pas se reproduire à l'identique avec de nouvelles corrections.

## AU12 · Les autres assets suivent le même parcours

**User stories** : US-519, US-529, US-531. **Bloquée par** : AU5, AU7.

### Ce qu'on livre

Produire un objet fixe, un objet animé, un décor et un élément d'interface dans l'univers,
par l'auteur ou l'agent, avec recherche et réutilisation avant nouvelle génération.

### Critères d'acceptation

- [ ] Un coffre animé n'exige aucun rig de personnage ; un portrait n'exige aucune animation.
- [ ] Les réglages visuels hérités et leurs dérogations se lisent avant fabrication.
- [ ] Les résultats se retrouvent, se corrigent et s'exportent par les mêmes portes.

## AU13 · Des tuiles qui se raccordent dans Godot

**User stories** : US-530, US-531. **Bloquée par** : AU12.

### Ce qu'on livre

Un premier ensemble de tuiles cohérent, corrigible, prévisualisé en répétition et utilisable
dans une petite carte Godot. Le détail se recadre sur les besoins du jeu avant exécution.

### Critères d'acceptation

- [ ] Produire, juger les raccords, corriger et exporter un ensemble choisi avec l'agent.
- [ ] Une carte réelle vérifie bords, coins, transparence et dimensions ; une tuile isolée ne suffit pas.
- [ ] L'export porte les relations utiles au jeu et ne se limite pas à un dossier de PNG.

## AU14 · Des sons cohérents avec l'univers

**User stories** : US-530 à US-532. **Bloquée par** : AU12.

### Ce qu'on livre

Un premier bruitage demandé par l'agent ou l'auteur, généré ou importé, écouté, ajusté,
conservé avec sa source et joué dans Godot. Réutiliser le savoir du projet voisin avant
de choisir un moteur ; le détail se recadre au moment de cette tranche.

### Critères d'acceptation

- [ ] Écouter, choisir une version et vérifier durée, niveau et boucle si demandée.
- [ ] Un fichier silencieux ou invalide n'est pas annoncé comme un résultat prêt.
- [ ] Le jeu lit le fichier exporté ; les travaux audio partagent le cadre et la file locale.

## Comment fermer une tranche

Les cases se cochent après usage du parcours et vérifications ciblées. Pour toute donnée
nouvelle : sauvegarder avec des valeurs non par défaut, fermer, rouvrir. Pour chaque capacité
serveur : nommer son accès UI et son accès MCP, ou expliquer pourquoi le geste reste manuel.
Revue visuelle dans une fenêtre desktop et essai de panne pertinents ; aucune génération
payante automatique. Mettre à jour l'aide et le seul tableau d'état de PLAN.md.

## Sort du plan précédent

L'amendement RF n'est plus une file de travail parallèle. Ses constats sont repris ainsi :
RF0 (build et polices) accompagne la première preuve et la revue visuelle ; RF1–RF2
(galerie et sujet) AU2–AU3 ; RF3–RF4 (retouche et animation) AU4 ; RF5 (équipement) reste
une capacité à préserver dans AU2/AU12, pas un blocage pour une première marche ; RF6
(réglages) AU3/AU7 ; RF7 (sortie) AU1/AU5. Les tranches déjà tenues restent historiques.
Le pantin 2D et le dépliage généralisé sont différés ; leur utilité sera rejugée sur un
besoin concret du jeu, sans les supprimer de l'historique.
