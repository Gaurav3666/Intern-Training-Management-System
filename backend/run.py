"""Starts the server on the first free port (8000 upwards) and opens the browser.

Run from the backend folder:  python run.py   (add --reload while developing)
Set PORT to start the search somewhere else.
"""
import os
import socket
import sys
import threading
import webbrowser

import uvicorn

HOST = "127.0.0.1"


def free_port(start: int, tries: int = 20) -> int:
    for port in range(start, start + tries):
        with socket.socket() as probe:
            try:
                probe.bind((HOST, port))
            except OSError:
                continue
            return port
    raise SystemExit(f"No free port between {start} and {start + tries - 1}.")


if __name__ == "__main__":
    first = int(os.environ.get("PORT", "8000"))
    port = free_port(first)
    if port != first:
        print(f"Port {first} is in use, using {port} instead.")
    threading.Timer(1.5, webbrowser.open, [f"http://{HOST}:{port}"]).start()
    uvicorn.run("app.main:app", host=HOST, port=port, reload="--reload" in sys.argv)
