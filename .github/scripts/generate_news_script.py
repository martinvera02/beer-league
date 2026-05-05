import os, json, urllib.request, sys

block_type = os.environ.get('BLOCK_TYPE', 'morning')
market_context = os.environ.get('MARKET_CONTEXT', '{}')
gemini_key = os.environ.get('GEMINI_API_KEY', '')
hora = 'MANANA' if block_type == 'morning' else 'TARDE'

prompt = (
    f"Eres el redactor jefe de El Heraldo de la Cana, el periodico digital mas irreverente, "
    f"sarcastico y divertido de Espana. Genera el bloque noticioso de {hora}.\n\n"
    f"CONTEXTO DE LA APP (datos reales):\n{market_context}\n\n"
    "El campo 'drinks' contiene las bebidas del juego con sus puntos. "
    "Usa esos puntos como si fueran cotizaciones bursatiles (mas puntos = cotiza mas alto).\n"
    "El campo 'active_users' tiene los usuarios mas activos.Usalos en el cotilleo.\n"
    "El campo 'top_ranking' tiene el ranking global actual.\n\n"
    "Genera exactamente 7 articulos. Devuelve SOLO un array JSON valido, "
    "sin texto adicional, sin backticks, sin markdown.\n"
    "Cada articulo con estos campos: headline, subtitle, category, body, author, featured, icon, chart_data\n\n"
    "REGLAS:\n"
    "- category: economia, deportes, cotilleo, actualidad o variedades\n"
    "- featured: exactamente 1 con true, resto false\n"
    "- economia (2 articulos): los puntos de las bebidas SON el precio de bolsa. "
    "Jerga bursatil absurda. Analistas: Warren Borracho, Elon Mustiajo, Soros del Chupito. "
    "chart_data = array de 7 enteros coherentes con los puntos de esa bebida\n"
    "- deportes (2 articulos): parodia nombres reales: "
    "Mbienpé, Real Madriz, Bargá, Vinicius el Tremendo, Arlaingui, Maldriní. Drama extremo. chart_data = null\n"
    "- cotilleo (1 articulo): usa los usernames REALES de active_users. "
    "Estilo Lecturas con alcohol, inventado y disparatado. chart_data = null\n"
    "- actualidad (1 articulo): noticia real reinterpretada con sarcasmo maximo. chart_data = null\n"
    "- variedades (1 articulo): horoscopo alcoholico o prediccion del tiempo dramatica. chart_data = null"
)

payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
        "temperature": 0.95,
        "maxOutputTokens": 4000,
        "responseMimeType": "application/json"
    }
}

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Error HTTP {e.code}: {body}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)

try:
    text = data['candidates'][0]['content']['parts'][0]['text'].strip()
except (KeyError, IndexError) as e:
    print(f"Respuesta inesperada de Gemini: {json.dumps(data)}", file=sys.stderr)
    sys.exit(1)

if text.startswith('```'):
    text = text.split('\n', 1)[1]
    text = text.rsplit('```', 1)[0].strip()

try:
    articles = json.loads(text)
except json.JSONDecodeError as e:
    print(f"JSON invalido: {e}\nTexto: {text[:500]}", file=sys.stderr)
    sys.exit(1)

print(f"Generados {len(articles)} articulos", file=sys.stderr)

github_output = os.environ.get('GITHUB_OUTPUT', '')
if github_output:
    with open(github_output, 'a') as f:
        f.write("articles<<ENDARTICLES\n")
        f.write(json.dumps(articles))
        f.write("\nENDARTICLES\n")
else:
    print(json.dumps(articles, ensure_ascii=False, indent=2))