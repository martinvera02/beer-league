import os, json, urllib.request, sys

block_type = os.environ.get('BLOCK_TYPE', 'morning')
market_context = os.environ.get('MARKET_CONTEXT', '{}')
gemini_key = os.environ.get('GEMINI_API_KEY', '')
hora = 'MAÑANA' if block_type == 'morning' else 'TARDE'

prompt = (
    f"Eres el redactor jefe de El Heraldo de la Caña, el periódico digital más irreverente, "
    f"sarcástico y divertido de España. Genera el bloque noticioso de {hora}.\n\n"
    f"CONTEXTO DEL MERCADO DE BEBIDAS (precios reales de la app):\n{market_context}\n\n"
    "Genera exactamente 7 artículos. Devuelve SOLO un array JSON válido, sin texto adicional, "
    "sin backticks, sin markdown. Cada artículo con estos campos exactos: "
    "headline, subtitle, category, body, author, featured, icon, chart_data\n\n"
    "REGLAS:\n"
    "- category debe ser uno de: economia, deportes, cotilleo, actualidad, variedades\n"
    "- featured: exactamente 1 articulo con true, el resto false\n"
    "- economia (2 articulos): usa precios REALES del contexto, jerga bursatil absurda, "
    "analistas con nombres como Warren Borracho o Elon Mustiajo. "
    "chart_data = array de 7 enteros coherentes con el precio actual\n"
    "- deportes (2 articulos): parodia nombres reales (Mbienpé, Real Madriz, Bargá, "
    "Vinicius el Tremendo). Drama extremo. chart_data = null\n"
    "- cotilleo (1 articulo): usa USERNAMES REALES del campo active_users. "
    "Estilo Lecturas/Hola con alcohol. chart_data = null\n"
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
except Exception as e:
    print(f"Error llamando a Gemini: {e}", file=sys.stderr)
    sys.exit(1)

text = data['candidates'][0]['content']['parts'][0]['text'].strip()
if text.startswith('```'):
    text = text.split('\n', 1)[1]
    text = text.rsplit('```', 1)[0].strip()

articles = json.loads(text)
print(f"Generados {len(articles)} articulos", file=sys.stderr)

github_output = os.environ.get('GITHUB_OUTPUT', '')
if github_output:
    with open(github_output, 'a') as f:
        f.write("articles<<ENDARTICLES\n")
        f.write(json.dumps(articles))
        f.write("\nENDARTICLES\n")
else:
    print(json.dumps(articles, ensure_ascii=False, indent=2))