import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Calendar, 
  Plus, 
  Clock, 
  MapPin, 
  Sparkles, 
  Trash2, 
  X, 
  Loader2, 
  PartyPopper,
  CalendarCheck2,
  Share2
} from 'lucide-react';

export default function ParishEvents({ user, profile, isCompact = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Campos do formulário de novo evento
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('paroquia');
  const [description, setDescription] = useState('');

  // Busca eventos a partir da data de hoje
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('parish_events')
        .select('id, title, event_date, event_time, location, category, description, user_id, created_at, profiles(id, display_name, avatar_url, email)')
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true });

      if (error) {
        console.error('Erro detalhado Supabase ao buscar eventos:', error);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (exceção ao carregar eventos):', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sincronização em tempo real via Supabase Realtime
  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('parish-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parish_events' },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  // Salvar novo evento com verificação de auth e campos padronizados
  const handleSaveEvent = async (e) => {
    e.preventDefault();

    if (!title.trim() || !eventDate) {
      alert('Preencha ao menos o título e a data do evento.');
      return;
    }

    setIsSaving(true);
    try {
      // Captura segura do usuário autenticado no Supabase
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Erro detalhado Supabase auth:', authError);
      }
      const currentUser = authData?.user || user;

      if (!currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const insertPayload = {
        user_id: currentUser.id,
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate, // Formato YYYY-MM-DD
        event_time: eventTime.trim() || null,
        location: location.trim() || null,
        category: (category || 'paroquia').toLowerCase(), // 'paroquia' | 'cenaculo' | 'festa' | 'outro'
      };

      const { data, error } = await supabase
        .from('parish_events')
        .insert(insertPayload)
        .select('id, title, event_date, event_time, location, category, description, user_id, created_at, profiles(id, display_name, avatar_url, email)')
        .single();

      if (error) {
        console.error('Erro detalhado Supabase ao inserir parish_events:', error);
        throw error;
      }

      if (data) {
        setEvents((prev) => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      } else {
        fetchEvents();
      }

      // Reset do formulário e fechar modal
      setTitle('');
      setEventDate('');
      setEventTime('');
      setLocation('');
      setCategory('paroquia');
      setDescription('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro detalhado Supabase:', err);
      alert(`Falha ao cadastrar evento: ${err.message || 'Verifique o console'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Excluir evento
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || user?.id;

      const { error } = await supabase
        .from('parish_events')
        .delete()
        .eq('id', eventToDelete.id)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Erro detalhado Supabase ao excluir parish_events:', error);
        throw error;
      }

      setEvents((prev) => prev.filter((e) => e.id !== eventToDelete.id));
      setEventToDelete(null);
    } catch (err) {
      console.error('Erro detalhado Supabase:', err);
      alert('Não foi possível excluir o acontecimento.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Formatação de data em português
  const formatEventDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    const day = date.getDate();
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
  };

  // Rótulo visual e cores por categoria
  const getCategoryInfo = (cat) => {
    const key = (cat || '').toLowerCase();
    switch (key) {
      case 'cenaculo':
        return {
          label: 'Cenáculo',
          classes: 'bg-cenaculo-crimson/15 text-cenaculo-crimson dark:bg-cenaculo-gold/20 dark:text-cenaculo-gold border-cenaculo-crimson/30 dark:border-cenaculo-gold/30',
        };
      case 'festa':
        return {
          label: 'Festa Litúrgica',
          classes: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        };
      case 'paroquia':
        return {
          label: 'Paróquia',
          classes: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      default:
        return {
          label: 'Outro',
          classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  // Compartilhar evento da paróquia no WhatsApp ou via Web Share API
  const handleShareEvent = async (event) => {
    const formattedDate = formatEventDate(event.event_date);
    const timeInfo = event.event_time ? ` às ${event.event_time}` : '';
    const locationInfo = event.location ? `\n📍 *Local:* ${event.location}` : '';
    const descInfo = event.description ? `\n\n📝 *Avisos:* ${event.description}` : '';
    const appUrl = `${window.location.origin}${window.location.pathname}?tab=inicio`;

    const message = 
`✝️ *Acontecimento Paroquial / Cenáculo* ✝️
*Sta. Filomena & S. José Sánchez del Río*

🎉 *${event.title}*
📅 *Quando:* ${formattedDate}${timeInfo}${locationInfo}${descInfo}

📲 Acompanhe nossa programação no aplicativo:
${appUrl}

_Santa Filomena e São José Sánchez, rogai por nós!_ 🕊️`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
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

  return (
    <section className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
      
      {/* Cabeçalho da Seção */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cenaculo-crimson to-cenaculo-gold flex items-center justify-center text-white shadow-xs">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-serif">
              Próximos Acontecimentos & Festas
              <Sparkles className="w-3.5 h-3.5 text-cenaculo-gold animate-pulse" />
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Missas, vigílias, encontros e celebrações da comunidade
            </p>
          </div>
        </div>

        {/* Botão de Cadastrar */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="py-2 px-3.5 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Evento/Festa</span>
        </button>
      </div>

      {/* Conteúdo: Lista Horizontal / Carrossel Responsivo */}
      {loading ? (
        <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-cenaculo-crimson dark:text-cenaculo-gold" />
          Carregando eventos da paróquia...
        </div>
      ) : events.length === 0 ? (
        <div className="p-6 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-center space-y-2">
          <PartyPopper className="w-6 h-6 text-cenaculo-gold mx-auto" />
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
            Nenhum evento agendado no momento
          </h4>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
            Tem uma missa especial, festa paroquial ou retiro se aproximando? Clique em <strong>"+ Cadastrar Evento/Festa"</strong> para avisar toda a turma!
          </p>
        </div>
      ) : (
        <div className="flex gap-3.5 overflow-x-auto pb-2 pt-1 no-scrollbar snap-x">
          {events.map((item) => {
            const isMyEvent = item.user_id === user?.id;
            const authorName = item.profiles?.display_name || item.profiles?.email?.split('@')[0] || 'Crismando';
            const authorAvatar = item.profiles?.avatar_url;
            const catInfo = getCategoryInfo(item.category);

            return (
              <div
                key={item.id}
                className="min-w-[270px] max-w-[310px] flex-shrink-0 snap-start bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-cenaculo-gold/40 transition-colors shadow-xs"
              >
                <div className="space-y-2">
                  {/* Topo do card: Categoria + Ações (Compartilhar e Excluir) */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${catInfo.classes}`}>
                      {catInfo.label}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleShareEvent(item)}
                        title="Compartilhar evento no WhatsApp"
                        className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {isMyEvent && (
                        <button
                          onClick={() => setEventToDelete(item)}
                          title="Excluir este evento"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Título do evento */}
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {item.title}
                  </h4>

                  {/* Data e Horário */}
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 font-semibold text-cenaculo-crimson dark:text-cenaculo-gold">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatEventDate(item.event_date)}</span>
                    </div>

                    {item.event_time && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.event_time}</span>
                      </div>
                    )}

                    {item.location && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Descrição breve */}
                  {item.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed pt-0.5 border-t border-slate-100 dark:border-slate-800">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Rodapé: Autor e Botão Discreto de Compartilhar Evento */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold">
                      {authorAvatar ? (
                        <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        authorName[0]?.toUpperCase()
                      )}
                    </div>
                    <span className="truncate">{authorName}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShareEvent(item)}
                    className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Compartilhar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVO EVENTO */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
          onClick={() => !isSaving && setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-[#1A1D21] border border-amber-900/20 dark:border-amber-500/20 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cenaculo-crimson/10 dark:bg-cenaculo-gold/20 text-cenaculo-crimson dark:text-cenaculo-gold flex items-center justify-center">
                  <CalendarCheck2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cadastrar Acontecimento / Festa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3.5">
              {/* Título do Evento */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Missa com Santa Filomena, Confraternização..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                />
              </div>

              {/* Data e Horário em linha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horário (opcional)
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                  />
                </div>
              </div>

              {/* Local e Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Local
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Igreja Matriz, Salão..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                  >
                    <option value="paroquia">Paróquia</option>
                    <option value="cenaculo">Cenáculo</option>
                    <option value="festa">Festa Litúrgica</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              {/* Descrição / Aviso */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Orientações (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Trazer prato de salgado ou doce; chegar com 15 min de antecedência..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-xs resize-none focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold"
                />
              </div>

              {/* Botões do Modal */}
              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {eventToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
          onClick={() => !isDeleting && setEventToDelete(null)}
        >
          <div 
            className="w-full max-w-sm bg-white dark:bg-[#1A1D21] border border-amber-900/20 dark:border-amber-500/20 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Excluir acontecimento?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O evento "{eventToDelete.title}" será removido da programação da comunidade.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
