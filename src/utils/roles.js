export const ROLES = {
  PROFETA: 'Profeta',
  FILOMENO: 'Filomeno',
  PAGAO: 'Pagão',
};

export const SUPERUSER_EMAIL = 'rap.rag@gmail.com';

/**
 * Retorna a classe/cargo efetivo do usuário.
 * O usuário rap.rag@gmail.com é sempre garantido como 'Profeta' (Superusuário).
 * Qualquer outro usuário não promovido é tratado como 'Pagão'.
 */
export function getUserRole(user, profile) {
  const email = (user?.email || profile?.email || '').toLowerCase().trim();
  if (email === SUPERUSER_EMAIL) {
    return ROLES.PROFETA;
  }

  const rawRole = (profile?.role || '').trim();
  if (rawRole === ROLES.PROFETA) return ROLES.PROFETA;
  if (rawRole === ROLES.FILOMENO || rawRole.toLowerCase() === 'filomenos') {
    return ROLES.FILOMENO;
  }

  return ROLES.PAGAO;
}

export function isProfeta(user, profile) {
  return getUserRole(user, profile) === ROLES.PROFETA;
}

export function isFilomeno(user, profile) {
  return getUserRole(user, profile) === ROLES.FILOMENO;
}

export function isPagao(user, profile) {
  return getUserRole(user, profile) === ROLES.PAGAO;
}

/**
 * Define se o usuário tem permissão para interagir (postar, comentar, reagir, marcar presença).
 * Filomenos e Profetas podem interagir. Pagãos apenas observam o mural.
 */
export function canInteract(user, profile) {
  const role = getUserRole(user, profile);
  return role === ROLES.PROFETA || role === ROLES.FILOMENO;
}

/**
 * Apenas o Profeta pode visualizar todos os usuários e atribuir classes.
 */
export function canManageUsers(user, profile) {
  return isProfeta(user, profile);
}
