from pathlib import Path

# Rekebisha index.html: ondoa scripts zilizoongezwa nje ya HTML
p = Path("index.html")
s = p.read_text()
end = s.lower().find("</html>")

if end == -1:
    raise SystemExit("ERROR: </html> haijapatikana; hakuna kilichobadilishwa.")

clean_html = s[:end + len("</html>")] + "\n"
if clean_html != s:
    p.write_text(clean_html)
    print("OK: index.html — scripts za ziada zimeondolewa.")
else:
    print("INFO: index.html tayari haina scripts za ziada.")

# Rekebisha server.js: ondoa routes mbili za Resend zisizofanya OTP verification
p = Path("server.js")
s = p.read_text()
marker = "// --- ANSIZA: Resend Integration ---"

if marker in s:
    s = s[:s.index(marker)].rstrip() + "\n"
    p.write_text(s)
    print("OK: server.js — routes za OTP zilizowekwa mwisho zimeondolewa.")
else:
    print("INFO: marker ya Resend haipo; server.js haijabadilishwa.")

print("\nImekamilika. Kagua syntax na tofauti kabla ya push.")
