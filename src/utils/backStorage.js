// Session employe backoffice (localStorage user_session)

const USER_KEY = 'user_session';

export function getUserSession() {
    try {
        const data = localStorage.getItem(USER_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (err) {
        return null;
    }
}

export function setUserSession(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeUserSession() {
    localStorage.removeItem(USER_KEY);
}

export function isBackofficeRoute(path) {
    if (path === '/login') return true;
    if (path.startsWith('/back')) return true;
    if (path === '/reinitialisation') return true;
    if (path.startsWith('/customer')) return true;
    return false;
}

export function isBackofficeLoginRoute(path) {
    return path === '/login';
}

export function requiresBackofficeAuth(path) {
    return isBackofficeRoute(path) && !isBackofficeLoginRoute(path);
}
