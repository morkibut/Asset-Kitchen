# -*- coding: utf-8 -*-
"""Le tableau des décisions des six essais, règle par règle — et rien au-delà.

Relit les six `essais/notes-<essai>.json` écrits par l'auteur depuis les
rapports, et les `mesures.json` de chaque essai pour les prix, puis imprime ce
que chaque règle du cahier dit. **Il ne conclut jamais au-delà de la règle** :
là où une règle demande des notes qui manquent, il écrit « en attente ».

    .venv\\Scripts\\python.exe essais/verdict_essais.py

Gratuit. Entrée : `essais/notes-*.json`, `essais/resultats_*/mesures.json`.
Sortie : le terminal, et `essais/verdict-essais.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from socle_essais import JETS, MODELE_DEFAUT, TEMOIN_MESURES, notes_de, preparer_sortie  # noqa: E402

SORTIE = RACINE / "verdict-essais.json"


# ── Les comptes d'un groupe ──────────────────────────────────────────────────


def _releve(essai: str) -> dict:
    chemin = RACINE / f"resultats_{essai.replace('-', '_')}" / "mesures.json"
    return json.loads(chemin.read_text("utf-8")) if chemin.exists() else {}


def _cout(essai: str, cle: str) -> float:
    if cle == "A-temoin" and essai in ("taille-reference", "grille-complete"):
        # Le témoin de E2 et E3 est celui de E1 avec les artworks du jour (2 septembre 2026).
        lignes = _releve("references-nommees").get("A2-temoin-art", {})
    elif cle == "A-temoin":
        if not TEMOIN_MESURES.exists():
            return 0.0
        lignes = json.loads(TEMOIN_MESURES.read_text("utf-8")).get(MODELE_DEFAUT, {})
    else:
        lignes = _releve(essai).get(cle, {})
    return round(sum(float(l.get("cout_usd") or 0) for k, l in lignes.items() if isinstance(l, dict) and not k.startswith("_")), 4)


def compter(notes: dict, cle: str, jets=None) -> dict:
    """Bonnes, moyennes, mauvaises, notées, et les échecs cochés d'un groupe."""
    jets = jets or [f"jet{j}" for j in JETS]
    c = {"bon": 0, "moyen": 0, "mauvais": 0, "notees": 0, "echecs": {}}
    for jet in jets:
        n = notes.get(f"{cle}:{jet}", {})
        if n.get("note") in c:
            c[n["note"]] += 1
            c["notees"] += 1
        for e in n.get("echecs", []):
            c["echecs"][e] = c["echecs"].get(e, 0) + 1
    return c


def _prix_par_bonne(cout: float, bonnes: int) -> str:
    return f"${cout / bonnes:.3f}" if bonnes else "—"


# ── Les règles, une par essai ────────────────────────────────────────────────


def regle_references_nommees(notes: dict) -> list[str]:
    """La règle refaite le 2 septembre 2026 : au moins la moitié de bonnes, sinon on n'insiste pas."""
    groupes = sorted({i.split(":")[0] for i in notes if ":" in i and not i.startswith("_")})
    if not groupes:
        return ["aucun groupe noté"]
    lignes = []
    for cle in groupes:
        jets = sorted({i.split(":")[1] for i in notes if i.startswith(cle + ":")})
        g = compter(notes, cle, jets)
        moitie = -(-len(jets) // 2)
        temoin = cle.startswith("A")
        verdict = "témoin, le point de comparaison" if temoin else ("à poursuivre" if g["bon"] >= moitie else "on n'insiste pas")
        lignes.append(f"{cle:<16} bonnes {g['bon']} · moyennes {g['moyen']} · mauvaises {g['mauvais']} sur {g['notees']} notées "
                      + ("" if temoin else f"(il en faut {moitie}) ") + f"→ {verdict} · {_prix_par_bonne(_cout('references-nommees', cle), g['bon'])} la bonne")
    passent = [k for k in groupes if not k.startswith("A") and compter(notes, k, sorted({i.split(':')[1] for i in notes if i.startswith(k + ':')}))["bon"] >= -(-len({i for i in notes if i.startswith(k + ':')}) // 2)]
    if passent and all(k.startswith("IA") for k in passent):
        lignes.append("seul le texte réécrit passe la barre : c'est la construction qui compte — une passe d'amélioration par IA dans l'atelier se discute")
    elif passent:
        lignes.append("passent la barre : " + ", ".join(passent) + " — le rangement entre dans R7")
    else:
        lignes.append("rien ne passe la barre : le texte du produit ne bouge pas")
    return lignes


def regle_taille_reference(notes: dict) -> tuple[list[str], int | None]:
    echec = "le personnage n'est pas reconnaissable comme le même"

    def meme(cle: str) -> int:
        return sum(1 for j in JETS if (n := notes.get(f"{cle}:jet{j}", {})).get("note") in ("bon", "moyen") and echec not in n.get("echecs", []))

    groupes = ("A-temoin", "B-256", "C-512")
    comptes = {k: compter(notes, k) for k in groupes}
    lignes = [f"« même personnage » : 64 px {meme('A-temoin')} · 256 px {meme('B-256')} · 512 px {meme('C-512')}"]
    if not all(comptes[k]["notees"] for k in groupes):
        lignes.append("en attente de notes sur les trois groupes")
        return lignes, None
    a, b, c = meme("A-temoin"), meme("B-256"), meme("C-512")
    taille = 64 if a >= b else (256 if b >= c else 512)
    lignes.append(f"taille retenue : {taille} px" + (" — 64 px n'est pas battu, la question est fermée" if taille == 64 else ""))
    for k, px in zip(groupes, (64, 256, 512)):
        lignes.append(f"    {px:>4} px  bonnes {comptes[k]['bon']} · {_prix_par_bonne(_cout('taille-reference', k), comptes[k]['bon'])} la bonne")
    return lignes, taille


def regle_grille_complete(notes: dict) -> list[str]:
    a = compter(notes, "A-temoin")
    neuf = "neuf sujets (ou plus) pour huit demandés"
    lignes = [f"A-temoin : bonnes {a['bon']} · neuf-pour-huit cochés {a['echecs'].get(neuf, 0)}"]
    for cle in ("B-4x2-carre", "C-4x2-3sur2"):
        g = compter(notes, cle)
        if not (a["notees"] and g["notees"]):
            lignes.append(f"{cle} : en attente de notes")
            continue
        n = g["echecs"].get(neuf, 0)
        # Le plancher du 2 septembre 2026 : au moins la moitié de bonnes, sinon « >= A - 1 » serait vide.
        plancher = max(a["bon"] - 1, -(-g["notees"] // 2))
        ok = n == 0 and g["bon"] >= plancher
        lignes.append(f"{cle} : neuf-pour-huit {n} (il en faut 0) · bonnes {g['bon']} contre A {a['bon']} (il en faut >= {plancher}) → {'règle atteinte' if ok else 'non atteinte'} · {_prix_par_bonne(_cout('grille-complete', cle), g['bon'])} la bonne")
    lignes.append("entre B et C : le format où l'auteur juge le personnage le plus lisible — à lui de le dire")
    return lignes


def regle_mise_en_pose(notes: dict) -> list[str]:
    choix = notes.get("_choix", {}).get("prep")
    lignes = [f"prep choisie : {choix or 'aucune'}"]
    a, b = compter(notes, "A-temoin"), compter(notes, "B-prep")
    if not (a["notees"] and b["notees"]):
        lignes.append("temps 2 : en attente de notes sur A et B")
        return lignes
    taille = "la taille du personnage change d'une case à l'autre"
    ta, tb = a["echecs"].get(taille, 0), b["echecs"].get(taille, 0)
    gagne, recule = b["bon"] >= a["bon"] + 2, (ta - tb) >= 3
    lignes.append(f"B >= A + 2 : {b['bon']} contre {a['bon']} → {'oui' if gagne else 'non'}")
    lignes.append(f"« la taille change » recule d'au moins trois : A {ta} → B {tb} → {'oui' if recule else 'non'}")
    lignes.append("la prep remplace la référence de face" if (gagne or recule) else "la prep n'entre pas dans la V3 comme étape ; le référent reste une question ouverte")
    return lignes


def regle_pose_imposee(notes: dict) -> list[str]:
    lignes = []
    tours = sorted(k for k in {i.split(":")[0] for i in notes if i.startswith("tour")})
    if not tours:
        return ["aucun tour noté"]
    for t in tours:
        g = compter(notes, t, [f"jet{i}" for i in range(1, 5)])
        meme = sum(1 for i in range(1, 5) if (n := notes.get(f"{t}:jet{i}", {})).get("note") and "n'est pas le même personnage" not in n.get("echecs", []))
        conclusion = notes.get("_tours", {}).get(t, {}).get("conclusion", "")
        lignes.append(f"{t} : obéit {g['bon']} · à moitié {g['moyen']} · n'obéit pas {g['mauvais']} · même personnage {meme} / {g['notees']}"
                      + (" — les quatre obéissent : arrêt, ça marche" if g["bon"] == 4 and meme == 4 else "")
                      + (f" · conclusion : {conclusion}" if conclusion else " · conclusion : (à écrire)"))
    # **L'arrêt écrit d'avance** : deux tours de suite qui n'apprennent rien.
    # Un tour n'apprend rien quand aucune pose n'obéit pleinement et qu'aucune
    # n'échoue franchement — le même « à moitié » que le tour d'avant.
    signatures = []
    for t in tours:
        g = compter(notes, t, [f"jet{i}" for i in range(1, 5)])
        signatures.append((g["bon"], g["moyen"], g["mauvais"]))
    if len(signatures) >= 2 and signatures[-1] == signatures[-2] and signatures[-1][0] == 0:
        lignes.append(f"deux tours de suite donnent le même résultat sans qu'aucune pose n'obéisse "
                      f"({len(tours)} tours faits, trois correctifs) : arrêt, la pose imposée par image "
                      f"n'entre pas dans A0 — le modèle suit la géométrie du guide et lui emprunte la carrure")
    bande = notes.get("bande:jet1", {}).get("note")
    if bande:
        lignes.append(f"la bande de huit appels contre le témoin : {bande} → " + ("le quatrième chemin entre dans A0 comme chemin retenu" if bande == "bon" else "le quatrième chemin n'est pas retenu par cette bande"))
    return lignes


def regle_video(notes: dict) -> list[str]:
    releve = _releve("video")
    # **Le témoin de la vidéo est celui des planches** : les deux A2 de E1,
    # notées par l'auteur là-bas — c'est le chemin qu'on cherche à battre, et
    # le faire renoter ici n'apporterait rien (2 septembre 2026).
    notes_planches = notes_de("references-nommees").get("notes", {})
    temoin = compter(notes_planches, "A2-temoin-art", ["jet1", "jet2"])
    cout_temoin = _cout("taille-reference", "A-temoin")
    prix_temoin = cout_temoin / temoin["bon"] if temoin["bon"] else None
    lignes = [f"témoin (les planches A2 de E1) : {temoin['bon']} bonne(s) sur {temoin['notees']} · "
              f"{_prix_par_bonne(cout_temoin, temoin['bon'])} la bonne planche"]
    for nom in releve.get("_fournisseur", {}).get("modeles", {}):
        # Les clips réellement tirés, pas un nombre écrit d'avance.
        clips = sorted(k for k in releve.get(nom, {}) if k.startswith("clip"))
        if not clips:
            continue
        brute, pixel = compter(notes, nom, clips), compter(notes, f"{nom}~pixel", clips)
        cout = round(sum(float(l.get("cout_usd") or 0) for k, l in releve.get(nom, {}).items() if k.startswith("clip")), 3)
        if not (brute["notees"] or pixel["notees"]):
            lignes.append(f"{nom} : en attente de notes")
            continue
        prix = cout / pixel["bon"] if pixel["bon"] else None
        # « au moins deux bonnes sur quatre » du cahier devient « au moins la
        # moitié », puisque l'auteur tire deux clips par modèle.
        besoin = max(1, -(-len(clips) // 2))
        assez = pixel["bon"] >= besoin
        moins = prix is not None and prix_temoin is not None and prix <= prix_temoin
        lignes.append(f"{nom} : clips utilisables {brute['bon']} / {len(clips)} · bandes pixelisées bonnes "
                      f"{pixel['bon']} / {len(clips)} (il en faut {besoin}) · "
                      f"{_prix_par_bonne(cout, pixel['bon'])} la bonne bande → "
                      + ("bandes pixelisées pas encore notées" if not pixel["notees"] else
                         "chemin candidat pour A0" if assez and moins else
                         "assez de bonnes, mais plus cher que le témoin" if assez else
                         f"moins de {besoin} bonne(s) bande(s) pixelisée(s)")
                      + (" — toutes bonnes : la V3 change de forme" if pixel["bon"] == len(clips) else ""))
        if brute["bon"] >= besoin and pixel["bon"] < besoin:
            lignes.append("    brutes bonnes, pixelisées mauvaises : c'est D2 qui est en cause, pas la vidéo")
    return lignes


# ── Le tableau ───────────────────────────────────────────────────────────────


def main() -> None:
    preparer_sortie()
    resultat: dict = {}
    essais = (
        ("E1", "references-nommees", regle_references_nommees),
        ("E2", "taille-reference", lambda n: regle_taille_reference(n)[0]),
        ("E3", "grille-complete", regle_grille_complete),
        ("E4", "mise-en-pose", regle_mise_en_pose),
        ("E5", "pose-imposee", regle_pose_imposee),
        ("E6", "video", regle_video),
    )
    for code, essai, regle in essais:
        fichier = notes_de(essai)
        notes = fichier.get("notes", {})
        print(f"\n{code} · {essai}" + (f" — séance {fichier.get('seance')}" if fichier else " — aucun relevé (essais/notes-" + essai + ".json)"))
        lignes = regle(notes) if fichier else ["en attente : le rapport n'a pas encore été noté"]
        for l in lignes:
            print("  " + l)
        resultat[essai] = {"seance": fichier.get("seance"), "lignes": lignes}
    SORTIE.write_text(json.dumps(resultat, indent=1, ensure_ascii=False), "utf-8")
    print(f"\n-> {SORTIE}")
    print("Ce tableau applique les règles écrites d'avance dans le cahier ; il ne conclut rien au-delà.")


if __name__ == "__main__":
    main()
