from pathlib import Path
import re
import sys

ROOT = Path.cwd()

CSS = r"""
/* Mchezo Wetu — Neon Green Glass Responsive Design */
:root {
  color-scheme: dark;
  --bg: #07100c;
  --panel: rgba(17, 31, 24, .88);
  --panel2: #101e17;
  --green: #7cff6b;
  --green2: #31e981;
  --text: #f2fff5;
  --muted: #91a99a;
  --border: rgba(124,255,107,.17);
  --radius: 20px;
  --shadow: 0 16px 50px rgba(0,0,0,.28);
}
* { box-sizing: border-box; }
html { min-height: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(ellipse at 8% 0%, rgba(49,233,129,.12), transparent 35%),
    radial-gradient(ellipse at 95% 15%, rgba(124,255,107,.08), transparent 30%),
    var(--bg);
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  line-height: 1.6;
}
button, input, select, textarea { font: inherit; }
button, a { -webkit-tap-highlight-color: transparent; }
a { color: var(--green); }
button {
  cursor: pointer;
  transition: transform .2s ease, filter .2s ease, border-color .2s ease;
}
button:hover { filter: brightness(1.12); }
button:active { transform: scale(.98); }
input, select, textarea {
  width: 100%;
  min-height: 45px;
  padding: 12px 14px;
  color: var(--text);
  background: rgba(4,13,8,.8);
  border: 1px solid var(--border);
  border-radius: 12px;
  outline: none;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(124,255,107,.1);
}
label { display: block; margin-bottom: 7px; color: #c7dfce; }
button, .btn, [type=submit] {
  border-radius: 12px;
}
.btn-primary, button.primary, .primary-btn,
button[type=submit], input[type=submit] {
  color: #061109;
  background: linear-gradient(135deg, var(--green), var(--green2));
  border: 0;
  font-weight: 800;
}
table { width: 100%; border-collapse: collapse; }
th, td { padding: 13px 15px; border-bottom: 1px solid var(--border); text-align: left; }
th { color: var(--green); font-size: .82rem; text-transform: uppercase; letter-spacing: .05em; }
tr:hover td { background: rgba(124,255,107,.035); }
img { max-width: 100%; }
header, nav, aside, main, section, footer { min-width: 0; }
header, nav, aside {
  border-color: var(--border);
}
header {
  background: rgba(7,16,12,.88);
  backdrop-filter: blur(18px);
}
nav a, aside a {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 13px;
  border-radius: 12px;
  color: #c8d9ce;
  text-decoration: none;
  transition: .2s ease;
}
nav a:hover, aside a:hover, nav a.active, aside a.active {
  color: var(--green);
  background: rgba(124,255,107,.09);
}
main, .container, .dashboard, .dashboard-content, .main-content {
  min-width: 0;
}
.card, .panel, .stat-card, .stat-box, .settings-card,
.profile-card, .payment-card, .contribution-card, .content-card,
[class*="card"], [class*="panel"] {
  border-color: var(--border);
}
.card, .panel, .stat-card, .stat-box, .settings-card,
.profile-card, .payment-card, .contribution-card, .content-card {
  background: linear-gradient(145deg, rgba(20,39,28,.92), rgba(10,22,15,.92));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
h1, h2, h3 { line-height: 1.25; letter-spacing: -.025em; }
h1 { font-size: clamp(1.65rem, 4vw, 2.5rem); }
h2 { font-size: clamp(1.2rem, 3vw, 1.65rem); }
small, .muted, .subtitle, .description { color: var(--muted); }
.badge, .status, .chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(124,255,107,.08);
  color: var(--green);
  font-size: .8rem;
}
button:not([type=submit]) {
  border-color: var(--border);
}
hr { border: 0; border-top: 1px solid var(--border); }
table { display: table; }
.table-wrap, .table-responsive, .overflow-auto {
  max-width: 100%;
  overflow-x: auto;
  border-radius: 14px;
}
::-webkit-scrollbar { width: 7px; height: 7px; }
::-webkit-scrollbar-thumb { background: #31523b; border-radius: 99px; }
:focus-visible { outline: 2px solid var(--green); outline-offset: 3px; }
@media (max-width: 1050px) {
  .sidebar, aside { max-width: 100%; }
  .dashboard-layout, .admin-layout { grid-template-columns: 1fr !important; }
  .stats-grid, .stats, .stat-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
}
@media (max-width: 720px) {
  body { font-size: 14px; }
  main, .container, .dashboard-content, .main-content {
    width: 100% !important;
    max-width: 100% !important;
    padding-left: 14px !important;
    padding-right: 14px !important;
  }
  header { padding-left: 14px; padding-right: 14px; }
  .sidebar, aside {
    width: 100% !important;
    position: relative !important;
    height: auto !important;
  }
  .stats-grid, .stats, .stat-grid, .grid-2, .grid-3, .grid-4 {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  }
  .card, .panel, .stat-card, .stat-box, .settings-card,
  .profile-card, .payment-card, .contribution-card, .content-card {
    border-radius: 16px;
  }
  table { min-width: 600px; }
  form { max-width: 100%; }
  button, .btn, [type=submit] { max-width: 100%; }
}
@media (max-width: 390px) {
  main, .container, .dashboard-content, .main-content {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }
  .stats-grid, .stats, .stat-grid, .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr !important;
  }
}
"""

def redesign(name):
    path = ROOT / name
    if not path.exists():
        print(f"IMEKOSA: {name} haipo kwenye {ROOT}")
        return False

    original = path.read_text(encoding="utf-8")
    updated = original

    # Ondoa nakala za CSS ya redesign ya awali tu, si scripts wala HTML.
    updated = re.sub(
        r"/\*\s*Mchezo Wetu\s*[—-]\s*Neon Green Glass Responsive Design\s*\*/.*?(?=</style>)",
        "",
        updated,
        flags=re.I | re.S
    )

    # Badilisha CSS ya zamani kwa kuweka CSS mpya ndani ya head.
    style = "<style>\n" + CSS + "\n</style>"
    if re.search(r"</head\s*>", updated, re.I):
        # Ondoa style blocks za zamani ili kuzuia CSS zilizokinzana.
        updated = re.sub(r"<style\b[^>]*>.*?</style\s*>", "", updated, flags=re.I | re.S)
        updated = re.sub(r"</head\s*>", style + "\n</head>", updated, count=1, flags=re.I)
    else:
        print(f"IMEKOSA: {name} haina </head>; hakuna kilichobadilishwa kwenye faili hili.")
        return False

    # Hakikisha viewport ipo kwa muonekano wa simu.
    viewport = re.search(r'<meta\b[^>]*name=["\']viewport["\'][^>]*>', updated, re.I)
    if not viewport:
        updated = re.sub(
            r"<head\b[^>]*>",
            lambda m: m.group(0) + '\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
            updated, count=1, flags=re.I
        )

    if updated == original:
        print(f"TAARIFA: {name} haijabadilika.")
        return True

    path.write_text(updated, encoding="utf-8")
    print(f"OK: {name} imewekewa muonekano mpya.")
    return True

def main():
    for name in ("dashboard.html", "admin.html"):
        if not redesign(name):
            sys.exit(1)
    print("\nImekamilika. HTML na JavaScript za login, Supabase na malipo zimeachwa; CSS ya muonekano ndiyo imebadilishwa.")

if __name__ == "__main__":
    main()
