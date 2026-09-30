import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Send, 
  Loader2, 
  Trash2, 
  X, 
  User, 
  Sparkles, 
  HeartHandshake, 
  Maximize2, 
  FilePlus2,
  MessageCircle,
  Clock,
  CornerDownRight,
  MessageSquare
} from 'lucide-react';

export default function FeedView({ user, profile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado do formulário de nova postagem
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [postToDelete, setPostToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Controle de comentários por post
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);

  // Lightbox de imagem em tela cheia
  const [lightboxImage, setLightboxImage] = useState(null);

  const fileInputRef = useRef(null);

  // O botão de publicação pode ser ativado se houver texto OU mídia
  const canPublish = Boolean(caption.trim() || mediaFile);

  // Buscar posts com perfis, reações e comentários
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, 
          user_id, 
          caption, 
          media_url, 
          media_type, 
          created_at, 
          profiles(id, display_name, avatar_url, email),
          post_reactions(id, user_id, reaction_type),
          post_comments(
            id, 
            post_id, 
            user_id, 
            content, 
            created_at, 
            profiles(id, display_name, avatar_url, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro detalhado Supabase ao buscar publicações:', error);
      } else {
        // Ordena os comentários dentro de cada post por ordem cronológica (mais antigos primeiro)
        const sortedData = (data || []).map((post) => ({
          ...post,
          post_comments: (post.post_comments || []).sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          ),
        }));
        setPosts(sortedData);
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (exceção ao buscar feed):', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Inscrição em tempo real para sincronização com outros crismandos (posts, reações e comentários)
  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('feed-realtime-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          fetchPosts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_reactions' },
        () => {
          fetchPosts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  // Manipulação da seleção de arquivo de mídia
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Por favor, selecione um arquivo de imagem ou vídeo.');
      return;
    }

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    setMediaType(type);
    setMediaFile(file);

    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
    setStatusMsg('');
  };

  const handleClearMedia = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Envio direto para o Cloudinary (se houver mídia) e persistência no Supabase
  const handlePublishPost = async (e) => {
    e.preventDefault();

    if (!canPublish) {
      alert('Digite uma mensagem ou selecione uma foto/vídeo para compartilhar.');
      return;
    }

    setIsPublishing(true);
    setStatusMsg('Preparando momento...');

    let uploadedMediaUrl = null;
    let finalMediaType = null;

    try {
      // 1. Capturar usuário autenticado no Supabase
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Erro detalhado Supabase auth:', authError);
      }
      const currentUser = authData?.user || user;

      if (!currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // 2. Upload para o Cloudinary apenas se houver arquivo
      if (mediaFile) {
        setStatusMsg('Enviando mídia para o Cloudinary...');
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'j0qjphl9';
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'cenaculo_preset';

        const formData = new FormData();
        formData.append('file', mediaFile);
        formData.append('upload_preset', uploadPreset);

        const cloudinaryEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
        const res = await fetch(cloudinaryEndpoint, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (data.secure_url) {
          uploadedMediaUrl = data.secure_url;
          finalMediaType = data.resource_type === 'video' ? 'video' : 'image';
        } else {
          console.error('Resposta de erro do Cloudinary:', data);
          throw new Error(data.error?.message || 'Falha ao processar upload no Cloudinary.');
        }
      }

      // 3. Insert na tabela posts do Supabase (media_url e media_type nulos se for apenas texto)
      setStatusMsg('Publicando no Mural do Cenáculo...');
      const insertPayload = {
        user_id: currentUser.id,
        caption: caption.trim() || null,
        media_url: uploadedMediaUrl || null,
        media_type: finalMediaType || null,
      };

      const { data: newPostData, error: dbError } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select(`
          id, 
          user_id, 
          caption, 
          media_url, 
          media_type, 
          created_at, 
          profiles(id, display_name, avatar_url, email),
          post_reactions(id, user_id, reaction_type),
          post_comments(id, post_id, user_id, content, created_at, profiles(id, display_name, avatar_url, email))
        `)
        .single();

      if (dbError) {
        console.error('Erro detalhado Supabase ao inserir post:', dbError);
        throw dbError;
      }

      if (newPostData) {
        setPosts((prev) => [{ ...newPostData, post_comments: [] }, ...prev]);
      } else {
        fetchPosts();
      }

      setCaption('');
      handleClearMedia();
      setStatusMsg('');
    } catch (err) {
      console.error('Erro detalhado Supabase (post):', err);
      alert(`Falha ao publicar momento: ${err.message || 'Verifique o console'}`);
      setStatusMsg('');
    } finally {
      setIsPublishing(false);
    }
  };

  // Alternar Reação Sacra ('amen' | 'flame' | 'heart') com otimismo na UI
  const handleToggleReaction = async (postId, reactionType) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || user;

      if (!currentUser) {
        alert('Faça login para reagir a esta publicação.');
        return;
      }

      const targetPost = posts.find((p) => p.id === postId);
      if (!targetPost) return;

      const currentReactions = targetPost.post_reactions || [];
      const existingReaction = currentReactions.find(
        (r) => r.user_id === currentUser.id && r.reaction_type === reactionType
      );

      // Atualização otimista imediata na UI
      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id !== postId) return p;
          let newReactions;
          if (existingReaction) {
            newReactions = (p.post_reactions || []).filter(
              (r) => !(r.user_id === currentUser.id && r.reaction_type === reactionType)
            );
          } else {
            newReactions = [
              ...(p.post_reactions || []),
              {
                id: `temp-${Date.now()}`,
                user_id: currentUser.id,
                reaction_type: reactionType,
              },
            ];
          }
          return { ...p, post_reactions: newReactions };
        })
      );

      if (existingReaction) {
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .eq('reaction_type', reactionType);

        if (error) {
          console.error('Erro detalhado Supabase ao remover reação:', error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: currentUser.id,
            reaction_type: reactionType,
          });

        if (error) {
          console.error('Erro detalhado Supabase ao inserir reação:', error);
          throw error;
        }
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (reação):', err);
      fetchPosts();
    }
  };

  // Alternar expansão da caixa de comentários
  const toggleComments = (postId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Enviar novo comentário no post
  const handleAddComment = async (postId, e) => {
    if (e) e.preventDefault();

    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    try {
      setSubmittingCommentPostId(postId);

      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user || user;

      if (!currentUser) {
        alert('Faça login para comentar.');
        return;
      }

      // Otimismo imediato na UI
      const optimisticComment = {
        id: `temp-comment-${Date.now()}`,
        post_id: postId,
        user_id: currentUser.id,
        content: text,
        created_at: new Date().toISOString(),
        profiles: {
          id: currentUser.id,
          display_name: profile?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Você',
          avatar_url: profile?.avatar_url || currentUser.user_metadata?.avatar_url || '',
          email: currentUser.email,
        },
      };

      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            post_comments: [...(p.post_comments || []), optimisticComment],
          };
        })
      );

      // Limpar campo
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));

      const { data: insertedComment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: text,
        })
        .select(`
          id, 
          post_id, 
          user_id, 
          content, 
          created_at, 
          profiles(id, display_name, avatar_url, email)
        `)
        .single();

      if (error) {
        console.error('Erro detalhado Supabase ao adicionar comentário:', error);
        throw error;
      }

      // Substituir o comentário temporário pelo oficial retornado do banco
      if (insertedComment) {
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              post_comments: p.post_comments.map((c) =>
                c.id === optimisticComment.id ? insertedComment : c
              ),
            };
          })
        );
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (comentário):', err);
      alert('Não foi possível enviar seu comentário.');
      fetchPosts();
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  // Excluir comentário
  const handleDeleteComment = async (postId, commentId) => {
    try {
      setDeletingCommentId(commentId);
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || user?.id;

      // Otimismo imediato
      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            post_comments: (p.post_comments || []).filter((c) => c.id !== commentId),
          };
        })
      );

      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Erro detalhado Supabase ao excluir comentário:', error);
        throw error;
      }
    } catch (err) {
      console.error('Erro detalhado Supabase (excluir comentário):', err);
      alert('Não foi possível excluir o comentário.');
      fetchPosts();
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Excluir postagem do usuário
  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || user?.id;

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete.id)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Erro detalhado Supabase ao excluir post:', error);
        throw error;
      }

      setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
      setPostToDelete(null);
    } catch (err) {
      console.error('Erro detalhado Supabase (exclusão de post):', err);
      alert('Não foi possível excluir a publicação.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Formatador de data e hora amigável
  const formatPostDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    if (isToday) return `Hoje às ${timeStr}`;
    if (isYesterday) return `Ontem às ${timeStr}`;

    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${timeStr}`;
  };

  const userAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const userName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Crismando';

  return (
    <div className="max-w-xl mx-auto space-y-6">

      {/* ÁREA DE NOVA PUBLICAÇÃO (CRIAR POST - FLEXÍVEL: TEXTO, MÍDIA OU AMBOS) */}
      <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
        
        {/* Cabeçalho do Card */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cenaculo-crimson/20 dark:border-cenaculo-gold/30 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold shadow-xs">
            {userAvatar ? (
              <img src={userAvatar} alt="Meu Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{userName}</span>
              <Sparkles className="w-3.5 h-3.5 text-cenaculo-gold" />
            </h3>
            <p className="text-[11px] text-slate-400">
              Compartilhe uma graça, foto, vídeo ou oração com a turma
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handlePublishPost} className="space-y-4">
          
          <div>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Compartilhe um momento, foto, vídeo ou oração dos nossos encontros..."
              disabled={isPublishing}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold text-sm resize-none transition-all"
            />
          </div>

          {/* Pré-visualização da Mídia Escolhida */}
          {mediaPreview && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black group max-h-[360px] flex items-center justify-center">
              {mediaType === 'video' ? (
                <video 
                  src={mediaPreview} 
                  controls 
                  playsInline 
                  className="w-full max-h-[360px] rounded-2xl object-contain bg-black" 
                />
              ) : (
                <img 
                  src={mediaPreview} 
                  alt="Pré-visualização" 
                  className="w-full max-h-[360px] object-contain rounded-2xl" 
                />
              )}

              <button
                type="button"
                onClick={handleClearMedia}
                disabled={isPublishing}
                title="Remover mídia"
                className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white transition-colors backdrop-blur-sm shadow-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-2 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] text-white font-medium flex items-center gap-1.5">
                {mediaType === 'video' ? <VideoIcon className="w-3 h-3 text-cenaculo-gold" /> : <ImageIcon className="w-3 h-3 text-cenaculo-gold" />}
                {mediaFile?.name}
              </div>
            </div>
          )}

          {/* Barra de Ações: Selecionar Arquivo + Botão Postar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              disabled={isPublishing}
              className="hidden"
              id="mural-media-input"
            />

            <label
              htmlFor="mural-media-input"
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                mediaFile 
                  ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800' 
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              } ${isPublishing ? 'pointer-events-none opacity-50' : ''}`}
            >
              <FilePlus2 className="w-4 h-4 text-cenaculo-crimson dark:text-cenaculo-gold" />
              <span>{mediaFile ? 'Trocar Foto/Vídeo' : 'Adicionar Foto ou Vídeo'}</span>
            </label>

            <button
              type="submit"
              disabled={isPublishing || !canPublish}
              className="py-2.5 px-5 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{statusMsg || 'Publicando...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Publicar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* FEED DE PUBLICAÇÕES */}
      <div className="space-y-4">
        
        {loading && (
          <div className="text-center py-8 space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-cenaculo-crimson dark:text-cenaculo-gold mx-auto" />
            <p className="text-xs font-medium">Carregando momentos do Cenáculo...</p>
          </div>
        )}

        {/* ESTADO VAZIO (EMPTY STATE) */}
        {!loading && posts.length === 0 && (
          <div className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-cenaculo-crimson/10 dark:bg-cenaculo-gold/15 text-cenaculo-crimson dark:text-cenaculo-gold mx-auto flex items-center justify-center">
              <HeartHandshake className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              O mural ainda está silencioso
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Seja o primeiro a compartilhar uma foto, um vídeo ou uma lembrança dos nossos encontros e da nossa caminhada na fé!
            </p>
          </div>
        )}

        {/* Lista de Posts */}
        {!loading && posts.map((post) => {
          const isMyPost = post.user_id === user?.id;
          const authorName = post.profiles?.display_name || post.profiles?.email?.split('@')[0] || 'Crismando';
          const authorAvatar = post.profiles?.avatar_url;

          // Cálculo das Reações Sacras
          const reactions = post.post_reactions || [];
          const amenCount = reactions.filter((r) => r.reaction_type === 'amen').length;
          const flameCount = reactions.filter((r) => r.reaction_type === 'flame').length;
          const heartCount = reactions.filter((r) => r.reaction_type === 'heart').length;

          const hasAmen = reactions.some((r) => r.user_id === user?.id && r.reaction_type === 'amen');
          const hasFlame = reactions.some((r) => r.user_id === user?.id && r.reaction_type === 'flame');
          const hasHeart = reactions.some((r) => r.user_id === user?.id && r.reaction_type === 'heart');

          // Comentários do post
          const comments = post.post_comments || [];
          const isCommentsOpen = Boolean(expandedComments[post.id]);
          const currentCommentText = commentInputs[post.id] || '';
          const isSubmittingThisComment = submittingCommentPostId === post.id;

          const hasMedia = Boolean(post.media_url);
          const hasCaption = Boolean(post.caption && post.caption.trim());

          return (
            <article 
              key={post.id}
              className="bg-white dark:bg-[#1A1D21] border border-amber-900/10 dark:border-amber-500/10 rounded-3xl p-4 md:p-5 shadow-sm space-y-3.5 transition-colors"
            >
              {/* Topo do Post: Autor, Data e Ações */}
              <div className="flex items-center justify-between">
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs">
                    {authorAvatar ? (
                      <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{authorName[0]?.toUpperCase() || 'C'}</span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug">
                      {authorName}
                      {isMyPost && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cenaculo-crimson/10 text-cenaculo-crimson dark:bg-cenaculo-gold/20 dark:text-cenaculo-gold">
                          Você
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {formatPostDate(post.created_at)}
                    </p>
                  </div>
                </div>

                {isMyPost && (
                  <button
                    onClick={() => setPostToDelete(post)}
                    title="Excluir publicação"
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* CONTEÚDO DO POST: 
                  Cenário 1: Post com foto ou vídeo
                  Cenário 2: Post apenas em texto (com destaque tipográfico especial)
              */}
              {hasMedia && (
                <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-950 relative group">
                  {post.media_type === 'video' ? (
                    <video 
                      src={post.media_url} 
                      controls 
                      playsInline 
                      className="w-full rounded-2xl max-h-[480px] bg-black object-contain"
                    />
                  ) : (
                    <div 
                      className="relative cursor-pointer overflow-hidden flex items-center justify-center"
                      onClick={() => setLightboxImage(post.media_url)}
                    >
                      <img 
                        src={post.media_url} 
                        alt="Foto do Cenáculo" 
                        loading="lazy"
                        className="w-full max-h-[500px] object-cover transition-transform duration-200 group-hover:scale-[1.01]" 
                      />
                      <button
                        type="button"
                        aria-label="Ver em tela cheia"
                        className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-950/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md cursor-pointer"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Legenda do Post: com formatação diferenciada se for post exclusivo de texto */}
              {hasCaption && (
                hasMedia ? (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {post.caption}
                  </p>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 shadow-xs">
                    <p className="text-base text-slate-800 dark:text-slate-100 whitespace-pre-line leading-relaxed font-serif">
                      "{post.caption}"
                    </p>
                  </div>
                )
              )}

              {/* BARRA DE INTERAÇÕES (REAÇÕES SACRAS + BOTÃO DE COMENTÁRIOS) */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  
                  {/* 🙏 1. Reação: Amém */}
                  <button
                    type="button"
                    onClick={() => handleToggleReaction(post.id, 'amen')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 select-none cursor-pointer ${
                      hasAmen
                        ? 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                    title="Amém"
                  >
                    <span className="text-sm leading-none">🙏</span>
                    <span>Amém</span>
                    {amenCount > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        hasAmen 
                          ? 'bg-amber-300/80 text-amber-950 dark:bg-amber-900 dark:text-amber-200' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {amenCount}
                      </span>
                    )}
                  </button>

                  {/* 🔥 2. Reação: Chama do Espírito */}
                  <button
                    type="button"
                    onClick={() => handleToggleReaction(post.id, 'flame')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 select-none cursor-pointer ${
                      hasFlame
                        ? 'bg-red-100 text-cenaculo-crimson border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                    title="Chama do Espírito"
                  >
                    <span className="text-sm leading-none">🔥</span>
                    <span>Chama</span>
                    {flameCount > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        hasFlame 
                          ? 'bg-red-200/90 text-red-950 dark:bg-red-900 dark:text-red-200' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {flameCount}
                      </span>
                    )}
                  </button>

                  {/* ❤️ 3. Reação: Amor Fraterno */}
                  <button
                    type="button"
                    onClick={() => handleToggleReaction(post.id, 'heart')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 active:scale-95 select-none cursor-pointer ${
                      hasHeart
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                    }`}
                    title="Amor Fraterno"
                  >
                    <span className="text-sm leading-none">❤️</span>
                    <span>Amor</span>
                    {heartCount > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        hasHeart 
                          ? 'bg-rose-200/90 text-rose-950 dark:bg-rose-900 dark:text-rose-200' 
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {heartCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* 4. Botão de Comentários */}
                <button
                  type="button"
                  onClick={() => toggleComments(post.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                    isCommentsOpen
                      ? 'bg-cenaculo-crimson text-white dark:bg-cenaculo-gold dark:text-slate-950 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title="Ver e adicionar comentários"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{comments.length > 0 ? comments.length : 'Comentar'}</span>
                </button>
              </div>

              {/* SEÇÃO EXPANSÍVEL DE COMENTÁRIOS */}
              {isCommentsOpen && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                  
                  {/* Lista de Comentários */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">
                        Nenhum comentário ainda. Deixe uma palavra de ânimo ou oração!
                      </div>
                    ) : (
                      comments.map((comment) => {
                        const isMyComment = comment.user_id === user?.id;
                        const cAuthorName = comment.profiles?.display_name || comment.profiles?.email?.split('@')[0] || 'Crismando';
                        const cAuthorAvatar = comment.profiles?.avatar_url;
                        const isDeletingThis = deletingCommentId === comment.id;

                        return (
                          <div 
                            key={comment.id}
                            className={`p-2.5 rounded-2xl flex items-start justify-between gap-2.5 ${
                              isMyComment
                                ? 'bg-cenaculo-crimson/5 dark:bg-cenaculo-gold/5 border border-cenaculo-crimson/15 dark:border-cenaculo-gold/20'
                                : 'bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 flex-shrink-0 mt-0.5">
                                {cAuthorAvatar ? (
                                  <img src={cAuthorAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{cAuthorName[0]?.toUpperCase() || 'C'}</span>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                                    {cAuthorName}
                                  </span>
                                  {isMyComment && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cenaculo-crimson/10 text-cenaculo-crimson dark:bg-cenaculo-gold/20 dark:text-cenaculo-gold">
                                      Você
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400">
                                    • {formatPostDate(comment.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed break-words">
                                  {comment.content}
                                </p>
                              </div>
                            </div>

                            {/* Excluir comentário próprio */}
                            {isMyComment && (
                              <button
                                onClick={() => handleDeleteComment(post.id, comment.id)}
                                disabled={isDeletingThis}
                                title="Excluir meu comentário"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex-shrink-0 cursor-pointer"
                              >
                                {isDeletingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Formulário de Envio de Comentário */}
                  <form 
                    onSubmit={(e) => handleAddComment(post.id, e)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="text"
                      placeholder="Escreva uma mensagem fraterna..."
                      value={currentCommentText}
                      onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }
                      }}
                      disabled={isSubmittingThisComment}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-cenaculo-crimson dark:focus:ring-cenaculo-gold transition-all"
                    />

                    <button
                      type="submit"
                      disabled={isSubmittingThisComment || !currentCommentText.trim()}
                      className="p-2 rounded-xl bg-cenaculo-crimson hover:bg-cenaculo-crimsonDark dark:bg-cenaculo-gold dark:text-slate-950 text-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Enviar comentário"
                    >
                      {isSubmittingThisComment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </form>
                </div>
              )}

            </article>
          );
        })}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {postToDelete && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all"
          onClick={() => !isDeleting && setPostToDelete(null)}
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
                Excluir publicação?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta lembrança será removida permanentemente do Mural do Cenáculo.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEM EM TELA CHEIA */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 transition-all"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            aria-label="Fechar visualização"
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors shadow-lg z-10 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <img 
            src={lightboxImage} 
            alt="Lembrança em alta resolução" 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

    </div>
  );
}
