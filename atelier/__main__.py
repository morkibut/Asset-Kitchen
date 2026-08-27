# -*- coding: utf-8 -*-
"""Lance le serveur, ouvre le navigateur.

    py -m atelier              lance et ouvre l'atelier
    py -m atelier --sans-navigateur
    py -m atelier --port 8123
"""

from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

import uvicorn

from atelier.api.app import creer_application

HOTE = "127.0.0.1"
PORT = 8420


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
    if not options.sans_navigateur:
        threading.Timer(1.0, lambda: webbrowser.open(adresse)).start()

    print(f"Asset Kitchen — {adresse}")
    uvicorn.run(
        creer_application(),
        host=options.hote,
        port=options.port,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
