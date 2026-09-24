# De la toile au sujet — quel modèle sur quelle tranche

> Compagnon de `docs/PLAN-de-la-toile-au-sujet.md`. Il ne change ni le contenu ni l'ordre des
> tranches : il dit seulement avec quel modèle et quel niveau de réflexion chacune se prend.
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

## Les dix-sept tranches

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| **TS1** · Le Codex montre le portrait | `[EASY]` | le portrait est déjà choisi et déjà calculé aux deux bouts ; il s'agit de le lire là où la grille prend encore la plus récente |
| **TS2** · Créer un sujet depuis une carte | `[MEDIUM]` | une route neuve qui enchaîne des services existants, avec un seul point dur sorti plus bas |
| **TS3** · La première planche | `[HARD]` | elle change ce qui part au modèle — un concept art cesse d'être un style pour devenir le design à reproduire — et chaque essai coûte de l'argent |
| **TS8** · Le sujet neuf dit quoi faire ensuite | `[MEDIUM]` | une règle neuve — quel est le prochain geste d'un sujet selon ce qu'il a — et une place en tête de page ; à accorder avec `RV15` |
| **TS11** · La première planche d'un concept art qui est une carte | `[MEDIUM]` | un défaut qui touche ce qui part au modèle ; la cause est à lire avant de corriger |
| **TS12** · Les palettes de la toile servent à la retouche et au sujet | `[HARD]` | touche une règle durable (une recette rend toujours la même image) et la forme d'une recette ; le choix de copier les couleurs pose un invariant |
| **TS4** · L'image arrive brute, en 512 ou 1024 | `[MEDIUM]` | une règle neuve : la toile échappe à l'univers et à la recette du jeu, sans que les autres chemins d'envoi changent ; le choix 512/1024 lui-même est simple |
| **TS5** · Le texte reste sur la carte | `[MEDIUM]` | la phrase vit sur la génération, pas sur la carte : il faut la faire remonter jusqu'à la toile, puis la rejouer dans la barre |
| **TS6** · Prendre une carte comme référence | `[EASY]` | les références de la barre existent ; il manque un geste visible et leur liste lisible |
| **TS9** · Les deux défauts du premier usage | `[EASY]` | un appel par version quand le modèle n'en fait qu'une, et la phrase portée par la carte posée ; deux causes lues |
| **TS10** · « Développer ce sujet » | `[MEDIUM]` | une image devient la référence d'édition de la barre, le résultat se pose relié à elle ; réutilise TS6 et la pose de TS4 |
| **TS7** · Les gestes de Mixboard | `[MEDIUM]` | triés par l'auteur : Combiner, Encore, et le lien visible ; tous reposent sur l'envoi et la pose reliée de TS10 |
| **TS13** · La toile revient après les ambiances | `[EASY]` | un défaut d'affichage dont la cause est à lire ; ni donnée ni règle neuve |
| **TS14** · La barre « Fabriquer » se replie | `[EASY]` | un repli sur un composant existant, sans perdre son état |
| **TS16** · « ouvrir sa palette » d'un îlot | `[EASY]` | un bouton qui ne mène nulle part et son doublon à retirer |
| **TS15** · Le détail dans la colonne de droite | `[MEDIUM]` | remettre en page deux fenêtres dans un panneau sans perdre une action, avec un état partagé entre la toile et la colonne |
| **TS17** · Choisir un modèle : les habitués d'abord | `[MEDIUM]` | un compte d'usage neuf côté serveur, et un composant posé à plusieurs endroits sans que le catalogue cesse de griser |

**Compte** : 0 `[VERY-HARD]`, 2 `[HARD]`, 9 `[MEDIUM]`, 6 `[EASY]`, 0 `[VERY-EASY]`.

*TS4 à TS12 ajoutées le 23 septembre 2026 ; TS13 à TS17 le 24.*

---

## Les points durs qui montent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **TS2** | l'image d'une carte devient un asset du sujet : ce sens n'existe pas, et la copie doit se ranger sans passer pour un doublon ni pour une image générée | `[HARD]` · Opus, sous-agent |
| **TS3** | la place du concept art dans ce qui part : référence, style, ou les deux, et ce que dit la phrase qui l'accompagne — d'autres chemins en héritent | `[HARD]` · Opus, dans la tranche |

---

## Les morceaux qui descendent d'un cran

| Dans | Le morceau | Traité en |
|---|---|---|
| **TS2** | le bouton du panneau de la carte et la fenêtre pré-remplie, une fois la route écrite | `[EASY]` · Sonnet |
| **TS3** | la préparation pré-remplie sur la fiche (pose de repos, directions du jeu) une fois décidé ce qui part | `[MEDIUM]` · Sonnet |
| **TS3** | les essais écrits d'après les critères d'acceptation déjà rédigés | `[EASY]` · Sonnet |

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
