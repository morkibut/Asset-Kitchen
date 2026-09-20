# RG5 — à qui appartient la bibliothèque des matières

> Décision demandée par `docs/PLAN-rangement.md`, § *Questions laissées ouvertes*, première
> question. Prise le 20 septembre 2026, sur mesure et non sur supposition.
>
> **La forme retenue : (A) la bibliothèque appartient au projet.** L'écran des tuiles n'en est
> qu'un lecteur.

## 1 · Ce que la mesure a trouvé

**Une matière est déjà un réglage de génération, pas un sujet.**
`ServiceGenerations.soumettre_matiere` pose `echelle="matière"` sur la demande, et c'est ce seul
mot qui donne à l'image sa recette de naissance — pas de détourage, pas de recadrage
(`atelier/services/generation.py` ~1120, `atelier/domaine/projet.py` `BAREME_PAR_DEFAUT` ligne 310).
Le chemin ne touche ni bible ni sujet : `atelier/services/matieres.py` compose son texte seul
(`atelier/domaine/texte_matiere.py`) et écrit déjà la preuve qu'il s'agit d'une matière dans
`filiation["matiere"]` — pierre, motif, cadrage, style, graine — **que personne ne relit**.

**Une collection tient des sujets, jamais des images.**
`Collection.membres` est un tuple de `Membre(jeu, sujet)` (`atelier/domaine/projet.py` 1580-1730,
table `collections_membres` dans `atelier/depot/base.py` 165). `Asset.collection` a existé de T3 à
B8.4 et a été retiré exprès (`atelier/domaine/asset.py`, docstring, ligne 28-34) : l'adhésion
s'écrit sur la collection. Une image nue n'est donc **pas** groupable aujourd'hui.

**Le moteur des tuiles ne consomme pas une matière : il consomme un identifiant d'image du projet.**
La recette valide un emplacement `{source: "asset", asset: <id>}` avec `_asset_valide`
(`atelier/services/tuiles.py` 90-94), qui vérifie trois choses seulement — l'image appartient au
projet, elle n'est pas supprimée, c'est une image. Rien n'y parle de matière ni de sujet
(`atelier/domaine/recette_tuiles.py` 133-200). Le sujet ne servait qu'à **lister** l'onglet « Mes
matières » (`interface/src/App.tsx` 2114-2119, `interface/src/composants/AtelierTuiles.tsx` 547-584).
⚠️ Dans le moteur, `source: "matiere"` désigne une matière **intégrée** au code (herbe, pierre…),
pas une image de l'auteur (`interface/src/tuiles/atelier.ts` 284) : les deux sens du mot cohabitent
déjà, et RG6 ne doit pas les confondre.

**Rien d'autre, dans le produit, ne consomme une texture qui se répète.**
Mesuré : le chemin 3D importe des GLB et des séquences de PNG rendues ailleurs, il n'applique
aucune texture (`atelier/services/sources_3d.py`) ; `atelier/domaine/fond.py` est une **couleur**
de fond pour le détourage, pas une image ; `atelier/domaine/ambiance.py` porte des images de
*référence*, qui orientent un texte et ne se raccordent pas. Le seul consommateur d'une texture
raccordable est le moteur des tuiles. Le besoin « fond d'écran, objet 3D » n'existe nulle part
dans le dépôt aujourd'hui.

**L'agent peut générer une matière et ne peut rien en faire.**
`generate_tile_material` (`atelier/mcp/tuiles.py` 131-160) rend des générations, dont chaque image
finie entre en bibliothèque. Aucun outil MCP ne crée un sujet de nature « matière » : le seul
créateur de sujet est `create_character` (`atelier/mcp/objectifs.py` 33-43), qui ne prend pas de
nature. Et aucun outil ne liste les matières — `list_assets` filtre par tri, rôle et jugement
(`atelier/domaine/galerie.py` 25-42), jamais par « c'est une matière ».

## 2 · La forme retenue, et pourquoi

**(A) la bibliothèque appartient au projet.**

Elle l'emporte parce que le serveur la porte **déjà** : la route des matières est montée sous
`/projects/{projet}/materials` (`atelier/api/matieres.py` ligne 9), et le moteur des tuiles accepte
n'importe quelle image du projet par son identifiant. Ranger la bibliothèque sous l'écran des
tuiles aurait posé un magasin à portée « tuiles » au-dessus d'une validation à portée « projet » —
deux vérités sur la même question.

Et parce qu'elle ne coûte rien de plus : le marqueur se pose à côté de `favori` et `epingle`, dans
un index qui se reconstruit des fichiers et n'a aucune migration de schéma
(`atelier/depot/base.py` 91-124, `docs/ARCHITECTURE.md` §4).

**Ce que ce choix ne dit pas.** Il ne déclare aucun second consommateur : la mesure n'en a trouvé
aucun, et RG5 n'en invente pas. Il dit seulement que la matière est rangée là où le tileset ira la
chercher, au lieu d'être rangée dans le tileset.

## 3 · La forme des données

### Ce qui s'ajoute

**Un booléen sur l'image** — `atelier/domaine/asset.py`, à côté de `favori` et `epingle` :

```python
matiere: bool = False
```

Écrit dans `en_json` / `depuis_json`. **Le nom d'une matière est le `label` de son image**, et il
n'y a pas de second nom à tenir d'accord : l'écran des tuiles lit déjà `a.label` aujourd'hui.

**La règle qui le pose, et elle est unique** — dans `ServiceAssets.naitre`
(`atelier/services/assets.py` 907) : une image dont la génération a demandé `echelle="matière"`
**naît matière**. C'est le même mot qui lui donne déjà sa recette de naissance ; rien n'est
inventé, et RG7 est payé d'avance — `generate_tile_material` dépose dans la bibliothèque sans
qu'on ajoute une ligne à son chemin. Comme pour `projet` et `personnage`, **une décision de
l'auteur l'emporte à la relance** : `ancien.matiere if ancien else …`.

**Une colonne dans l'index** — `atelier/depot/base.py`, table `assets` :

```sql
matiere INTEGER NOT NULL DEFAULT 0,
CREATE INDEX IF NOT EXISTS assets_matieres ON assets (projet, matiere);
```

Écrite de l'objet à chaque enregistrement, comme `role`. Aucune migration : le schéma est jeté et
refait des fichiers.

**Un genre sur le membre d'une collection** — `atelier/domaine/projet.py` :

```python
SUJET, MATIERE = "sujet", "matiere"

@dataclass(frozen=True, slots=True)
class Membre:
    jeu: str
    sujet: str          # l'identifiant du sujet, ou celui de l'image pour une matière
    genre: str = SUJET
```

`contient` / `avec` / `sans` prennent le genre ; `sujets_du_jeu()` ne rend que `genre == SUJET`
(sinon les écrans de sujets compteraient des images), et une `matieres_du_jeu()` jumelle rend
l'autre moitié. La table `collections_membres` gagne `genre TEXT NOT NULL DEFAULT 'sujet'` dans sa
clé primaire. `membres_depuis_json` rend `sujet` aux entrées qui n'ont pas de genre — une fiche
écrite avant RG5 se relit sans perte.

**L'invariant de B8.4 tient toujours** : l'adhésion reste écrite sur la collection, une matière
appartient à plusieurs collections, et aucune image ne porte la sienne.

**Deux routes, sur le préfixe qui existe** — `atelier/api/matieres.py` :

| Route | Ce qu'elle fait |
|---|---|
| `GET /api/projects/{projet}/materials` | La bibliothèque : `{"matieres": [{identifiant, nom, largeur, hauteur, apercu, cadrage, cree_le, collections: [{identifiant, nom}]}]}`. `cadrage` est relu de `filiation["matiere"]["cadrage"]` de la génération, vide si l'image vient d'ailleurs. |
| `PUT /api/projects/{projet}/materials/{asset}` | Corps `{"matiere": true \| false}`. Déclarer une image ordinaire matière, ou lui retirer la marque. C'est le « en un geste » de RG6. |

### Ce qui ne bouge pas

- **La nature « matière » reste au barème** (`BAREME_PAR_DEFAUT`, `silhouette=False`,
  occupation 100) et `capacites_de("matière")` reste comme RG1 l'a écrite. C'est la **recette**
  appliquée à la naissance ; la retirer ferait revenir le défaut du 19 septembre. Ce que RG5 lui
  ôte, c'est d'être un type de **sujet** qu'on crée.
- **La recette d'un jeu de tuiles** : `{source: "asset", asset: <id>}`, inchangée.
- **`_asset_valide` ne change pas non plus** : une image ordinaire reste posable dans un
  emplacement. Le marqueur décide de ce qui est **listé**, jamais de ce qui est **accepté** —
  refuser une image non marquée casserait des jeux déjà composés.
- `Asset.personnage`, `pose`, `direction`, `piece` : inchangés. Une matière les a simplement vides.
- `atelier/services/matieres.py` et `texte_matiere.py` : rien à y toucher.

## 4 · Ce qu'une matière ne peut pas faire

Elle n'a **ni sujet, ni pose, ni direction, ni objectif, ni livraison propre**. Deux routes
peuvent encore le lui proposer ; elles refusent, en `409`, avec ces phrases-là :

**`PUT /api/v1/assets/{identifiant}/character`** (`atelier/api/production.py` 1191), quand l'image
porte `matiere=True` :

> Une matière n'a pas de sujet : c'est un ingrédient du jeu de tuiles, pas une chose du jeu. Pour
> la ranger, mets-la dans une collection ; pour en faire l'image d'un sujet, retire-lui d'abord la
> marque « matière » depuis sa fiche.

**`POST /api/v1/characters`** (`atelier/api/production.py` 1097) et
`PUT /api/v1/characters/{identifiant}`, quand `type == "matière"` :

> On ne crée plus de sujet de nature « matière ». Une matière est une image de la bibliothèque du
> jeu : génère-la depuis l'écran des tuiles, ou déclare une image existante « matière » depuis sa
> fiche.

Il n'y a **pas de troisième refus à écrire** : l'objectif et la livraison se demandent à un sujet,
et après RG8 aucun sujet de nature « matière » n'existe plus. Écrire un refus là où aucune route
ne passe serait du décor.

## 5 · La migration, pour RG8

Mesuré sur `donnees/projets/la-foret-magique/` : un sujet `matieres` (« Matières »), de nature
**`décor`** — l'auteur a contourné la nature manquante —, et deux images rattachées
(`7b894dcedf4e4271afa61cdf358f07ae-0` et `7c96f9bb051e4a9abc93e26b46917e93-0`), dont le `label`
est le texte anglais de l'envoi. Aucun sujet de nature `matière` sur le disque.

La règle se lit **sur la génération, jamais sur le nom du sujet** — sans quoi un sujet nommé
« Matières » qui contiendrait des décors emporterait tout :

1. Toute image dont la génération a demandé `echelle="matière"` prend `matiere = True`, quel que
   soit le sujet où elle est rangée. C'est ce qui rattrape les deux images ci-dessus.
2. Ses champs `personnage`, `pose` et `direction` sont vidés.
3. Son nom : si `label` est vide, on y écrit le nom du sujet qu'elle quitte ; sinon le `label`
   reste. **Aucune matière ne perd son nom**, et aucune n'en gagne un faux.
4. Les collections où était rangé le sujet reçoivent les images migrées comme membres
   `genre="matiere"`. Le groupement de l'auteur survit au déménagement.
5. **Le sujet n'est pas supprimé.** Il reste, vide, et l'écran propose de le jeter en un geste.
   Effacer un dossier de l'auteur n'est pas la décision d'une migration.
6. Un sujet de nature `matière` qui garderait des images non migrées repasse en nature `décor` —
   les capacités de repli de RG1 — au lieu de porter une nature qu'on ne crée plus.

La migration est **rejouable** : appliquée deux fois, elle ne change rien la seconde fois.

## 6 · Ce que ça change pour l'agent

**L'outil qui manque : `list_materials`.** Un seul, en lecture, gratuit — dans
`atelier/mcp/tuiles.py`, à côté de `generate_tile_material` :

```
list_materials(project: str | None = None, search: str = "", limit: int = 50)
→ {"materials": [{"id", "name", "framing", "width", "height", "path",
                  "created", "collections": [{"id", "name"}]}], "total": int}
```

`id` est exactement ce qui se pose dans un emplacement de recette :
`{source: "asset", asset: id}` — la phrase à écrire dans la description de l'outil, pour que
l'enchaînement de RG7 n'ait pas à être deviné. `framing` (surface, face, plat, motif) vient de
`filiation["matiere"]["cadrage"]` : c'est ce qui dit à l'agent si la texture est un sol ou une
face de mur, et c'est la première fois que cette filiation déjà écrite sert à quelque chose.

**Et rien d'autre.** Déclarer une image existante matière se fait par le champ `material: bool`
ajouté à `edit_asset`, pas par un nouvel outil. La description de `generate_tile_material` gagne
une phrase : chaque tirage fini est déjà dans la bibliothèque des matières du jeu, et se retrouve
par `list_materials`.

L'agent peut alors faire seul, sans écran et sans créer de sujet :
`generate_tile_material` → `check_generation` → `list_materials` → `create_tile_set` avec la
recette qui cite l'identifiant. C'est l'essai de bout en bout que RG7 demande.
