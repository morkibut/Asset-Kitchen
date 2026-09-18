# Styles de combat — plan

> Demandé par l'auteur le 18 septembre 2026. Les attaques animées par Wan 2.2 sont mauvaises :
> le texte envoyé (*attack, winding up, striking forward…*) ne dit ni le geste, ni la partie du
> corps, ni l'arme. Le 18 septembre, un premier pas est livré (commit `ba72f12`) : chaque
> direction porte une phrase d'animation placée en tête du texte, et les mouvements sont propres
> à chaque jeu. Ce plan ajoute **le style** : *comment* ce personnage-là attaque.
>
> Quel modèle sur quelle tranche : [PLAN-styles-de-combat-affectation.md](PLAN-styles-de-combat-affectation.md).

## Décisions d'architecture

- **Un style est une donnée du jeu**, rangée comme les mouvements : `projets/<id>/styles.json`,
  la bibliothèque livrée sert de départ, la première modification la copie dans le jeu.
- **Un style porte un texte par mouvement**, pas un seul texte. « Bâton à deux mains » dit son
  attaque, et peut dire aussi son repos (garde levée) ; un mouvement qu'il ne dit pas garde le
  texte du mouvement.
- **Le texte qui part** : *phrase de la direction* + *texte du style pour ce mouvement*, sinon
  *texte du mouvement*. Un texte relu à la main part tel quel, comme aujourd'hui.
- **Le produit ne devine pas un style à partir d'un nom.** Un personnage a un style choisi ; à
  défaut, il prend celui de la pièce qu'il porte en calque, si cette pièce en déclare un ; à
  défaut, aucun style — le texte du mouvement part seul.
- **Aucun appel payant** dans ce chantier : les textes se vérifient par les essais. Les tirages
  pour juger leur qualité sont un geste de l'auteur, annoncé avec son prix.

## Les tranches

### SC1 · Le style, une donnée du jeu

**Bloquée par** : rien.

Le domaine `Style` (identifiant, nom, ce qu'il tient en main, textes par mouvement), un catalogue
livré d'au moins dix styles aux textes d'attaque soignés — mains nues simple, karaté / kung-fu,
arme tranchante à une main, arme lourde à deux mains, bâton à deux mains, lance, dagues, arc,
magie, bouclier et arme —, le rangement par jeu et ses routes (lire, modifier, nommer, masquer).

- [ ] Un jeu lit les styles livrés tant qu'il n'a rien changé ; sa première modification les
      copie, et les autres jeux ne bougent pas.
- [ ] Chaque texte livré dit une seule action, nomme la main ou la partie du corps, nomme l'objet
      tenu, et finit dans la position de départ (*returns to the starting stance, staying in place*).
- [ ] Nommer, modifier, masquer et remontrer un style passent par les routes, sans rien payer.

### SC2 · Le style d'un personnage, et celui d'une pièce

**Bloquée par** : SC1.

Un champ `style` sur le personnage et sur la pièce d'équipement ; la résolution *choisi →
pièce portée en calque → aucun* ; les routes pour poser et retirer.

- [ ] Un personnage qui porte le bâton en calque, et dont le bâton déclare « bâton à deux
      mains », a ce style sans qu'on le choisisse.
- [ ] Un style choisi sur le personnage passe devant celui de la pièce.
- [ ] Un personnage sans style ni pièce qui en déclare un n'a aucun style — rien n'est deviné.

### SC3 · Le texte qui part

**Bloquée par** : SC2.

La composition *direction + style ou mouvement* dans `texte_du_clip`, la route qui montre ce qui
partira et celle qui commande un clip, pour un personnage donné.

- [ ] Une attaque vers le nord de Champy part avec la phrase du nord puis le texte d'attaque du
      bâton à deux mains.
- [ ] Un mouvement que le style ne dit pas part avec le texte du mouvement.
- [ ] L'écran d'un clip montre exactement ce texte avant l'envoi ; un texte relu part tel quel.

### SC4 · Les écrans

**Bloquée par** : SC3.

Le bloc « Les styles de combat » dans Réglages › Univers (lire, modifier un texte par mouvement,
nommer un style), le choix du style sur la fiche d'un personnage (avec ce qu'il hérite de sa
pièce, dit en clair), et le choix du style sur une pièce d'équipement.

- [ ] Les trois gestes se font sans rien payer, et se vérifient au navigateur sur un atelier
      jetable.
- [ ] La fiche dit d'où vient le style : « choisi » ou « celui du bâton ».
