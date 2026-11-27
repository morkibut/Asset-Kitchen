"""RC1 : l'agent dépose dans le registre du contenu, relève les décisions de
l'auteur et y répond. Mêmes services que l'écran (`atelier/api/registre.py`).

**Aucun outil ne décide** : valider, demander une reprise, écarter, mettre en
pause, prendre une proposition sont des gestes de l'auteur, à l'écran. Rien
n'est payé, rien n'est fabriqué.
"""
from typing import Any


def installer_registre(serveur, atelier, refus):
    def meta(titre, verbe="travailler"):
        return {"barre": {"titre": titre, "phrase": "Montre le contenu du jeu à l'auteur et relève ses décisions.",
            "verbe": verbe, "paiement": "gratuit", "ou": "registre", "route": "", "besoins": []}}

    @serveur.tool(name="list_entry_types", meta=meta("Lire les types du registre"), description=(
        "List what a game's content register accepts, so you never write an unknown value: entry types with their "
        "validation gates (e.g. a 'texte' has two gates, 'brief' then 'textes'; nothing enters the game before the "
        "last one), shelves ('rayons'), entry states, remark kinds and remark states. Also returns the drop folder "
        "path for agents that cannot reach this server (see submit_entry)."))
    @refus
    async def list_entry_types(project: str) -> dict[str, Any]:
        reglages = atelier.registre.reglages(project)
        return reglages | {"drop_folder": str(atelier.registre._racine(project) / "depot")}

    @serveur.tool(name="list_entries", meta=meta("Chercher dans le registre"), description=(
        "List a game's register entries, newest change first, one short line each (default 30, max 500). Filters: "
        "state (see list_entry_types), type, shelf, author, waiting_for_author (only what the author still has to "
        "decide), changed_since (unix seconds), text. Writeoffs and replaced entries are hidden unless state names "
        "them or include_hidden is true. Also takes in any drop-folder deposits, and lists the refused ones with "
        "their reason."))
    @refus
    async def list_entries(project: str, state: str | None = None, type: str | None = None, shelf: str | None = None,
                           author: str | None = None, waiting_for_author: bool = False,
                           changed_since: float | None = None, text: str | None = None, limit: int = 30,
                           include_hidden: bool = False) -> dict[str, Any]:
        return atelier.registre.lister(project, etat=state, type_=type, rayon=shelf, auteur=author,
                                       attend_l_auteur=waiting_for_author, depuis=changed_since, texte=text,
                                       limite=limit, hors_vue=include_hidden)

    @serveur.tool(name="get_entry", meta=meta("Lire une entrée du registre"), description=(
        "Read one register entry in full: current version (body, proposals with captions, flaws and advised flag), "
        "its state and gates, what the author picked, older versions with what the author said about each, remarks "
        "with their replies and status, and the entry's event log."))
    @refus
    async def get_entry(project: str, entry: str) -> dict[str, Any]:
        return atelier.registre.lire(project, entry)

    @serveur.tool(name="submit_entry", meta=meta("Déposer une entrée au registre", "regler"), description=(
        "Create or update a register entry with its media in ONE call. Idempotent on `id` (lowercase, digits, "
        "hyphens): submitting the same id again updates it instead of duplicating it; if the media or body changed, "
        "it becomes a new version and the previous one stays in the history with what the author said. Fields: "
        "type and shelf from list_entry_types; title; summary (two sentences: what it is, what you expect from the "
        "author); body (Markdown); group; author (your agent or thread name, required); choice=true when the author "
        "must pick among proposals (2+ media); change (what changed in this version); waiting_on (what this decision "
        "unblocks, e.g. 'I wait for this choice to launch the 36 cards'). Each media item: either `file` (absolute "
        "path on this machine: png/jpg/webp/gif, mp4/webm, wav/ogg/mp3, md/txt) or `asset` (a library asset id, by "
        "reference, never copied); optional code, caption, flaws (what you yourself noticed), advised (true on the "
        "one you recommend), provenance, subtitles (.vtt path). Files are copied once, by content hash: no need to "
        "compress or upload anything.\n\nAgents that cannot reach this server (cloud threads) write the same JSON "
        "with French keys (identifiant, type, titre, resume, corps, rayon, groupe, auteur, choix, medias[{fichier, "
        "asset, code, legende, defauts, conseil, provenance, sous_titres}], change, attend) as "
        "<drop_folder>/<any-folder>/entree.json, media files next to it with relative paths, entree.json written "
        "LAST. The workshop takes it in at its next look; a refused deposit stays there with REFUS.txt saying why."))
    @refus
    async def submit_entry(project: str, title: str, type: str, author: str, id: str | None = None,
                           summary: str | None = None, body: str | None = None, shelf: str | None = None,
                           group: str | None = None, choice: bool = False, media: list[dict[str, Any]] | None = None,
                           change: str | None = None, waiting_on: str | None = None) -> dict[str, Any]:
        medias = [{{"file": "fichier", "caption": "legende", "flaws": "defauts", "advised": "conseil",
                    "subtitles": "sous_titres"}.get(k, k): v for k, v in (m or {}).items()} for m in (media or [])]
        brut = {"identifiant": id, "type": type, "titre": title, "resume": summary, "corps": body, "rayon": shelf,
                "groupe": group, "auteur": author, "choix": choice, "medias": medias, "change": change,
                "attend": waiting_on}
        vue = atelier.registre.deposer(project, {k: v for k, v in brut.items() if v is not None})
        return {k: vue[k] for k in ("identifiant", "etat", "porte", "version", "versions", "change", "medias")}

    @serveur.tool(name="read_decisions", meta=meta("Relever les décisions de l'auteur"), description=(
        "What the author did since a marker: validations, revision requests (with the word), writeoffs, pauses, "
        "restarts, picks among proposals, remarks, and cancellations of any of these. Each event once, oldest first, "
        "with the entry id and title. Pass `reader` (your agent name): the marker is kept for you and advances by "
        "itself, so nothing is read twice nor missed. Or pass `since` (a marker from a previous answer). The answer's "
        "`repere` is the new marker. THE tool to call at the start of each session."))
    @refus
    async def read_decisions(project: str, reader: str | None = None, since: str | None = None) -> dict[str, Any]:
        return atelier.registre.decisions_depuis(project, since, lecteur=reader)

    @serveur.tool(name="answer_remark", meta=meta("Répondre à une remarque", "regler"), description=(
        "Answer one of the author's remarks (its `repere` from read_decisions or get_entry): a short text shown "
        "under the remark ('noted, I integrate it', 'done', 'I cannot, here is why') and/or its state: vue, en-cours, "
        "faite, refusee."))
    @refus
    async def answer_remark(project: str, remark: str, author: str, text: str | None = None,
                            state: str | None = None) -> dict[str, Any]:
        return atelier.registre.repondre(project, remark, text, etat=state, qui=author)

    @serveur.tool(name="set_entry_status", meta=meta("Avancer le statut d'une entrée", "regler"), description=(
        "Say where an entry stands on your side: en-cours (you are working on the requested revision), integree "
        "(it is in the game), retiree (withdrawn), remplacee (replaced by `replaced_by`, another entry id). An agent "
        "never validates: validation is the author's gesture, on screen."))
    @refus
    async def set_entry_status(project: str, entry: str, status: str, author: str,
                               replaced_by: str | None = None) -> dict[str, Any]:
        vue = atelier.registre.statuer(project, entry, status, qui=author, par=replaced_by)
        return {k: vue[k] for k in ("identifiant", "etat", "porte", "remplacee_par")}

    @serveur.tool(name="set_entry_waiting", meta=meta("Dire ce qu'une décision débloque", "regler"), description=(
        "Declare what work waits on the author's decision on an entry (e.g. 'I wait for this pick to launch the 36 "
        "cards'), shown on the entry while it is undecided. Empty text clears it."))
    @refus
    async def set_entry_waiting(project: str, entry: str, author: str, text: str | None = None) -> dict[str, Any]:
        vue = atelier.registre.attendre(project, entry, text, qui=author)
        return {k: vue[k] for k in ("identifiant", "etat", "attend")}
