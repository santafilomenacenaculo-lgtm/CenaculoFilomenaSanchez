import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import ParishEvents from './ParishEvents';
import santosPadroeirosImg from '../assets/santos_padroeiros.jpg';
import { 
  Cross, 
  Sparkles, 
  CalendarDays, 
  Image as ImageIcon, 
  Crown, 
  ChevronRight, 
  Flame, 
  Heart, 
  ArrowRight, 
  Clock, 
  Users, 
  Plus, 
  MessageSquareHeart,
  Loader2,
  MessageCircle,
  Share2
} from 'lucide-react';

export default function HomeView({ user, profile, onNavigate }) {
  const [bestDay, setBestDay] = useState(null);
  const [bestDayCount, setBestDayCount] = useState(0);
  const [loadingBestDay, setLoadingBestDay] = useState(true);

  const [recentPosts, setRecentPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const currentMonthName = useMemo(() => {
    const raw = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  // 1. Buscar o Melhor Dia do Mês da tabela availabilities
  const fetchBestDayOfMonth = useCallback(async () => {
    try {
      setLoadingBestDay(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();

      const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('availabilities')
        .select('available_date, user_id')
        .gte('available_date', startDateStr)
        .lte('available_date', endDateStr);

      if (error) {
        console.error('Erro detalhado Supabase ao buscar availabilities:', error);
        return;
      }

      if (!data || data.length === 0) {
        setBestDay(null);
        setBestDayCount(0);
        return;
      }

      // Agrupar por data
      const counts = {};
      data.forEach((item) => {
        counts[item.available_date] = (counts[item.available_date] || 0) + 1;
      });

      let max = 0;
      let topDates = [];
      Object.entries(counts).forEach(([date, cnt]) => {
        if (cnt > max) {
          max = cnt;
          topDates = [date];
        } else if (cnt === max) {
          topDates.push(date);
        }
      });

      if (max > 0) {
        setBestDay(topDates[0]);
        setBestDayCount(max);
      } else {
        setBestDay(null);
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (melhor dia home):', err);
    } finally {
      setLoadingBestDay(false);
    }
  }, []);

  // 2. Buscar as 2-3 postagens mais recentes do mural
  const fetchRecentPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, 
          user_id, 
          caption, 
          media_url, 
          media_type, 
          created_at, 
          profiles(display_name, avatar_url),
          post_reactions(id, reaction_type),
          post_comments(id)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Erro detalhado Supabase ao buscar posts recentes:', error);
      } else {
        setRecentPosts(data || []);
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (posts recentes):', err);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchBestDayOfMonth();
    fetchRecentPosts();
  }, [fetchBestDayOfMonth, fetchRecentPosts]);

  // Formatar data em português por extenso
  const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const formatted = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Compartilhar melhor dia apurado no WhatsApp ou via Web Share API
  const handleShareBestDay = async () => {
    if (!bestDay) return;
    const formattedDate = formatDateFull(bestDay);
    const appUrl = `${window.location.origin}${window.location.pathname}?tab=encontros&date=${bestDay}`;

    const message = 
`✝️🔥 *Cenáculo de Crisma* 🔥✝️
*Sta. Filomena & S. José Sánchez del Río*

📅 *Melhor Dia do Encontro (${currentMonthName}):*
✨ *${formattedDate}*

👥 Já temos *${bestDayCount} ${bestDayCount === 1 ? 'irmão disponível' : 'irmãos disponíveis'}* com presença confirmada!

📲 Marque ou consulte seus dias no aplicativo:
${appUrl}

_"Nunca foi tão fácil ganhar o Céu como agora."_
¡Viva Cristo Rey! 🕊️`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Melhor Dia do Cenáculo - ${currentMonthName}`,
          text: message,
          url: appUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  const userName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Crismando';

  return (
    <div className="space-y-6">

      {/* A) TOPO DE BOAS-VINDAS SACRO COM IMAGEM DOS SANTOS PADROEIROS E ATALHOS */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-red-950 via-cenaculo-crimson to-amber-950 text-white shadow-xl relative overflow-hidden border border-cenaculo-gold/30">
        
        {/* Marca d'água sutil de fundo com a imagem dos santos */}
        <div className="absolute right-0 top-0 bottom-0 w-2/3 md:w-1/2 opacity-15 md:opacity-20 pointer-events-none overflow-hidden">
          <img 
            src={santosPadroeirosImg} 
            alt="" 
            className="w-full h-full object-cover object-center" 
            style={{ 
              maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 15%, transparent 100%)', 
              WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 15%, transparent 100%)' 
            }} 
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Lado Esquerdo: Frase, Padroeiros e Ações */}
          <div className="flex-1 space-y-4 max-w-xl">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-amber-200 backdrop-blur-xs border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-cenaculo-gold" />
                Cenáculo de Santa Filomena & São José Sánchez
              </span>
              <span className="text-xs text-amber-200/80 font-medium">
                Paz e Bem, {userName.split(' ')[0]}!
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide font-serif leading-tight">
                "Nunca foi tão fácil ganhar o Céu como agora."
              </h2>
              <p className="text-xs md:text-sm text-amber-300 font-semibold tracking-wider">
                — São José Sánchez del Río (¡Viva Cristo Rey!)
              </p>
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                onClick={() => onNavigate('encontros')}
                className="py-2.5 px-4 rounded-xl bg-cenaculo-gold text-slate-950 hover:bg-cenaculo-goldLight font-bold text-xs transition-transform active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Ver Calendário de Encontros</span>
              </button>

              <button
                onClick={() => onNavigate('feed')}
                className="py-2.5 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs backdrop-blur-md transition-colors border border-white/20 flex items-center gap-2 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-amber-200" />
                <span>Mural da Comunidade</span>
              </button>
            </div>
          </div>

          {/* Lado Direito: Quadro Sacro dos Santos Padroeiros com Moldura Dourada */}
          <div className="flex-shrink-0 self-center md:self-auto flex flex-col items-center">
            <div className="relative group">
              {/* Halo de luz dourada divina */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cenaculo-gold via-amber-300 to-cenaculo-crimson rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300"></div>
              
              <div className="relative w-52 sm:w-60 md:w-64 aspect-[16/10] rounded-2xl overflow-hidden border-2 border-cenaculo-gold/90 shadow-2xl bg-black">
                <img 
                  src={santosPadroeirosImg} 
                  alt="Santa Filomena e São José Sánchez del Río" 
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                <span className="absolute bottom-1.5 left-2 right-2 text-center text-[10px] sm:text-[11px] font-bold text-amber-200 drop-shadow-md">
                  Sta. Filomena & S. José Sánchez
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* B) CARROSSEL / FAIXA DE PRÓXIMOS ACONTECIMENTOS & FESTAS */}
      <ParishEvents user={user} profile={profile} />

      {/* C) RESUMO DO PRÓXIMO ENCONTRO DO CENÁCULO */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-5 md:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-serif">
                Próximo Encontro do Cenáculo ({currentMonthName})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Data mais cotada pela turma neste mês
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('encontros')}
            className="text-xs font-semibold text-cenaculo-crimson dark:text-cenaculo-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver calendário completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingBestDay ? (
          <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cenaculo-crimson dark:text-cenaculo-gold" />
            Apurando disponibilidades do mês...
          </div>
        ) : bestDay ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cenaculo-crimson/10 via-amber-500/10 to-cenaculo-gold/15 border border-cenaculo-crimson/20 dark:border-cenaculo-gold/30 flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cenaculo-crimson dark:text-cenaculo-gold flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> Melhor dia apurado
              </span>
              <h4 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                {formatDateFull(bestDay)}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cenaculo-crimson dark:text-cenaculo-gold" />
                <span><strong>{bestDayCount}</strong> {bestDayCount === 1 ? 'irmão disponível' : 'irmãos disponíveis'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleShareBestDay}
                className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-transform active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Avisar no WhatsApp do Cenáculo"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Avisar no WhatsApp</span>
              </button>

              <button
                onClick={() => onNavigate('encontros')}
                className="py-2.5 px-4 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-semibold text-xs transition-transform active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Marcar presença</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O calendário de <strong>{currentMonthName}</strong> está aberto! Toque nos dias livres para definirmos a melhor data do Cenáculo.
            </p>
            <button
              onClick={() => onNavigate('encontros')}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-cenaculo-crimson dark:text-cenaculo-gold hover:underline cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Abrir Calendário de Encontros</span>
            </button>
          </div>
        )}
      </div>

      {/* D) ÚLTIMOS MOMENTOS DO MURAL */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cenaculo-crimson/10 text-cenaculo-crimson dark:text-cenaculo-gold flex items-center justify-center shadow-xs">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-serif">
                Últimos Momentos do Mural
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fotos e lembranças recentes compartilhadas pelos irmãos
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('feed')}
            className="text-xs font-semibold text-cenaculo-crimson dark:text-cenaculo-gold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver todo o Mural</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingPosts ? (
          <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cenaculo-crimson dark:text-cenaculo-gold" />
            Carregando publicações recentes...
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ainda não há fotos ou orações postadas no mural.
            </p>
            <button
              onClick={() => onNavigate('feed')}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar Primeiro Momento</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {recentPosts.map((post) => {
              const authorName = post.profiles?.display_name || 'Crismando';
              const reactions = post.post_reactions || [];
              const amenCount = reactions.filter((r) => r.reaction_type === 'amen').length;
              const flameCount = reactions.filter((r) => r.reaction_type === 'flame').length;
              const heartCount = reactions.filter((r) => r.reaction_type === 'heart').length;

              return (
                <div
                  key={post.id}
                  onClick={() => onNavigate('feed')}
                  className="group bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5 hover:border-cenaculo-crimson/30 dark:hover:border-cenaculo-gold/30 transition-all cursor-pointer shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {/* Thumbnail se houver mídia */}
                    {post.media_url && (
                      <div className="w-full h-32 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                        {post.media_type === 'video' ? (
                          <video 
                            src={post.media_url} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <img 
                            src={post.media_url} 
                            alt="" 
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                          />
                        )}
                      </div>
                    )}

                    {/* Autor e Legenda */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                        {authorName}
                      </span>
                      {post.caption && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mt-0.5">
                          {post.caption}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reações e comentários resumidos */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {amenCount > 0 && <span className="flex items-center gap-0.5">🙏 {amenCount}</span>}
                      {flameCount > 0 && <span className="flex items-center gap-0.5">🔥 {flameCount}</span>}
                      {heartCount > 0 && <span className="flex items-center gap-0.5">❤️ {heartCount}</span>}
                      {amenCount === 0 && flameCount === 0 && heartCount === 0 && (
                        <span className="text-[10px] text-slate-400">Ver no mural →</span>
                      )}
                    </div>
                    {post.post_comments?.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <MessageCircle className="w-3 h-3" />
                        {post.post_comments.length}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
