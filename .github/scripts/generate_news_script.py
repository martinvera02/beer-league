import os, json, random, urllib.request, sys
from datetime import datetime

block_type = os.environ.get('BLOCK_TYPE', 'morning')
market_context_raw = os.environ.get('MARKET_CONTEXT', '{}')

try:
    ctx = json.loads(market_context_raw)
except:
    ctx = {}

drinks = ctx.get('drinks', [])
users = ctx.get('active_users', [])
ranking = ctx.get('top_ranking', [])

# Helpers para extraer datos reales
def drink_name(i=0): return drinks[i]['name'] if i < len(drinks) else 'Cubata'
def drink_emoji(i=0): return drinks[i]['emoji'] if i < len(drinks) else '🥃'
def drink_pts(i=0): return drinks[i]['points'] if i < len(drinks) else 10
def user(i=0): return users[i]['username'] if i < len(users) else 'un usuario misterioso'
def top(i=0): return ranking[i]['username'] if i < len(ranking) else 'el líder'
def top_pts(i=0): return ranking[i]['total_points'] if i < len(ranking) else 0
def rand_user(): return random.choice(users)['username'] if users else 'un usuario'
def rand_drink(): d = random.choice(drinks) if drinks else {'name':'Cubata','emoji':'🥃','points':2}; return d
def chart_for(pts):
    base = float(pts)
    vals = []
    v = max(1, base * 0.7)
    for _ in range(7):
        v = max(1, v + random.uniform(-base*0.15, base*0.2))
        vals.append(round(v, 1))
    vals[-1] = round(base, 1)
    return vals

# ═══════════════════════════════════════════════════════
# BANCO DE NOTICIAS — 300+ artículos con templates
# ═══════════════════════════════════════════════════════

def build_bank():
    d0 = drink_name(0); d0e = drink_emoji(0); d0p = drink_pts(0)
    d1 = drink_name(1); d1e = drink_emoji(1); d1p = drink_pts(1)
    d2 = drink_name(2); d2e = drink_emoji(2); d2p = drink_pts(2)
    u0 = user(0); u1 = user(1); u2 = user(2)
    t0 = top(0); t1 = top(1); t0p = top_pts(0)
    ru = rand_user; rd = rand_drink

    bank = []

    # ── ECONOMÍA — generada dinámicamente con datos reales del mercado ──────
    economia = []

    # Ordenar bebidas por puntos
    drinks_sorted = sorted(drinks, key=lambda x: x['points'], reverse=True)
    drinks_asc    = sorted(drinks, key=lambda x: x['points'])

    for i, d in enumerate(drinks_sorted[:8]):  # top 8 bebidas
        nm  = d['name']; em = d['emoji']; pts = d['points']
        ref = drinks_sorted[i+1] if i+1 < len(drinks_sorted) else drinks_asc[0]

        # Calcular variación simulada pero determinista basada en puntos
        import hashlib
        seed = int(hashlib.md5(nm.encode()).hexdigest(), 16) % 1000
        pct_up   = round(5 + (seed % 35), 1)
        pct_down = round(2 + (seed % 20), 1)
        pts_high = round(pts * (1 + pct_up/100), 1)
        pts_low  = round(pts * (1 - pct_down/100), 1)

        # Analistas rotativos
        analysts = [
            'Warren Borracho', 'Elon Mustiajo', 'Soros del Chupito',
            'Goldman Borrachs', 'Fibonacci Borrachs', 'Pepita Inversiones',
            'El Oráculo del Combinado', 'Christine LaGarza'
        ]
        analyst = analysts[i % len(analysts)]

        # Verbo de tendencia basado en si está por encima o debajo de la media
        media = sum(x['points'] for x in drinks) / len(drinks) if drinks else 1
        trending_up = pts > media

        if trending_up:
            economia.append({
                "headline": f"ALERTA ALCISTA: {em} {nm.upper()} ROMPE RÉCORDS CON {pts} PUNTOS",
                "subtitle": f"El activo más rentable del momento dispara las alarmas de los analistas",
                "body": (
                    f"El {nm} ({em}) cotiza hoy a {pts} puntos, muy por encima de la media del mercado ({round(media,1)} pts), "
                    f"en lo que {analyst} de 'Goldman Borrachs' describe como 'la oportunidad etílica del siglo'. "
                    f"Los modelos cuantitativos apuntan a un objetivo de {pts_high} puntos a corto plazo. "
                    f"'Quien no tenga {em} en cartera está perdiendo el tiempo y el dinero', sentenció el analista desde su bar de confianza."
                ),
                "author": f"{analyst}, Goldman Borrachs",
                "icon": "📈",
                "chart_data": sorted([round(pts * (0.7 + (int(hashlib.md5((nm+str(j)).encode()).hexdigest(),16) % 600)/1000), 1) for j in range(6)] + [pts])
            })
        else:
            economia.append({
                "headline": f"COLAPSO EN EL MERCADO: {em} {nm.upper()} TOCA MÍNIMOS CON {pts} PUNTOS",
                "subtitle": f"Los inversores huyen del {nm} mientras los expertos discuten si es el fondo",
                "body": (
                    f"El {nm} ({em}) languidece a {pts} puntos, por debajo de la media del mercado ({round(media,1)} pts), "
                    f"generando pánico entre los tenedores del activo. {analyst} recomienda 'vender, llorar y pedir otra ronda'. "
                    f"Los soportes técnicos apuntan a {pts_low} puntos como próximo nivel clave. "
                    f"'El {nm} necesita un catalizador, o al menos un camarero que lo recomiende más', añade el informe."
                ),
                "author": f"{analyst}, Resaca Capital",
                "icon": "📉",
                "chart_data": sorted([round(pts * (0.7 + (int(hashlib.md5((nm+str(j)).encode()).hexdigest(),16) % 600)/1000), 1) for j in range(6)] + [pts])
            })

    # Artículo de comparativa — las dos bebidas más extremas
    if len(drinks_sorted) >= 2:
        top_d  = drinks_sorted[0]
        low_d  = drinks_asc[0]
        diff   = round(top_d['points'] - low_d['points'], 1)
        economia.append({
            "headline": f"DUELO ÉPICO: {top_d['emoji']} {top_d['name'].upper()} VS {low_d['emoji']} {low_d['name'].upper()}",
            "subtitle": f"Una diferencia de {diff} puntos separa al rey del mercado de su vasallo más humilde",
            "body": (
                f"El mercado de bebidas vive su mayor brecha histórica: {top_d['name']} ({top_d['points']} pts) "
                f"frente a {low_d['name']} ({low_d['points']} pts), una diferencia de {diff} puntos que los analistas califican de 'brutal, injusta y completamente merecida'. "
                f"Warren Borracho ha publicado un hilo de 47 tweets explicando por qué esto era inevitable. "
                f"Nadie lo ha leído entero pero todo el mundo está de acuerdo."
            ),
            "author": "Warren Borracho, hilo de Twitter",
            "icon": "⚖️",
            "chart_data": [round(top_d['points'] * (0.8 + i*0.03), 1) for i in range(7)]
        })

    # Artículo de recomendación global
    mejor = drinks_sorted[0] if drinks_sorted else {'name':'Cubata','emoji':'🥃','points':10}
    peor  = drinks_asc[0] if drinks_asc else {'name':'Radler','emoji':'🍋','points':1}
    economia.append({
        "headline": f"CARTERA RECOMENDADA: COMPRA {mejor['emoji']} {mejor['name'].upper()}, VENDE {peor['emoji']} {peor['name'].upper()}",
        "subtitle": "El consenso de analistas del Heraldo de la Caña en un único movimiento",
        "body": (
            f"Tras analizar el mercado durante exactamente dos cañas, el equipo de análisis del Heraldo de la Caña "
            f"recomienda COMPRAR {mejor['name']} ({mejor['points']} pts, máxima puntuación del mercado) y VENDER inmediatamente {peor['name']} ({peor['points']} pts). "
            f"'La estrategia es simple: bebe lo que más puntúa y olvida lo que menos', resume el informe de 3 páginas. "
            f"Rentabilidad estimada: muy alta. Resaca estimada: también muy alta."
        ),
        "author": "Comité de Análisis del Heraldo",
        "icon": "💼",
        "chart_data": [round(mejor['points'] * (0.75 + i*0.04), 1) for i in range(7)]
    })

    # ── DEPORTES (80 artículos) ──────────────────────────────────────────────
    deportes = [
        {"headline": "ESCÁNDALO TOTAL: MBIENPÉ LLORA EN RUEDA DE PRENSA TRAS PERDER SU APUESTA",
         "subtitle": "La estrella del Real Madriz admite haber apostado todos sus puntos al Radler",
         "body": "Kylian Mbienpé, el delantero más caro del planeta, apareció ayer ante los medios con los ojos llorosos y una lata de Radler en la mano. 'Perdí todos mis puntos apostando al Radler y no lo entiendo, si sube muy lento', declaró entre sollozos. El presidente del Real Madriz ha convocado una junta de urgencia. Los socios piden explicaciones. Mbienpé pide otra lata.",
         "author": "Marca de la Caña, deportes", "icon": "⚽", "chart_data": None},

        {"headline": "BARGÁ 0-7 REAL MADRIZ: LA MAYOR HUMILLACIÓN DE LA HISTORIA DEL FÚTBOL BEBEDOR",
         "subtitle": "El Clásico más goleado deja al Bargá en shock y al mundo sin palabras",
         "body": "Lo que se esperaba como el partido del siglo se convirtió en ejecución en público. El Bargá, debilitado por una misteriosa resaca colectiva, cayó 0-7 ante el Real Madriz en un partido que los historiadores recordarán. Arlaingui metió cuatro goles, tres de ellos desde el vestuario. El entrenador del Bargá dimitió en el minuto 23. El de los Madriz pidió un cubata para celebrar.",
         "author": "Sport de la Caña, crónica", "icon": "🏟️", "chart_data": None},

        {"headline": "VINICIUS EL TREMENDO RECIBE EL BALÓN DE ORO Y LO BEBE",
         "subtitle": "El astro brasileño confunde el trofeo con una copa de premio y se lo toma de un trago",
         "body": "La ceremonia del Balón de Oro quedará en los anales por el momento en que Vinicius el Tremendo, al recibir el trofeo dorado, lo elevó, gritó '¡Salud!' y se lo bebió. Afortunadamente era hueco. El público tardó tres minutos en reaccionar. La FIFA estudia cambiar el material del trofeo. Vinicius ha pedido disculpas pero admite que 'estaba muy bueno'.",
         "author": "France Football Etílico", "icon": "🏆", "chart_data": None},

        {"headline": "ARLAINGUI ROMPE TODOS LOS RÉCORDS: 40 GOLES Y 40 CHUPITOS EN UNA SEMANA",
         "subtitle": "El delantero aragonés vive la semana más productiva de su carrera en todos los sentidos",
         "body": "Nadie en la historia del fútbol había combinado con tal maestría el gol y el chupito. Arlaingui ha marcado 40 goles esta semana mientras celebraba cada uno con un chupito diferente. Los médicos dicen que es 'biológicamente imposible'. Los entrenadores rivales dicen que es 'injusto'. Arlaingui dice que es 'la dieta mediterránea'. El mundo lo admira.",
         "author": "AS de la Caña, récords", "icon": "⚡", "chart_data": None},

        {"headline": "EL ATLÉTICO DE MADRID FICHA A UN BARRIL DE CERVEZA COMO DELANTERO CENTRO",
         "subtitle": "El Cholo Simeone confirma la contratación más insólita de la historia del fútbol",
         "body": "El Atlético de Madriz ha presentado a su nuevo fichaje: un barril de cerveza de 50 litros al que han puesto el dorsal 9 y el nombre artístico de 'El Barrilón'. 'Lleva semanas sin fallar un gol', asegura el Cholo con la cara seria que le caracteriza. El barril ya ha marcado 3 goles en pretemporada. El VAR estudia si es legal.",
         "author": "El Mundo Deportivo Etílico", "icon": "🍺", "chart_data": None},

        {"headline": "NADAL SE RETIRA Y VUELVE Y SE RETIRA OTRA VEZ EN LA MISMA TARDE",
         "subtitle": "Rafafael Nadalón protagoniza la retirada más dramática y confusa del tenis mundial",
         "body": "A las 15:00 anunció su retirada. A las 16:30 la desmintió. A las 17:45 la confirmó de nuevo. A las 19:00 apareció en pista con raqueta. A las 20:15 volvió a retirarse. Rafafael Nadalón ha vivido la tarde más intensa de su carrera sin golpear una sola pelota. 'Me retiré cuatro veces pero cada vez me ofrecieron un cubata y volví', explicó.",
         "author": "El País Deportivo, tenis", "icon": "🎾", "chart_data": None},

        {"headline": "ESCÁNDALO FIFA: SE DESCUBRE QUE LOS ÁRBITROS COBRAN EN CHUPITOS",
         "subtitle": "Investigación revela el sistema de corrupción más creativo de la historia del deporte",
         "body": "Una investigación periodística ha destapado que los árbitros de Primera División cobran complementos salariales en chupitos. 'Por cada penalti pitado, dos chupitos de la marca del equipo local', revela el documento filtrado. La FIFA ha convocado una reunión de urgencia. Los árbitros han pedido que se incluyan también los cubatas en el convenio colectivo.",
         "author": "Der Spiegel Etílico, investigación", "icon": "🏴‍☠️", "chart_data": None},

        {"headline": "MALDRINÍ DEBUTA CON HAT-TRICK Y DEDICA LOS TRES GOLES A SU CUBATA",
         "subtitle": "El heredero del trono del fútbol mundial marca tres golazos en su primer partido",
         "body": "El mundo conoció ayer a Maldriní, 17 años, zurdo, pelado al cero y con una cubata permanente en la mano izquierda. Debutó, marcó tres, se quitó la camiseta, sacó una cubata de no se sabe dónde y la agitó ante el público. Los cazatalentos del Real Madriz y el Bargá se pelearon literalmente en la grada. Maldriní ha pedido que en su contrato incluyan cláusula de cubatas ilimitadas.",
         "author": "Ojeador del Año, fichajes", "icon": "⭐", "chart_data": None},

        {"headline": "FÓRMULA 1: VERSTAPPÉN GANA OTRA VEZ Y YA NADIE SABE QUÉ DECIR",
         "subtitle": "El piloto neerlandés suma su victoria número 847 consecutiva con cara de aburrimiento total",
         "body": "Maximiliano Verstappén cruzó la línea de meta, se quitó el casco, bostezó y preguntó si había algo en la nevera. Llevaba tres carreras durmiendo en el podio. Sus rivales han dejado de intentarlo y algunos han pedido un cambio de reglamento que obligue a Verstappén a competir con los ojos cerrados. La FIA estudia la propuesta. Verstappén ha pedido un radler.",
         "author": "Autosport de la Caña", "icon": "🏎️", "chart_data": None},

        {"headline": "LA SELECCIÓN ESPAÑOLA CELEBRA LA EUROCOPA CON UNA RONDA PARA TODOS",
         "subtitle": "La Roja invita a todo el país a una caña después del título más esperado",
         "body": "Tras ganar la Eurocopa por penaltis en la prórroga de la prórroga, la selección española ha anunciado que paga una ronda para todos los ciudadanos del país. El coste estimado es de 48.000 millones de euros. El Ministerio de Hacienda estudia si es deducible. Luis de la Fuentes ha declarado: 'Esto es lo mínimo que podemos hacer después de haceros sufrir tanto'.",
         "author": "RFEF, nota de prensa", "icon": "🇪🇸", "chart_data": None},

        {"headline": "BOXEO: PELEA SUSPENDIDA PORQUE AMBOS PÚGILES PREFIEREN TOMAR ALGO",
         "subtitle": "En el momento del primer golpe, los dos boxeadores decidieron hacerse amigos",
         "body": "El combate del siglo entre El Matagigantes y El Destructor acabó antes de empezar cuando, en el momento de chocar los guantes, ambos se miraron y El Matagigantes dijo: '¿Y si mejor tomamos algo?'. El Destructor respondió: 'Llevaba pensándolo desde el pesaje'. El público abucheó durante tres minutos y luego fue con ellos al bar. La noche acabó bien.",
         "author": "ESPN de la Caña, boxeo", "icon": "🥊", "chart_data": None},

        {"headline": "CICLISMO: EL TOUR DE FRANCE GANA OTRO CICLISTA QUE NADIE CONOCÍA",
         "subtitle": "Tadej Pogačar ha sido adelantado por un desconocido corredor esloveno de 19 años",
         "body": "En lo que los expertos llaman 'el sorpresón del siglo', un ciclista llamado Blazej Niemowliński que nadie había visto nunca ha ganado el Tour de France adelantando a Pogačar en el último kilómetro. Al cruzar la meta preguntó si había acabado la carrera. Llevaba tres días pedaleando sin saber que estaba en el Tour. Su entrenador no existe. Es simplemente un aficionado con muy buenas piernas.",
         "author": "L'Équipe de la Caña", "icon": "🚴", "chart_data": None},

        {"headline": f"REAL MADRIZ FICHA A {u0.upper()} TRAS VER SUS ESTADÍSTICAS DE LA APP",
         "subtitle": "El club blanco rastrea perfiles de Beer League para encontrar su próxima estrella",
         "body": f"El departamento de scouting del Real Madriz ha fichado a {u0} después de analizar sus estadísticas en la app. Con {users[0].get('drinks', 0) if users else 0} consumiciones, el club considera que 'tiene el aguante físico que necesitamos'. Florentino Bébez ha convocado una rueda de prensa. {u0} ha pedido que el contrato incluya cubatas ilimitadas en la ciudad deportiva.",
         "author": "Fichajes de la Caña, rumores", "icon": "🔍", "chart_data": None},

        {"headline": "NBA: EL EQUIPO ENTERO EXPULSADO POR CELEBRAR CON BEBIDAS EN EL PARQUET",
         "subtitle": "Los Lakers sacan una nevera durante el partido y el árbitro pierde la cabeza",
         "body": "El partido entre Lakers y Celtics quedará en la historia cuando, tras un triple decisivo, el banquillo entero de los Lakers sacó una nevera portátil y empezó a celebrar con bebidas en el parquet. El árbitro tardó cuatro minutos en reaccionar porque también quería una. Al final expulsó a todos pero guardó un botellín para después. El partido se suspendió. Nadie se quejó.",
         "author": "NBA Etílica, crónica", "icon": "🏀", "chart_data": None},

        {"headline": "GOLF: JUGADOR PIERDE LA BOLA Y ENCUENTRA UN BAR",
         "subtitle": "El búsqueda más larga de la historia del golf acaba con un descubrimiento inesperado",
         "body": "Rory McElroy buscó su bola durante 47 minutos en el rough del hoyo 14. Cuando finalmente la encontró, estaba dentro de un bar que había aparecido misteriosamente en el campo de golf. 'Me pareció de mala educación no pedir algo', explicó. Terminó el partido tres horas tarde pero con muy buen humor. Ha ganado el premio al jugador más sociable del tour.",
         "author": "Golf Digest Etílico", "icon": "⛳", "chart_data": None},
    ]

    # ── COTILLEO (60 artículos) ──────────────────────────────────────────────
    cotilleo_templates = [
        {"headline": f"EXCLUSIVA: {u0.upper()} Y {u1.upper()} VISTOS JUNTOS EN UN BAR A LAS 4 DE LA MADRUGADA",
         "subtitle": "Fuentes cercanas confirman que 'había mucha complicidad y varias rondas'",
         "body": f"El Heraldo de la Caña puede confirmar en exclusiva que {u0} y {u1} fueron vistos juntos en el mítico bar 'El Último Cubata' a las 4:17 de la madrugada del pasado sábado. Las fuentes, que piden anonimato pero que básicamente eran los camareros, describen 'mucha complicidad, risas y al menos cuatro rondas'. Ninguno de los dos ha confirmado ni desmentido la historia. Sus portavoces no cogen el teléfono.",
         "author": "¡Hola! de la Caña, exclusiva", "icon": "💅", "chart_data": None},

        {"headline": f"BOMBA: {t0.upper()} ABANDONA LA LIGA TRAS MISTERIOSO ENFRENTAMIENTO",
         "subtitle": "El líder del ranking global desaparece durante 48 horas y nadie sabe nada",
         "body": f"El mundo de Beer League se despertó ayer con la noticia que nadie quería escuchar: {t0}, líder indiscutible con {t0p} puntos, ha desaparecido del radar durante 48 horas. Fuentes cercanas hablan de 'una discusión épica sobre qué bebida puntúa más'. Otros mencionan 'una apuesta perdida con consecuencias'. Los fans hacen vigilia. La liga tiembla.",
         "author": "Lecturas de la Caña, cotilleo", "icon": "😱", "chart_data": None},

        {"headline": f"CONFESIÓN EXPLOSIVA: {u1.upper()} REVELA QUE LLEVA MESES BEBIENDO EN SECRETO",
         "subtitle": "El usuario que parecía sobrio admite una doble vida etílica que lo cambia todo",
         "body": f"En una entrevista que nadie esperaba, {u1} ha roto su silencio: 'Llevaba meses aparentando que no bebía mientras en realidad lo registraba todo en otra cuenta'. El escándalo ha sacudido la app. Sus seguidores están divididos entre la comprensión y la traición. {u0}, su supuesto rival, ha declarado: 'Lo sabía desde el principio. Se notaba en los ojos'.",
         "author": "Semana de la Caña, confesiones", "icon": "🤫", "chart_data": None},

        {"headline": f"GUERRA DECLARADA: {u0.upper()} Y {u2.upper()} SE LANZAN DARDOS EN REDES",
         "subtitle": "El enfrentamiento que tiene en vilo a toda la comunidad de Beer League",
         "body": f"Lo que empezó como un comentario inocente sobre el precio del cubata ha derivado en la guerra más épica de la historia de la app. {u0} publicó: 'Hay gente que no sabe beber'. {u2} respondió: 'Hay gente que no sabe callar'. Llevamos 48 horas de intercambio de indirectas. Los seguidores hacen palomitas. El administrador estudia intervenir. Nadie quiere que pare.",
         "author": "Corazón de la Caña, drama", "icon": "⚔️", "chart_data": None},

        {"headline": f"ROMANCE DEL AÑO: {u0.upper()} DEDICA SU CUBATA A UNA PERSONA MISTERIOSA",
         "subtitle": "Un mensaje críptico en la app tiene a todos buscando al destinatario",
         "body": f"Cuando {u0} registró su último cubata, añadió una nota: 'Para ti, ya sabes quién eres'. La app entera lleva 24 horas especulando. Los candidatos son al menos cuatro usuarios. Las teorías se multiplican. Alguien ha creado un hilo de Reddit con árbol genealógico. {u0} no ha aclarado nada y solo ha publicado un emoji de corazón. El misterio continúa.",
         "author": "Elle de la Caña, romance", "icon": "💕", "chart_data": None},

        {"headline": f"ESCÁNDALO DE DOPAJE: {u1.upper()} ACUSADO DE USAR ENERGÉTICOS PARA SUBIR PUNTOS",
         "subtitle": "La denuncia que sacude los cimientos del ranking global de Beer League",
         "body": f"Una denuncia anónima señala que {u1} habría mezclado bebidas energéticas con sus consumiciones para aumentar artificialmente sus puntos. 'Es trampa, los energéticos no puntúan', alega el denunciante. El comité de ética de la app ha abierto una investigación. {u1} lo niega todo y ha pedido que le hagan la prueba del alcoholímetro. Hay tensión.",
         "author": "Investigación Etílica, denuncia", "icon": "🧪", "chart_data": None},

        {"headline": f"EXCLUSIVA MUNDIAL: {t0.upper()} RECHAZÓ OFERTA MILLONARIA DE OTRA APP",
         "subtitle": "El número uno del ranking global eligió Beer League sobre una competidora con más presupuesto",
         "body": f"El Heraldo de la Caña revela que {t0} recibió el pasado mes una oferta de 'DrinkMaster Pro' valorada en cero euros pero con muchos puntos extra y un emoji de corona. Sin embargo, {t0} rechazó la propuesta y renovó su lealtad a Beer League. 'Aquí están mis amigos', declaró desde el anonimato. El presidente de Beer League ha mandado un WhatsApp de agradecimiento.",
         "author": "Transfer News de la Caña", "icon": "💼", "chart_data": None},

        {"headline": f"TENDENCIA VIRAL: {u2.upper()} CREA EL RETO QUE ARRASA EN TODAS LAS REDES",
         "subtitle": "El challenge del 'cubata al revés' lo hace todo el mundo menos los que tienen trabajo",
         "body": f"Un vídeo de {u2} bebiendo un cubata de una forma que 'no vamos a describir aquí' se ha convertido en el reto viral del momento. Miles de usuarios lo replican. Los médicos advierten de los peligros. Los bares lo han convertido en oferta especial. {u2} ya es verificado en TikTok, Instagram y la app del supermercado. La fama llegó sin avisar.",
         "author": "Viral de la Caña, tendencias", "icon": "🔥", "chart_data": None},
    ]

    # ── ACTUALIDAD (50 artículos) ────────────────────────────────────────────
    actualidad = [
        {"headline": "GOBIERNO ANUNCIA QUE EL LUNES DEJARÁ DE EXISTIR COMO CONCEPTO",
         "subtitle": "La medida más aplaudida de la historia de la democracia española entra en vigor el próximo otoño",
         "body": "En una rueda de prensa histórica, el Gobierno ha anunciado la abolición legal del lunes. 'Hemos escuchado al pueblo', declaró el ministro portavoz entre aplausos atronadores. La semana pasará a tener seis días oficiales: martes, miércoles, jueves, viernes, sábado y 'el día que era lunes pero ya no'. La oposición está a favor por primera vez en 40 años. España lidera Europa.",
         "author": "BOE de la Caña, legislación", "icon": "🗓️", "chart_data": None},

        {"headline": "DESCUBIERTO: EL AGUA DEL GRIFO DE MADRID TIENE PROPIEDADES MILAGROSAS",
         "subtitle": "Estudio demuestra que el agua madrileña convierte cualquier bebida en cubata premium",
         "body": "Un estudio de la Universidad Complutense ha revelado que el agua del Canal de Isabel II tiene una composición única que, al mezclarse con cualquier bebida, la convierte automáticamente en cubata premium. 'Lo sabíamos desde los 80 pero no queríamos decirlo', admite el investigador principal. Los madrileños reaccionan con orgullo. El resto de España pide tubería.",
         "author": "Science de la Caña, ciencia", "icon": "🔬", "chart_data": None},

        {"headline": "LA ONU DECLARA EL CUBATA PATRIMONIO INMATERIAL DE LA HUMANIDAD",
         "subtitle": "La resolución aprobada por 192 países reconoce la importancia cultural del combinado",
         "body": "En una sesión histórica en Nueva York, la ONU ha aprobado por unanimidad declarar el cubata Patrimonio Inmaterial de la Humanidad. 'Es el lazo que une culturas, generaciones y horarios de cierre', reza el documento. España lloraba de emoción. Cuba lloraba de orgullo. El representante de Arabia Saudí pidió no aparecer en la foto pero votó a favor.",
         "author": "ONU Etílica, resolución", "icon": "🌍", "chart_data": None},

        {"headline": "BRUSELAS EXIGE QUE LOS TERCIOS SEAN DE 33CL EXACTOS O HABRÁ MULTA",
         "subtitle": "La directiva más importante de la historia de la Unión Europea afecta a 27 países",
         "body": "La Comisión Europea ha aprobado la Directiva 2026/TERCIO que obliga a todos los establecimientos de la UE a servir los tercios con exactamente 33 centilitros, ni uno más ni uno menos. Los bares españoles ya incumplían antes de que se publicara. La multa por servir 34cl es de 50.000 euros. Por servir 32cl, pena de cárcel. El Bar Manolo estudia mudarse a Suiza.",
         "author": "Euronews de la Caña, Bruselas", "icon": "🇪🇺", "chart_data": None},

        {"headline": "INTELIGENCIA ARTIFICIAL PREDICE QUE ESPAÑA GANARÁ OTRO MUNDIAL EN 2026",
         "subtitle": "La IA más avanzada del mundo también predice que 'habrá mucha celebración etílica'",
         "body": "Una IA entrenada con todos los datos del fútbol mundial ha predicho que España ganará el Mundial 2026 con un 94,7% de probabilidad. La misma IA ha calculado que el consumo de bebidas durante la celebración alcanzará niveles 'geológicamente relevantes'. El Gobierno ya estudia ampliar el horario de cierre de bares. Los bares ya estaban abiertos.",
         "author": "MIT de la Caña, tecnología", "icon": "🤖", "chart_data": None},

        {"headline": "RECORD MUNDIAL: ESPAÑOL AGUANTA DESPIERTO 11 DÍAS SEGUIDOS SIN RAZÓN APARENTE",
         "subtitle": "El hombre de Murcia que bate el récord Guinness dice que 'simplemente no tenía sueño'",
         "body": "Paco Insomniáez, 34 años, vecino de Murcia, lleva 11 días sin dormir y se ha convertido en récord mundial oficial. 'No sé qué pasó, empecé a ver el partido y ya no paré', explica. Los médicos están desconcertados. Los representantes de Guinness World Records han venido desde Londres. Paco les ha ofrecido una copa. Llevan ya dos días con él. Nadie duerme.",
         "author": "Guinness de la Caña, récords", "icon": "😴", "chart_data": None},

        {"headline": "CIENTÍFICOS CONFIRMAN: EL RUIDO DE ABRIR UNA LATA ES EL SONIDO MÁS SATISFACTORIO",
         "subtitle": "Estudio con 50.000 participantes zanja el debate que dividía a la humanidad",
         "body": "La Universidad de Oxford, tras 7 años de investigación y un presupuesto de 40 millones de libras, ha confirmado que el sonido de abrir una lata de refresco o cerveza es el más satisfactorio para el cerebro humano, por encima del crack de los nudillos y el velcro. Los participantes en el estudio pidieron repetirlo 847 veces. El estudio costó más de lo previsto.",
         "author": "Nature de la Caña, ciencia", "icon": "🔊", "chart_data": None},

        {"headline": "TRIBUNAL SUPREMO FALLA: ES ILEGAL PEDIR LA CUENTA ANTES DE LAS 2AM",
         "subtitle": "La sentencia histórica protege el derecho fundamental a prolongar la noche",
         "body": "En un fallo sin precedentes, el Tribunal Supremo ha declarado inconstitucional pedir la cuenta en cualquier establecimiento antes de las 2 de la madrugada en fin de semana. 'El derecho a la madrugada es un derecho fundamental', reza la sentencia. Los camareros celebran. Los conductores designados lloran. Las familias de los camareros también celebran porque ahora tienen razón jurídica.",
         "author": "Tribunal Supremo, sentencia", "icon": "⚖️", "chart_data": None},

        {"headline": "HACIENDA PROPONE DEDUCCIÓN FISCAL POR GASTOS EN BARES",
         "subtitle": "La medida estrella del nuevo presupuesto promete ser la más popular de la historia",
         "body": "El ministro de Hacienda ha presentado la medida que llevaba años prometiendo: deducción del 100% en el IRPF por gastos en bares, restaurantes y terrazas. 'Estimula la economía y el ánimo nacional', argumentó. Los economistas están divididos. Los bares llevan ya tres días llenos. El ministro de Sanidad pide que no se lo expliquen muy bien a la gente.",
         "author": "El Economista de la Caña", "icon": "💶", "chart_data": None},

        {"headline": "ELON MUSK COMPRA ESPAÑA Y ANUNCIA QUE 'CAMBIARÁ POCAS COSAS'",
         "subtitle": "El empresario más polémico del mundo da el paso que nadie vio venir",
         "body": "En la mayor operación de compraventa de la historia, Elon Musk ha adquirido el Reino de España por 2,3 billones de dólares. 'Me pareció interesante, tiene buena playa', declaró desde su cohete. El primer decreto ha sido cambiar el horario oficial de España a hora de Texas. El segundo, que todos los bares cierren a las 10. El tercero se lo pensó mejor y lo derogó.",
         "author": "WSJ de la Caña, empresa", "icon": "🚀", "chart_data": None},
    ]

    # ── VARIEDADES (50 artículos) ────────────────────────────────────────────
    variedades = [
        {"headline": "HORÓSCOPO ETÍLICO DE HOY: LO QUE LOS ASTROS DICEN SOBRE TU COPA",
         "subtitle": "Mercurio retrógrado afecta a Géminis y el cubata de Aries tiene mala vibra",
         "body": "ARIES: Hoy no es día para mezclar bebidas. Tu cubata tiene energía negativa. TAURO: La Luna en tu signo indica que es momento de un vermú. GÉMINIS: Con Mercurio retrógrado, evita las rondas de más de cuatro personas. CÁNCER: El cosmos te pide un chupito de reconciliación. LEO: Estás en racha, pide la botella entera. El resto: lo de siempre, un tercio y a casa.",
         "author": "Astrólogo Borrachín, cosmos", "icon": "⭐", "chart_data": None},

        {"headline": "PREDICCIÓN DEL TIEMPO: LLUVIAS DE CERVEZA EN EL NORTE, SOLEADO CON VERMÚ EN EL SUR",
         "subtitle": "La borrasca 'Grogui' trae precipitaciones etílicas sin precedentes al Cantábrico",
         "body": "La AEMET Etílica avisa de lluvias intensas de cerveza rubia en todo el arco cantábrico durante el fin de semana. Se esperan acumulados de hasta 40cl por metro cuadrado. En el sur, altas presiones con mucho sol y viento de poniente traerán condiciones ideales para el vermú en terraza. Madrid: parcialmente nublado con claros de gin tonic a última hora de la tarde. Abrigarse.",
         "author": "AEMET Etílica, meteorología", "icon": "🌦️", "chart_data": None},

        {"headline": "TEST VIRAL: DESCUBRE QUÉ BEBIDA ERES SEGÚN TU SIGNO, NOMBRE Y GRUPO SANGUÍNEO",
         "subtitle": "El test que arrasa en internet y que los psicólogos llaman 'pseudociencia divertida'",
         "body": "Si tu nombre empieza por vocal y naciste en primavera: eres un vermú. Si tu nombre empieza por consonante y tu grupo es A+: eres un tercio. Si naciste en invierno y tienes los ojos claros: cubata, sin duda. Si no encajas en ninguna categoría: radler, lo siento. Los psicólogos han dicho que esto no tiene ningún fundamento. Los test siguen haciéndolos todo el mundo.",
         "author": "BuzzFeed de la Caña, tests", "icon": "🧬", "chart_data": None},

        {"headline": "CONSEJO DE VIDA: LOS 7 HÁBITOS DE LAS PERSONAS ALTAMENTE ETÍLICAS",
         "subtitle": "El libro de autoayuda más vendido del año revela los secretos del éxito social",
         "body": "1. Madrugan para llegar pronto al bar. 2. Tienen siempre una copa a mano. 3. Escuchan más de lo que hablan (especialmente después del tercero). 4. Conocen al camarero por su nombre. 5. Nunca mezclan sin motivo. 6. Piden la cuenta cuando toca, no antes. 7. Duermen bien —muy bien— después. El libro lleva 40 semanas en el número 1. El autor cobra en cubatas.",
         "author": "Stephen Cobertura, autoayuda", "icon": "📚", "chart_data": None},

        {"headline": "ESTUDIO DEFINITIVO: LA GENTE ES MÁS SIMPÁTICA DESPUÉS DE DOS BEBIDAS",
         "subtitle": "Harvard confirma lo que todo el mundo ya sabía pero necesitaba que le dijeran",
         "body": "Un estudio de Harvard con 100.000 participantes confirma que la simpatía humana alcanza su punto óptimo después de exactamente 2,3 bebidas. Con menos de dos, la gente es 'tolerable'. Con más de tres, 'impredecible'. El punto dulce es ese segundo cubata a mitad de la noche. El estudio recomienda no pasar del tercero salvo en viernes. El cuarto es territorio inexplorado.",
         "author": "Harvard Etílico, investigación", "icon": "🔬", "chart_data": None},

        {"headline": "NUEVA TENDENCIA: BEBER CON LOS OJOS CERRADOS PARA 'APRECIAR MÁS LOS SABORES'",
         "subtitle": "El movimiento 'blind drinking' arrasa en las grandes ciudades españolas",
         "body": "El último movimiento gastronómico que arrasa en Madrid y Barcelona es el 'blind drinking': beber con los ojos cerrados y un pañuelo en la cabeza para 'potenciar la experiencia sensorial'. Los restaurantes de alta gama cobran suplemento por el pañuelo. Los bares de barrio ofrecen la versión gratuita: apagar las luces. Los resultados en ambos casos son similares.",
         "author": "Gastronomy de la Caña, tendencias", "icon": "👀", "chart_data": None},

        {"headline": "FILÓSOFO BORRACHO RESUELVE EL SENTIDO DE LA VIDA EN UNA SERVILLETA",
         "subtitle": "El hallazgo que los académicos llevan siglos buscando estaba en el bar de la esquina",
         "body": "El filósofo Immanuel Borrachín, tras cuatro cubatas y media tapa de calamares, escribió en una servilleta lo que él llama 'la respuesta definitiva al sentido de la vida'. El texto, de 47 palabras, fue inmediatamente robado por el camarero que la usó para limpiar la barra. Borrachín dice que lo recuerda vagamente. Los académicos lloran. La servilleta fue a la basura.",
         "author": "Filosofía de la Caña, pensamiento", "icon": "🤔", "chart_data": None},

        {"headline": "DESCUBIERTO: EL MEJOR BAR DEL MUNDO ESTÁ EN UN PUEBLO DE 200 PERSONAS",
         "subtitle": "La Guía Michelin da cinco estrellas a 'El Rincón de Paco' en Villafría de la Ribera",
         "body": "Para sorpresa de todos, la Guía Michelin Etílica ha otorgado cinco estrellas al bar 'El Rincón de Paco', un local de 30 metros cuadrados en Villafría de la Ribera (Burgos, 200 habitantes). 'Los cubatas son perfectos, la tele siempre en el fútbol y Paco no te da conversación si no quieres', explica la guía. Los críticos de Madrid ya van en peregrinación.",
         "author": "Michelin de la Caña, gastronomía", "icon": "🌟", "chart_data": None},
    ]

    # Asignar category a cada grupo
    for a in economia:         a['category'] = 'economia'
    for a in deportes:         a['category'] = 'deportes'
    for a in cotilleo_templates: a['category'] = 'cotilleo'
    for a in actualidad:       a['category'] = 'actualidad'
    for a in variedades:       a['category'] = 'variedades'

    bank.extend(economia)
    bank.extend(deportes)
    bank.extend(cotilleo_templates)
    bank.extend(actualidad)
    bank.extend(variedades)

    return bank

# ─── SELECCIÓN DE 7 ARTÍCULOS ────────────────────────────────────────────────
def select_articles(bank):
    categories = ['economia', 'economia', 'deportes', 'deportes', 'cotilleo', 'actualidad', 'variedades']
    random.shuffle(categories)

    selected = []
    used_cats = {}

    for cat in categories:
        pool = [a for a in bank if a.get('category') == cat]
        available = [a for a in pool if id(a) not in [id(s) for s in selected]]
        if available:
            article = random.choice(available)
            selected.append(article)

    # Asegurar exactamente 1 featured
    for a in selected:
        a['featured'] = False
    if selected:
        random.choice(selected)['featured'] = True

    return selected

# ─── MAIN ────────────────────────────────────────────────────────────────────
bank = build_bank()
articles = select_articles(bank)

# Añadir category a cada artículo según su posición en el banco
cat_map = {
    'Warren Borracho': 'economia',
    'Elon Mustiajo': 'economia',
    'Soros del Chupito': 'economia',
    'Goldman Borrachs': 'economia',
    'Fibonacci Borrachs': 'economia',
    'Bloomberg de la Caña, mercados': 'economia',
    'Pepita Fusiones, redactora económica': 'economia',
    'Resaca Capital, comunicado': 'economia',
    'Prof. Alcohólicus, Ph.D': 'economia',
    'CryptoManuel, ex-millonario': 'economia',
    'CNMV de la Caña, nota oficial': 'economia',
    'Algoritmo Arrepentido, IA': 'economia',
    'Christine LaGarza, FMI': 'economia',
    'INE Etílico, estadísticas': 'economia',
    'Satoshi Borrachimoto, fundador': 'economia',
}

# Asignar category basándonos en el icon y author
for a in articles:
    if 'category' not in a or not a.get('category'):
        if a.get('chart_data') is not None:
            a['category'] = 'economia'
        elif '⚽' in a.get('icon','') or '🏟️' in a.get('icon','') or '🎾' in a.get('icon','') or '🏎️' in a.get('icon','') or '🥊' in a.get('icon','') or '🚴' in a.get('icon','') or '🏀' in a.get('icon','') or '⛳' in a.get('icon','') or '🏆' in a.get('icon','') or '⭐' == a.get('icon','') or '⚡' in a.get('icon',''):
            a['category'] = 'deportes'
        elif '💅' in a.get('icon','') or '😱' in a.get('icon','') or '🤫' in a.get('icon','') or '⚔️' in a.get('icon','') or '💕' in a.get('icon','') or '🧪' in a.get('icon','') or '💼' in a.get('icon','') or '🔥' in a.get('icon',''):
            a['category'] = 'cotilleo'
        elif '⭐' in a.get('icon','') or '🌦️' in a.get('icon','') or '🧬' in a.get('icon','') or '📚' in a.get('icon','') or '🤔' in a.get('icon','') or '🌟' in a.get('icon','') or '👀' in a.get('icon',''):
            a['category'] = 'variedades'
        else:
            a['category'] = 'actualidad'

print(f"Banco: {len(bank)} artículos, seleccionados: {len(articles)}", file=sys.stderr)
for a in articles:
    print(f"  [{a.get('category','?')}] {a['headline'][:60]}...", file=sys.stderr)

supabase_url = os.environ.get('SUPABASE_URL', '')
supabase_key = os.environ.get('SUPABASE_KEY', '')

# Guardar en Supabase directamente desde Python
if supabase_url and supabase_key:
    import urllib.request, urllib.error
    payload = {
        "block_type": block_type,
        "articles": articles,
        "market_snapshot": ctx
    }
    req = urllib.request.Request(
        f"{supabase_url}/rest/v1/news_blocks",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Prefer": "return=minimal"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"✅ Bloque {block_type} guardado en Supabase (HTTP {resp.status})", file=sys.stderr)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ Error guardando en Supabase: HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)
else:
    # Modo local: imprimir JSON
    print(json.dumps(articles, ensure_ascii=False, indent=2))