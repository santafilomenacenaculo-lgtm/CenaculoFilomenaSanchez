import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { SUPERUSER_EMAIL, ROLES } from '../utils/roles';
import { 
  Users, 
  Crown, 
  Flame, 
  Eye, 
  ShieldCheck, 
  Search, 
  Check, 
  Loader2, 
  Sparkles, 
  UserX, 
  Copy, 
  AlertCircle,
  Clock,
  Mail,
  User as UserIcon
} from 'lucide-react';

export default function UsersManagementView({ user, profile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('ALL'); // 'ALL' | 'Pagão' | 'Filomeno' | 'Profeta'
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlBanner, setShowSqlBanner] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar perfis:', error);
        setFeedbackError('Não foi possível carregar a lista de usuários.');
      } else {
        // Normaliza as classes dos perfis
        const normalized = (data || []).map((p) => {
          const isOwner = (p.email || '').toLowerCase().trim() === SUPERUSER_EMAIL;
          let role = p.role;
          if (isOwner) {
            role = ROLES.PROFETA;
          } else if (!role || role.trim() === '') {
            role = ROLES.PAGAO;
          } else if (role.toLowerCase() === 'filomenos') {
            role = ROLES.FILOMENO;
          }
          return { ...p, role };
        });
        setProfiles(normalized);
      }
    } catch (err) {
      console.error('Falha geral ao buscar usuários:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    // Inscrição em tempo real para novos cadastros de usuários
    const channel = supabase
      .channel('realtime-profiles-management')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  // Contadores
  const stats = useMemo(() => {
    const total = profiles.length;
    const profetas = profiles.filter((p) => p.role === ROLES.PROFETA).length;
    const filomenos = profiles.filter((p) => p.role === ROLES.FILOMENO).length;
    const pagãos = profiles.filter((p) => p.role === ROLES.PAGAO).length;
    return { total, profetas, filomenos, pagãos };
  }, [profiles]);

  // Filtro e Busca
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const name = (p.display_name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      if (filterRole === 'ALL') return true;
      return p.role === filterRole;
    });
  }, [profiles, searchTerm, filterRole]);

  // Alterar classe do usuário
  const handleChangeRole = async (targetUser, newRole) => {
    if ((targetUser.email || '').toLowerCase().trim() === SUPERUSER_EMAIL && newRole !== ROLES.PROFETA) {
      alert('O cargo do Superusuário Profeta não pode ser modificado.');
      return;
    }

    setUpdatingUserId(targetUser.id);
    setFeedbackMsg('');
    setFeedbackError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUser.id);

      if (error) {
        if (error.message?.includes('column "role"') || error.code === '42703' || error.code === 'PGRST204') {
          setShowSqlBanner(true);
          setFeedbackError('A coluna "role" ainda não existe no Supabase. Execute o comando SQL no banner abaixo para habilitar o salvamento permanente.');
        } else {
          throw error;
        }
      } else {
        setFeedbackMsg(`Classe de ${targetUser.display_name || targetUser.email} atualizada para "${newRole}" com bênção do Profeta!`);
      }

      // Atualização otimista imediata na interface
      setProfiles((prev) =>
        prev.map((p) => (p.id === targetUser.id ? { ...p, role: newRole } : p))
      );
    } catch (err) {
      console.error('Erro ao atualizar papel do usuário:', err);
      setFeedbackError('Falha ao atualizar classe. Verifique sua conexão.');
    } finally {
      setUpdatingUserId(null);
      setTimeout(() => {
        setFeedbackMsg('');
      }, 5000);
    }
  };

  const copySqlToClipboard = () => {
    const sql = `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'Pagão';\nUPDATE public.profiles SET role = 'Profeta' WHERE LOWER(email) = 'rap.rag@gmail.com';`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Gestão do Profeta */}
      <div className="bg-gradient-to-br from-amber-500/10 via-cenaculo-crimson/10 to-amber-900/10 dark:from-[#1E1914] dark:to-[#17141D] border border-amber-500/20 dark:border-amber-500/20 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 text-xs font-bold tracking-wider uppercase mb-2">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Painel do Profeta • Superusuário
            </div>
            <h2 className="text-2xl md:text-3xl font-bold font-serif text-cenaculo-crimson dark:text-cenaculo-gold">
              Gestão de Discípulos & Irmãos
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
              Como Profeta, somente você pode visualizar o total de participantes e conceder a 
              classe <strong className="text-cenaculo-crimson dark:text-cenaculo-gold">Filomeno</strong> aos novos cadastrados para que possam interagir no Cenáculo.
            </p>
          </div>

          <button
            onClick={() => setShowSqlBanner(!showSqlBanner)}
            className="self-start md:self-center px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-amber-500/20 text-slate-700 dark:text-slate-200 hover:border-amber-500 transition-colors shadow-sm cursor-pointer"
          >
            {showSqlBanner ? 'Ocultar Script SQL' : 'Script Supabase (SQL)'}
          </button>
        </div>

        {/* Banner Opcional de SQL */}
        {showSqlBanner && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Script SQL para criar a coluna no Supabase:
              </div>
              <button
                onClick={copySqlToClipboard}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors font-medium cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto select-all">
{`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'Pagão';
UPDATE public.profiles SET role = 'Profeta' WHERE LOWER(email) = 'rap.rag@gmail.com';`}
            </pre>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Cole e execute no <strong>SQL Editor</strong> do painel do Supabase se desejar que a coluna fique salva permanentemente no banco de dados.
            </p>
          </div>
        )}

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#1A1D21]/80 border border-amber-900/10 dark:border-amber-500/10 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <Users className="w-4 h-4 text-slate-500" />
              Total de Irmãos
            </div>
            <div className="text-2xl font-bold font-serif text-slate-900 dark:text-white mt-1">
              {stats.total}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#1A1D21]/80 border border-cenaculo-crimson/20 dark:border-cenaculo-gold/20 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1.5 text-cenaculo-crimson dark:text-cenaculo-gold text-xs font-semibold">
              <Flame className="w-4 h-4 text-cenaculo-crimson dark:text-cenaculo-gold" />
              Filomenos
            </div>
            <div className="text-2xl font-bold font-serif text-cenaculo-crimson dark:text-cenaculo-gold mt-1">
              {stats.filomenos}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#1A1D21]/80 border border-slate-300 dark:border-slate-700 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-semibold">
              <Eye className="w-4 h-4 text-slate-500" />
              Pagãos (Novos)
            </div>
            <div className="text-2xl font-bold font-serif text-slate-700 dark:text-slate-300 mt-1">
              {stats.pagãos}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/70 dark:bg-[#1A1D21]/80 border border-amber-400/30 dark:border-amber-500/30 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Crown className="w-4 h-4 text-amber-500" />
              Profeta
            </div>
            <div className="text-2xl font-bold font-serif text-amber-600 dark:text-amber-400 mt-1">
              {stats.profetas}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Feedback */}
      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {feedbackError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{feedbackError}</span>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Campo de Busca */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Abas de Filtro de Cargo */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterRole('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterRole === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Todos ({stats.total})
          </button>

          <button
            onClick={() => setFilterRole(ROLES.PAGAO)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              filterRole === ROLES.PAGAO
                ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Pagãos ({stats.pagãos})
          </button>

          <button
            onClick={() => setFilterRole(ROLES.FILOMENO)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              filterRole === ROLES.FILOMENO
                ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Filomenos ({stats.filomenos})
          </button>

          <button
            onClick={() => setFilterRole(ROLES.PROFETA)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              filterRole === ROLES.PROFETA
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            Profeta ({stats.profetas})
          </button>
        </div>
      </div>

      {/* Lista de Usuários */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-xs">Carregando discípulos...</span>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-2xl p-8">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Nenhum usuário encontrado
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Tente outro termo de busca ou selecione outro filtro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProfiles.map((item) => {
            const isSuper = (item.email || '').toLowerCase().trim() === SUPERUSER_EMAIL;
            const isTargetFilomeno = item.role === ROLES.FILOMENO;
            const isTargetPagao = item.role === ROLES.PAGAO;
            const isUpdating = updatingUserId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-[#1A1D21] border rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                  isSuper
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/5 to-transparent'
                    : isTargetFilomeno
                    ? 'border-cenaculo-crimson/20 dark:border-cenaculo-gold/20'
                    : 'border-slate-200 dark:border-slate-800 opacity-90'
                }`}
              >
                {/* Linha de Dados do Usuário */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    {isSuper && (
                      <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-slate-950 shadow">
                        <Crown className="w-3 h-3" />
                      </span>
                    )}
                    {isTargetFilomeno && !isSuper && (
                      <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-cenaculo-crimson text-white shadow">
                        <Flame className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.display_name || item.email?.split('@')[0] || 'Crismando'}
                      </h4>
                      
                      {/* Selo da Classe */}
                      {isSuper ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Crown className="w-2.5 h-2.5 text-amber-500" />
                          Profeta
                        </span>
                      ) : isTargetFilomeno ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <Flame className="w-2.5 h-2.5 text-rose-500" />
                          Filomeno
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                          <Eye className="w-2.5 h-2.5 text-slate-400" />
                          Pagão (Observador)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        Cadastrado em {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'Data não registrada'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações de Modificação de Classe */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isSuper ? (
                      <span className="italic text-amber-600 dark:text-amber-400">Superusuário Imutável</span>
                    ) : isTargetFilomeno ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Tem acesso total ao Cenáculo</span>
                    ) : (
                      <span className="text-slate-400 italic">Apenas lê o mural</span>
                    )}
                  </div>

                  <div>
                    {isSuper ? (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        Você (Profeta)
                      </span>
                    ) : isTargetPagao ? (
                      <button
                        onClick={() => handleChangeRole(item, ROLES.FILOMENO)}
                        disabled={isUpdating}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cenaculo-crimson to-cenaculo-crimsonDark dark:from-cenaculo-gold dark:to-amber-500 text-white dark:text-slate-950 text-xs font-bold shadow hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Consagrar Filomeno
                      </button>
                    ) : (
                      <button
                        onClick={() => handleChangeRole(item, ROLES.PAGAO)}
                        disabled={isUpdating}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                        Tornar Pagão
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
