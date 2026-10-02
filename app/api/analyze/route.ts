import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt, imageBase64 } = await request.json();
    
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Falta configurar la variable GROQ_API_KEY en Vercel.');
    }

    // Petición HTTP nativa a Groq (sin instalar paquetes externos)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: 'Eres un nutricionista experto. Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin formato markdown y sin explicaciones. La estructura exacta debe ser: {"name": "string", "calories": number, "protein": number, "carbs": number, "fat": number}'
          },
          {
            role: 'user',
            content: imageBase64 ? [
              { type: 'text', text: prompt || 'Analiza este alimento y devuelve el JSON' },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ] : (prompt || 'Manzana')
          }
        ],
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      throw new Error(data.error?.message || 'Error en la respuesta de Groq');
    }

    let textResponse = data.choices[0]?.message?.content?.trim() || '';
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!textResponse) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    const parsedData = JSON.parse(textResponse);
    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Error en API analyze:', error);
    return NextResponse.json({ error: 'Error al procesar con IA: ' + error.message }, { status: 500 });
  }
}