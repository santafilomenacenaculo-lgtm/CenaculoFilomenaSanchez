import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getUserRole, ROLES } from '../utils/roles';
import { Camera, Check, Loader2, Mail, User, ShieldCheck, Crown, Flame, Eye } from 'lucide-react';

export default function ProfileView({ profile, user, onProfileUpdated }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const currentRole = getUserRole(user, profile);

  // Sincroniza dados caso o perfil seja carregado assincronamente
  useEffect(() => {
    if (profile) {
      if (profile.display_name) setDisplayName(profile.display_name);
      if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  // Upload direto para o Cloudinary
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setSuccessMsg('');

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'j0qjphl9';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'cenaculo_preset';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setAvatarUrl(data.secure_url);
      } else if (data.error) {
        throw new Error(data.error.message || 'Falha no Cloudinary');
      }
    } catch (err) {
      console.error('Erro ao enviar imagem ao Cloudinary:', err);
      alert('Falha ao enviar foto. Verifique as configurações do Cloudinary.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    try {
      const updateData = {
        id: profile?.id,
        display_name: displayName,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updateData, { onConflict: 'id' });

      if (error) throw error;

      setSuccessMsg('Perfil atualizado com sucesso!');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      alert('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-cenaculo-crimson dark:text-cenaculo-gold flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cenaculo-gold" />
          Perfil do Discípulo
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Identificação na comunidade de Santa Filomena & São José Sánchez
        </p>

        {/* Card de Status da Classe / Cargo */}
        <div className="mt-4 p-3.5 rounded-2xl inline-flex items-center gap-3 border shadow-xs max-w-sm text-left">
          {currentRole === ROLES.PROFETA ? (
            <>
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                  Cargo: Profeta (Superusuário)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acesso total e gestão exclusiva de todos os discípulos.
                </span>
              </div>
            </>
          ) : currentRole === ROLES.FILOMENO ? (
            <>
              <div className="w-9 h-9 rounded-xl bg-cenaculo-crimson/15 dark:bg-cenaculo-gold/20 text-cenaculo-crimson dark:text-cenaculo-gold flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-cenaculo-crimson dark:text-cenaculo-gold uppercase tracking-wider block">
                  Classe: Filomeno (Membro Pleno)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acesso liberado a todos os encontros, presenças e publicações.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Classe: Pagão (Acesso Leitura)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Apenas visualização do Mural. Aguarde bênção do Profeta.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Foto de Perfil com upload */}
        <div className="flex flex-col items-center">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cenaculo-crimson/20 dark:border-cenaculo-gold/30 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-400" />
              )}
            </div>

            <label className="absolute bottom-0 right-0 p-2.5 rounded-full bg-cenaculo-crimson text-white hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 cursor-pointer shadow-md transition-transform hover:scale-110">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={uploading} 
                className="hidden" 
              />
            </label>
          </div>
          <span className="text-[11px] text-slate-400 mt-2">
            {uploading ? 'Carregando foto para o Cloudinary...' : 'Toque no ícone para trocar de foto'}
          </span>
        </div>

        {/* Nome de Exibição */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Como você quer ser chamado no Cenáculo:
          </label>
          <div className="relative">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Ex: João Silva"
              className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold text-sm"
            />
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        {/* E-mail (Somente Leitura do Google) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            E-mail do Google (vinculado):
          </label>
          <div className="relative">
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
            />
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            {successMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full py-3 px-4 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-medium text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}
