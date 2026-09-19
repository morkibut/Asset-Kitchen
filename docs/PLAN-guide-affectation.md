# Le guide — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-guide.md`. Il ne change ni le contenu ni l'ordre des tranches :
> il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
>
> Le classement est fait sur ce que la tranche demande **au moment de l'écrire**, pas sur sa
> valeur ni sur sa taille.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Le critère d'entrée |
|---|---|---|---|
| `[VERY-EASY]` | Haiku 4.5 | faible | la forme existe déjà ailleurs et se recopie ; on peut décrire le résultat exact avant de commencer ; aucune décision |
| `[EASY]` | Sonnet | faible | montre des données existantes par des routes existantes ; ni schéma, ni invariant, ni algorithme |
| `[MEDIUM]` | Sonnet | élevée | une règle métier neuve, une route neuve, ou un algorithme standard et nommé |
| `[HARD]` | Opus | moyenne | change une forme de données ; **ou** pose un invariant dont d'autres tranches héritent ; **ou** touche à l'argent, à un secret, au disque de l'utilisateur ; **ou** c'est un sous-système qui n'existe nulle part |
| `[VERY-HARD]` | Opus | max | traverse plusieurs couches à la fois **et** doit faire passer un corpus d'essais existant sans qu'une assertion bouge |

---

## Ce qui a été mesuré avant de classer

- Le corpus porte **229 fiches** dans un seul fichier ; **156** ont un texte long.
- Quatre fichiers d'essais lisent le corpus, dont celui du volet (138 lignes).
- Le volet n'a **aucune notion de groupe ni de résumé** : les deux champs sont à créer, et le
  type qui les porte est consommé par le volet, la bulle et la ligne sous un titre de section.
- **Aucune route serveur n'est touchée**, aucune migration, aucune dépense.
- La répartition réelle des fiches par écran est ce qui dimensionne les tranches de
  réécriture : 73, 35, 25, 21, 19, 12 — et **zéro** pour les tuiles, le son et douze écrans.

C'est cette dernière ligne qui explique pourquoi la plupart des tranches sont `[MEDIUM]` et non
`[EASY]` : réécrire une fiche n'est pas la recopier, il faut d'abord aller lire le réglage dans
le code pour savoir s'il fait encore ce que la fiche prétend.

---

## Les 16 tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **GU1** · Le relevé écran par écran | `[MEDIUM]` | Croiser trois sources — les genres de lieu, les écrans du guide, les fiches — et nommer les désaccords : aucune décision d'architecture, mais aucune ligne ne se déduit d'une seule lecture. |
| **GU2** · La forme du volet | `[HARD]` | Ajoute deux champs à la forme que tout le corpus porte et que quatre fichiers d'essais lisent, et pose l'invariant de rendu dont les douze tranches suivantes héritent. |
| **GU3** · Les garde-fous | `[EASY]` | Un fichier d'essais qui compte des signes et compare deux listes ; les limites sont déjà écrites dans le plan. |
| **GU4** · Les résumés des écrans | `[MEDIUM]` | Trente textes courts qui doivent se ressembler : le travail est de tenir un ton, pas de décider d'une règle. |
| **GU5** · Les tables — 73 fiches | `[HARD]` | Découper soixante-treize réglages en zones d'écran est la décision qui commande tout le chantier ; mal coupée, elle se repaie sur les sept tranches suivantes. |
| **GU6** · La fiche d'un sujet — 35 | `[MEDIUM]` | Trente-cinq fiches à vérifier contre l'écran réel, dans un groupement que `GU5` a déjà tranché. |
| **GU7** · Les règles du jeu — 25 | `[MEDIUM]` | Les fiches de la bible sont les mieux écrites du corpus ; le travail est de raccourcir sans perdre ce qu'elles ont de juste. |
| **GU8** · Les équipements — 21 | `[MEDIUM]` | Vingt et une fiches sur un écran dont le vocabulaire a été fermé récemment : chacune se relit contre le mot en vigueur. |
| **GU9** · L'univers — 19 | `[MEDIUM]` | Trois côtés d'écran qui ne se ressemblent pas, donc trois groupements à poser avant d'écrire. |
| **GU10** · L'installation — 12 | `[EASY]` | Douze fiches sur un écran d'interrupteurs, homogène et sans zone à départager. |
| **GU11** · Les animations — 21 | `[MEDIUM]` | Trois écrans voisins qu'on confond facilement ; il faut lire le code pour savoir lequel porte quoi. |
| **GU12** · Galerie, image, codex, livraison — 23 | `[MEDIUM]` | Quatre écrans légers, mais quatre groupements, et des fiches adressées au mauvais écran à remettre en place. |
| **GU13** · Les tuiles | `[MEDIUM]` | Rien n'existe : il faut lire le chantier livré hier pour savoir ce qui se règle, ce qui se paie et ce qui ne se paie pas. |
| **GU14** · Le son | `[MEDIUM]` | Même travail que `GU13` sur un domaine plus large, où la frontière entre ce qui tourne ici et ce qui se paie doit être exacte. |
| **GU15** · Les douze orphelins | `[MEDIUM]` | Douze écrans à visiter et un repli à retirer dans le code, une fois tranché lesquels méritent des fiches et lesquels ne sont qu'un état. |
| **GU16** · La relecture croisée | `[HARD]` | Confronter deux cent vingt-neuf fiches entre elles pour trouver ce que deux tranches voisines ont dit différemment — exactement ce qu'un modèle plus petit rate. |

**Compte** : 0 `[VERY-HARD]`, 3 `[HARD]`, 11 `[MEDIUM]`, 2 `[EASY]`, 0 `[VERY-EASY]`.

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **GU4** | Les trois premiers résumés, qui fixent le ton de tous les autres | Opus, réflexion moyenne |
| **GU5** | Le découpage des 73 fiches en zones d'écran, avant toute réécriture | Opus, réflexion moyenne |
| **GU12** | Décider à quel écran appartient chaque fiche aujourd'hui mal adressée | Opus, réflexion moyenne |
| **GU15** | Trancher, genre par genre, ce qui est un écran et ce qui n'est qu'un état de l'écran où l'on est | Opus, réflexion moyenne |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **GU2** | Le rendu des groupes et des replis, une fois la forme des données arrêtée | Sonnet, réflexion élevée |
| **GU2** | La mise à jour des quatre fichiers d'essais qui lisent le corpus | Sonnet, réflexion faible |
| **GU5** | La réécriture fiche par fiche, une fois les zones posées | Sonnet, réflexion élevée |
| **GU16** | L'ouverture des écrans un par un dans un atelier jetable, `?` pressé sur chacun | Sonnet, réflexion élevée |

---

## Les règles qui priment sur le tableau

1. **Le relecteur est toujours le plus gros modèle**, quelle que soit l'étiquette de la
   tranche. Son travail est de confronter des fichiers entre eux ; c'est exactement ce qu'un
   modèle plus petit rate.
2. **Ce qui touche au modèle de données passe avant l'écran qui l'affiche**, et c'est la partie
   données qui porte l'étiquette. L'écran qui suit descend souvent d'un cran.
3. **Une tranche `[HARD]` ou `[VERY-HARD]` se découpe avant d'être confiée.** Le gros modèle
   sert à poser la décision et l'invariant ; ce qui en découle repart plus bas.
4. **Un point dur qui monte se traite en sous-agent, pas en changement de session.** La
   session qui tient la tranche l'appelle via l'outil `Agent` avec le modèle imposé par le
   point dur, sur un prompt autonome et étroit ; elle continue elle-même le reste.
5. **Propre à ce chantier** : une tranche de réécriture ne se confie pas à un modèle plus petit
   que Sonnet en réflexion élevée. Ce qui est en jeu est la qualité d'une phrase française, et
   c'est la première chose qui se dégrade en descendant.
