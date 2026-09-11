# Architecture — atelier unifié et agent Godot

> Décisions du 11 septembre 2026. Complément d'ARCHITECTURE.md pour le nouveau parcours.
> Ce sont des contrats à construire, sauf dans la section « Ce qui existe ».

## Ce qui existe, et ce qu'on réutilise

| Besoin | Preuve dans le code lu | Limite observée |
|---|---|---|
| Services partagés entre API et MCP | `atelier/mcp/serveur.py`, `atelier/api/` | le MCP expose les images et les poses, pas la boucle complète clip → bande → export animé |
| Vidéo distante et locale | `atelier/fournisseur/port.py`, `maison.py`, `openrouter_video.py` | le local est un montage vidéo spécifique, pas un catalogue de workflows arbitraires |
| Conservation et montage des bandes | `atelier/domaine/bande.py`, `atelier/services/montage.py` | la couverture et la sélection de versions doivent devenir des règles communes aux deux interfaces |
| Exports d'animations | `atelier/services/export.py`, notamment `exporter_bandes` | l'export MCP d'un personnage appelle actuellement la sortie des images fixes |
| Sources 3D réutilisables | projet voisin `asset3d`, `serveur/personnages.py`, `serveur/executeur.py` | API séparée, versions de contrat et reprise à éprouver ; pas de transaction commune avec l'atelier |
| Rendu et rig 3D | `asset3d/blender/`, `asset3d/serveur/main.py` | les verrous GPU sont internes au processus asset3d, pas partagés avec l'atelier |

Lecture de code et de contrats, sans lancement GPU, génération payante ni modification
d'asset3d. Les mentions « livrée » de son plan ne remplacent pas un essai d'intégration.

## Une seule chaîne de production, deux façades

```text
IA qui développe le jeu ── MCP ──┐
                               ├── services de l'atelier ── adaptateurs ── moteurs
Interface desktop ─── API ──────┘             │
                                      bibliothèque / travaux
                                             │
                                     export du jeu associé
                                             │
                                      projet Godot
```

Le jeu livré n'appelle pas l'atelier à l'exécution. L'agent de développement le fait.
MCP conserve ses outils existants ; ses nouvelles opérations de production appellent
les mêmes services que l'API. Les noms d'outils sont anglais, le domaine et l'UI français.
On expose des gestes complets, pas chaque nœud de ComfyUI ni chaque curseur de retouche.

## Objets et compatibilité

- **Sujet** : identité dans un jeu ; les identifiants existants de personnage restent
  valides. « Sujet » est ici le concept commun, pas un ordre de renommer toutes les tables.
- **Objectif de production** : sorties demandées, mouvement, direction, taille, cadence,
  boucle et repère. La demande peut ne porter que des images fixes.
- **Source** : image, clip, modèle 3D, squelette ; version et origine conservées.
- **Résultat** : image ou bande issue de sources précises, recette et provenance complètes.
- **Travail** : demande durable d'un humain ou de l'agent, étapes et identifiants externes.
- **Livraison** : sélection de versions et manifeste d'export ; distincte des favoris.

Une source ne satisfait pas un objectif de livraison. Images et bandes conservent leurs
comptes séparés. « Non demandé » est hors dénominateur. « Produit », « retenu » et « exporté »
ne deviennent pas un seul booléen. Les résultats entrent directement en bibliothèque.
Les données sur disque restent la source durable et SQLite un index reconstructible.
Tout ajout a une relecture des anciennes données avec valeurs par défaut explicites ;
aucune conversion destructive du plan de poses existant.

## Demande agent et travail durable

Une demande précise le projet, le sujet ou son intention de création, les sorties,
les références, la méthode permise et une clé de requête. L'auteur a associé explicitement
le projet de jeu et son dossier ; aucune création implicite de projet.

La réponse est structurée : identifiants stables de demande et de résultats, état,
résultats réutilisés, manques, consommation dans son unité, prochaine action possible.
À la fin, elle rend les chemins produits et leur manifeste, sans imposer à l'agent de
deviner des noms ni de lire l'interface. L'attente est bornée ; les calculs longs se suivent.

**États** : préparé, en attente, en cours, à vérifier, terminé, échoué, annulation demandée,
annulé, état externe inconnu. Un état inconnu n'est ni un échec certain ni un appel gratuit.
La demande est écrite avant soumission, l'identifiant externe dès son retour. Une clé
répétée avec le même contenu relit le travail ; un contenu différent sous cette clé est refusé.
Deux appels concurrents ne réservent pas deux fois le même travail.

Le trou entre acceptation distante et réception de son identifiant est traité explicitement :
réconciliation si le fournisseur sait retrouver la demande, sinon état incertain et reprise
explicite. On ne promet pas l'exécution « exactement une fois » chez un tiers qui ne le permet pas.
Le coût reçu s'enregistre avant décodage des médias. Réessayer n'est jamais automatique.

## Cadre de délégation

Le cadre par jeu autorise des méthodes par capacité, limite argent, appels et tentatives,
déclare la destination et le mode de livraison (provisoire automatique ou choix explicite).
Les réservations empêchent deux demandes simultanées de dépasser ensemble un plafond.
Le temps GPU se compte séparément de l'argent ; inconnu reste inconnu. L'interface montre
qui a demandé quoi et pourquoi un travail attend.

Le modèle gratuit imposé historiquement au MCP ne peut pas devenir un repli universel :
un modèle sans référence ne remplace pas une animation fidèle. Hors cadre ou capacité
insuffisante : refus exploitable, sans changement caché de fournisseur. Les anciens réglages
se migrent vers le cadre le plus conservateur équivalent, sans élargir une autorisation.

## Moteurs locaux et ressources

ComfyUI reste un service externe installé par l'auteur. Un profil de workflow versionné
déclare ses entrées, sorties, paramètres exposés, prérequis, empreinte, capacités et
mesures de durée. Le JSON de workflow avancé ne devient pas le formulaire quotidien.
Pas de noms de modèles codés dans les écrans ; un catalogue annonce chaque capacité.

Le transport et les découvertes de l'adaptateur Maison se réutilisent quand leurs contrats
conviennent. Les ports image, vidéo et production 3D restent typés : un modèle 3D n'est pas
une image dont on aurait changé l'extension. Une recette CPU déterministe reste séparée
des générations et du rendu 3D qui peuvent utiliser le GPU.

Le planificateur sérialise par défaut les étapes GPU lancées par l'atelier. Les travaux
externes non possédés restent visibles comme une concurrence possible ; les verrous d'un
autre processus ne sont pas une garantie globale. ComfyUI et asset3d doivent déclarer un
état exploitable ou l'atelier refuse d'annoncer une ressource libre. Jamais d'interruption
globale d'un travail étranger. Si une annulation ciblée manque, l'écran le dit.

Pas d'installation, mise à jour de nœuds ou téléchargement de poids implicite. Le premier
connecteur 3D parle à asset3d par une frontière d'adaptateur, sans fusionner les deux dépôts
ni importer son serveur Python dans le processus de l'atelier.

## Intégration asset3d par étapes

1. Lire son catalogue de personnages et ses rendus existants ; importer un résultat dans
   la bibliothèque avec le lien de provenance. La copie locale reste ouvrable serveur éteint.
2. Soumettre une fabrication puis suivre son identifiant ; rapatrier les artefacts et les
   réglages réellement appliqués. Modèle et squelette ne sont pas recalculés pour chaque bande.
3. Demander une autre animation ou caméra à la même source. Capturer les corrections du
   squelette utilisées : « rejouer avec les corrections actuelles » et « reproduire un ancien
   rendu » sont deux gestes différents dans le contrat actuel d'asset3d.

API relevée : `/api/personnages`, `/api/essais`, état par identifiant, modèles et rigs GLB,
catalogues animations/angles/réglages, rendus et planches. Avant activation, confronter la
version et les champs ; un profil absent n'est pas deviné. La disponibilité d'un bouton
dans l'UI asset3d ne prouve pas qu'une route équivalente accepte le même geste.

## Livraison Godot

Conserver PNG et descriptifs existants, dont le JSON Aseprite sans clés maison ajoutées.
Un manifeste maison séparé porte provenance, pivot, version choisie et lien du projet.
Le pont Godot fabrique une ressource SpriteFrames et un exemple AnimatedSprite2D depuis
ces fichiers ; les durées, noms d'animations et boucles sont vérifiés dans le moteur.
Les API de ces ressources sont documentées par
[SpriteFrames](https://docs.godotengine.org/en/stable/classes/class_spriteframes.html) et
[AnimatedSprite2D](https://docs.godotengine.org/en/stable/classes/class_animatedsprite2d.html).

La cible initiale est Godot 4 ; la version exacte sera lue dans le projet associé et
vérifiée avec son exécutable, pas supposée à partir de la documentation « stable ».
Le pivot est appliqué au sprite ou à son conteneur ; SpriteFrames seul ne porte pas ce repère.
L'agent reste responsable du comportement du personnage dans le jeu.

Écriture limitée au dossier associé, avec prévisualisation du manifeste et contrôle des
chemins résolus. Pas d'écrasement d'un fichier utilisateur inconnu. Une nouvelle livraison
remplace seulement des fichiers possédés et inchangés depuis la livraison précédente ;
sinon conflit lisible. Préparer les fichiers puis publier le manifeste évite un paquet
mi-ancien mi-nouveau. Les références stables du jeu pointent vers la livraison choisie.

## Définition d'une preuve

Un essai de la boucle passe par le MCP réel, des fournisseurs doublés, le stockage réel
dans un dossier jetable et une scène Godot minimale. Il referme et rouvre l'atelier,
répète une clé de demande et vérifie une révision. Un JSON bien formé ne prouve pas que
Godot joue la bonne animation. Le test GPU et la qualité artistique sont deux validations
distinctes, effectuées ensuite avec des modèles installés et une autorisation de génération.
