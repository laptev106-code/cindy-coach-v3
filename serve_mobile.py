import http.server
import socketserver
import socket
import sys
import qrcode

# Force UTF-8 stdout on Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

PORT = 8082

def get_wifi_ip():
    # Detect primary local network IP (e.g. 192.168.x.x)
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip.startswith('192.168.'):
                return ip
        # Fallback to standard socket trick
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

local_ip = get_wifi_ip()
url = f"http://{local_ip}:{PORT}/index.html"

print("=" * 64)
print("  CINDY COACH V3 REDESIGN -- МОБИЛЬНЫЙ СЕРВЕР")
print("=" * 64)
print()
print(f"  Локально на ПК:   http://127.0.0.1:{PORT}/index.html")
print(f"  Для телефона:     {url}")
print()
print("  Наведите камеру iPhone / Samsung на QR-код ниже:")
print("-" * 64)

qr = qrcode.QRCode(border=1)
qr.add_data(url)
qr.make(fit=True)
qr.print_ascii(invert=True)

print("-" * 64)
print("  Сервер работает. Для завершения нажмите Ctrl+C.")
print("=" * 64)

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
})

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
