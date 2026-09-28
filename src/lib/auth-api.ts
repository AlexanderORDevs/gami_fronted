export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  storeIds: string[];
  mustChangePassword: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthSession = {
  tokens: AuthTokens;
  user: AuthUser;
};

export type PasswordChangeResult = AuthSession & {
  recoveryCodes: string[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

export function localizedApiError(
  message: string | undefined,
  status: number,
): string {
  const messages: Record<string, string> = {
    "El stock cambio. Actualiza el inventario y vuelve a intentarlo.":
      "El stock cambió. Actualiza el inventario y vuelve a intentarlo.",
    "El stock no puede ser menor que las unidades reservadas.":
      "El stock no puede ser menor que las unidades reservadas.",
    "Stock disponible insuficiente. Actualiza las cantidades.":
      "Stock disponible insuficiente. Actualiza las cantidades.",
    "La tienda debe estar activa para registrar ordenes.":
      "La tienda debe estar activa para registrar órdenes.",
    "Una variante no esta publicada o no pertenece a esta tienda.":
      "Una variante no está publicada o no pertenece a esta tienda.",
    "La variante no pertenece a esta tienda.":
      "La variante no pertenece a esta tienda.",
    "La orden no pertenece exclusivamente a esta tienda.":
      "La orden no pertenece exclusivamente a esta tienda.",
    "Esta orden ya tiene un envio registrado.":
      "Esta orden ya tiene un envío registrado.",
    "El estado de la orden no permite crear un envio.":
      "El estado de la orden no permite crear un envío.",
    "La fecha de recojo debe ser futura.":
      "La fecha de recojo debe ser futura.",
    "El tipo de prenda no corresponde a la categoria.":
      "El tipo de prenda no corresponde a la categoría.",
    "El largo es obligatorio para esta categoria.":
      "El largo es obligatorio para esta categoría.",
    "Completa el precio y la cantidad minima por mayor.":
      "Completa el precio y la cantidad mínima por mayor.",
    "El precio por mayor no puede superar el precio unitario.":
      "El precio por mayor no puede superar el precio unitario.",
    "No se pueden repetir combinaciones de talla y color.":
      "No se pueden repetir combinaciones de talla y color.",
    "El color principal debe aparecer en una variante.":
      "El color principal debe aparecer en una variante.",
    "El distrito es obligatorio para Lima.":
      "El distrito es obligatorio para Lima.",
    "La agencia es obligatoria para este destino.":
      "La agencia es obligatoria para este destino.",
    "No se pueden repetir variantes en la orden.":
      "No se pueden repetir variantes en la orden.",
    "El importe total supera el limite permitido.":
      "El importe total supera el límite permitido.",
    "El registro ya existe. Actualiza la lista antes de intentarlo de nuevo.":
      "El registro ya existe. Actualiza la lista antes de intentarlo de nuevo.",
    "You do not have permission for this store operation.":
      "No tienes permiso para realizar esta operación en esta tienda.",
    "The last active store administrator cannot be removed or demoted.":
      "La tienda debe conservar al menos un administrador activo.",
    "Store member was not found.":
      "No se encontró ese integrante en esta tienda.",
    "A store is required for a store role.":
      "Selecciona una tienda para asignar este rol.",
    "La hora de cierre debe ser posterior a la apertura.":
      "La hora de cierre debe ser posterior a la apertura.",
    "Los turnos del mismo día no pueden superponerse.":
      "Los turnos del mismo día no pueden superponerse.",
    "Una tienda cerrada o rechazada no admite cambios.":
      "Una tienda cerrada o rechazada no admite cambios.",
    "Una tienda activa debe conservar al menos un horario.":
      "Una tienda activa debe conservar al menos un horario.",
    "La tienda cambió desde que la abriste. Recarga el detalle antes de guardar.":
      "La tienda cambió desde que la abriste. Recarga el detalle antes de guardar.",
    "Ese número de WhatsApp ya está registrado en otra tienda.":
      "Ese número de WhatsApp ya está registrado en otra tienda.",
    "The current password is incorrect.": "La contraseña actual es incorrecta.",
    "The new password must be different.":
      "La nueva contraseña debe ser diferente a la anterior.",
    "Invalid or expired recovery code.":
      "El código de recuperación es inválido o ha vencido.",
    "Password reset email delivery is not configured.":
      "El envío de correo no está configurado. Solicita una contraseña temporal a un administrador.",
    "The password reset email could not be sent. Try again later.":
      "No se pudo enviar el correo. Inténtalo más tarde o contacta a un administrador.",
    "Username, email, or phone already exists.":
      "El usuario, correo o teléfono ya está registrado.",
    "You cannot block your own account.":
      "No puedes bloquear tu propia cuenta.",
    "You cannot revoke your own SUPER_ADMIN role.":
      "No puedes retirar tu propio rol de administrador general.",
    "The last active SUPER_ADMIN cannot be blocked or demoted.":
      "Debe quedar al menos un administrador general activo.",
    "Use change-password for your own account.":
      "Usa la opción Cambiar contraseña para tu propia cuenta.",
    "Store was not found.": "No se encontró la tienda.",
    "User was not found.": "No se encontró el usuario.",
    "The user does not have this role.": "El usuario no tiene este rol.",
    "Active store membership was not found.":
      "No se encontró un acceso activo a esta tienda.",
  };
  if (message && messages[message]) return messages[message];
  if (status === 400)
    return "Revisa los campos obligatorios y el formato de los datos ingresados.";
  if (status === 401)
    return "La sesión o las credenciales no son válidas. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permisos para realizar esta operación.";
  if (status === 404) return "No se encontró el registro solicitado.";
  if (status === 409)
    return "Los datos entran en conflicto con un registro existente.";
  if (status === 429)
    return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";
  return "No se pudo completar la solicitud. Inténtalo de nuevo más tarde.";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  }).catch(() => {
    throw new Error(
      "No se pudo conectar con Gami. Revisa tu conexión e inténtalo de nuevo.",
    );
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(" ")
      : payload?.message;
    throw new ApiError(
      localizedApiError(message, response.status),
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function login(username: string, password: string) {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function changePassword(
  accessToken: string,
  currentPassword: string | undefined,
  newPassword: string,
) {
  return request<PasswordChangeResult>("/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/request-password-reset", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function recoverPassword(
  email: string,
  recoveryCode: string,
  newPassword: string,
) {
  return request<PasswordChangeResult>("/auth/recover-password", {
    method: "POST",
    body: JSON.stringify({ email, recoveryCode, newPassword }),
  });
}

export function refreshSession(refreshToken: string) {
  return request<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function getCurrentUser(accessToken: string) {
  return request<AuthUser>("/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function logout(accessToken: string) {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 401) {
    throw new Error("No se pudo cerrar la sesión en el servidor.");
  }
}
