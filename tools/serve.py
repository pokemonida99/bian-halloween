# 開發用伺服器：不讓瀏覽器快取（改完重新整理就是新的）；python3 tools/serve.py [port]
import http.server, sys, os, functools
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4530
http.server.ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
