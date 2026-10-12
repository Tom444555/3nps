# Testserver wie GitHub Pages; existiert die Datei HANG, antwortet er 30 s lang nicht (WLAN ohne Internet)
import http.server, os, time, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/pages'; PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8791
HANG = ROOT + '/HANG'
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(s):
        if os.path.exists(HANG): time.sleep(30)
        return super().do_GET()
    def log_message(s, *a): pass
http.server.ThreadingHTTPServer(('', PORT), H).serve_forever()
