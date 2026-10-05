import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import HomeView from './components/HomeView';
import ProfileView from './components/ProfileView';
import MeetingsView from './components/MeetingsView';
import FeedView from './components/FeedView';
import UsersManagementView from './components/UsersManagementView';
import { 
  getUserRole, 
  isProfeta, 
  isFilomeno, 
  isPagao, 
  canInteract, 
  canManageUsers, 
  ROLES, 
  SUPERUSER_EMAIL 
} from './utils/roles';
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
  LogIn,
  Crown,
  Eye,
  Users,
  Lock
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tema Light / Dark
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('cenaculo_theme') === 'dark';
  });

  // Aba ativa: 'inicio' | 'encontros' | 'feed' | 'perfil' | 'usuarios'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (['inicio', 'encontros', 'feed', 'perfil', 'usuarios'].includes(tabParam)) {
        return tabParam;
      }
    } catch (e) {
      // Ignora erro
    }
    return 'inicio';
  });

  // Aplica classe dark mode
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
      if (session?.user) syncAndFetchProfile(session.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) syncAndFetchProfile(session.user);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sincroniza e busca o perfil do usuário.
   * Se for novo cadastro, salva na tabela profiles com role 'Pagão' (ou 'Profeta' se for rap.rag@gmail.com).
   */
  const syncAndFetchProfile = async (userObj) => {
    if (!userObj) return;

    const email = (userObj.email || '').toLowerCase().trim();
    const isSuper = email === SUPERUSER_EMAIL;
    const defaultRole = isSuper ? ROLES.PROFETA : ROLES.PAGAO;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userObj.id)
        .single();

      if (!error && data) {
        // Se o usuário já existe na tabela
        const effectiveRole = isSuper ? ROLES.PROFETA : (data.role || ROLES.PAGAO);
        const resolvedProfile = {
          ...data,
          role: effectiveRole,
        };
        setProfile(resolvedProfile);

        // Se a role no banco estiver desatualizada, tenta atualizar
        if (data.role !== effectiveRole) {
          supabase
            .from('profiles')
            .update({ role: effectiveRole })
            .eq('id', userObj.id)
            .then(() => {});
        }
      } else {
        // Usuário novo! Cria registro inicial na tabela profiles
        const displayName = 
          userObj.user_metadata?.full_name || 
          userObj.user_metadata?.name || 
          email.split('@')[0] || 
          'Crismando';
        const avatarUrl = 
          userObj.user_metadata?.avatar_url || 
          userObj.user_metadata?.picture || 
          '';

        const initialData = {
          id: userObj.id,
          email: userObj.email,
          display_name: displayName,
          avatar_url: avatarUrl,
          role: defaultRole,
        };

        // Tenta cadastrar com coluna role
        const { data: created, error: insertErr } = await supabase
          .from('profiles')
          .upsert(initialData, { onConflict: 'id' })
          .select()
          .single();

        if (!insertErr && created) {
          setProfile(created);
        } else {
          // Fallback caso a coluna role ainda não tenha sido criada no Supabase
          const safeData = {
            id: userObj.id,
            email: userObj.email,
            display_name: displayName,
            avatar_url: avatarUrl,
          };
          await supabase.from('profiles').upsert(safeData, { onConflict: 'id' });
          setProfile({
            ...safeData,
            role: defaultRole,
          });
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar perfil do usuário:', err);
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

  // Papéis e permissões calculadas
  const userRole = getUserRole(session?.user, profile);
  const isUserProfeta = userRole === ROLES.PROFETA;
  const isUserFilomeno = userRole === ROLES.FILOMENO;
  const isUserPagao = userRole === ROLES.PAGAO;

  // Regra de Redirecionamento:
  // - Usuário Pagão SÓ pode ver o Mural e Perfil
  // - Não-profetas NUNCA podem ver a aba 'usuarios'
  useEffect(() => {
    if (!profile && !session?.user) return;

    if (isUserPagao && activeTab !== 'feed' && activeTab !== 'perfil') {
      setActiveTab('feed');
    } else if (!isUserProfeta && activeTab === 'usuarios') {
      setActiveTab(isUserPagao ? 'feed' : 'inicio');
    }
  }, [profile, isUserPagao, isUserProfeta, activeTab, session?.user]);

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
            onClick={() => setActiveTab(isUserPagao ? 'feed' : 'inicio')}
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
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider">
                  Olá, {profile?.display_name?.split(' ')[0] || 'Crismando'}
                </span>
                
                {/* Badge de Classe no Header */}
                {isUserProfeta ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                    <Crown className="w-2.5 h-2.5 text-amber-500" />
                    Profeta
                  </span>
                ) : isUserFilomeno ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-rose-500/15 text-cenaculo-crimson dark:text-cenaculo-gold border border-cenaculo-crimson/20">
                    <Flame className="w-2.5 h-2.5 text-cenaculo-gold" />
                    Filomeno
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Eye className="w-2.5 h-2.5 text-slate-400" />
                    Pagão
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegação Desktop */}
            <nav className="hidden md:flex items-center gap-1 mr-4">
              
              {/* Início e Encontros: Liberados apenas para Filomenos e Profeta */}
              {!isUserPagao && (
                <>
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
                </>
              )}

              {/* Mural: Visível para TODOS (Pagão, Filomeno e Profeta) */}
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

              {/* Aba Exclusiva do Superusuário Profeta: Gestão de Discípulos */}
              {isUserProfeta && (
                <button 
                  onClick={() => setActiveTab('usuarios')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'usuarios' 
                      ? 'bg-amber-500 text-slate-950 shadow-sm' 
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  <Crown className="w-4 h-4 text-amber-500" />
                  Gestão de Irmãos
                </button>
              )}

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
        {activeTab === 'inicio' && !isUserPagao && (
          <HomeView 
            user={session?.user} 
            profile={profile} 
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'encontros' && !isUserPagao && (
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

        {activeTab === 'usuarios' && isUserProfeta && (
          <UsersManagementView 
            user={session?.user} 
            profile={profile} 
          />
        )}

        {activeTab === 'perfil' && (
          <ProfileView 
            profile={profile} 
            user={session?.user}
            onProfileUpdated={() => session?.user && syncAndFetchProfile(session.user)} 
          />
        )}
      </main>

      {/* Navegação Mobile Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#1A1D21]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-40 px-3 py-2 flex justify-around items-center shadow-lg">
        {!isUserPagao && (
          <>
            <button
              onClick={() => setActiveTab('inicio')}
              className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                activeTab === 'inicio' 
                  ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
                  : 'text-slate-400'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">Início</span>
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
              <span className="text-[10px]">Encontros</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'feed' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-[10px]">Mural</span>
        </button>

        {/* Gestão Mobile (Apenas Profeta) */}
        {isUserProfeta && (
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'usuarios' 
                ? 'text-amber-500 font-bold' 
                : 'text-amber-600/70 dark:text-amber-400/70'
            }`}
          >
            <Crown className="w-5 h-5 text-amber-500" />
            <span className="text-[10px]">Irmãos</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('perfil')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'perfil' 
              ? 'text-cenaculo-crimson dark:text-cenaculo-gold font-bold' 
              : 'text-slate-400'
          }`}
        >
          <UserCircle className="w-5 h-5" />
          <span className="text-[10px]">Perfil</span>
        </button>
      </nav>

    </div>
  );
}
