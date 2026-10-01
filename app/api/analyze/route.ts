import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Inicializa el cliente moderno de Google Gen AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, imageBase64 } = body;

    let contents: any[] = [];

    if (imageBase64) {
      contents = [
        {
          inlineData: {
            data: imageBase64.split(',')[1] || imageBase64,
            mimeType: 'image/jpeg',
          },
        },
        'Analiza esta imagen de comida. Devuelve estrictamente un objeto JSON válido con las siguientes claves exactas: "name" (nombre descriptivo del plato), "calories" (número entero de calorías estimadas), "protein" (gramos de proteína en número), "carbs" (gramos de carbohidratos en número), "fat" (gramos de grasa en número). No agregues texto adicional, solo el JSON.'
      ];
    } else if (prompt) {
      contents = [
        `Analiza este alimento o plato: "${prompt}". Devuelve estrictamente un objeto JSON válido con las siguientes claves exactas: "name" (nombre descriptivo), "calories" (número entero de calorías estimadas), "protein" (gramos de proteína en número), "carbs" (gramos de carbohidratos en número), "fat" (gramos de grasa en número). No agregues texto adicional, solo el JSON.`
      ];
    } else {
      return NextResponse.json({ error: 'No se proporcionó texto ni imagen.' }, { status: 400 });
    }

    // Llamada actualizada usando el modelo recomendado
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error('No se recibió respuesta de la IA.');
    }

    const cleanJsonText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const foodData = JSON.parse(cleanJsonText);

    return NextResponse.json(foodData);
  } catch (error: any) {
    console.error('Error al analizar comida con IA:', error);
    return NextResponse.json({ error: 'Error al procesar el alimento con IA.' }, { status: 500 });
  }
}