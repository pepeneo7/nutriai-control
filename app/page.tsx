'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

interface UserProfile {
  fullName: string;
  birthday: string;
  weight: number;
  height: number;
  goalCalories: number;
  avatarUrl: string;
}

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  mealType: 'Desayuno' | 'Almuerzo' | 'Comida' | 'Cena' | 'Snack';
}

interface WorkoutItem {
  id: string;
  exerciseName: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;
  category: 'Cardio' | 'Fuerza' | 'HIIT' | 'Yoga / Movilidad' | 'Deporte';
}

interface WeightRecord {
  id: string;
  weight: number;
  date: string;
}

interface DinnerSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'tracker' | 'workout' | 'profile' | 'history'>('dashboard');
  
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    birthday: '',
    weight: 70,
    height: 170,
    goalCalories: 2000,
    avatarUrl: '',
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<'Desayuno' | 'Almuerzo' | 'Comida' | 'Cena' | 'Snack'>('Comida');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [meals, setMeals] = useState<FoodItem[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [weightLogs, setWeightLogs] = useState<WeightRecord[]>([]);
  const [favorites, setFavorites] = useState<Omit<FoodItem, 'id' | 'date'>[]>([]);

  // Estados para Nuevos Entrenamientos
  const [workoutName, setWorkoutName] = useState('');
  const [workoutMinutes, setWorkoutMinutes] = useState<number | ''>(30);
  const [workoutCalories, setWorkoutCalories] = useState<number | ''>(200);
  const [workoutCategory, setWorkoutCategory] = useState<'Cardio' | 'Fuerza' | 'HIIT' | 'Yoga / Movilidad' | 'Deporte'>('Cardio');

  // Estados para Modales y Acciones
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDayModal, setSelectedDayModal] = useState<string | null>(null);
  const [historyFilterCategory, setHistoryFilterCategory] = useState<string>('Todos');
  const [selectedFavorite, setSelectedFavorite] = useState<Omit<FoodItem, 'id' | 'date'> | null>(null);
  const [selectedMealToDelete, setSelectedMealToDelete] = useState<FoodItem | null>(null);
  const [selectedWorkoutToDelete, setSelectedWorkoutToDelete] = useState<WorkoutItem | null>(null);
  const [addingFav, setAddingFav] = useState(false);
  
  const [aiDinnerModal, setAiDinnerModal] = useState<DinnerSuggestion | null>(null);
  const [loadingDinner, setLoadingDinner] = useState(false);

  // Estado para botón de Scroll al Top y Celebración de Meta
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showGoalCelebration, setShowGoalCelebration] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    // Cargar datos locales por si hay offline
    const localMeals = localStorage.getItem('nutriai_offline_meals');
    if (localMeals) {
      try { setMeals(JSON.parse(localMeals)); } catch (e) {}
    }
    const localWorkouts = localStorage.getItem('nutriai_offline_workouts');
    if (localWorkouts) {
      try { setWorkouts(JSON.parse(localWorkouts)); } catch (e) {}
    }

    if (!supabase) return;
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) await fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) await fetchUserData(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    await fetchProfile(userId);
    await fetchMeals(userId);
    await fetchWorkouts(userId);
    await fetchWater(userId, selectedDate);
    await fetchWeightHistory(userId);
    
    const savedFavs = localStorage.getItem(`nutriai_favs_${userId}`);
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) {}
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchWater(session.user.id, selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (meals.length > 0) {
      localStorage.setItem('nutriai_offline_meals', JSON.stringify(meals));
    }
  }, [meals]);

  useEffect(() => {
    if (workouts.length > 0) {
      localStorage.setItem('nutriai_offline_workouts', JSON.stringify(workouts));
    }
  }, [workouts]);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile({
        fullName: data.full_name || '',
        birthday: data.birthday || '',
        weight: data.weight || 70,
        height: data.height || 170,
        goalCalories: data.goal_calories || 2000,
        avatarUrl: data.avatar_url || '',
      });
    }
  };

  const fetchMeals = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setMeals(data.map((item: any) => ({
        id: item.id,
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        date: item.date,
        mealType: item.meal_type || 'Comida',
      })));
    }
  };

  const fetchWorkouts = async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setWorkouts(data.map((item: any) => ({
        id: item.id,
        exerciseName: item.exercise_name,
        durationMinutes: item.duration_minutes,
        caloriesBurned: item.calories_burned,
        date: item.date,
        category: item.category || 'Cardio',
      })));
    }
  };

  const fetchWater = async (userId: string, date: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('water_logs').select('glasses').eq('user_id', userId).eq('date', date).single();
    setWaterGlasses(data ? data.glasses : 0);
  };

  const fetchWeightHistory = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('weight_history').select('*').eq('user_id', userId).order('date', { ascending: true });
    if (data) {
      setWeightLogs(data.map((w: any) => ({ id: w.id, weight: w.weight, date: w.date })));
    }
  };

  const updateWaterGlasses = async (newCount: number) => {
    const clamped = Math.max(0, Math.min(15, newCount));
    setWaterGlasses(clamped);
    if (!supabase || !session) return;

    await supabase.from('water_logs').upsert({
      user_id: session.user.id,
      date: selectedDate,
      glasses: clamped,
    }, { onConflict: 'user_id,date' });
  };

  const saveProfileToSupabase = async (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    if (!supabase || !session) return;
    
    await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: updatedProfile.fullName,
      birthday: updatedProfile.birthday,
      weight: updatedProfile.weight,
      height: updatedProfile.height,
      goal_calories: updatedProfile.goalCalories,
      avatar_url: updatedProfile.avatarUrl,
      updated_at: new Date(),
    });
  };

  const handleRecordWeight = async (newWeight: number) => {
    const updated = { ...profile, weight: newWeight };
    await saveProfileToSupabase(updated);

    if (!supabase || !session) return;
    const today = new Date().toISOString().split('T')[0];
    
    await supabase.from('weight_history').insert({
      user_id: session.user.id,
      weight: newWeight,
      date: today,
    });
    await fetchWeightHistory(session.user.id);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !session) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await saveProfileToSupabase({ ...profile, avatarUrl: publicUrlData.publicUrl });
    } catch (err: any) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!supabase) {
      if (authEmail) setSession({ user: { email: authEmail } });
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) setAuthError(error.message);
      else alert('¡Registro exitoso! Ya puedes iniciar sesión.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) setAuthError('Correo o contraseña incorrectos.');
    }
  };

  const heightInMeters = profile.height ? profile.height / 100 : 1.70;
  const imcNum = profile.weight && profile.height ? Number((profile.weight / (heightInMeters * heightInMeters)).toFixed(1)) : 0;
  
  const getImcCategory = (val: number) => {
    if (val === 0) return { text: 'Sin datos', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };
    if (val < 18.5) return { text: 'Bajo peso', color: 'text-sky-500', bg: 'bg-sky-500/10 border-sky-500/20' };
    if (val < 25) return { text: 'Saludable', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (val < 30) return { text: 'Sobrepeso', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { text: 'Obesidad', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' };
  };

  const imcStatus = getImcCategory(imcNum);
  const imcPercentage = Math.min(100, Math.max(0, ((imcNum - 15) / (40 - 15)) * 100));

  const todaysMeals = meals.filter(m => m.date === selectedDate);
  const todaysWorkouts = workouts.filter(w => w.date === selectedDate);

  const totalCaloriesIn = todaysMeals.reduce((acc, item) => acc + item.calories, 0);
  const totalCaloriesBurned = todaysWorkouts.reduce((acc, item) => acc + item.caloriesBurned, 0);
  const netCalories = totalCaloriesIn - totalCaloriesBurned;
  const caloriesLeft = profile.goalCalories - netCalories;

  const maxScaleCalories = 4500;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fillPercentage = Math.min(100, (netCalories / maxScaleCalories) * 100);
  const strokeDashoffset = circumference - (fillPercentage / 100) * circumference;

  const getGaugeColorClass = () => {
    if (netCalories > profile.goalCalories) return 'text-rose-500';
    if (netCalories >= profile.goalCalories * 0.85) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getGaugeMessage = () => {
    if (netCalories > profile.goalCalories) {
      return { text: `¡Exceso neto de ${Math.abs(caloriesLeft)} kcal!`, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
    }
    if (netCalories >= profile.goalCalories * 0.85) {
      return { text: `⚠️ Cerca de tu meta (${caloriesLeft} kcal netas restantes)`, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    }
    return { text: `Te faltan ${caloriesLeft} kcal netas para tu meta`, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  };

  const gaugeStatus = getGaugeMessage();

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutName.trim() || workoutMinutes === '' || workoutCalories === '') return;

    const newWorkoutData = {
      user_id: session?.user?.id || null,
      exercise_name: workoutName.trim(),
      duration_minutes: Number(workoutMinutes),
      calories_burned: Number(workoutCalories),
      date: selectedDate,
      category: workoutCategory,
    };

    const newItemId = Date.now().toString();

    if (supabase && session?.user?.id) {
      await supabase.from('workouts').insert([newWorkoutData]);
    }

    const newItem: WorkoutItem = {
      id: newItemId,
      exerciseName: newWorkoutData.exercise_name,
      durationMinutes: newWorkoutData.duration_minutes,
      caloriesBurned: newWorkoutData.calories_burned,
      date: selectedDate,
      category: workoutCategory,
    };

    setWorkouts(prev => [newItem, ...prev]);
    setWorkoutName('');
    setWorkoutMinutes(30);
    setWorkoutCalories(200);
  };

  const handleDeleteWorkout = async (workout: WorkoutItem) => {
    setWorkouts(prev => prev.filter(w => w.id !== workout.id));
    setSelectedWorkoutToDelete(null);

    if (supabase && session?.user?.id) {
      await supabase.from('workouts').delete().eq('id', workout.id);
    }
  };

  const getLast7DaysStats = () => {
    const list: { date: string; calories: number; label: string }[] = [];
    let totalCals7 = 0;
    let totalProt7 = 0;
    let totalCarbs7 = 0;
    let totalFat7 = 0;
    let daysWithData = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayM = meals.filter(m => m.date === dateStr);
      const dayCals = dayM.reduce((a, b) => a + b.calories, 0);

      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      list.push({ date: dateStr, calories: dayCals, label: dayNames[d.getDay()] });

      if (dayM.length > 0) {
        daysWithData++;
        totalCals7 += dayCals;
        totalProt7 += dayM.reduce((a, b) => a + b.protein, 0);
        totalCarbs7 += dayM.reduce((a, b) => a + b.carbs, 0);
        totalFat7 += dayM.reduce((a, b) => a + b.fat, 0);
      }
    }

    const divisor = daysWithData > 0 ? daysWithData : 1;
    const avgCals = Math.round(totalCals7 / divisor);
    const balance = (profile.goalCalories * daysWithData) - totalCals7;

    return {
      dailyList: list,
      avgCalories: avgCals,
      avgProtein: Math.round(totalProt7 / divisor),
      avgCarbs: Math.round(totalCarbs7 / divisor),
      avgFat: Math.round(totalFat7 / divisor),
      netBalance: balance,
    };
  };

  const weeklyStats = getLast7DaysStats();

  const calculateStreak = () => {
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayM = meals.filter(m => m.date === dateStr);
      const dayCals = dayM.reduce((a, b) => a + b.calories, 0);

      if (dayM.length > 0 && dayCals <= profile.goalCalories) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  const handleGetDinnerSuggestion = async () => {
    setLoadingDinner(true);
    try {
      const promptText = `Tengo ${Math.max(0, caloriesLeft)} calorías disponibles para mi cena de hoy y busco mantener una buena nutrición. Dame una sugerencia de cena saludable.`;
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await response.json();
      if (response.ok) {
        setAiDinnerModal({
          name: data.name || 'Cena saludable sugerida',
          calories: Number(data.calories) || 350,
          protein: Number(data.protein) || 25,
          carbs: Number(data.carbs) || 30,
          fat: Number(data.fat) || 12,
        });
      } else {
        alert(data.error || 'No se pudo generar la sugerencia');
      }
    } catch (e) {
      alert('Error de conexión con la IA.');
    } finally {
      setLoadingDinner(false);
    }
  };

  const processMealAnalysis = async (payload: { prompt?: string; imageBase64?: string }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        const newMealData = {
          user_id: session?.user?.id || null,
          name: data.name || 'Alimento analizado',
          calories: Number(data.calories) || 300,
          protein: Number(data.protein) || 20,
          carbs: Number(data.carbs) || 30,
          fat: Number(data.fat) || 10,
          date: selectedDate,
          meal_type: selectedMealType,
        };

        const newItemId = Date.now().toString();

        if (supabase && session?.user?.id) {
          const { data: inserted, error } = await supabase.from('meals').insert([newMealData]).select().single();
          if (!error && inserted) {
            newMealData.user_id = inserted.id;
          }
        }

        const newItem: FoodItem = {
          id: newItemId,
          name: newMealData.name,
          calories: newMealData.calories,
          protein: newMealData.protein,
          carbs: newMealData.carbs,
          fat: newMealData.fat,
          date: selectedDate,
          mealType: newMealData.meal_type as any,
        };

        setMeals(prev => [newItem, ...prev]);
        setInputPrompt('');

        if (netCalories >= profile.goalCalories * 0.9 && netCalories <= profile.goalCalories * 1.1) {
          setShowGoalCelebration(true);
          setTimeout(() => setShowGoalCelebration(false), 5000);
        }

      } else {
        alert(data.error || 'Error al calcular con IA');
      }
    } catch (err) {
      alert('Hubo un error de conexión con la IA. Se guardó localmente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !inputPrompt.trim()) return;
    processMealAnalysis({ prompt: inputPrompt });
  };

  const handleFoodImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => processMealAnalysis({ imageBase64: reader.result as string });
    reader.readAsDataURL(file);
  };

  const saveAsFavorite = (meal: FoodItem) => {
    const favData = { name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, mealType: meal.mealType };
    if (!favorites.some(f => f.name === favData.name)) {
      const updatedFavs = [...favorites, favData];
      setFavorites(updatedFavs);
      if (session?.user?.id) {
        localStorage.setItem(`nutriai_favs_${session.user.id}`, JSON.stringify(updatedFavs));
      }
    }
  };

  const addFavoriteToDay = async (fav: Omit<FoodItem, 'id' | 'date'>) => {
    if (addingFav) return;
    setAddingFav(true);

    try {
      const newMealData = {
        user_id: session?.user?.id || null,
        name: fav.name,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        date: selectedDate,
        meal_type: fav.mealType,
      };

      if (supabase && session?.user?.id) {
        await supabase.from('meals').insert([newMealData]);
      }

      const newItem: FoodItem = {
        id: Date.now().toString(),
        name: fav.name,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        date: selectedDate,
        mealType: fav.mealType,
      };
      setMeals(prev => [newItem, ...prev]);
    } finally {
      setAddingFav(false);
    }
  };

  const handleDeleteMeal = async (meal: FoodItem) => {
    setMeals(prev => prev.filter(m => m.id !== meal.id));
    setSelectedMealToDelete(null);

    if (supabase && session?.user?.id) {
      await supabase.from('meals').delete().eq('id', meal.id);
    }
  };

  const exportDataToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Fecha,Comida,Tipo,Calorias,Proteinas,Carbohidratos,Grasas\n";
    meals.forEach(m => {
      csvContent += `${m.date},"${m.name}",${m.mealType},${m.calories},${m.protein},${m.carbs},${m.fat}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nutriai_reporte_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  if (!session) {
    return (
      <main className={`min-h-screen w-full ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} flex items-center justify-center p-4 font-sans transition-colors`}>
        <div className={`w-full max-w-sm p-8 rounded-3xl border text-center space-y-6 shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h1 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">NutriAI Control</h1>
          {authError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-3 rounded-xl">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-3 text-left">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Correo</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="tucorreo@email.com" className={`w-full mt-1 p-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className={`w-full mt-1 p-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition text-sm shadow-lg shadow-indigo-600/20">{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline block mx-auto pt-2">
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className={`min-h-screen w-full ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors flex justify-center`}>
      <main className="w-full max-w-md min-h-screen pb-28 relative font-sans flex flex-col shadow-2xl">
        
        {showGoalCelebration && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-gradient-to-r from-amber-500 to-indigo-600 text-white p-4 rounded-2xl shadow-2xl text-center animate-bounce border border-white/20">
            <h4 className="text-sm font-black">🎉 ¡Felicitaciones!</h4>
            <p className="text-xs mt-0.5">Has alcanzado con éxito tu meta calórica neta de hoy.</p>
          </div>
        )}

        <header className={`p-4 flex justify-between items-center border-b ${theme === 'dark' ? 'border-slate-900 bg-slate-950/80' : 'border-slate-200 bg-white/80'} backdrop-blur sticky top-0 z-40 transition-colors`}>
          <div className="flex items-center gap-3">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-indigo-500/40 shadow-md" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600/25 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">👤</div>
            )}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Hola,</span>
              <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">{profile.fullName || session.user.email}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-600'}`} title="Días consecutivos cumpliendo tu meta">
              <span>🔥</span> {currentStreak} días
            </div>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-xl text-xs border transition ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-slate-100 border-slate-200 text-indigo-600'}`}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={async () => { if (supabase) await supabase.auth.signOut(); setSession(null); }} className={`text-xs px-3 py-1.5 rounded-lg border transition ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
              Salir
            </button>
          </div>
        </header>

        <div className="p-4 space-y-6 flex-1">

          {currentTab === 'dashboard' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">📊 Dashboard de Hoy</h3>
              
              <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden flex flex-col items-center text-center transition-colors ${theme === 'dark' ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between w-full px-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Meta: <strong className="text-indigo-600 dark:text-indigo-400">{profile.goalCalories} kcal</strong></span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Consumidas: {totalCaloriesIn} | Quemadas: -{totalCaloriesBurned}</span>
                </div>

                <div className="relative w-36 h-36 flex items-center justify-center my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="9" className={theme === 'dark' ? 'text-slate-800' : 'text-slate-200'} fill="transparent" />
                    <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="9" className={`${getGaugeColorClass()} transition-all duration-700 ease-out`} style={{ strokeDasharray: circumference, strokeDashoffset: strokeDashoffset }} fill="transparent" strokeLinecap="round" />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{netCalories}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">kcal netas</span>
                  </div>
                </div>

                <div className={`mt-3 py-2 px-4 rounded-2xl border text-xs font-semibold w-full ${gaugeStatus.color}`}>
                  {gaugeStatus.text}
                </div>
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm space-y-3 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold flex items-center gap-1.5">💧 Hidratación Diaria</span>
                  <span className="text-xs font-bold text-sky-400">{waterGlasses} / 8 Vasos</span>
                </div>
                <div className="flex justify-between items-center gap-1 overflow-x-auto py-1">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateWaterGlasses(idx < waterGlasses ? idx : idx + 1)}
                      className={`h-9 flex-1 min-w-[32px] rounded-xl border transition flex items-center justify-center text-sm ${
                        idx < waterGlasses 
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-sm shadow-sky-500/20' 
                          : theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-300'
                      }`}
                    >
                      💧
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className={`p-4 rounded-2xl border text-center transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Proteínas</span>
                  <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{todaysMeals.reduce((a, b) => a + b.protein, 0)}g</div>
                </div>
                <div className={`p-4 rounded-2xl border text-center transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Carbos</span>
                  <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{todaysMeals.reduce((a, b) => a + b.carbs, 0)}g</div>
                </div>
                <div className={`p-4 rounded-2xl border text-center transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Grasas</span>
                  <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{todaysMeals.reduce((a, b) => a + b.fat, 0)}g</div>
                </div>
              </div>

              {/* Gráfica de Barras de los Últimos 7 Días */}
              <div className={`p-5 rounded-3xl border space-y-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">📊 Tendencia Calórica (7 Días)</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Meta: {profile.goalCalories} kcal</span>
                </div>

                <div className="flex items-end justify-between h-28 pt-6 px-2 gap-2">
                  {weeklyStats.dailyList.map((item, idx) => {
                    const maxLimit = Math.max(profile.goalCalories * 1.2, ...weeklyStats.dailyList.map(d => d.calories), 2500);
                    const heightPct = Math.max(10, Math.min(100, (item.calories / maxLimit) * 100));
                    const isOver = item.calories > profile.goalCalories;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <span className="text-[9px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition">{item.calories}</span>
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-500 ${isOver ? 'bg-rose-500/80' : 'bg-indigo-600/80'}`} 
                          style={{ height: `${item.calories > 0 ? heightPct : 6}%` }}
                        ></div>
                        <span className="text-[10px] text-slate-400 font-bold">{item.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-700/30">
                  <div className={`p-2.5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 block">Promedio Diario</span>
                    <strong className="text-xs font-black">{weeklyStats.avgCalories} kcal</strong>
                  </div>
                  <div className={`p-2.5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-400 block">Balance Neto</span>
                    <strong className={`text-xs font-black ${weeklyStats.netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {weeklyStats.netBalance >= 0 ? `Déficit ${weeklyStats.netBalance}` : `Exceso ${Math.abs(weeklyStats.netBalance)}`}
                    </strong>
                  </div>
                </div>
              </div>

              <button onClick={() => setCurrentTab('tracker')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                <span>🍽 Registrar Comida de Hoy</span>
              </button>
            </div>
          )}

          {currentTab === 'tracker' && (
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className="text-xs text-slate-400 font-medium">Fecha:</span>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`text-xs p-2 rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
              </div>

              <div className={`p-4 rounded-3xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gradient-to-r from-indigo-950/40 to-slate-900 border-indigo-500/30 text-white' : 'bg-indigo-50/60 border-indigo-200 text-slate-900'}`}>
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">✨ Asistente de Cenas con IA</span>
                  <span className="text-[11px] text-slate-400">Calcula una cena adaptada a tus calorías restantes.</span>
                </div>
                <button
                  onClick={handleGetDinnerSuggestion}
                  disabled={loadingDinner}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl font-semibold transition shadow-md shadow-indigo-600/20 disabled:opacity-50 flex-shrink-0"
                >
                  {loadingDinner ? 'Analizando...' : 'Sugerir Cena 🌙'}
                </button>
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm space-y-3 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">Tiempo de comida:</label>
                  <div className="grid grid-cols-5 gap-1">
                    {(['Desayuno', 'Almuerzo', 'Comida', 'Cena', 'Snack'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedMealType(type)}
                        className={`py-2 text-[10px] font-bold rounded-xl border transition ${selectedMealType === type ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Analizar con foto:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2.5 px-3 rounded-xl font-medium cursor-pointer transition flex items-center justify-center gap-1.5 shadow-sm">
                      <span>📸</span> Tomar Foto
                      <input type="file" accept="image/*" capture="environment" onChange={handleFoodImageCapture} disabled={loading} className="hidden" />
                    </label>
                    <label className={`text-xs py-2.5 px-3 rounded-xl font-medium cursor-pointer transition border flex items-center justify-center gap-1.5 ${theme === 'dark' ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}>
                      <span>📁</span> Subir Imagen
                      <input type="file" accept="image/*" onChange={handleFoodImageCapture} disabled={loading} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-700/30"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-400 uppercase tracking-widest font-bold">o por texto</span>
                  <div className="flex-grow border-t border-slate-700/30"></div>
                </div>

                <form onSubmit={handleAnalyzeFood} className="flex flex-col gap-3">
                  <textarea value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)} placeholder="Ej. Pechuga asada con ensalada..." className={`w-full p-3 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} rows={2} />
                  <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-medium transition text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20">
                    {loading ? 'Analizando con IA...' : 'Calcular con IA 🤖'}
                  </button>
                </form>
              </div>

              {favorites.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">⭐ Comidas Favoritas</h4>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {favorites.map((fav, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedFavorite(fav)} 
                        className={`p-3 rounded-2xl border text-left min-w-[140px] flex-shrink-0 transition ${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-500'}`}
                      >
                        <div className="font-semibold text-xs truncate">{fav.name}</div>
                        <div className="text-[10px] text-indigo-400 font-bold mt-1">+{fav.calories} kcal</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-400">Registros del día ({todaysMeals.length})</h3>
                {todaysMeals.length === 0 ? (
                  <div className={`text-center py-10 rounded-3xl border border-dashed text-xs ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                    Sin comidas registradas en esta fecha.
                  </div>
                ) : (
                  (['Desayuno', 'Almuerzo', 'Comida', 'Cena', 'Snack'] as const).map(type => {
                    const categoryMeals = todaysMeals.filter(m => m.mealType === type);
                    if (categoryMeals.length === 0) return null;
                    return (
                      <div key={type} className="space-y-2">
                        <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{type}</h4>
                        {categoryMeals.map(meal => (
                          <div key={meal.id} className={`p-4 rounded-2xl flex justify-between items-center border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                            <div>
                              <h5 className="font-medium text-sm">{meal.name}</h5>
                              <span className="text-[11px] text-slate-400">P: {meal.protein}g • C: {meal.carbs}g • G: {meal.fat}g</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">+{meal.calories} kcal</span>
                              <button onClick={() => saveAsFavorite(meal)} title="Guardar como favorito" className="text-xs text-slate-400 hover:text-amber-400 transition p-1">⭐</button>
                              <button onClick={() => setSelectedMealToDelete(meal)} title="Eliminar registro" className="text-xs text-rose-400 hover:text-rose-500 transition p-1">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Sección de Entrenamiento */}
          {currentTab === 'workout' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2">💪 Registro de Entrenamiento</h3>

              <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <span className="text-xs text-slate-400 font-medium">Fecha:</span>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`text-xs p-2 rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm space-y-3 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Registrar Actividad Física</h4>
                
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">Categoría:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Cardio', 'Fuerza', 'HIIT', 'Yoga / Movilidad', 'Deporte'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setWorkoutCategory(cat)}
                        className={`py-2 text-[10px] font-bold rounded-xl border transition ${workoutCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleAddWorkout} className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Nombre del ejercicio o rutina</label>
                    <input type="text" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Ej. Correr en pista, Pesas pierna..." className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 font-medium">Duración (minutos)</label>
                      <input type="number" value={workoutMinutes} onChange={(e) => setWorkoutMinutes(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-medium">Calorías quemadas (kcal)</label>
                      <input type="number" value={workoutCalories} onChange={(e) => setWorkoutCalories(e.target.value === '' ? '' : Number(e.target.value))} placeholder="250" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} required />
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-medium transition text-sm shadow-md shadow-indigo-600/20">
                    Registrar Entrenamiento 🔥
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-slate-400">Entrenamientos del día ({todaysWorkouts.length})</h3>
                  <span className="text-xs font-bold text-rose-400">Total: -{totalCaloriesBurned} kcal</span>
                </div>

                {todaysWorkouts.length === 0 ? (
                  <div className={`text-center py-10 rounded-3xl border border-dashed text-xs ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
                    Sin entrenamientos registrados en esta fecha.
                  </div>
                ) : (
                  todaysWorkouts.map(workout => (
                    <div key={workout.id} className={`p-4 rounded-2xl flex justify-between items-center border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-sm">{workout.exerciseName}</h5>
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">{workout.category}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">⏱️ {workout.durationMinutes} minutos</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-rose-500 text-sm">-{workout.caloriesBurned} kcal</span>
                        <button onClick={() => setSelectedWorkoutToDelete(workout)} title="Eliminar entrenamiento" className="text-xs text-rose-400 hover:text-rose-500 transition p-1">🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {currentTab === 'profile' && (
            <div className={`p-6 rounded-3xl border space-y-5 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
              <h3 className="text-base font-bold text-indigo-600 dark:text-indigo-400">Perfil y Tendencia de Peso</h3>
              
              <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/50 shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-indigo-600/25 border-2 border-indigo-500/50 flex items-center justify-center text-indigo-400 text-2xl font-bold">👤</div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">Foto de perfil</label>
                  <div className="flex flex-wrap gap-2">
                    <label className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-2 rounded-xl font-medium cursor-pointer transition shadow-sm flex items-center gap-1.5">
                      <span>📸</span> Tomar Foto
                      <input type="file" accept="image/*" capture="user" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
                    </label>
                    <label className={`text-xs px-3 py-2 rounded-xl font-medium cursor-pointer transition border ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700'}`}>
                      📁 Galería
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
                    </label>
                  </div>
                  {uploadingAvatar && <span className="text-[10px] text-indigo-400 animate-pulse block">Subiendo imagen...</span>}
                </div>
              </div>

              <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400">Tu IMC Actual</span>
                    <div className="text-2xl font-black">{imcNum || '--'}</div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium border ${imcStatus.bg} ${imcStatus.color}`}>{imcStatus.text}</span>
                </div>
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-800 p-0.5 border border-slate-700/60 relative">
                  <div className="h-full bg-sky-400 flex-[1]"></div>
                  <div className="h-full bg-emerald-500 flex-[1.5]"></div>
                  <div className="h-full bg-amber-500 flex-[1]"></div>
                  <div className="h-full bg-rose-500 flex-[1]"></div>
                  <div className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_8px_white] transition-all duration-500 -translate-x-1/2 rounded-full" style={{ left: `${imcPercentage}%` }}></div>
                </div>
              </div>

              {weightLogs.length > 0 && (
                <div className={`p-4 rounded-2xl border space-y-2 ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">📈 Tendencia de Peso (kg)</span>
                  <div className="flex items-end gap-2 h-24 pt-4 px-2">
                    {weightLogs.map((log, idx) => {
                      const minW = Math.min(...weightLogs.map(w => w.weight)) - 2;
                      const maxW = Math.max(...weightLogs.map(w => w.weight)) + 2;
                      const heightPct = Math.max(15, Math.min(100, ((log.weight - minW) / (maxW - minW || 1)) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                          <span className="text-[9px] text-indigo-400 font-bold opacity-0 group-hover:opacity-150 transition">{log.weight}kg</span>
                          <div className="w-full bg-indigo-600/80 rounded-t-md transition-all duration-500" style={{ height: `${heightPct}%` }}></div>
                          <span className="text-[8px] text-slate-500 truncate w-full text-center">{log.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Nombre completo</label>
                  <input type="text" value={profile.fullName} onChange={(e) => saveProfileToSupabase({...profile, fullName: e.target.value})} placeholder="Tu nombre" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Peso actual (kg)</label>
                    <input type="number" value={profile.weight || ''} onChange={(e) => handleRecordWeight(Number(e.target.value))} placeholder="Ej. 75" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Altura (cm)</label>
                    <input type="number" value={profile.height || ''} onChange={(e) => saveProfileToSupabase({...profile, height: Number(e.target.value)})} placeholder="Ej. 175" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium">Meta Diaria de Calorías (kcal)</label>
                  <input type="number" value={profile.goalCalories || ''} onChange={(e) => saveProfileToSupabase({...profile, goalCalories: Number(e.target.value)})} placeholder="Ej. 2000" className={`w-full p-3 rounded-xl text-sm border mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                </div>
              </div>

              <button onClick={exportDataToCSV} className={`w-full py-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 ${theme === 'dark' ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-indigo-600'}`}>
                <span>📥</span> Exportar Historial a CSV
              </button>
            </div>
          )}

          {currentTab === 'history' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-indigo-600 dark:text-indigo-400">Historial Mensual</h3>
                <span className="text-xs text-slate-400">Meta: {profile.goalCalories} kcal</span>
              </div>

              <div className={`p-4 rounded-3xl border shadow-sm transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between items-center mb-4 px-1">
                  <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))} className={`p-2 rounded-xl text-xs border transition ${theme === 'dark' ? 'bg-slate-950 border-slate-800 hover:bg-slate-800' : 'bg-slate-100 border-slate-200'}`}>◀ Anterior</button>
                  <span className="text-sm font-bold tracking-wide">{monthNames[month]} {year}</span>
                  <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))} className={`p-2 rounded-xl text-xs border transition ${theme === 'dark' ? 'bg-slate-950 border-slate-800 hover:bg-slate-800' : 'bg-slate-100 border-slate-200'}`}>Siguiente ▶</button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
                  <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} className="h-16 opacity-0"></div>)}
                  {Array.from({ length: totalDaysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayMeals = meals.filter(m => m.date === dateString);
                    const dayCals = dayMeals.reduce((acc, m) => acc + m.calories, 0);
                    const hasMeals = dayMeals.length > 0;
                    const isExceeded = dayCals > profile.goalCalories;

                    return (
                      <div key={dateString} onClick={() => hasMeals && setSelectedDayModal(dateString)} className={`h-16 rounded-xl p-1 flex flex-col justify-between border transition relative overflow-hidden ${hasMeals ? (isExceeded ? 'bg-rose-500/10 border-rose-500/30 cursor-pointer hover:border-rose-500' : 'bg-emerald-500/10 border-emerald-500/30 cursor-pointer hover:border-emerald-500') : theme === 'dark' ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200/60'}`}>
                        <span className={`text-[11px] font-bold ${hasMeals ? (isExceeded ? 'text-rose-500' : 'text-emerald-500') : 'text-slate-400'}`}>{dayNum}</span>
                        {hasMeals ? (
                          <div className="text-center">
                            <span className={`text-[10px] font-black block leading-none ${isExceeded ? 'text-rose-500' : 'text-emerald-500'}`}>{dayCals}</span>
                            <span className="text-[8px] text-slate-400 uppercase">kcal</span>
                          </div>
                        ) : <span className="text-[9px] text-slate-500 text-center pb-1">-</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Botón Flotante para ir al Top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-16 right-4 z-40 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-full shadow-2xl transition-all transform hover:scale-110 flex items-center justify-center border border-indigo-400/40"
            title="Ir arriba"
          >
            ⬆️
          </button>
        )}

        {/* Modal de Detalle de Día */}
        {selectedDayModal && (() => {
          const dayMeals = meals.filter(m => m.date === selectedDayModal);
          const dayTotalCals = dayMeals.reduce((acc, m) => acc + m.calories, 0);
          const isExceeded = dayTotalCals > profile.goalCalories;
          const filteredMeals = historyFilterCategory === 'Todos' ? dayMeals : dayMeals.filter(m => m.mealType === historyFilterCategory);

          return (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className={`w-full max-w-sm p-6 rounded-3xl border space-y-4 shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                <div className="flex justify-between items-center border-b pb-3 border-slate-700/40">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Detalle del Día</span>
                    <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                      <span>{selectedDayModal}</span>
                      <span>{isExceeded ? '😢' : '😊'}</span>
                    </h4>
                  </div>
                  <button onClick={() => setSelectedDayModal(null)} className="text-slate-400 hover:text-white text-xs p-1.5 rounded-xl border border-slate-700/50">✕</button>
                </div>

                <div className={`p-3 rounded-2xl flex justify-between items-center text-xs font-bold border ${isExceeded ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}>
                  <span>Total del Día:</span>
                  <span>{dayTotalCals} kcal / {profile.goalCalories} kcal</span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Filtrar por categoría:</span>
                  <div className="grid grid-cols-6 gap-1">
                    {['Todos', 'Desayuno', 'Almuerzo', 'Comida', 'Cena', 'Snack'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setHistoryFilterCategory(cat)}
                        className={`py-1.5 text-[9px] font-bold rounded-xl border transition ${historyFilterCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {filteredMeals.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">No hay registros en esta categoría.</div>
                  ) : historyFilterCategory === 'Todos' ? (
                    (['Desayuno', 'Almuerzo', 'Comida', 'Cena', 'Snack'] as const).map(type => {
                      const group = dayMeals.filter(m => m.mealType === type);
                      if (group.length === 0) return null;
                      return (
                        <div key={type} className="space-y-1.5">
                          <h5 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">{type}</h5>
                          {group.map(meal => (
                            <div key={meal.id} className={`p-2.5 rounded-xl border flex justify-between items-center ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                              <div>
                                <h6 className="text-xs font-semibold">{meal.name}</h6>
                                <span className="text-[9px] text-slate-400">P: {meal.protein}g • C: {meal.carbs}g • G: {meal.fat}g</span>
                              </div>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">+{meal.calories} kcal</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    filteredMeals.map(meal => (
                      <div key={meal.id} className={`p-3 rounded-2xl border flex justify-between items-center ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div>
                          <h5 className="text-xs font-semibold">{meal.name}</h5>
                          <span className="text-[10px] text-slate-400">P: {meal.protein}g • C: {meal.carbs}g • G: {meal.fat}g</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">+{meal.calories} kcal</span>
                      </div>
                    ))
                  )}
                </div>

                <button onClick={() => setSelectedDayModal(null)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-medium transition shadow-md shadow-indigo-600/20">Cerrar</button>
              </div>
            </div>
          );
        })()}

        {/* Modal de Confirmación para Eliminar Alimento */}
        {selectedMealToDelete && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm p-6 rounded-3xl border space-y-4 shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
              <div className="text-center space-y-2">
                <span className="text-2xl">⚠️</span>
                <h4 className="text-sm font-bold">¿Eliminar este registro?</h4>
                <p className="text-xs text-slate-400">Vas a eliminar <strong className="text-indigo-400">{selectedMealToDelete.name}</strong> ({selectedMealToDelete.calories} kcal) de tu diario.</p>
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  onClick={() => handleDeleteMeal(selectedMealToDelete)}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl text-xs font-semibold transition shadow-md shadow-rose-600/20"
                >
                  Sí, eliminar
                </button>
                <button 
                  onClick={() => setSelectedMealToDelete(null)}
                  className="w-full bg-slate-800/40 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition border border-slate-700/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación para Eliminar Entrenamiento */}
        {selectedWorkoutToDelete && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm p-6 rounded-3xl border space-y-4 shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
              <div className="text-center space-y-2">
                <span className="text-2xl">⚠️</span>
                <h4 className="text-sm font-bold">¿Eliminar este entrenamiento?</h4>
                <p className="text-xs text-slate-400">Vas a eliminar <strong className="text-indigo-400">{selectedWorkoutToDelete.exerciseName}</strong> (-{selectedWorkoutToDelete.caloriesBurned} kcal).</p>
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  onClick={() => handleDeleteWorkout(selectedWorkoutToDelete)}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl text-xs font-semibold transition shadow-md shadow-rose-600/20"
                >
                  Sí, eliminar
                </button>
                <button 
                  onClick={() => setSelectedWorkoutToDelete(null)}
                  className="w-full bg-slate-800/40 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition border border-slate-700/50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Opciones para Comida Favorita */}
        {selectedFavorite && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm p-6 rounded-3xl border space-y-4 shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
              
              <div className="flex justify-between items-center border-b pb-3 border-slate-700/40">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Comida Favorita</span>
                  <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selectedFavorite.name}</h4>
                </div>
                <button onClick={() => setSelectedFavorite(null)} className="text-slate-400 hover:text-white text-xs p-1.5 rounded-xl border border-slate-700/50">✕</button>
              </div>

              <div className={`p-3 rounded-2xl flex justify-between items-center text-xs font-medium border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span>Desglose nutricional:</span>
                <span className="font-bold text-indigo-500">+{selectedFavorite.calories} kcal</span>
              </div>
              <div className="text-[11px] text-slate-400 text-center">
                Proteínas: {selectedFavorite.protein}g • Carbos: {selectedFavorite.carbs}g • Grasas: {selectedFavorite.fat}g
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  disabled={addingFav}
                  onClick={() => {
                    addFavoriteToDay(selectedFavorite);
                    setSelectedFavorite(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  📥 Registrar en el Diario de Hoy
                </button>

                <button 
                  onClick={() => {
                    const updated = favorites.filter(f => f.name !== selectedFavorite.name);
                    setFavorites(updated);
                    if (session?.user?.id) {
                      localStorage.setItem(`nutriai_favs_${session.user.id}`, JSON.stringify(updated));
                    }
                    setSelectedFavorite(null);
                  }}
                  className="w-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 py-2.5 rounded-xl text-xs font-semibold transition"
                >
                  🗑️ Eliminar de Favoritos
                </button>
              </div>

              <button onClick={() => setSelectedFavorite(null)} className="w-full text-xs text-slate-400 hover:text-slate-200 pt-1 text-center block">Cancelar</button>
            </div>
          </div>
        )}

        {/* Modal para la Sugerencia de Cena IA */}
        {aiDinnerModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-sm p-6 rounded-3xl border space-y-4 shadow-2xl relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
              
              <div className="flex justify-between items-center border-b pb-3 border-slate-700/40">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">✨ Sugerencia de IA</span>
                  <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{aiDinnerModal.name}</h4>
                </div>
                <button onClick={() => setAiDinnerModal(null)} className="text-slate-400 hover:text-white text-xs p-1.5 rounded-xl border border-slate-700/50">✕</button>
              </div>

              <div className={`p-4 rounded-2xl space-y-2 border ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Calorías estimadas:</span>
                  <strong className="text-indigo-500 font-black">+{aiDinnerModal.calories} kcal</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Proteínas:</span>
                  <span className="font-bold">{aiDinnerModal.protein}g</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Carbohidratos:</span>
                  <span className="font-bold">{aiDinnerModal.carbs}g</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Grasas:</span>
                  <span className="font-bold">{aiDinnerModal.fat}g</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button 
                  disabled={addingFav}
                  onClick={() => {
                    addFavoriteToDay({
                      name: aiDinnerModal.name,
                      calories: aiDinnerModal.calories,
                      protein: aiDinnerModal.protein,
                      carbs: aiDinnerModal.carbs,
                      fat: aiDinnerModal.fat,
                      mealType: 'Cena'
                    });
                    setAiDinnerModal(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  📥 Registrar como mi Cena de Hoy
                </button>

                <button 
                  onClick={() => {
                    saveAsFavorite({
                      id: '',
                      name: aiDinnerModal.name,
                      calories: aiDinnerModal.calories,
                      protein: aiDinnerModal.protein,
                      carbs: aiDinnerModal.carbs,
                      fat: aiDinnerModal.fat,
                      date: selectedDate,
                      mealType: 'Cena'
                    });
                    alert('¡Añadido a tus favoritos!');
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold border transition ${theme === 'dark' ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-amber-400' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-600'}`}
                >
                  ⭐ Guardar en Favoritos
                </button>
              </div>

              <button onClick={() => setAiDinnerModal(null)} className="w-full text-xs text-slate-400 hover:text-slate-200 pt-1 text-center block">Cerrar</button>
            </div>
          </div>
        )}

        <nav className={`absolute bottom-0 left-0 right-0 backdrop-blur-md border-t p-2 flex justify-around text-[10px] font-medium z-50 transition-colors ${theme === 'dark' ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-white/90 border-slate-200 text-slate-600'}`}>
          <button onClick={() => setCurrentTab('dashboard')} className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${currentTab === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            <span>📊</span><span className="mt-1">Dashboard</span>
          </button>
          <button onClick={() => setCurrentTab('tracker')} className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${currentTab === 'tracker' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            <span>🍽️</span><span className="mt-1">Diario</span>
          </button>
          <button onClick={() => setCurrentTab('workout')} className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${currentTab === 'workout' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            <span>💪</span><span className="mt-1">Entreno</span>
          </button>
          <button onClick={() => setCurrentTab('history')} className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${currentTab === 'history' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            <span>📅</span><span className="mt-1">Historial</span>
          </button>
          <button onClick={() => setCurrentTab('profile')} className={`flex flex-col items-center py-1 px-2 rounded-xl transition ${currentTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}>
            <span>👤</span><span className="mt-1">Perfil</span>
          </button>
        </nav>

      </main>
    </div>
  );
}