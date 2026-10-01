import Groq from "groq-sdk";
import { NextResponse } from 'next/server';

// Inicializa el cliente oficial de Groq (toma automáticamente process.env.GROQ_API_KEY)
const groq = new Groq();

export async function POST(request: Request) {
  try {
    const { prompt, imageBase64 } = await request.json();
    
    // Usamos el modelo oficial y veloz indicado en la documentación de Groq
    const modelToUse = "qwen/qwen3.8-27b";

    let messages: any[] = [
      {
        role: "system",
        content: 'Eres un nutricionista experto. Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin formato markdown y sin explicaciones. La estructura exacta debe ser: {"name": "string", "calories": number, "protein": number, "carbs": number, "fat": number}'
      },
      {
        role: "user",
        content: imageBase64 ? [
          { type: "text", text: prompt || "Analiza este alimento y devuelve el JSON" },
          { type: "image_url", image_url: { url: imageBase64 } }
        ] : (prompt || "Manzana")
      }
    ];

    const completion = await groq.chat.completions.create({
      model: modelToUse,
      messages: messages,
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" }, // Forzar salida JSON limpia
    });

    let textResponse = completion.choices[0]?.message?.content?.trim() || '';
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!textResponse) {
      throw new Error('La IA devolvió una respuesta vacía.');
    }

    const parsedData = JSON.parse(textResponse);
    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Error en API analyze con Groq:', error);
    return NextResponse.json({ error: 'Error al procesar con IA: ' + error.message }, { status: 500 });
  }
}