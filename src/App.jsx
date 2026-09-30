import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import HomeView from './components/HomeView';
import ProfileView from './components/ProfileView';
import MeetingsView from './components/MeetingsView';
import FeedView from './components/FeedView';
import { 
  Home,
  CalendarDays, 
  Image as ImageIcon, 
  UserCircle, 
  Sun, 
  Moon, 
  Flame, 
  Cross, 
  LogOut, 
  LogIn 
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tema Light / Dark
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('cenaculo_theme') === 'dark';
  });

  // Aba ativa: 'inicio' | 'encontros' | 'feed' | 'perfil' (com suporte a link direto ?tab=...)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (['inicio', 'encontros', 'feed', 'perfil'].includes(tabParam)) {
        return tabParam;
      }
    } catch (e) {
      // Ignora erro
    }
    return 'inicio';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('cenaculo_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('cenaculo_theme', 'light');
    }
  }, [darkMode]);

  // Listener de autenticação Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userOrId) => {
    const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
    } else if (typeof userOrId === 'object' && userOrId.id) {
      setProfile({
        id: userOrId.id,
        email: userOrId.email,
        display_name: userOrId.user_metadata?.full_name || userOrId.user_metadata?.name || userOrId.email?.split('@')[0] || 'Crismando',
        avatar_url: userOrId.user_metadata?.avatar_url || userOrId.user_metadata?.picture || '',
      });
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121417] flex items-center justify-center">
        <Flame className="w-8 h-8 text-amber-500 fill-amber-500 animate-pulse" />
      </div>
    );
  }

  // Se não estiver logado: Tela de Entrada Sacra
  if (!session) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121417] text-slate-800 dark:text-slate-100 flex flex-col justify-center items-center px-4 relative transition-colors duration-200">
        
        {/* Alternador de Tema no Login */}
        <div className="absolute top-6 right-6">
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Alternar Tema"
            className="p-2.5 rounded-2xl bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 text-slate-700 dark:text-amber-400 shadow-sm hover:scale-105 transition-transform cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="max-w-md w-full bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-cenaculo-gold mx-auto shadow-lg shadow-cenaculo-crimson/25 bg-black">
            <img 
              src="/santos_padroeiros.jpg" 
              alt="Santa Filomena e São José Sánchez" 
              className="w-full h-full object-cover object-top" 
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-cenaculo-crimson dark:text-cenaculo-gold font-serif">
              Cenáculo de Crisma
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest font-semibold">
              Sta. Filomena & S. José Sánchez
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 text-xs italic text-amber-900 dark:text-amber-200 leading-relaxed shadow-inner">
            "Nunca foi tão fácil ganhar o Céu como agora."
            <br />
            <span className="font-bold not-italic mt-1 inline-block text-amber-800 dark:text-amber-300">
              — ¡Viva Cristo Rey!
            </span>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            Entrar com Conta do Google
          </button>
        </div>
      </div>
    );
  }

  // Aplicativo Autenticado
  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#121417] text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#1A1D21]/80 backdrop-blur-md border-b border-amber-900/10 dark:border-amber-500/10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div 
            onClick={() => setActiveTab('inicio')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cenaculo-crimson to-cenaculo-gold flex items-center justify-center text-white shadow-md shadow-cenaculo-crimson/20">
              <Cross className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-wide flex items-center gap-1.5 text-cenaculo-crimson dark:text-cenaculo-gold font-serif">
                Cenáculo
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider">
                Olá, {profile?.display_name?.split(' ')[0] || 'Crismando'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegação Desktop */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              <button 
                onClick={() => setActiveTab('inicio')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'inicio' 
                    ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Início
              </button>
              <button 
                onClick={() => setActiveTab('encontros')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'encontros' 
                    ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Encontros
              </button>
              <button 
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'feed' 
                    ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Mural / Mídia
              </button>
              <button 
                onClick={() => setActiveTab('perfil')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'perfil' 
                    ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Meu Perfil
              </button>
            </nav>

            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Alternar Tema"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:scale-105 transition-transform cursor-pointer"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-24 md:pb-8">
        {activeTab === 'inicio' && (
          <HomeView 
            user={session?.user} 
            profile={profile} 
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'encontros' && (
          <MeetingsView 
            user={session?.user} 
            profile={profile} 
          />
        )}

        {activeTab === 'feed' && (
          <FeedView 
            user={session?.user} 
            profile={profile} 
          />
        )}

        {activeTab === 'perfil' && (
          <ProfileView 
            profile={profile} 
            onProfileUpdated={() => session?.user && fetchProfile(session.user)} 
          />
        )}
      </main>

      {/* Navegação Mobile Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1A1D21]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-40 px-4 py-2 flex justify-around items-center shadow-lg">
        <button
          onClick={() => setActiveTab('inicio')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'inicio' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px]">Início</span>
        </button>

        <button
          onClick={() => setActiveTab('encontros')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'encontros' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[11px]">Encontros</span>
        </button>

        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'feed' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[11px]">Mural</span>
        </button>

        <button
          onClick={() => setActiveTab('perfil')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'perfil' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <UserCircle className="w-5 h-5" />
          <span className="text-[11px]">Perfil</span>
        </button>
      </nav>

    </div>
  );
}
