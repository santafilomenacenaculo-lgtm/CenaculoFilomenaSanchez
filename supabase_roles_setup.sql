-- ==============================================================================
-- SETUP DE CARGOS / CLASSES DO CENÁCULO (Santa Filomena & São José Sánchez)
-- Execute este script no SQL Editor do painel Supabase (https://app.supabase.com)
-- ==============================================================================

-- 1. Adiciona a coluna 'role' na tabela profiles (caso ainda não exista)
-- Classes válidas: 'Profeta', 'Filomeno', 'Pagão'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'Pagão';

-- 2. Define o Superusuário 'rap.rag@gmail.com' como 'Profeta'
UPDATE public.profiles 
SET role = 'Profeta' 
WHERE LOWER(email) = 'rap.rag@gmail.com';

-- 3. Garante que novos usuários que não tiverem role preenchida recebam 'Pagão'
UPDATE public.profiles 
SET role = 'Pagão' 
WHERE role IS NULL OR role = '';

-- 4. Opcional: Política RLS para garantir que apenas o Profeta ou o próprio usuário 
-- consigam atualizar perfis no banco
-- (Caso o RLS esteja ativo em public.profiles)
DO $$
BEGIN
  -- Permite leitura de profiles por qualquer usuário autenticado ou visitante
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir leitura de perfis'
  ) THEN
    CREATE POLICY "Permitir leitura de perfis" ON public.profiles FOR SELECT USING (true);
  END IF;

  -- Permite atualização do próprio perfil ou pelo Profeta
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir atualizacao por Profeta ou dono'
  ) THEN
    CREATE POLICY "Permitir atualizacao por Profeta ou dono" ON public.profiles FOR UPDATE USING (
      auth.uid() = id OR 
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'Profeta' OR LOWER(email) = 'rap.rag@gmail.com')
      )
    );
  END IF;
END $$;
