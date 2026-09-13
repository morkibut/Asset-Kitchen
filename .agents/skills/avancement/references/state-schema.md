# `docs/status/state.json`

Fichier unique, versionnable dans git, lisible à la main. C'est lui qui rend les
mises à jour incrémentales possibles : le scan ne réécrit que le bloc
`detected`.

```jsonc
{
  "schema": 1,
  "project": { "name": "Abreuvoir Connecté", "item_word": "stories" },
  "config":  { "out_dir": "docs/status", "primary_source": "bmad" },

  // réécrit intégralement à chaque scan
  "detected": {
    "items": [ { "id": "2.1", "type": "story", "parent": "2", "title": "Ingestion MQTT",
                 "status": "in_progress", "status_raw": "In Progress", "team": null,
                 "path": "docs/stories/2.1.md", "checks": {"done": 2, "total": 4},
                 "source": "bmad", "order": 7 } ],
    "sources": ["BMAD (bmad-core)", "claude-mastery (docs/PLAN.md)"],
    "artifacts": [ { "label": "Brief / PRD", "path": "docs/PRD.md", "present": true, "detail": "" } ],
    "scanned_at": "2026-08-27"
  },

  // jamais touché par le scan
  "manual":     { "items": [ /* mêmes champs, source "manual" */ ] },
  "overrides":  { "2.1": { "status": "blocked", "team": "Dev backend" } },
  "notes":      [ { "id": "n1", "level": "blocker", "text": "…", "date": "2026-08-27",
                    "scope": "2.1", "scope_label": "Ingestion MQTT" } ],
  "milestones": [ { "id": "m1", "title": "Démo client", "date": "2026-09-15", "status": "todo" } ],
  "activity":   [ { "hash": "d67bfda", "date": "2026-08-27", "text": "feat(mesures): …" } ]
}
```

Règles :

- un `override` s'applique à l'id même si le scan ne l'a pas (encore) vu ;
- un override sur un epic force son statut mais pas son pourcentage, sauf si on
  passe explicitement `--progress` ;
- éditer ce fichier à la main est légitime ; relancer `render` suffit ensuite.
