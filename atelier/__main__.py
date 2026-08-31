# -*- coding: utf-8 -*-
"""Lance le serveur, ouvre le navigateur.

    py -m atelier              lance et ouvre l'atelier
    py -m atelier --sans-navigateur
    py -m atelier --port 8123

**Il regarde le port avant de s'y attacher, et c'est un bug payé le 31 août
2026.** Le lanceur annonçait l'adresse et armait le navigateur *avant* de savoir
si le serveur allait démarrer. Quand un atelier tournait déjà — le cas le plus
banal qui soit : on oublie la première fenêtre et l'on relance — la seconde
échouait à prendre le port, mourait aussitôt, et la **dernière ligne écrite était
la bannière de succès**. L'auteur voyait donc l'adresse, la fenêtre se refermait
en une seconde, et rien ne disait ce qui s'était passé.

Trois règles en sont sorties, et elles sont celles du produit entier :

- **on ne dit pas qu'on est ouvert avant de l'être** — la bannière et le
  navigateur attendent que le port soit tenu pour de bon ;
- **ce qui empêche porte sa raison, en clair** — et jamais noyée sous une ligne
  qui dit le contraire. Mesuré ici : `uvicorn` sort tout seul avec le code 3
  quand la liaison échoue, donc le code de sortie était juste depuis le début ;
  ce qui manquait était la phrase qui le traduit, et le temps de la lire ;
- **le produit constate, il ne se plaint pas** : un atelier déjà ouvert n'est pas
  une erreur, c'est la réponse à ce qu'on demandait. On ouvre le sien.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
import threading
import urllib.error
import urllib.request
import webbrowser

import uvicorn

from atelier.api.app import creer_application

HOTE = "127.0.0.1"
PORT = 8420

# Combien de temps on laisse le port répondre avant de conclure qu'il est libre.
# Une demi-seconde sur une boucle locale est déjà mille fois le nécessaire ; ce
# qui compte est de ne jamais faire attendre au démarrage du cas normal.
ATTENTE_PRISE_S = 0.5
ATTENTE_SANTE_S = 1.5


def port_pris(hote: str, port: int) -> bool:
    """Quelque chose écoute-t-il déjà là ?

    On se connecte, on ne se lie pas : se lier pour tester le libérerait juste
    avant que le vrai serveur le demande, et sur Windows la place peut être
    reprise entre les deux.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as prise:
        prise.settimeout(ATTENTE_PRISE_S)
        return prise.connect_ex((hote, port)) == 0


def atelier_repond(adresse: str) -> bool:
    """Est-ce **un atelier** qui tient ce port, ou n'importe quoi d'autre ?

    La distinction change tout ce qu'on dit ensuite : un atelier déjà ouvert,
    c'est ce qu'on voulait — on ouvre le sien. Autre chose, c'est un conflit, et
    il faut choisir un autre port.
    """
    try:
        requete = urllib.request.Request(f"{adresse}/api/health")
        with urllib.request.urlopen(requete, timeout=ATTENTE_SANTE_S) as reponse:
            return json.load(reponse).get("atelier") == "ouvert"
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError):
        # Injoignable, muet, ou bavard en autre chose : ce n'est pas un atelier,
        # et l'ignorer vaut mieux que de deviner ce que c'est.
        return False


# Combien de temps au plus la fenêtre se retient. **Une borne, pas un confort** :
# `isatty` ne suffit pas à savoir si quelqu'un est là — sur Windows le
# périphérique `NUL` se déclare terminal —, et une attente sans borne pendrait
# une tâche planifiée pour toujours. Deux minutes laissent tout le temps de lire
# quatre lignes, et rien ne reste jamais coincé.
ATTENTE_LECTURE_S = 120.0


def retenir_la_fenetre() -> None:
    """Garder la fenêtre ouverte le temps de lire, **sans jamais rester coincé**.

    C'est la moitié qui manquait : une explication parfaite ne sert à rien si la
    fenêtre se referme avant qu'on l'ait lue, et un lanceur double-cliqué se
    referme toujours.

    Deux garde-fous, parce qu'un seul ne tient pas. `isatty` écarte le cas franc
    — une sortie redirigée, un essai —, mais il **ment sur Windows** : mesuré le
    31 août 2026, le périphérique `NUL` s'y déclare terminal. Le second est une
    borne de temps : l'attente vit dans un fil démon, et l'on ne l'accompagne
    que deux minutes. Après quoi l'on ferme, quoi qu'il arrive.
    """
    if not (sys.stdin and sys.stdin.isatty()):
        return

    def attendre() -> None:
        try:
            input("\nAppuie sur Entrée pour fermer cette fenêtre. ")
        except (EOFError, KeyboardInterrupt, OSError, ValueError):
            # Pas d'entrée à lire : il n'y a personne, et l'on ne le savait pas.
            pass

    fil = threading.Thread(target=attendre, daemon=True)
    fil.start()
    fil.join(ATTENTE_LECTURE_S)


def main() -> int:
    # Windows encode en cp1252 dès que la sortie est redirigée : un simple « ── »
    # lève alors un UnicodeEncodeError. Trois lignes en tête, jamais « on verra ».
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")

    arguments = argparse.ArgumentParser(prog="atelier", description="Asset Kitchen")
    arguments.add_argument("--hote", default=HOTE)
    arguments.add_argument("--port", type=int, default=PORT)
    arguments.add_argument("--sans-navigateur", action="store_true")
    options = arguments.parse_args()

    adresse = f"http://{options.hote}:{options.port}"
    ouvrir = None if options.sans_navigateur else lambda: webbrowser.open(adresse)

    # ── Le port est-il déjà tenu ? ───────────────────────────────────────────
    if port_pris(options.hote, options.port):
        if atelier_repond(adresse):
            # **Ce n'est pas une erreur.** On voulait un atelier ouvert : il
            # l'est. On ouvre le sien plutôt que d'en réclamer un second, et
            # l'on sort proprement, sans retenir la fenêtre — il n'y a rien à
            # lire, le navigateur montre déjà la réponse.
            print(f"Un atelier tourne déjà ici — {adresse}", flush=True)
            print("On ouvre celui-là plutôt que d'en lancer un second.", flush=True)
            if ouvrir:
                ouvrir()
            return 0

        print(f"Le port {options.port} est déjà pris, et ce n'est pas un atelier.", flush=True)
        print("Un autre programme l'occupe. Deux façons d'en sortir :", flush=True)
        print("  · fermer ce programme-là, puis relancer l'atelier ;", flush=True)
        print(f"  · ou lancer l'atelier ailleurs : py -m atelier --port {options.port + 1}", flush=True)
        retenir_la_fenetre()
        return 1

    # ── Le port est libre : on ne parle qu'une fois debout ───────────────────
    #
    # La bannière et le navigateur partent depuis le rappel de démarrage
    # d'uvicorn, qui n'est appelé qu'après que le port est **tenu**. Les annoncer
    # avant, c'était promettre une adresse qui pouvait ne jamais répondre.
    serveur = uvicorn.Server(
        uvicorn.Config(
            creer_application(),
            host=options.hote,
            port=options.port,
            log_level="info",
        )
    )

    fini = threading.Event()

    def annoncer() -> None:
        """Attendre que le serveur soit vraiment en écoute, puis parler.

        **On n'attend pas indéfiniment.** Un démarrage qui échoue ne met jamais
        `started` à vrai : sans borne, ce fil tournerait jusqu'à la fin du
        processus pour une bannière qui ne doit surtout pas paraître.
        """
        while not serveur.started:
            if fini.wait(0.05):
                return
        print(f"Asset Kitchen — {adresse}", flush=True)
        if ouvrir:
            ouvrir()

    threading.Thread(target=annoncer, daemon=True).start()

    try:
        serveur.run()
    except OSError as erreur:
        # Le port a été pris entre notre coup d'œil et notre demande — une
        # course rare, mais elle existe, et elle mérite mieux qu'une trace.
        print(f"L'atelier n'a pas pu prendre le port {options.port} : {erreur}", flush=True)
        print(f"Essaie : py -m atelier --port {options.port + 1}", flush=True)
        fini.set()
        retenir_la_fenetre()
        return 1
    except SystemExit as sortie:
        # **Uvicorn sort tout seul quand la liaison échoue**, avec le code 3 et
        # une ligne ERROR — mesuré le 31 août 2026, et c'est ce qui a fait
        # croire que le lanceur « plantait sans rien dire ». Le code est bon ;
        # ce qui manquait est la phrase qui le traduit, et le temps de la lire.
        print(f"L'atelier n'a pas démarré sur le port {options.port}.", flush=True)
        print("La ligne ERROR juste au-dessus dit pourquoi — le plus souvent :", flush=True)
        print("quelque chose occupe déjà ce port.", flush=True)
        print(f"Essaie : py -m atelier --port {options.port + 1}", flush=True)
        fini.set()
        retenir_la_fenetre()
        code = sortie.code
        return code if isinstance(code, int) and code != 0 else 1

    # **Le filet, pour le jour où uvicorn cessera de sortir tout seul.** Rendre
    # zéro après un démarrage qui n'a pas eu lieu est la faute d'origine : le
    # lanceur du bureau se fie au code de sortie pour décider s'il retient sa
    # fenêtre, et il la refermait sur une erreur que personne n'avait lue.
    fini.set()
    if not serveur.started:
        print(f"L'atelier n'a pas démarré sur le port {options.port}.", flush=True)
        print("Regarde la ligne ERROR juste au-dessus : elle dit pourquoi.", flush=True)
        retenir_la_fenetre()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
