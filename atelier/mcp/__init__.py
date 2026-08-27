# -*- coding: utf-8 -*-
"""Le serveur MCP — **vide jusqu'à T7**, et ce vide est une décision.

`mcp/` est le voisin d'`api/`, pas son client : les deux appellent `services/`,
aucune ne réimplémente rien (`docs/ARCHITECTURE.md` §4, règle 2). C'est ce qui
garantit que ce qu'un agent peut faire est exactement ce que l'écran peut faire
— et ce qui interdit d'ajouter ici un geste que l'atelier n'a pas.

Une dizaine d'outils épais viendront s'y poser, chacun façade d'un geste déjà
livré : `generate_asset` (T1), `edit_asset` (T2), `list_assets` (T3),
`export_assets` (T6). Les noms d'outils sont en anglais — ils sont lus par des
modèles entraînés en anglais.
"""
