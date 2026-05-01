// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageUrl } = await req.json()

    // Descargar imagen y convertir a base64
    const imgRes = await fetch(imageUrl)
    const imgBuf = await imgRes.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)))
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: { mime_type: mimeType, data: base64 }
              },
              {
                text: 'Analiza esta imagen y determina si muestra una bebida (alcohólica o no alcohólica) de forma clara y verosímil, como en un bar, restaurante, en mano, o sobre una mesa en un contexto real de consumo. No es válida si parece imagen de internet, catálogo, producto en tienda sin contexto de consumo, o no se ve ninguna bebida. Responde ÚNICAMENTE con JSON sin texto adicional ni backticks: {"valid": true, "reason": "explicación breve en español de máximo 20 palabras"}'
              }
            ]
          }],
          generationConfig: { maxOutputTokens: 100, temperature: 0 }
        })
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, reason: 'Error al analizar la imagen' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})