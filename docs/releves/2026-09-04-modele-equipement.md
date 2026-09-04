# Une pièce d'équipement n'appartient à personne — 4 septembre 2026

> **Ce n'est pas un défaut d'écran, c'est une relation qui manque au modèle.** Trois griefs d'usage
> en découlent, et aucun des trois ne se répare au dessin. Consigné ici parce qu'une refonte partie
> de l'usage butera exactement là : **le vestiaire qu'on veut dessiner n'a pas de données pour le
> porter.**

---

## Ce que l'auteur a dit

> déjà les équipements, ils ne devraient pas tous être disponibles par défaut sur tous les
> personnages. **Si je crée un sac à dos pour le héros, je le mets que sur le héros.** bref y a rien
> qui va

---

## Ce que le code dit — vérifié le 4 septembre 2026

**Une pièce d'équipement** (`atelier/domaine/equipement.py:109`) porte exactement ceci :

| Champ | Ce que c'est |
|---|---|
| `identifiant` | son identité |
| `nom` | son nom |
| `description` | ce qui part dans le prompt d'une planche d'équipement |
| `emplacement` | où elle se pose sur le corps — vide tant que l'auteur n'a rien dit |
| `portee` | *contenue* ou *agrandit* — si elle dépasse la silhouette |
| `concept_arts` | les cartes du tableau qu'elle désigne |

**Il n'y a aucun champ qui désigne un personnage.**

Et le vestiaire se demande **par projet**, jamais par personnage :

```
vestiaire(projet) → { emplacements: [...], pieces: [...] }
```
`atelier/services/equipement.py:1114`

Les emplacements aussi appartiennent au projet (`objet.emplacements`).

**Conséquence, par construction** : toute pièce créée dans un jeu est disponible sur tout le casting,
et il n'existe nulle part de moyen de dire le contraire.

### Ce qui aurait pu être le lien, et ne l'est pas

Un personnage possède bien un champ `prend` (`atelier/api/production.py:195`), mais il vaut
`tout | couleurs | sans-images` : il dit **ce que le personnage emprunte à une ambiance**, pas ce
qu'il porte. Vérifié pour écarter une fausse piste.

---

## Les trois griefs que cette seule absence produit

1. **L'écran Équipement est une suite de paragraphes** — *« du texte, du texte, encore du texte,
   illisible, effrayant »*. Il n'a personne à qui rattacher ce qu'il montre : c'est une liste de
   jeu, pas un vestiaire.
2. **« un menu permettant de passer sur des objets alors que je n'ai même pas décidé si ce
   personnage a cet objet ou pas »** — il n'y a rien à décider. **Le produit n'a pas prévu qu'on
   décide.**
3. **La colonne qui dit *ce que l'entité réclame*** liste l'équipement du jeu entier pour chaque
   personnage. Le défaut n'est pas seulement que tout y est au vert : **la liste elle-même n'a pas
   de sens.**

---

## Le modèle proposé — non tranché

> **Les emplacements restent au jeu.** Tête, torse, dos : c'est le plan du corps, il est commun à
> tout le casting, et il est bien à sa place.
>
> **Une pièce reste au jeu, mais elle déclare qui la porte** — et **personne par défaut**. Une pièce
> créée depuis la fiche d'un personnage lui est attribuée d'emblée : c'est le geste que l'auteur
> décrit.

**Pourquoi garder le partage possible plutôt que coller une pièce à un seul personnage** : un casque
de garde porté par cinq gardes se décrirait une fois au lieu de cinq, et surtout **une pièce
partagée se fabrique une fois par personnage mais se règle une fois pour toutes**. C'est le seul
point où la proposition dépasse ce que l'auteur a demandé, et il est réversible : *une pièce
n'appartient qu'à un personnage* est plus simple, et suffit à un jeu sans figurants en série.

### Ce que ça change en aval

- **La fiche d'un personnage gagne son vestiaire** — ce qu'il porte, en images, à côté de ses poses.
  C'est ce que l'auteur attendait en cliquant sur *Équipement*, au mauvais endroit.
- **L'écran Équipement devient une vraie liste** : une pièce par ligne, avec son emplacement et
  **qui la porte**. Il a enfin quelque chose à montrer par pièce.
- **La colonne *ce que l'entité réclame*** cesse de lister le vestiaire du jeu entier.

### Ce que ça coûte

⚠️ **C'est un changement de modèle, pas de design** : le PRD, le serveur, et les données déjà
écrites. Il doit être tranché **avant** que ces écrans ne soient redessinés — la forme d'un écran
découle de la relation qu'il affiche, pas l'inverse.
