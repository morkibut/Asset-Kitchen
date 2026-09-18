# Les références d'un sujet — chaque image part quand elle sert

> Chantier ouvert le 18 septembre 2026, à la demande de l'auteur, après une fabrication de
> Champy au bâton : la planche des quatre directions était jointe, et le modèle a rendu **un
> seul** Champy en vue isométrique. Le texte envoyé demandait « one single sprite », et la
> planche n'y était décrite que comme « le même personnage ».

## Ce qui existe (relevé du 18 septembre 2026)

- Un sujet porte une liste d'images **promues en référence** (`Personnage.references`). Elles
  partent **toutes, à chaque appel qui le vise**, en rôle `REFERENCE`, décrites au modèle par
  une seule phrase : *THE SAME CHARACTER*. Rien ne distingue une planche de quatre vues d'une
  vue de face.
- L'écran *Relire avant l'envoi* laisse décocher chaque image jointe, pour cet appel seulement ;
  les portées durables (jeu, sujet) s'écrivent depuis le panneau des réglages. **Cela reste.**
- Une image fixe part toujours avec le cadre *FRAMING — one single sprite and nothing else* et
  la caméra *CAMERA — this overrides everything above*. Seule une planche pliée y échappe.

## Les décisions

1. **Une référence promue porte un usage**, et un seul : `libre` (défaut — part toujours,
   comme aujourd'hui), `planche` (toutes les vues du sujet sur une image), ou
   `direction:<id>` (le sujet vu dans cette direction). Les références déjà promues sont
   `libre` : rien de ce qui part aujourd'hui ne change tant que l'auteur ne range rien.
2. **La fabrication choisit selon son contexte**, jamais au hasard :
   - une planche (pliée par directions, ou *refaire une planche*) → les références `planche` ;
   - une case dans une direction → les références de **cette** direction ; s'il n'y en a pas,
     la `planche` ;
   - le reste (sans case, sans direction) → aucune référence typée.
   Les `libre` partent dans tous les cas. Les autres usages restent sur la fiche.
3. **Chaque image jointe dit au modèle ce qu'elle est** : une planche est décrite comme une
   planche (« chaque case est le même personnage vu sous un autre angle »), une référence de
   direction comme « le même personnage, vu sous cet angle ».
4. **Refaire une planche** est une case de la préparation d'une image fixe : *Garder la mise en
   page de la référence*. Cochée, le cadre « un seul sprite » et la phrase qui fait primer la
   caméra ne partent pas ; une consigne demande de reproduire la planche — même nombre de vues,
   même ordre, même cadrage — en n'appliquant que la modification décrite. La mise en page vient
   de la référence `planche` du sujet, sinon de la première image jointe à la main ; sans l'une
   ni l'autre, l'appel est refusé **avant de payer**.
5. **La référence d'une direction ne se crée pas toute seule** : ce serait envoyer une image que
   l'auteur n'a pas choisie. La fiche propose, pour une direction sans référence, l'image
   retenue de cette direction, en un clic.

## Les tranches

### RS1 · L'usage d'une référence, et le choix selon le contexte (serveur)

Le champ, sa route, la sélection dans `_reinjections`, la phrase qui décrit chaque image, la
provenance lisible dans *Relire avant l'envoi*.

- [x] une référence promue porte un usage (`libre` par défaut), écrit dans le fichier du sujet
      et relu sans migration
- [x] une route règle l'usage d'une référence ; un usage de direction que le jeu ne tient pas est
      refusé
- [x] une case dans une direction n'emporte que les références de cette direction (sinon la
      planche), plus les libres ; une planche pliée par directions emporte la planche
- [x] le texte décrit une planche comme une planche, une direction comme une direction
- [x] l'écran de confirmation nomme l'usage de chaque référence ; les décocher marche toujours
- [x] essais sans appel payant

### RS2 · Refaire une planche

- [ ] la case *Garder la mise en page de la référence* existe sur la préparation d'une image
      fixe, et part avec la demande
- [ ] cochée : ni « one single sprite », ni la phrase qui fait primer la caméra ; une consigne
      de planche à reproduire, lisible dans *Relire avant l'envoi*
- [ ] la référence `planche` du sujet part, décrite comme la mise en page à reproduire ; sinon la
      première image jointe à la main ; sinon refus avant de payer
- [ ] essais sans appel payant ; **un essai payé** proposé à l'auteur, prix annoncé d'abord

### RS3 · La fiche range ses références

- [ ] l'onglet *Images de référence* montre les références par usage : la planche, une place
      par direction du jeu, les libres
- [ ] l'usage d'une référence se change sur la fiche
- [ ] une direction sans référence propose l'image retenue de cette direction, en un clic
- [ ] essais d'écran

**Ordre** : RS1, puis RS2 et RS3 — toutes deux dépendent de l'usage posé par RS1.
