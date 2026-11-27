# Le registre du contenu — cadrage

> Demandé par l'auteur le 26 novembre 2026, sur un brief écrit depuis le projet d'un de ses
> jeux. Cadré le 27 novembre 2026. Ce document fait foi sur **l'usage** du registre ; la
> construction est dans [archi-registre.md](archi-registre.md), l'ordre dans
> [PLAN-registre.md](PLAN-registre.md). Le [PRD](PRD.md) y renvoie.
>
> **Le périmètre du produit s'élargit** : l'atelier ne fabrique plus seulement les assets d'un
> jeu, il **pilote aussi son contenu** — propositions, textes, décisions —, comme la levée de
> l'exclusion du local le 11 septembre. Ce qui reste dehors est écrit plus bas.

## Problème

L'auteur fabrique un jeu avec une dizaine d'agents en parallèle. Chacun produit des choses à
lui montrer : portraits, bêtes, planches, cinématiques, sons, textes de quêtes, lettres, briefs.
Il n'a pas le temps de tout suivre au fil de l'eau. Il veut **tout retrouver au même endroit,
voir l'image ou entendre le son sur place, décider d'un geste, et que les agents lisent sa
décision sans qu'il la recopie.**

L'outil de fortune qui le fait aujourd'hui (une page publiée hors de l'atelier, avec une petite
base) a prouvé le besoin en deux jours et en a atteint les limites : plein à 512 fichiers ; les
images ne se voient pas là où l'on décide ; **la validation est un message, pas un état** (trois
entrées validées deux ou trois fois de suite, une validation rangée en « j'aime ») ; deux
vérités, une figée et une par-dessus ; tout à la main pour les agents ; aucun lien entre les
entrées, les versions empilées en entrées séparées ; aucun contrôle des valeurs.

## Solution

**Le registre**, une porte du carnet, dans le jeu ouvert. Trois mots tranchés par l'auteur :

- **une entrée** — une chose du contenu qu'on montre et qu'on juge ;
- **une remarque** — ce que l'auteur écrit sur une entrée ou sur un de ses médias ;
- **une décision** — valider, demander une reprise, écarter, mettre en pause, relancer ; et,
  sur une entrée à choix, **prendre** une, plusieurs ou aucune proposition.

**Une décision est un état, dit là où l'on a cliqué** : l'entrée change d'apparence tout de
suite, la redire ne crée rien, et l'on peut annuler. Les agents relèvent « ce que l'auteur a
fait depuis mon dernier passage », une fois et une seule. **Un agent ne valide jamais.**

Pourquoi dans l'atelier : une proposition de visuel **est déjà** un asset de la bibliothèque,
qu'une entrée montre par référence sans le copier ; « posséder, préférer, choisir pour le
jeu » sont déjà trois décisions distinctes, et juger une entrée en est le prolongement ;
l'atelier a déjà la porte des agents (le MCP).

**Comment le jugement d'une entrée s'articule avec ce qui existe.** Le favori, « choisi pour
le jeu », le jugement d'un son et « c'est la référence » restent ce qu'ils sont : des réglages
**d'un asset**. Une décision porte sur **une entrée**, qui peut montrer plusieurs assets, un
texte ou rien. Prendre un asset dans une entrée **ne le met ni en favori ni dans le jeu** : c'est
l'agent qui en tire la suite, et l'écran de l'asset reste le seul endroit où on le choisit pour
le jeu. Une quatrième façon de dire la même chose aurait été le piège ; ici, chaque geste a
son objet.

### Trois étapes, et le téléphone à part

| Étape | Ce qu'elle livre | Ce qui dit qu'elle est finie |
|---|---|---|
| **1** | Les entrées et leurs médias sur place ; les décisions et les remarques ; le journal et la rétrospective qui s'en déduit ; le MCP et la boîte de dépôt par fichiers ; la reprise de l'existant | L'auteur ferme l'ancien outil et ne s'en sert plus |
| **2** | Les liens typés entre entrées et vers les assets ; les vues qui s'en déduisent (décisions, quêtes, fils rouges, calendrier) ; les contrôles qui s'affichent sans rien refuser ; la couverture des assets | Le registre d'écriture et le calendrier du jeu ne se tiennent plus à la main |
| **Téléphone** | Relire et décider au téléphone, PC éteint | Une entrée validée au téléphone est relevée par l'agent |
| **3** | Les scénarios à embranchements ; la livraison du contenu validé vers le jeu par un adaptateur ; la relecture depuis le jeu | Un texte validé arrive dans le jeu sans copier-coller |

**PC d'abord, téléphone plus tard** (décidé le 26 novembre 2026) : rien à l'étape 1 ne doit
l'empêcher. C'est pourquoi tout est en fichiers lisibles hors de l'atelier, et une décision est
un fichier d'évènement qui peut venir d'ailleurs que de l'écran.

## Utilisateur cible

- **L'auteur** relit, compare, choisit, valide, écarte, commente, par petites séances (tard le
  soir, tôt le matin). Il veut voir, pas suivre un lien. **Une décision à la fois.**
- **Les agents sur la machine** déposent, joignent des médias, relèvent les décisions,
  répondent, avancent un statut — par le MCP.
- **Les agents dans le nuage** n'atteignent pas le port local de l'atelier ; ils savent écrire
  des fichiers dans un dossier approuvé. Ils déposent dans **la boîte de dépôt** et lisent les
  décisions dans le journal, en fichiers.

## User Stories → `docs/user-stories.md` § Le registre du contenu

US-546 à US-571. Les premières portent l'étape 1 ; la suite est au plan.

## Critères de succès

Observables par l'auteur, repris de la demande :

1. Depuis une entrée de trois portraits, il voit les trois images à leur taille, en prend
   une, et **l'entrée le dit tout de suite** ; un second clic ne crée rien ; il peut revenir
   sur son choix.
2. Il ouvre l'atelier après deux jours : il voit en premier ce qui attend sa décision, dans
   l'ordre, et peut les passer **une par une** sans revenir à une liste.
3. Il écoute un son et regarde une cinématique sous-titrée **dans l'entrée**, sans lien sortant.
4. Un agent dépose une entrée à choix avec six images **en un geste**, sans compresser ni
   recopier d'adresse ; redéposer ne double rien.
5. Un agent demande « quoi de neuf depuis mon dernier passage » et reçoit exactement les
   décisions et remarques qu'il n'a pas encore lues, une fois.
6. Un agent sans accès au port local dépose une entrée et lit une décision.
7. La v3 d'un portrait remplace la v2 à l'écran ; l'histoire montre encore la v2 et ce que
   l'auteur en avait dit.
8. La rétrospective se régénère depuis le journal, sans saisie.
9. Mille entrées et trois mille médias ne posent pas de limite.
10. On ferme l'atelier, on efface l'index, on rouvre : entrées, décisions, remarques, vu /
    non vu sont là.
11. (Étape 2) Le graphe des quêtes d'un chapitre et l'arbre d'un évènement à choix se voient
    sans lire de JSON ; un contrôle signale une quête orpheline.
12. (Étape 3) Un texte validé part dans les données du jeu après relecture de ce qui change ;
    un texte non validé ne part pas.

## Hors périmètre

- Écrire le contenu à la place des agents ou de l'auteur : l'atelier ne génère pas de texte de
  quête dans ce chantier.
- Comptes, droits, travail à plusieurs en même temps. Un relecteur invité plus tard lira, sans
  compte.
- La gestion de projet générale : tâches de code, tickets, planning.
- Un moteur de dialogues ou de quêtes exécutable : l'atelier décrit et livre des données, le
  jeu les joue.
- Une messagerie : l'atelier porte les décisions, il ne remplace pas la conversation avec les
  agents.
- **Aucune donnée d'un jeu réel dans le dépôt** : le dépôt est public, les essais prennent le
  marais du vocabulaire.

## Décisions prises le 27 novembre 2026

Tranchées par l'auteur :

- **Le registre vit dans le jeu de l'atelier** — son dossier, à côté de sa bible et de ses
  assets.
- Les mots **entrée**, **remarque** ; l'auteur a ensuite demandé que les questions mineures
  soient tranchées sur recommandation, sans l'arrêter.

Prises sur recommandation, écrites ici pour être revues d'un coup :

- **Une décision** garde ce nom ; **le rangement** se dit **rayon**, déclaré par le jeu ; une
  étape de validation se dit **une porte**.
- **Les types de départ** : proposition de visuel, proposition de son, cinématique ou planche,
  texte (deux portes : le brief, puis les textes), personnage, décision à prendre (une porte
  chacun), document de référence (aucune). Un jeu les remplace par son propre
  `registre/reglages.json`.
- **Une entrée écartée** est cachée de la vue courante et gardée dans l'histoire ; elle se
  relance d'un geste. Rien ne se supprime.
- **La rétrospective** se lit dans l'atelier et s'exporte en Markdown ; l'écrire dans le dépôt
  d'un jeu passera par une livraison relue avant d'écrire (étape 3), pas en silence.
- **L'ancien outil reste en service** tant que la reprise de ses données n'a pas été faite et
  jugée par l'auteur ; ensuite il est gelé en lecture, pas tenu en double.
- **Étape 2 : on commence par le graphe des décisions**, qui se déduit des seules données de
  l'étape 1 ; le graphe des quêtes suit, quand la reprise des textes est faite.
- **La maquette est l'écran lui-même.** L'auteur a demandé d'avancer jusqu'au code ; la
  première tranche se juge à l'usage, sur des entrées neutres, puis sur les vraies.
