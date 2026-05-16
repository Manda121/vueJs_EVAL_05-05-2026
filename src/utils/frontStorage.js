// Gestion simple du localStorage pour le frontoffice (panier par utilisateur)

const CUSTOMER_KEY = 'customer_session';
const CART_PREFIX = 'cart_session_';
const LEGACY_CART_KEY = 'cart_session';
const EVENT_NAME = 'front-storage-change';

export function getCustomerSession() {
    try {
        const data = localStorage.getItem(CUSTOMER_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (err) {
        return null;
    }
}

export function getCustomerId() {
    const session = getCustomerSession();
    if (session && session.id) {
        return String(session.id);
    }
    return '0';
}

export function getCartStorageKey(customerId) {
    let id = customerId;
    if (id === undefined || id === null) {
        id = getCustomerId();
    }
    return CART_PREFIX + String(id);
}

export function setCustomerSession(customer) {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    notifyChange('customer');
}

export function removeCustomerSession() {
    localStorage.removeItem(CUSTOMER_KEY);
    notifyChange('customer');
}

export function getStoredCart(customerId) {
    const key = getCartStorageKey(customerId);

    try {
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data);
        }
    } catch (err) {
        return null;
    }

    // Ancien format cart_session (une seule cle pour tous)
    const currentId = customerId !== undefined && customerId !== null
        ? String(customerId)
        : getCustomerId();

    if (currentId === '0' || currentId === getCustomerId()) {
        try {
            const legacy = localStorage.getItem(LEGACY_CART_KEY);
            if (legacy) {
                const cart = JSON.parse(legacy);
                saveStoredCart(cart, currentId);
                localStorage.removeItem(LEGACY_CART_KEY);
                return cart;
            }
        } catch (err) {
            return null;
        }
    }

    return null;
}

export function saveStoredCart(cart, customerId) {
    const key = getCartStorageKey(customerId);
    localStorage.setItem(key, JSON.stringify(cart));
    notifyChange('cart');
}

export function removeStoredCart(customerId) {
    const key = getCartStorageKey(customerId);
    localStorage.removeItem(key);
    notifyChange('cart');
}

export function isGuestCustomer(customer) {
    const c = customer || getCustomerSession();
    if (!c) return false;
    return String(c.is_guest) === '1' || c.is_guest === 1 || c.is_guest === true;
}

// Pas connecte : on peut lancer la commande (login demande aux etapes)
// Connecte avec is_guest: 1 : commande interdite
export function canPlaceOrder(customer) {
    const c = customer !== undefined ? customer : getCustomerSession();
    if (!c) return true;
    return !isGuestCustomer(c);
}

function notifyChange(type) {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: type } }));
}

export function notifyAddressChange() {
    notifyChange('address');
}

export function onFrontStorageChange(callback) {
    const handler = function (event) {
        callback(event.detail || {});
    };
    window.addEventListener(EVENT_NAME, handler);
    return function () {
        window.removeEventListener(EVENT_NAME, handler);
    };
}
