#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


class SpaFallbackHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        self._root_dir = Path(directory).resolve()
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self):
        self._serve_with_fallback()

    def do_HEAD(self):
        self._serve_with_fallback(head_only=True)

    def _serve_with_fallback(self, head_only: bool = False):
        requested_path = unquote(self.path.split("?", 1)[0].split("#", 1)[0])
        if requested_path == "/":
            return super().do_HEAD() if head_only else super().do_GET()

        candidate = (self._root_dir / requested_path.lstrip("/")).resolve()
        inside_root = os.path.commonpath([self._root_dir, candidate]) == str(self._root_dir)
        exists = inside_root and candidate.exists()
        is_asset_request = "." in Path(requested_path).name

        if exists:
            return super().do_HEAD() if head_only else super().do_GET()

        if is_asset_request:
            self.send_error(404, "File not found")
            return

        self.path = "/index.html"
        return super().do_HEAD() if head_only else super().do_GET()


def parse_args():
    parser = argparse.ArgumentParser(description="Serve static SPA assets with history fallback.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5173)
    parser.add_argument("--dir", default="client/dist")
    return parser.parse_args()


def main():
    args = parse_args()
    serve_dir = Path(args.dir).resolve()
    if not serve_dir.exists():
        raise SystemExit(f"Directory not found: {serve_dir}")

    handler = lambda *h_args, **h_kwargs: SpaFallbackHandler(
        *h_args, directory=str(serve_dir), **h_kwargs
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving SPA from {serve_dir} on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
