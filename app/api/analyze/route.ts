import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { prompt, imageBase64 } = await request.json();
    
    const model = 'gemini-2.5-flash';
    let contents: any = [];

    if (imageBase64) {
      const base64Data = imageBase64.split(',')[1] || imageBase64;
      contents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg',
          },
        },
        'Analiza este alimento y responde estrictamente en JSON plano con este formato exacto, sin markdown adicional: {"name": "Nombre", "calories": 300, "protein": 20, "carbs": 30, "fat": 10}'
      ];
    } else {
      contents = [
        `Analiza este alimento o petición: "${prompt}". Responde estrictamente en JSON plano con este formato exacto, sin markdown adicional: {"name": "Nombre", "calories": 300, "protein": 20, "carbs": 30, "fat": 10}`
      ];
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        temperature: 0.1, // Temperatura baja para que responda de inmediato y sin rodeos
        maxOutputTokens: 150, // Límite corto para acelerar la generación
      }
    });

    let textResponse = response.text ? response.text.trim() : '';
    // Limpiar si trae bloques de código markdown de texto
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(textResponse);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al procesar con IA: ' + error.message }, { status: 500 });
  }
}