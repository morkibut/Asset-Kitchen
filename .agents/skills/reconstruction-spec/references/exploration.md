# Protocole d'exploration, en détail

Sommaire :
- [Repères par écosystème](#repères-par-écosystème)
- [Quand l'architecture résiste](#quand-larchitecture-résiste)
- [Extraire le « pourquoi »](#extraire-le--pourquoi-)
- [Commandes utiles](#commandes-utiles)

---

## Repères par écosystème

Dans chaque cas : le manifeste dit la pile, le point d'entrée dit la séquence, le schéma dit
le domaine, les routes disent le contrat.

### JavaScript / TypeScript

| Élément | Où chercher |
|---|---|
| Pile et outils | `package.json` — les `scripts` révèlent les outils de maintenance, souvent invisibles ailleurs |
| Point d'entrée | `main`, `scripts.dev`/`start`, ou `server.*` / `index.*` à la racine |
| Modèle de données | `schema.*` (Drizzle, Prisma `schema.prisma`), `models/`, `entities/` |
| Routes | `routes/`, `api/`, `controllers/`, `pages/api/`, `app/**/route.ts` |
| Contrats partagés | `types/`, `shared/`, `common/` — souvent le fichier le plus dense en règles métier |
| Interface | composant racine, puis navigation, puis les écrans principaux |

Astuce : dans un projet TypeScript, `grep -rn "^export type\|^export interface" src/types` donne
la carte du domaine en une commande.

### Python

| Élément | Où chercher |
|---|---|
| Pile | `pyproject.toml`, `requirements.txt`, `setup.py` |
| Point d'entrée | `__main__.py`, `app.py`, `main.py`, `manage.py`, `wsgi.py` |
| Modèle de données | `models.py`, `migrations/`, fichiers SQLAlchemy ou Pydantic |
| Routes | décorateurs `@app.route`, `@router.*`, `urls.py` en Django |
| Réglages | `settings.py`, `config.py`, variables d'environnement |

En Django, `python manage.py showmigrations` et la lecture des `migrations/` racontent
l'évolution du domaine mieux que les modèles seuls.

### Go, Rust, Java, PHP

| Écosystème | Manifeste | Entrée | Domaine |
|---|---|---|---|
| Go | `go.mod` | `main.go`, `cmd/` | `internal/`, `pkg/` |
| Rust | `Cargo.toml` | `src/main.rs` | `src/lib.rs`, modules |
| Java | `pom.xml`, `build.gradle` | classe `@SpringBootApplication` | `entity/`, `repository/` |
| PHP / Laravel | `composer.json` | `routes/web.php`, `routes/api.php` | `app/Models/`, `database/migrations/` |

### Ce qui vaut partout

- Les fichiers de configuration de déploiement (`Dockerfile`, `docker-compose.yml`, manifestes
  d'orchestration) disent les volumes à conserver, les ports, et donc l'état persistant.
- Le dossier de tests est un **inventaire des comportements que quelqu'un a jugé fragiles**.
  La liste des noms de fichiers de test est une carte des risques, gratuite à lire.
- `.env.example` liste les intégrations externes.

---

## Quand l'architecture résiste

**Le code est réparti sans logique apparente.** Suis les données plutôt que les dossiers :
pars d'une table centrale et cherche tous les endroits qui écrivent dedans
(`grep -rn "nom_de_table"`). Les points d'écriture dessinent les responsabilités réelles, quel
que soit le rangement.

**Tout passe par des abstractions génériques.** Cherche les implémentations concrètes plutôt
que les interfaces, et lis d'abord un cas d'usage complet de bout en bout. Une trace verticale
apprend plus que trois couches horizontales.

**Le projet a plusieurs générations superposées.** C'est fréquent. Repère ce qui est mort :
```bash
git log -1 --format=%ci -- <fichier>     # date du dernier changement
```
Un module que personne n'a touché depuis deux ans alors que son voisin bouge chaque semaine est
probablement remplacé. Vérifie qui l'importe encore avant de le documenter — et si personne ne
l'importe, dis-le dans le document, c'est une information utile.

**Monorepo.** Demande le périmètre avant de lire. Documenter cinq applications superficiellement
ne permet d'en reconstruire aucune.

---

## Extraire le « pourquoi »

Les commandes qui font remonter la matière des invariants :

```bash
# Commentaires longs : ceux qui racontent un incident font plusieurs lignes.
grep -rn -B1 -A6 "^\s*/\*\*" src | grep -i "sinon\|au lieu de\|le problème\|panne\|cassait\|échouait\|silence"

# Garde-fous nommés.
grep -rn "ensure\|assert\|guard\|refuse\|reject\|isStuck\|release\|fallback\|retry" src --include=*.ts

# Constantes nommées : chacune est un arbitrage chiffré.
grep -rn "^const [A-Z_]\+ = \|^[A-Z_]\+ = " src

# Les catch qui n'échouent pas : presque toujours accompagnés d'une raison.
grep -rn -A3 "catch" src | grep -i "//"

# Fichiers les plus retouchés : là où le métier a résisté.
git log --format=format: --name-only | sort | uniq -c | sort -rn | head -25
```

Le dernier est particulièrement rentable : un fichier modifié cinquante fois porte un problème
que personne n'a résolu du premier coup, et c'est exactement ce qu'un reconstructeur doit savoir
avant de recommencer.

---

## Commandes utiles

```bash
# Plan de lecture : les fichiers par taille décroissante.
find . -path ./node_modules -prune -o -name "*.ts" -print | xargs wc -l | sort -rn | head -60

# En-tête + signatures d'un lot de fichiers, en un appel.
for f in src/services/*.ts; do
  echo "===== $f"; sed -n '1,35p' "$f"; echo "--- exporte :"; grep -n "^export " "$f"
done

# Lecture d'un gros fichier par tranches.
sed -n '1,300p' gros.ts
sed -n '300,600p' gros.ts

# Titres d'une documentation existante, sans la lire en entier.
grep -n "^#\{1,3\} " docs/*.md
```

Deux réflexes qui font gagner beaucoup :

- **Regrouper les lectures indépendantes** dans un même tour plutôt que de les enchaîner.
- **Ne jamais relancer une commande dont la sortie a été tronquée** pour cause de volume : elle
  le sera de nouveau. Découpe avec `sed -n`, ou restreins avec `grep`.
