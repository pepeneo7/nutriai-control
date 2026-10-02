export interface UserMetrics {
    weight: number;
    height: number;
    age: number;
    gender: 'male' | 'female';
    activityLevel: number;
    goal: 'lose' | 'maintain' | 'gain';
  }
  
  export function calculateNutritionGoals(metrics: UserMetrics) {
    // 1. Tasa Metabólica Basal (BMR)
    let bmr = (10 * metrics.weight) + (6.25 * metrics.height) - (5 * metrics.age);
    bmr = metrics.gender === 'male' ? bmr + 5 : bmr - 161;
  
    // 2. Gasto Energético Total (TDEE)
    let tdee = bmr * metrics.activityLevel;
  
    // 3. Ajuste por objetivo
    let targetCalories = tdee;
    if (metrics.goal === 'lose') targetCalories -= 500; // Déficit
    if (metrics.goal === 'gain') targetCalories += 300;  // Superávit
  
    // 4. Macronutrientes (Proteína alta de 2g/kg, grasa al 27%, resto carbohidratos)
    const proteinGrams = Math.round(metrics.weight * 2.0);
    const proteinCalories = proteinGrams * 4;
  
    const fatCalories = targetCalories * 0.27;
    const fatGrams = Math.round(fatCalories / 9);
  
    const carbCalories = targetCalories - (proteinCalories + fatCalories);
    const carbGrams = Math.max(Math.round(carbCalories / 4), 50);
  
    return {
      calories: Math.max(Math.round(targetCalories), 1200),
      protein: proteinGrams,
      carbs: carbGrams,
      fat: fatGrams,
    };
  }