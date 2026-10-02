#!/usr/bin/env python3
"""
No-cache HTTP server for local development.
Serves the project root at http://localhost:4173 with
Cache-Control: no-store on every response so browsers
always fetch fresh JSON and JS without a hard reload.
"""
import http.server
import os

PORT = 4173
ROOT = os.path.join(os.path.dirname(__file__), "..")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}  (no-cache)")
        httpd.serve_forever()
