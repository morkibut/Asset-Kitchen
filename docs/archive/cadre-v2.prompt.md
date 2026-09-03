# Prompt `/cadre` — V2 : Character Creator et Equipment Creator

> À passer tel quel à `/cadre`. Mode extension : `docs/PRD.md` existe et fait foi sur la V1 ;
> c'est **la partie V2 qui est à reprendre**, parce qu'elle porte une décision fausse et
> qu'il lui manque la méthode que les essais ont validée.

---

## Ce qu'on cadre

La **V2 = Character Creator + Equipment Creator**. Un personnage, ses poses, et les pièces
d'équipement qu'il porte. Elle est passée devant les tuiles le 28 août 2026 sur la foi de deux
essais payés (~2,5 $) ; l'ordre des versions est acquis et ne se rediscute pas : **V2 personnage
et équipement, V3 animation, V4 tuiles, V5 son.**

La V1 est close — dix tranches T1→T10, 115 critères tenus. Rien de ce cadrage ne la modifie.

---

## 1 · Ce qui est faux dans le PRD actuel, et doit être retiré

Le PRD porte aujourd'hui une idée fausse, sous trois formulations. Elle vient d'une
extrapolation, pas d'une mesure :

- section *Décisions d'implémentation* — « Un calque fabriqué sur une pose **se pose sur les
  autres sans rien payer**. La superposition est un affichage. »
- section *Hors périmètre*, « Écarté de la V2 » — « Régénération d'un calque au changement de
  pose : ce qui est apparu une fois est posé, **jamais refait**. »
- section *Critères de succès* — « Le même calque, posé sur une autre pose du même personnage,
  s'affiche superposé **sans qu'aucun appel payant n'ait lieu**. »
- section *Notes complémentaires* — « La moitié non testée de l'équipement est le risque
  principal de la V2 » (le risque disparaît avec la fausse promesse).

**Pourquoi c'est faux, et pourquoi ça n'a pas besoin d'être mesuré** : un casque vu de face
n'est pas un casque vu de dos. Un calque est solidaire de la pose sur laquelle il est apparu.
Pour huit frames d'un cycle de marche, il faut huit calques. C'est une évidence de dessin, pas
une incertitude technique.

Ces quatre passages sont à supprimer ou à réécrire. Les documents en aval les portent aussi et
suivront : `docs/archi-versions.md` §7 et §11, `docs/PLAN.md` tranche C4.

---

## 2 · Ce qui doit entrer à la place — la planche d'équipement pliée

C'est la vraie méthode, et elle n'existe dans aucun document. Elle reprend le pliage déjà
retenu pour les poses et l'applique à l'équipement :

1. Le personnage a déjà N poses générées (des images de corps séparées, rangées en
   bibliothèque).
2. **L'application compose elle-même une planche** de ces N corps, sur une grille carrée dont
   elle connaît la géométrie case par case.
3. Elle envoie cette planche avec la consigne « la même planche, avec la pièce en plus, ne
   touche à rien d'autre ».
4. Elle redécoupe la planche revenue sur la **même** grille — le découpeur de T5 fait déjà la
   moitié du travail.
5. Case par case, elle compare l'avant (qu'elle connaît exactement, puisqu'elle l'a composée)
   et l'après. Chaque différence est un calque, **propre à sa pose**.
6. L'auteur rattrape à la main ce qui tombe faux.

**Ce que ça change** : N calques d'équipement pour **un** appel payant au lieu de N. Et la
comparaison part d'une base connue au lieu d'être devinée — c'est plus solide que la méthode
une-pièce-un-corps du PRD actuel.

Le pliage cesse donc d'être un dispositif du lot de poses pour devenir une **fonction générale
de l'atelier : habiller ou transformer N images d'un seul appel.**

---

## 3 · Ce que les essais ont mesuré — les faits, avec leurs chiffres

Deux essais payés, résultats sur le disque, reproductibles gratuitement.

### `essais/essai_grille.py` — la grille en création (24 planches, 3 modèles, 2 jets)

| Fait mesuré | Chiffre | Ce qu'il décide |
|---|---|---|
| Le gabarit sert | compte exact **11/12 avec**, 9/12 sans | le gabarit de cases vides devient une pièce du produit |
| Le personnage tient d'une case à l'autre | parenté 98,4 à 99,8 % | la planche ne casse pas l'identité |
| **La grille de pixels dans un seul appel** | dérive médiane **1,00×** | contre 2,5× entre deux appels (§4 bis) : **une planche achète de la cohérence, pas seulement des appels** |
| Le 3×3 rate plus que le 2×2 | seedream échoue en 3×3, gemini échoue en 3×3 libre | la taille du lot est un arbitrage réel, pas un curseur libre |
| Piège — la redondance | **2 planches sur 24** ont répété la même pose | le compte peut être bon et la planche sans valeur |
| Piège — le gabarit recopié | visible sur la planche contact | un modèle rend les traits du gabarit dans l'image |

### `essais/essai_silhouette.py` — l'édition qui ne change rien d'autre (36 images, 6 modèles, 2 jets)

| Pièce | Silhouette retrouvée | **Corps repeint** | Ajout | Échelle au retour |
|---|---:|---:|---:|---:|
| Jambières | 99,5 % | **0,3 %** | 2,3 % | 1,00 |
| Casque | 99,2 % | **0,8 %** | 6,1 % | 0,96 |
| **Cape** | 100,0 % | **23,5 %** | 203 % | **0,62** |

Trois choses à retenir, et la troisième est neuve :

- **La colonne qui décide est « repeint », pas « silhouette ».** Une silhouette à 100 % avec un
  repeint à 23 % veut dire que le modèle a gardé la forme et redessiné l'intérieur.
- **Les six modèles tiennent le casque et les jambières**, tous sous 1,5 % de repeint, sur les
  deux jets. La méthode par différence est validée pour ces pièces.
- **La cape échoue sur les six modèles, aux deux jets, sans exception** (repeint de 17,1 % à
  44,6 %). La planche contact montre la cause : le modèle **dézoome le personnage** pour faire
  tenir la cape dans le cadre — échelle 0,62 au retour. À partir de là il n'y a plus de
  différence à calculer.
- La conclusion imprimée par l'essai annonce pourtant que « les six modèles tiennent les deux
  seuils » : elle calcule une **médiane sur six lignes** et la cape n'en rate que deux. **La
  médiane efface le seul cas qui échoue** — à corriger dans l'essai, et à ne pas reproduire
  dans le PRD.

**La règle produit qui en sort, et qui doit être écrite** : la méthode par différence tient
pour une pièce **contenue dans la silhouette** (casque, jambières, ceinture, gants, plastron)
et casse pour une pièce qui **l'agrandit** (cape, ailes, arme longue, sac à dos, monture).

---

## 4 · Ce qui est acquis, et ne se rediscute pas

Quinze décisions prises en séance et confirmées par les essais. Le cadrage les reprend, il ne
les rouvre pas.

**Le corps et son unité**

1. Le corps **naît dans l'atelier** ; aucune planche étrangère n'entre. Pas d'écran de création
   de personnage avec son propre prompt.
2. L'unité manipulée est **l'image de corps**. Une planche n'est qu'un groupe d'images qui
   partagent un nom et un index.
3. **Personnage** est une entité neuve portée par le projet — la deuxième depuis T4, et ça
   demandera d'être justifié dans `ARCHITECTURE.md` §5.

**La fabrication**

4. Le calque se fabrique **par différence seule. Aucune ancre, aucune mire, jamais.**
5. Le **gabarit de poses vit sur le projet** ; une entrée porte un nom et un nombre d'images,
   pour que l'animation (V3) le remplisse sans le réécrire. Le personnage déclare lesquelles il
   tient.
6. Trois niveaux : **emplacement** et **pièce** au projet, **calque** au personnage. Écrire un
   nom qui n'existe pas le crée — ranger n'est jamais un préalable (US-5).
7. La **zone est un masque**, champ d'une recette de calque, ajustable après coup pour rien.
   Défaut : aucun masque.
8. **Masque et retouche pixel sont deux couches rejouables**, rangées à côté de l'image payée,
   jamais écrites dedans.

**Le contrôle**

9. **La taille du lot est le choix de l'auteur**, à chaque génération. Cohérence par
   construction dans un lot, par référence entre deux lots. La pose reste régénérable seule.
10. Les **concept arts sont des cartes du tableau** que l'entité désigne — et une carte désignée
    doit se voir sur la toile.
11. **Ce qui part en référence est visible et décochable**, à trois portées (cette génération /
    ce personnage / le projet), enregistrable en profils nommés. Précédence écrite, provenance
    affichée, **panneau et jamais tunnel**.
12. Les mesures sont **purement indicatives ; seul le compte d'images refuse**, parce que c'est
    un contrat et non un jugement. Posture générale : l'outil accompagne, l'utilisateur choisit ;
    on ne jette rien, on archive.

**La sortie et la forme**

13. **L'atelier décrit** — PNG dans le dossier du jeu + JSON descripteur ; l'agent écrit les
    lignes de catalogue.
14. **Matrice de production à vignettes**, deux axes, **sans recherche ni filtre ni sélection
    multiple** — c'est cette privation qui l'empêche de devenir une seconde bibliothèque et qui
    préserve la règle « une seule grille d'assets » de T3.
15. Cinq tranches **C1→C5**, puis la salle d'essai **hors V2**.

**Le découpage acquis** — à reprendre tel quel, il fait foi sur l'ordre :

| | Ce qu'elle livre | Ce qu'elle vaut seule |
|---|---|---|
| **C1 · Le personnage et son plan** | gabarit de poses au projet · entité Personnage · choix modifiable de ses poses · la matrice qui montre le fait et le pas-fait · une pose générée, avec le panneau de ce qui part et son coût annoncé | un générateur de personnage qui range et qui dit ce qui manque |
| **C2 · Le lot** | pliage / dépliage en grille carrée · sélection de poses · une génération pour N poses · reprise d'un lot interrompu · profils de génération nommés | le coût divisé par N |
| **C3 · La pièce et le calque** | emplacement ordonné · pièce et sa description-consigne · édition sur la grille de corps · nettoyage de sortie · recalage · différence · seuil, amas, **masque rectangle** · quantification · superposition affichée | on habille, et on voit |
| **C4 · La main** | masque libre puis au pixel · éditeur pixel sur le calque, corps en repère dessous · comparateur avant/après · les quatre mesures, triées par le pire | ce qui ne tombe pas juste se rattrape |
| **C5 · La sortie** | export vers le dossier du jeu · JSON descripteur · outils MCP | ça rentre dans le jeu |

Deux points de ce découpage sont **délibérés et ne doivent pas être déplacés** :

- **Le masque rectangle est en C3, pas en C4.** Sans lui la différence emporte le visage, et C3
  ne serait pas utilisable à sa livraison. C4 apporte la finesse, pas la fonction.
- **Le MCP suit en C5 sans rien décider.** L'invariant de T7 dit qu'il n'a aucune logique propre
  et n'expose que les gestes de l'écran.

---

## 5 · Ce que le cadrage doit trancher

Les questions ouvertes, dans l'ordre où elles comptent.

1. **La pièce qui agrandit la silhouette.** Mesuré comme cassant la méthode. Que fait le
   produit ? Trois directions à arbitrer : générer sur une toile avec marge pour que la pièce
   ait la place sans que le modèle recadre ; normaliser l'échelle au retour avant de
   différencier (le produit doit déjà le faire, §11) ; ou traiter la cape comme un cas nommé,
   distinct, avec son propre chemin. La réponse décide de ce que C3 promet.
2. **Comment se compose la planche d'équipement.** Qui choisit les poses qui partent ensemble,
   ce que l'application met dans les cases, et ce qu'elle fait si une pose manque.
3. **Ce qu'on fait d'une planche revenue redondante** (les 2/24 mesurées). Le compte est bon,
   donc le contrat est tenu, donc rien ne refuse — mais l'auteur doit le voir.
4. **Le gabarit recopié dans le rendu.** Un modèle rend les traits du gabarit. Réglage de
   modèle par défaut distinct entre « produire une planche » et « éditer un corps » ?
5. **La taille de lot recommandée.** Le 3×3 rate plus que le 2×2. Le produit ne plafonne pas
   (décision 9) — mais annonce-t-il le risque, et sur quelle base ?
6. **Le sort des planches existantes de Cœur de Pierre.** Décision prise : le nain est refait,
   les planches actuelles ne servent plus que de référence de pose. À écrire.

---

## 6 · Ce qui reste explicitement hors V2

La **salle d'essai** (voir le personnage équipé dans un décor) — plus tard, hors V2.
L'animation, les tuiles, le son — V3, V4, V5.
Squelette, os, interpolation entre deux poses — c'est l'animation.
Bibliothèque de poses partagée entre projets — le plan appartient au projet.
Génération d'une pièce seule sur fond vide — une pièce n'existe qu'apparue sur un corps.
Reconnaissance automatique de la pièce ou de l'emplacement — l'auteur nomme.
Refus automatique sur les mesures de qualité — seul le compte refuse.
Feuille de sprites assemblée à la sortie — le pliage est une ruse d'appel, pas un format de
livraison.

---

## 7 · Ce que j'attends en sortie

Une mise à jour de `docs/PRD.md` :

- les quatre passages faux de la section 1 **retirés ou réécrits** ;
- la **planche d'équipement pliée** écrite comme méthode, avec ses user stories ;
- la **règle « pièce contenue / pièce qui agrandit »** écrite comme décision d'implémentation,
  avec le chiffre qui la fonde ;
- les user stories de la V2 **renumérotées proprement** si le découpage bouge (elles vont
  aujourd'hui de US-115 à US-152) ;
- les critères de succès de la section « Le personnage et son équipement » **corrigés** — celui
  qui parle du calque reposé sans appel payant est faux ;
- les six questions de la section 5 **tranchées**, une par une, en me demandant quand ça
  t'appartient et pas à moi.

Ne touche ni à `docs/ARCHITECTURE.md`, ni à `docs/PLAN.md` : ils suivront, dans cet ordre, une
fois le PRD juste.
