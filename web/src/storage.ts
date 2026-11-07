/**
 * Acceso a localStorage que nunca rompe la página: en modo privado, con el
 * almacenamiento bloqueado o lleno, simplemente no guarda.
 */
export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nada que hacer */
  }
}
