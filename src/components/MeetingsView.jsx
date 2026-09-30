import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Users, 
  Crown, 
  Star, 
  Check, 
  Plus, 
  X, 
  User, 
  Sparkles, 
  HeartHandshake,
  Clock,
  Flame,
  Loader2,
  Share2,
  MessageSquare
} from 'lucide-react';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function MeetingsView({ user, profile }) {
  // Data de referência do mês selecionado (com suporte a parâmetro de URL ?date=YYYY-MM-DD)
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, m, d] = dateParam.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
    } catch (e) {
      // Ignora erro em ambientes sem window
    }
    return new Date();
  });

  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingDate, setActionLoadingDate] = useState(null);
  
  // Modal de detalhes de participantes para uma data específica
  const [selectedDateModal, setSelectedDateModal] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return dateParam;
      }
    } catch (e) {
      // Ignora erro
    }
    return null;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Formatador de mês/ano em português
  const monthYearLabel = useMemo(() => {
    const raw = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [currentDate]);

  // Carrega disponibilidades do mês atual
  const fetchMonthAvailabilities = useCallback(async () => {
    try {
      setLoading(true);
      const startDay = new Date(year, month, 1);
      const endDay = new Date(year, month + 1, 0);

      const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('availabilities')
        .select('id, user_id, available_date, profiles(id, display_name, avatar_url, email)')
        .gte('available_date', startDateStr)
        .lte('available_date', endDateStr);

      if (error) {
        console.error('Erro ao buscar disponibilidades:', error);
      } else {
        setAvailabilities(data || []);
      }
    } catch (err) {
      console.error('Falha de conexão com Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchMonthAvailabilities();

    // Inscrição em tempo real para sincronização com outros irmãos
    const channel = supabase
      .channel(`availabilities-${year}-${month}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availabilities' },
        () => {
          fetchMonthAvailabilities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMonthAvailabilities, year, month]);

  // Navegação de meses
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  // Mapeamento de disponibilidades por data 'YYYY-MM-DD'
  const availabilitiesByDate = useMemo(() => {
    const map = {};
    for (const item of availabilities) {
      const dateKey = item.available_date;
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(item);
    }
    return map;
  }, [availabilities]);

  // Cálculo do(s) melhor(es) dia(s) do mês
  const bestDaysInfo = useMemo(() => {
    const entries = Object.entries(availabilitiesByDate);
    if (entries.length === 0) return null;

    let maxCount = 0;
    for (const [, list] of entries) {
      if (list.length > maxCount) {
        maxCount = list.length;
      }
    }

    if (maxCount === 0) return null;

    const topDates = entries
      .filter(([, list]) => list.length === maxCount)
      .map(([date]) => date);

    return {
      dates: topDates,
      count: maxCount,
    };
  }, [availabilitiesByDate]);

  // Ranking ordenado de todos os dias que receberam votos no mês
  const rankedDays = useMemo(() => {
    return Object.entries(availabilitiesByDate)
      .map(([date, list]) => ({
        date,
        count: list.length,
        items: list,
      }))
      .sort((a, b) => {
        // Ordena por maior contagem primeiro; se empatado, por data cronológica
        if (b.count !== a.count) return b.count - a.count;
        return a.date.localeCompare(b.date);
      });
  }, [availabilitiesByDate]);

  // Alterna disponibilidade do usuário atual para a data clicada (com UI otimista)
  const handleToggleDay = async (dateStr) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) console.error('Erro detalhado Supabase auth:', authError);
      const currentUser = authData?.user || user;

      if (!currentUser) {
        alert('Faça login para marcar seus dias disponíveis.');
        return;
      }

      const currentList = availabilitiesByDate[dateStr] || [];
      const isMarked = currentList.some(a => a.user_id === currentUser.id);

      setActionLoadingDate(dateStr);

      // Otimismo na UI
      const previousAvailabilities = [...availabilities];
      if (isMarked) {
        setAvailabilities(prev => prev.filter(a => !(a.user_id === currentUser.id && a.available_date === dateStr)));
      } else {
        const optimisticEntry = {
          id: `temp-${Date.now()}`,
          user_id: currentUser.id,
          available_date: dateStr,
          profiles: {
            id: currentUser.id,
            display_name: profile?.display_name || currentUser.email?.split('@')[0] || 'Você',
            avatar_url: profile?.avatar_url || '',
            email: currentUser.email,
          }
        };
        setAvailabilities(prev => [...prev, optimisticEntry]);
      }

      if (isMarked) {
        const { error } = await supabase
          .from('availabilities')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('available_date', dateStr);

        if (error) {
          console.error('Erro detalhado Supabase ao remover disponibilidade:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('availabilities')
          .insert({
            user_id: currentUser.id,
            available_date: dateStr,
          });

        if (error) {
          console.error('Erro detalhado Supabase ao inserir disponibilidade:', error);
          throw error;
        }
      }
      // Re-sincroniza com dados reais do Supabase
      fetchMonthAvailabilities();
    } catch (err) {
      console.error('Erro detalhado Supabase (disponibilidade):', err);
      alert('Não foi possível salvar sua disponibilidade. Tente novamente.');
      fetchMonthAvailabilities();
    } finally {
      setActionLoadingDate(null);
    }
  };

  // Montagem da grade do calendário
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo

    const days = [];

    // Células em branco dos dias do mês anterior
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true, id: `empty-${i}` });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayAvails = availabilitiesByDate[dateStr] || [];
      const userMarked = dayAvails.some(a => a.user_id === user?.id);
      const isBest = bestDaysInfo?.dates.includes(dateStr);
      const isToday = dateStr === todayStr;

      days.push({
        empty: false,
        dayNumber: d,
        dateStr,
        count: dayAvails.length,
        userMarked,
        isBest,
        isToday,
        items: dayAvails,
      });
    }

    return days;
  }, [year, month, availabilitiesByDate, user?.id, bestDaysInfo]);

  // Formata data completa em português (Ex: "Sábado, 19 de Setembro")
  const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Compartilhamento no WhatsApp ou Web Share API para o Melhor Dia
  const handleShareBestDays = async () => {
    if (!bestDaysInfo || bestDaysInfo.dates.length === 0) return;

    const datesFormatted = bestDaysInfo.dates
      .map((d) => `✨ *${formatDateFull(d)}*`)
      .join('\n');

    const primaryDate = bestDaysInfo.dates[0];
    const appUrl = `${window.location.origin}${window.location.pathname}?tab=encontros&date=${primaryDate}`;
    const brothersCount = bestDaysInfo.count;

    const message = 
`✝️🔥 *Cenáculo de Crisma* 🔥✝️
*Sta. Filomena & S. José Sánchez del Río*

📅 *Melhor Data de Encontro (${monthYearLabel}):*
${datesFormatted}

👥 Já temos *${brothersCount} ${brothersCount === 1 ? 'irmão disponível' : 'irmãos disponíveis'}* com presença marcada!

📲 Marque ou consulte sua presença no nosso aplicativo:
${appUrl}

_"Nunca foi tão fácil ganhar o Céu como agora."_
¡Viva Cristo Rey! 🕊️`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Melhor Dia do Cenáculo - ${monthYearLabel}`,
          text: message,
          url: appUrl,
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback nativo WhatsApp
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Compartilhar data específica do modal no WhatsApp
  const handleShareSpecificDate = async (dateStr) => {
    const formattedDate = formatDateFull(dateStr);
    const attendees = availabilitiesByDate[dateStr] || [];
    const count = attendees.length;
    const names = attendees
      .slice(0, 8)
      .map((a) => `• ${a.profiles?.display_name || a.profiles?.email?.split('@')[0] || 'Crismando'}`)
      .join('\n');
    const more = count > 8 ? `\n... e mais ${count - 8} irmãos` : '';
    const appUrl = `${window.location.origin}${window.location.pathname}?tab=encontros&date=${dateStr}`;

    const message = 
`✝️🔥 *Encontro do Cenáculo de Crisma* 🔥✝️
*Sta. Filomena & S. José Sánchez del Río*

📅 *Data:* ${formattedDate}
👥 *Presenças confirmadas (${count}):*
${names || '• Seja o primeiro a marcar!'}${more}

📲 Marque ou altere sua disponibilidade:
${appUrl}

¡Viva Cristo Rey! 🕊️`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Encontro Cenáculo - ${formattedDate}`,
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

  const isCurrentMonthNow = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month;
  }, [year, month]);

  return (
    <div className="space-y-6">
      
      {/* 1. SELETOR DE MÊS E ANO */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-4 shadow-sm flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          aria-label="Mês anterior"
          className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-cenaculo-crimson hover:text-white dark:hover:bg-cenaculo-gold dark:hover:text-slate-950 transition-colors shadow-xs"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-cenaculo-crimson dark:text-cenaculo-gold" />
            <span className="text-lg md:text-xl font-bold text-slate-900 dark:text-white capitalize tracking-tight font-serif">
              {monthYearLabel}
            </span>
          </div>
          {!isCurrentMonthNow && (
            <button
              onClick={handleGoToday}
              className="text-[11px] font-semibold text-cenaculo-crimson dark:text-cenaculo-gold hover:underline mt-0.5 flex items-center gap-1"
            >
              <Clock className="w-3 h-3" /> Voltar para o mês atual
            </button>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          aria-label="Próximo mês"
          className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-cenaculo-crimson hover:text-white dark:hover:bg-cenaculo-gold dark:hover:text-slate-950 transition-colors shadow-xs"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 3. CARD DE DESTAQUE: "MELHOR DIA DO MÊS" */}
      {bestDaysInfo ? (
        <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-cenaculo-crimson via-red-900 to-amber-900 text-white shadow-lg relative overflow-hidden border border-cenaculo-gold/30">
          <div className="absolute right-[-10px] bottom-[-25px] opacity-15 pointer-events-none">
            <Crown className="w-44 h-44 text-cenaculo-gold" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-cenaculo-gold text-slate-950 font-bold shadow-xs">
                  <Crown className="w-4 h-4 fill-slate-950" />
                </span>
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-200">
                  {bestDaysInfo.dates.length > 1 ? '🌟 Empate Abençoado no Cenáculo' : '🌟 Melhor Dia para o Encontro'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-amber-200 border border-white/20">
                {bestDaysInfo.count} {bestDaysInfo.count === 1 ? 'irmão disponível' : 'irmãos disponíveis'}
              </span>
            </div>

            <div className="space-y-1.5">
              {bestDaysInfo.dates.map((dateStr) => (
                <div key={dateStr} className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-xs flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cenaculo-gold" />
                    {formatDateFull(dateStr)}
                  </h3>
                  <button
                    onClick={() => setSelectedDateModal(dateStr)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-amber-100 transition-colors backdrop-blur-sm border border-white/10 cursor-pointer"
                  >
                    Ver quem vai →
                  </button>
                </div>
              ))}
            </div>

            {/* Linha de rodapé com texto e botão de destaque para o WhatsApp */}
            <div className="pt-3 border-t border-white/15 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <p className="text-xs text-amber-100/90 flex-1">
                Data com maior quorum da turma. Se você ainda não marcou, toque nos dias no calendário abaixo para participar!
              </p>

              <button
                type="button"
                onClick={handleShareBestDays}
                className="py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 border border-emerald-400/40 cursor-pointer flex-shrink-0"
              >
                <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.08 7.37C8.91 7.37 8.64 7.43 8.41 7.68C8.18 7.93 7.53 8.54 7.53 9.78C7.53 11.02 8.43 12.21 8.56 12.38C8.69 12.55 10.32 15.06 12.8 16.13C13.39 16.39 13.85 16.54 14.21 16.65C14.8 16.84 15.34 16.81 15.77 16.75C16.25 16.68 17.24 16.15 17.45 15.56C17.66 14.97 17.66 14.47 17.6 14.36C17.54 14.25 17.37 14.19 17.12 14.07C16.87 13.94 15.65 13.34 15.42 13.26C15.2 13.17 15.03 13.13 14.86 13.38C14.69 13.62 14.22 14.19 14.07 14.36C13.92 14.53 13.78 14.55 13.53 14.42C13.28 14.3 12.47 14.03 11.52 13.19C10.78 12.53 10.28 11.72 10.15 11.47C10.03 11.22 10.14 11.09 10.26 10.96C10.37 10.85 10.51 10.67 10.64 10.52C10.77 10.37 10.81 10.26 10.89 10.1C10.97 9.93 10.93 9.79 10.87 9.66C10.81 9.54 10.32 8.34 10.11 7.84C9.91 7.36 9.71 7.42 9.55 7.42C9.4 7.42 9.24 7.37 9.08 7.37Z" />
                </svg>
                <span>Avisar no WhatsApp do Cenáculo</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Nenhum dia marcado em {monthYearLabel} ainda
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
            Toque nos dias no calendário abaixo em que você tem disponibilidade para descobrirmos juntos a melhor data para o nosso Cenáculo!
          </p>
        </div>
      )}

      {/* 2. CALENDÁRIO INTERATIVO */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-4 md:p-6 shadow-sm space-y-4">
        
        {/* Cabeçalho explicativo */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="font-medium flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-cenaculo-crimson dark:text-cenaculo-gold" />
            Toque no dia para <strong className="text-slate-700 dark:text-slate-200">marcar</strong> ou <strong className="text-slate-700 dark:text-slate-200">desmarcar</strong> sua presença
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cenaculo-crimson dark:bg-cenaculo-gold inline-block"></span>
              Você vai
            </span>
            <span className="flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" />
              Melhor dia
            </span>
          </div>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 md:gap-2 text-center">
          {WEEKDAYS.map((dayName, idx) => (
            <div 
              key={dayName}
              className={`py-1.5 text-xs font-bold uppercase tracking-wider ${
                idx === 0 || idx === 6 
                  ? 'text-cenaculo-crimson dark:text-cenaculo-gold' 
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-2.5">
          {calendarDays.map((cell) => {
            if (cell.empty) {
              return <div key={cell.id} className="min-h-[58px] md:min-h-[76px] rounded-2xl bg-transparent" />;
            }

            const isBusyWithAction = actionLoadingDate === cell.dateStr;

            return (
              <div
                key={cell.dateStr}
                onClick={() => handleToggleDay(cell.dateStr)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleDay(cell.dateStr); }}
                className={`group relative min-h-[62px] md:min-h-[82px] p-1.5 md:p-2.5 rounded-2xl flex flex-col justify-between cursor-pointer select-none transition-all duration-150 ${
                  cell.userMarked
                    ? 'bg-cenaculo-crimson/10 dark:bg-cenaculo-gold/15 border-2 border-cenaculo-crimson dark:border-cenaculo-gold shadow-sm scale-[1.01]'
                    : cell.isBest
                    ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 hover:border-cenaculo-gold'
                    : 'bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                {/* Topo da célula: Número do dia e distintivos */}
                <div className="flex items-center justify-between">
                  <span 
                    className={`text-xs md:text-sm font-bold flex items-center justify-center ${
                      cell.isToday 
                        ? 'w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                        : cell.userMarked
                        ? 'text-cenaculo-crimson dark:text-cenaculo-gold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Indicador de Melhor Dia ou Marcado */}
                  <div className="flex items-center gap-1">
                    {cell.isBest && (
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" title="Melhor dia do mês" />
                    )}
                    {cell.userMarked && (
                      <span className="w-4 h-4 rounded-full bg-cenaculo-crimson dark:bg-cenaculo-gold text-white dark:text-slate-950 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Base da célula: Contador de irmãos e estado de loading */}
                <div className="mt-1 flex items-end justify-between">
                  {isBusyWithAction ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cenaculo-crimson dark:text-cenaculo-gold" />
                  ) : cell.count > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDateModal(cell.dateStr);
                      }}
                      title="Ver quem marcou este dia"
                      className={`text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition-transform hover:scale-105 ${
                        cell.userMarked
                          ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Users className="w-2.5 h-2.5 md:w-3 md:h-3" />
                      <span>{cell.count}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      +
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="text-center py-2 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando presenças...
          </div>
        )}
      </div>

      {/* 4. RANKING DE DIAS VOTADOS NO MÊS */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-cenaculo-crimson dark:text-cenaculo-gold" />
              Ranking de Disponibilidade ({monthYearLabel})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Datas mais cotadas pelos crismandos ordenadas por confirmações
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {rankedDays.length} {rankedDays.length === 1 ? 'dia votado' : 'dias votados'}
          </span>
        </div>

        {rankedDays.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
            Nenhum crismando marcou datas para este mês ainda.
          </div>
        ) : (
          <div className="space-y-2.5">
            {rankedDays.map((ranked, index) => {
              const isFirst = index === 0;
              const userInThisDay = ranked.items.some(a => a.user_id === user?.id);

              return (
                <div
                  key={ranked.date}
                  onClick={() => setSelectedDateModal(ranked.date)}
                  className={`p-3.5 md:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isFirst
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Badge da posição no ranking */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isFirst
                          ? 'bg-cenaculo-gold text-slate-950 shadow-xs'
                          : index === 1
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                          : index === 2
                          ? 'bg-amber-800/20 text-amber-800 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isFirst ? <Crown className="w-3.5 h-3.5 fill-slate-950" /> : `#${index + 1}`}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        {formatDateFull(ranked.date)}
                        {userInThisDay && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cenaculo-crimson/10 text-cenaculo-crimson dark:bg-cenaculo-gold/20 dark:text-cenaculo-gold">
                            Você vai
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ranked.count} {ranked.count === 1 ? 'irmão disponível' : 'irmãos disponíveis'}
                      </p>
                    </div>
                  </div>

                  {/* Avatar stack e botão de ver */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2 overflow-hidden">
                      {ranked.items.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          title={item.profiles?.display_name || item.profiles?.email || 'Crismando'}
                          className="w-7 h-7 rounded-full border-2 border-white dark:border-[#1A1D21] bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden text-[10px] font-bold text-slate-700 dark:text-slate-200 shadow-xs"
                        >
                          {item.profiles?.avatar_url ? (
                            <img 
                              src={item.profiles.avatar_url} 
                              alt="Avatar" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <span>
                              {(item.profiles?.display_name || item.profiles?.email || 'C')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                      {ranked.items.length > 4 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white dark:border-[#1A1D21] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                          +{ranked.items.length - 4}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="text-xs font-semibold text-cenaculo-crimson dark:text-cenaculo-gold hover:underline hidden sm:inline-block"
                    >
                      Ver detalhes →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. MODAL DE PARTICIPANTES DO DIA */}
      {selectedDateModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
          onClick={() => setSelectedDateModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#1A1D21] border border-amber-900/20 dark:border-amber-500/20 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-cenaculo-crimson dark:text-cenaculo-gold">
                  Presenças Confirmadas
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDateFull(selectedDateModal)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDateModal(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de irmãos */}
            {(() => {
              const attendees = availabilitiesByDate[selectedDateModal] || [];
              const userIsGoing = attendees.some(a => a.user_id === user?.id);

              return (
                <div className="space-y-4">
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {attendees.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        Nenhum irmão marcou este dia ainda. Seja o primeiro!
                      </div>
                    ) : (
                      attendees.map((item) => {
                        const isMe = item.user_id === user?.id;
                        const name = item.profiles?.display_name || item.profiles?.email?.split('@')[0] || 'Crismando';
                        const avatar = item.profiles?.avatar_url;

                        return (
                          <div 
                            key={item.id} 
                            className={`p-3 rounded-2xl flex items-center justify-between ${
                              isMe 
                                ? 'bg-cenaculo-crimson/10 dark:bg-cenaculo-gold/10 border border-cenaculo-crimson/20 dark:border-cenaculo-gold/30' 
                                : 'bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                                {avatar ? (
                                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{name[0].toUpperCase()}</span>
                                )}
                              </div>
                              <div>
                                <h5 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {name}
                                  {isMe && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950">
                                      Você
                                    </span>
                                  )}
                                </h5>
                                <p className="text-[11px] text-slate-400">
                                  {item.profiles?.email || 'Membro do Cenáculo'}
                                </p>
                              </div>
                            </div>

                            <Check className="w-4 h-4 text-emerald-500" />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Botões de ação rápida dentro do modal */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <button
                      onClick={() => handleToggleDay(selectedDateModal)}
                      disabled={actionLoadingDate === selectedDateModal}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        userIsGoing
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-900'
                          : 'bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white'
                      }`}
                    >
                      {actionLoadingDate === selectedDateModal ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : userIsGoing ? (
                        <>
                          <X className="w-4 h-4" /> Desmarcar minha presença neste dia
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Confirmar minha disponibilidade neste dia
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareSpecificDate(selectedDateModal)}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Compartilhar esta data no WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
