<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';

const import_csv = defineModel();

const fileRef = ref(null);
const separator = ref(',');
const loading = ref(false);
const warning = ref(null);
const error = ref(null);
const results = ref([]);
const total = ref(0);
const done = ref(0);

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true
});

const defaultLangId = 1;
const defaultCurrencyId = 1;
const defaultCarrierId = 1;
const defaultShopId = 1;
const defaultShopGroupId = 1;
const defaultCountryId = 133;
const defaultCustomerGroupId = 3;
const defaultCity = 'Antananarivo';
const defaultPostcode = '00000';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const productCache = ref({});
const taxRateCache = ref({});
const optionValueCache = ref({});
const combinationCache = ref({});
const orderStateCache = ref({});

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(',', '.').replace('%', '').trim();
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function parseCsv(text, sep) {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === sep && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (current.length || row.length) {
                row.push(current.trim());
                rows.push(row);
                row = [];
                current = '';
            }
            if (char === '\r' && next === '\n') {
                i++;
            }
        } else {
            current += char;
        }
    }

    if (current.length || row.length) {
        row.push(current.trim());
        rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => cell !== ''));
}

function findIndex(headers, names) {
    const lower = headers.map((h) => h.toLowerCase());
    for (let i = 0; i < names.length; i++) {
        const name = names[i].toLowerCase();
        const idx = lower.indexOf(name);
        if (idx !== -1) return idx;
    }
    return -1;
}

function normalizeDateTime(value) {
    const trimmed = String(value || '').trim();
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${match[2]}-${match[1]} 00:00:00`;
}

function parseAchat(value) {
    const items = [];
    if (!value) return items;
    const regex = /\(\s*"([^"]*)"\s*;\s*(\d+)\s*;\s*"([^"]*)"\s*\)/g;
    let match = null;
    while ((match = regex.exec(value)) !== null) {
        items.push({
            reference: match[1],
            quantity: parseInt(match[2], 10),
            karazany: match[3] || ''
        });
    }
    return items;
}

async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

async function getCustomerByEmail(email) {
    const response = await api.get('/customers', {
        params: {
            'filter[email]': email,
            display: 'full'
        }
    });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.customers?.customer;
    if (!data) return null;
    return Array.isArray(data) ? data[0] : data;
}

async function getCustomerById(id) {
    const response = await api.get(`/customers/${id}`);
    const jsonObj = parser.parse(response.data);
    return jsonObj?.prestashop?.customer || null;
}

function buildCustomerXml(payload) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const customerData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            customer: payload
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(customerData)}`;
}

async function ensureCustomer(nom, email, pwd) {
    const existing = await getCustomerByEmail(email);
    if (existing) {
        const full = await getCustomerById(existing.id);
        return { id: existing.id, secure_key: full?.secure_key || existing.secure_key || '' };
    }

    const payload = {
        lastname: nom,
        firstname: nom || 'Client',
        email: email,
        passwd: pwd,
        active: 1,
        id_default_group: defaultCustomerGroupId,
        id_lang: defaultLangId,
        newsletter: 0,
        optin: 0,
        is_guest: 0,
        deleted: 0
    };

    const xml = buildCustomerXml(payload);
    const response = await api.post('/customers', xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    let newId = null;
    const location = response?.headers?.location || response?.headers?.Location;
    if (location) {
        const match = String(location).match(/\/(\d+)(?:\?.*)?$/);
        if (match) newId = match[1];
    }

    if (!newId && typeof response.data === 'string' && response.data.includes('<prestashop')) {
        const jsonObj = parser.parse(response.data);
        newId = jsonObj?.prestashop?.customer?.id || null;
    }

    if (!newId) return null;
    const full = await getCustomerById(newId);
    return { id: newId, secure_key: full?.secure_key || '' };
}

async function ensureAddress(idCustomer, lastname, firstname, address1) {
    const response = await api.get('/addresses', {
        params: {
            'filter[id_customer]': idCustomer,
            display: 'full'
        }
    });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.addresses?.address;
    const addresses = Array.isArray(data) ? data : data ? [data] : [];

    const normalizedAddress = normalizeText(address1);
    const normalizedLast = normalizeText(lastname);

    const existing = addresses.find((addr) => {
        const addr1 = normalizeText(addr.address1 || '');
        const last = normalizeText(addr.lastname || '');
        return addr1 === normalizedAddress && last === normalizedLast;
    });

    if (existing) return existing.id;

    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const addressData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            address: {
                id_customer: idCustomer,
                alias: 'Adresse import CSV',
                lastname: lastname,
                firstname: firstname || lastname || 'Client',
                address1: address1,
                city: defaultCity,
                id_country: defaultCountryId,
                postcode: defaultPostcode,
                deleted: 0
            }
        }
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(addressData)}`;

    const createResponse = await api.post('/addresses', xml, {
        headers: { 'Content-Type': 'application/xml' }
    });

    let newId = null;
    const location = createResponse?.headers?.location || createResponse?.headers?.Location;
    if (location) {
        const match = String(location).match(/\/(\d+)(?:\?.*)?$/);
        if (match) newId = match[1];
    }

    if (!newId && typeof createResponse.data === 'string' && createResponse.data.includes('<prestashop')) {
        const dataObj = parser.parse(createResponse.data);
        newId = dataObj?.prestashop?.address?.id || null;
    }

    return newId;
}

async function loadProductByReference(reference) {
    if (productCache.value[reference]) return productCache.value[reference];

    const response = await api.get('/products', {
        params: {
            'filter[reference]': reference,
            display: 'full'
        }
    });

    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.products?.product;
    if (!data) return null;
    const product = Array.isArray(data) ? data[0] : data;
    const payload = {
        id: product.id,
        price_ht: parseNumber(product.price) ?? 0,
        id_tax_rules_group: product.id_tax_rules_group || 0
    };
    productCache.value[reference] = payload;
    return payload;
}

async function getTaxRateForGroup(groupId) {
    if (!groupId) return 0;
    if (taxRateCache.value[groupId]) return taxRateCache.value[groupId];

    const rulesResponse = await api.get('/tax_rules', {
        params: { 'filter[id_tax_rules_group]': groupId, display: 'full' }
    });
    const rulesObj = parser.parse(rulesResponse.data);
    const rules = rulesObj?.prestashop?.tax_rules?.tax_rule;
    const rule = Array.isArray(rules) ? rules[0] : rules;

    if (!rule || !rule.id_tax) {
        taxRateCache.value[groupId] = 0;
        console.log('no taxe ' + groupId);
        return 0;
    }

    const taxResponse = await api.get(`/taxes/${rule.id_tax}`);
    const taxObj = parser.parse(taxResponse.data);
    console.log('taxe obj', taxObj?.prestashop?.tax?.rate);
    const rate = parseNumber(taxObj?.prestashop?.tax?.rate) ?? 0;
    taxRateCache.value[groupId] = rate;
    return rate;
}

async function loadOptionValues() {
    if (Object.keys(optionValueCache.value).length > 0) return;

    const response = await api.get('/product_option_values', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.product_option_values?.product_option_value;
    const values = Array.isArray(data) ? data : data ? [data] : [];

    values.forEach((val) => {
        const nameNode = val.name?.language;
        const id = val.id;
        if (Array.isArray(nameNode)) {
            nameNode.forEach((lng) => {
                if (lng && lng['#text']) {
                    optionValueCache.value[normalizeText(lng['#text'])] = id;
                }
            });
        } else if (nameNode && nameNode['#text']) {
            optionValueCache.value[normalizeText(nameNode['#text'])] = id;
        }
    });
}

async function getCombinationByValue(productId, valueName) {
    if (!valueName) return { id: 0, impact_ht: 0 };
    await loadOptionValues();

    const valueId = optionValueCache.value[normalizeText(valueName)];
    if (!valueId) return null;

    if (!combinationCache.value[productId]) {
        const response = await api.get('/combinations', {
            params: { 'filter[id_product]': productId, display: 'full' }
        });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.combinations?.combination;
        combinationCache.value[productId] = Array.isArray(data) ? data : data ? [data] : [];
    }

    const combos = combinationCache.value[productId] || [];
    for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const values = combo?.associations?.product_option_values?.product_option_value;
        const list = Array.isArray(values) ? values : values ? [values] : [];
        const found = list.some((val) => String(val.id) === String(valueId));
        if (found) {
            return { id: combo.id, impact_ht: parseNumber(combo.price) ?? 0 };
        }
    }

    return null;
}

async function loadOrderStates() {
    if (Object.keys(orderStateCache.value).length > 0) return;

    const response = await api.get('/order_states', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.order_states?.order_state;
    const states = Array.isArray(data) ? data : data ? [data] : [];

    states.forEach((state) => {
        const nameNode = state.name?.language;
        const id = state.id;
        if (Array.isArray(nameNode)) {
            nameNode.forEach((lng) => {
                if (lng && lng['#text']) {
                    orderStateCache.value[normalizeText(lng['#text'])] = id;
                }
            });
        } else if (nameNode && nameNode['#text']) {
            orderStateCache.value[normalizeText(nameNode['#text'])] = id;
        }
    });
}

async function getOrderStateId(label) {
    if (!label) return null;
    await loadOrderStates();
    return orderStateCache.value[normalizeText(label)] || null;
}

function getPaymentInfo(etat) {
    const normalized = normalizeText(etat);
    if (normalized.includes('livraison')) {
        return { module: 'ps_cashondelivery', payment: 'Paiement a la livraison' };
    }
    if (normalized.includes('cheque') || normalized.includes('check')) {
        return { module: 'ps_checkpayment', payment: 'Cheque' };
    }
    if (normalized.includes('accepte')) {
        return { module: 'ps_checkpayment', payment: 'Paiement accepte' };
    }
    if (normalized.includes('erreur')) {
        return { module: 'ps_checkpayment', payment: 'Erreur de paiement' };
    }
    return { module: 'ps_checkpayment', payment: 'Paiement' };
}

function buildCartXml(cart) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const cartData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            cart: {
                id: cart.id || undefined,
                id_customer: cart.id_customer,
                id_address_delivery: cart.id_address_delivery,
                id_address_invoice: cart.id_address_invoice,
                id_currency: cart.id_currency,
                id_lang: cart.id_lang,
                id_carrier: cart.id_carrier,
                id_shop: cart.id_shop,
                id_shop_group: cart.id_shop_group,
                secure_key: cart.secure_key,
                date_add: cart.date_add,
                date_upd: cart.date_upd,
                associations: {
                    cart_rows: {
                        cart_row: cart.rows
                    }
                }
            }
        }
    };
    console.log('Cart XML', cart.date_add);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(cartData)}`;
}

function buildOrderXml(order) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const orderData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            order: order
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(orderData)}`;
}

function buildOrderPaymentXml(payment) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const paymentData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            order_payment: {
                id: payment.id || undefined,
                order_reference: payment.order_reference,
                id_currency: payment.id_currency,
                amount: payment.amount,
                payment_method: payment.payment_method,
                transaction_id: payment.transaction_id,
                date_add: payment.date_add
            }
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(paymentData)}`;
}

function buildOrderHistoryXml(history) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const historyData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            order_history: history
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(historyData)}`;
}

function listFromPrestaShop(node) {
    if (!node) return [];
    return Array.isArray(node) ? node : [node];
}

async function putResourceDates(resourceName, entityName, payload) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const container = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            [entityName]: payload
        }
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(container)}`;
    await api.put(`/${resourceName}/${payload.id}`, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });
}

async function syncCartDates(cartId, cartPayload, dateAdd) {
    cartPayload.id = cartId;
    cartPayload.date_add = dateAdd;
    cartPayload.date_upd = dateAdd;
    await putResourceDates('carts', 'cart', cartPayload);
}

async function syncOrderRelatedDates(orderId, dateAdd) {
    // 1. Récupération complète de la commande
    const orderGetResponse = await api.get(`/orders/${orderId}`);
    const rawOrder = parser.parse(orderGetResponse.data)?.prestashop?.order;
    
    let orderReference = '';

    if (rawOrder) {
        // Sauvegarde de la référence pour l'étape des paiements plus bas
        orderReference = rawOrder.reference || '';

        // Nettoyage strict pour éviter les erreurs de parsing XML
        const cleanedOrder = {
            id: rawOrder.id,
            id_address_delivery: typeof rawOrder.id_address_delivery === 'object' ? rawOrder.id_address_delivery['#text'] : rawOrder.id_address_delivery,
            id_address_invoice: typeof rawOrder.id_address_invoice === 'object' ? rawOrder.id_address_invoice['#text'] : rawOrder.id_address_invoice,
            id_cart: typeof rawOrder.id_cart === 'object' ? rawOrder.id_cart['#text'] : rawOrder.id_cart,
            id_currency: typeof rawOrder.id_currency === 'object' ? rawOrder.id_currency['#text'] : rawOrder.id_currency,
            id_lang: typeof rawOrder.id_lang === 'object' ? rawOrder.id_lang['#text'] : rawOrder.id_lang,
            id_customer: typeof rawOrder.id_customer === 'object' ? rawOrder.id_customer['#text'] : rawOrder.id_customer,
            id_carrier: typeof rawOrder.id_carrier === 'object' ? rawOrder.id_carrier['#text'] : rawOrder.id_carrier,
            current_state: typeof rawOrder.current_state === 'object' ? rawOrder.current_state['#text'] : rawOrder.current_state,
            module: rawOrder.module,
            invoice_number: rawOrder.invoice_number,
            invoice_date: rawOrder.invoice_date,
            delivery_number: rawOrder.delivery_number,
            delivery_date: rawOrder.delivery_date,
            valid: rawOrder.valid,
            shipping_number: typeof rawOrder.shipping_number === 'object' ? (rawOrder.shipping_number['#text'] || '') : (rawOrder.shipping_number || ''),
            note: rawOrder.note || '',
            id_shop_group: rawOrder.id_shop_group,
            id_shop: rawOrder.id_shop,
            secure_key: rawOrder.secure_key,
            payment: rawOrder.payment,
            recyclable: rawOrder.recyclable,
            gift: rawOrder.gift,
            gift_message: rawOrder.gift_message || '',
            mobile_theme: rawOrder.mobile_theme,
            total_discounts: rawOrder.total_discounts,
            total_discounts_tax_incl: rawOrder.total_discounts_tax_incl,
            total_discounts_tax_excl: rawOrder.total_discounts_tax_excl,
            total_paid: rawOrder.total_paid,
            total_paid_tax_incl: rawOrder.total_paid_tax_incl,
            total_paid_tax_excl: rawOrder.total_paid_tax_excl,
            total_paid_real: rawOrder.total_paid_real,
            total_products: rawOrder.total_products,
            total_products_wt: rawOrder.total_products_wt,
            total_shipping: rawOrder.total_shipping,
            total_shipping_tax_incl: rawOrder.total_shipping_tax_incl,
            total_shipping_tax_excl: rawOrder.total_shipping_tax_excl,
            carrier_tax_rate: rawOrder.carrier_tax_rate,
            total_wrapping: rawOrder.total_wrapping,
            total_wrapping_tax_incl: rawOrder.total_wrapping_tax_incl,
            total_wrapping_tax_excl: rawOrder.total_wrapping_tax_excl,
            round_mode: rawOrder.round_mode,
            round_type: rawOrder.round_type,
            conversion_rate: rawOrder.conversion_rate,
            reference: rawOrder.reference,
            // Injection des dates du CSV
            date_add: dateAdd,
            date_upd: dateAdd
        };
        
        // Exécution du PUT propre
        await putResourceDates('orders', 'order', cleanedOrder);
    }

    // 2. Historique des États (Order History)
    const historiesResponse = await api.get('/order_histories', {
        params: { 'filter[id_order]': orderId, display: 'full' }
    });
    const histories = listFromPrestaShop(
        parser.parse(historiesResponse.data)?.prestashop?.order_histories?.order_history
    );
    for (const history of histories) {
        if (!history?.id) continue;
        await putResourceDates('order_histories', 'order_history', {
            id: history.id,
            id_order: orderId,
            id_order_state: history.id_order_state,
            id_employee: history.id_employee ?? 0,
            date_add: dateAdd
        });
    }

    // 3. Transporteurs de la commande (Order Carriers)
    const carriersResponse = await api.get('/order_carriers', {
        params: { 'filter[id_order]': orderId, display: 'full' }
    });
    const carriers = listFromPrestaShop(
        parser.parse(carriersResponse.data)?.prestashop?.order_carriers?.order_carrier
    );
    for (const carrier of carriers) {
        if (!carrier?.id) continue;
        await putResourceDates('order_carriers', 'order_carrier', {
            id: carrier.id,
            id_order: orderId,
            id_carrier: carrier.id_carrier,
            weight: carrier.weight ?? 0,
            shipping_cost_tax_excl: carrier.shipping_cost_tax_excl ?? 0,
            shipping_cost_tax_incl: carrier.shipping_cost_tax_incl ?? 0,
            date_add: dateAdd
        });
    }

    // 4. CORRECTION ICI : Paiements de la commande (Order Payments)
    if (orderReference) {
        const paymentsResponse = await api.get('/order_payments', {
            params: { 'filter[order_reference]': orderReference, display: 'full' }
        });
        const payments = listFromPrestaShop(
            parser.parse(paymentsResponse.data)?.prestashop?.order_payments?.order_payment
        );
        for (const payment of payments) {
            if (!payment?.id) continue;
            await putResourceDates('order_payments', 'order_payment', {
                id: payment.id,
                order_reference: orderReference,
                id_currency: payment.id_currency,
                amount: payment.amount,
                payment_method: payment.payment_method,
                transaction_id: payment.transaction_id || '',
                date_add: dateAdd
            });
        }
    }

    // 5. Factures de la commande (Order Invoices)
    const invoicesResponse = await api.get('/order_invoices', {
        params: { 'filter[id_order]': orderId, display: 'full' }
    });
    const invoices = listFromPrestaShop(
        parser.parse(invoicesResponse.data)?.prestashop?.order_invoices?.order_invoice
    );
    for (const invoice of invoices) {
        if (!invoice?.id) continue;
        await putResourceDates('order_invoices', 'order_invoice', {
            id: invoice.id,
            id_order: orderId,
            number: invoice.number,
            delivery_number: invoice.delivery_number ?? 0,
            delivery_date: invoice.delivery_date || '0000-00-00 00:00:00',
            total_discount_tax_excl: invoice.total_discount_tax_excl ?? 0,
            total_discount_tax_incl: invoice.total_discount_tax_incl ?? 0,
            total_paid_tax_excl: invoice.total_paid_tax_excl ?? 0,
            total_paid_tax_incl: invoice.total_paid_tax_incl ?? 0,
            total_products: invoice.total_products ?? 0,
            total_products_wt: invoice.total_products_wt ?? 0,
            total_shipping_tax_excl: invoice.total_shipping_tax_excl ?? 0,
            total_shipping_tax_incl: invoice.total_shipping_tax_incl ?? 0,
            shipping_tax_computation_method: invoice.shipping_tax_computation_method ?? 0,
            total_wrapping_tax_excl: invoice.total_wrapping_tax_excl ?? 0,
            total_wrapping_tax_incl: invoice.total_wrapping_tax_incl ?? 0,
            note: invoice.note || '',
            date_add: dateAdd
        });
    }
}

async function applyCsvDates(cartId, orderId, cartPayload, dateAdd) {
    try {
        await syncCartDates(cartId, cartPayload, dateAdd);
    } catch (err) {
        console.warn('Mise a jour dates panier echouee:', err);
    }

    if (orderId) {
        try {
            await syncOrderRelatedDates(orderId, dateAdd);
        } catch (err) {
            console.warn('Mise a jour dates liees commande echouee:', err);
        }
    }
}

async function importCommandes() {
    warning.value = null;
    error.value = null;
    results.value = [];
    done.value = 0;
    total.value = 0;

    const file = fileRef.value?.files?.[0];
    if (!file) {
        warning.value = 'Choisissez un fichier CSV.';
        return;
    }

    loading.value = true;

    try {
        const text = await readFileAsText(file);
        const rows = parseCsv(text, separator.value);
        if (rows.length < 2) {
            warning.value = 'Fichier CSV vide ou invalide.';
            return;
        }

        const headers = rows[0];
        const idxDate = findIndex(headers, ['date']);
        const idxNom = findIndex(headers, ['nom']);
        const idxEmail = findIndex(headers, ['email']);
        const idxPwd = findIndex(headers, ['pwd']);
        const idxAdresse = findIndex(headers, ['adresse']);
        const idxAchat = findIndex(headers, ['achat']);
        const idxEtat = findIndex(headers, ['etat']);

        total.value = rows.length - 1;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const dateCsv = row[idxDate] || '';
            const nom = row[idxNom] || '';
            const email = row[idxEmail] || '';
            const pwd = row[idxPwd] || '';
            const adresse = row[idxAdresse] || '';
            const achatRaw = row[idxAchat] || '';
            const etat = row[idxEtat] || '';
            const rowInfo = { line: i + 1, email, status: 'ok', message: 'OK' };

            if (!email || !nom || !adresse || !achatRaw) {
                rowInfo.status = 'error';
                rowInfo.message = 'Champs obligatoires manquants.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const dateAdd = normalizeDateTime(dateCsv);
            if (!dateAdd) {
                rowInfo.status = 'error';
                rowInfo.message = 'Date invalide.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const customer = await ensureCustomer(nom, email, pwd);
            if (!customer) {
                rowInfo.status = 'error';
                rowInfo.message = 'Impossible de creer le client.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const addressId = await ensureAddress(customer.id, nom, nom || 'Client', adresse);
            if (!addressId) {
                rowInfo.status = 'error';
                rowInfo.message = 'Impossible de creer l\'adresse.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const items = parseAchat(achatRaw);
            if (items.length === 0) {
                rowInfo.status = 'error';
                rowInfo.message = 'Achat invalide.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const cartRows = [];
            let totalProductsHt = 0;
            let totalProductsTtc = 0;

            let invalidLine = false;
            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                const product = await loadProductByReference(item.reference);
                if (!product) {
                    rowInfo.status = 'error';
                    rowInfo.message = `Produit introuvable: ${item.reference}`;
                    invalidLine = true;
                    break;
                }

                let combo = null;
                if (item.karazany) {
                    combo = await getCombinationByValue(product.id, item.karazany);
                    if (!combo) {
                        rowInfo.status = 'error';
                        rowInfo.message = `Declinaison introuvable: ${item.reference} ${item.karazany}`;
                        invalidLine = true;
                        break;
                    }
                }

                const taxRate = await getTaxRateForGroup(product.id_tax_rules_group['#text']);
                const unitHt = product.price_ht + (combo ? combo.impact_ht : 0);
                const unitTtc = unitHt * (1 + taxRate / 100);

                cartRows.push({
                    id_product: product.id,
                    id_product_attribute: combo ? combo.id : 0,
                    id_address_delivery: addressId,
                    quantity: item.quantity
                });

                totalProductsHt += unitHt * item.quantity;
                totalProductsTtc += unitTtc * item.quantity;
            }

            if (invalidLine) {
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const cartPayload = {
                id_customer: customer.id,
                id_address_delivery: addressId,
                id_address_invoice: addressId,
                id_currency: defaultCurrencyId,
                id_lang: defaultLangId,
                id_carrier: defaultCarrierId,
                id_shop: defaultShopId,
                id_shop_group: defaultShopGroupId,
                secure_key: customer.secure_key,
                rows: cartRows
            };

            const cartXml = buildCartXml(cartPayload);

            const cartResponse = await api.post('/carts', cartXml, {
                headers: { 'Content-Type': 'application/xml' }
            });

            let cartId = null;
            const cartLocation = cartResponse?.headers?.location || cartResponse?.headers?.Location;
            if (cartLocation) {
                const match = String(cartLocation).match(/\/(\d+)(?:\?.*)?$/);
                if (match) cartId = match[1];
            }
            if (!cartId && typeof cartResponse.data === 'string' && cartResponse.data.includes('<prestashop')) {
                const cartObj = parser.parse(cartResponse.data);
                cartId = cartObj?.prestashop?.cart?.id || null;
            }

            if (!cartId) {
                rowInfo.status = 'error';
                rowInfo.message = 'Creation panier echouee.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            // --- CAS PARTICULIER EXPLICITE : ÉTAT VIDE -> SEULEMENT LE PANIER ---
            if (etat == null || etat === '') {
                try {
                    await syncCartDates(cartId, cartPayload, dateAdd);
                } catch (cartDateErr) {
                    console.warn('Mise a jour dates panier seule echouee:', cartDateErr);
                }
                rowInfo.status = 'warning';
                rowInfo.message = 'Etat de la commande non defini, statut par defaut applique.';
                results.value.push(rowInfo);
                done.value++;
                continue; 
            }

            const orderStateId = await getOrderStateId(etat);
            const paymentInfo = getPaymentInfo(etat);

            const orderXml = buildOrderXml({
                id_cart: cartId,
                id_customer: customer.id,
                id_address_delivery: addressId,
                id_address_invoice: addressId,
                id_currency: defaultCurrencyId,
                id_lang: defaultLangId,
                id_carrier: defaultCarrierId,
                module: paymentInfo.module,
                payment: paymentInfo.payment,
                total_paid: totalProductsTtc.toFixed(6),
                total_paid_tax_incl: totalProductsTtc.toFixed(6),
                total_paid_tax_excl: totalProductsHt.toFixed(6),
                total_paid_real: '0.000000',
                total_products: totalProductsHt.toFixed(6),
                total_products_wt: totalProductsTtc.toFixed(6),
                total_shipping: 0,
                total_shipping_tax_incl: 0,
                total_shipping_tax_excl: 0,
                total_discounts: 0,
                total_discounts_tax_incl: 0,
                total_discounts_tax_excl: 0,
                conversion_rate: 1,
                current_state: orderStateId || 0
            });

            const orderResponse = await api.post('/orders', orderXml, {
                headers: { 'Content-Type': 'application/xml' }
            });

            let orderId = null;
            const orderLocation = orderResponse?.headers?.location || orderResponse?.headers?.Location;
            if (orderLocation) {
                const match = String(orderLocation).match(/\/(\d+)(?:\?.*)?$/);
                if (match) orderId = match[1];
            }
            if (!orderId && typeof orderResponse.data === 'string' && orderResponse.data.includes('<prestashop')) {
                const orderObj = parser.parse(orderResponse.data);
                orderId = orderObj?.prestashop?.order?.id || null;
            }

            if (!orderId) {
                rowInfo.status = 'error';
                rowInfo.message = 'Creation commande echouee.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            if (totalProductsTtc > 0) {
                try {
                    const orderPaymentXml = buildOrderPaymentXml({
                        order_reference: '',
                        id_order: orderId,
                        id_currency: defaultCurrencyId,
                        amount: totalProductsTtc.toFixed(6),
                        payment_method: paymentInfo.payment,
                        transaction_id: '',
                        date_add: dateAdd
                    });
                    await api.post('/order_payments', orderPaymentXml, {
                        headers: { 'Content-Type': 'application/xml' }
                    });
                } catch (payErr) {
                    console.warn('Creation paiement order_payments echouee:', payErr);
                }
            }

            if (orderStateId) {
                try {
                    const historyXml = buildOrderHistoryXml({
                        id_order: orderId,
                        id_order_state: orderStateId,
                        date_add: dateAdd,
                        id_employee: 0
                    });
                    await api.post('/order_histories?sendemail=0', historyXml, {
                        headers: { 'Content-Type': 'application/xml' }
                    });
                } catch (histErr) {
                    console.warn('Creation historique order_histories echouee:', histErr);
                }
            }

            // Exécution finale et sécurisée des modifications de dates par PUT
            await applyCsvDates(cartId, orderId, cartPayload, dateAdd);

            results.value.push(rowInfo);
            done.value++;
        }
    } catch (err) {
        if (err && err.response) {
            error.value = `Erreur lors de l'import. Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
            console.error('importCommandes error response:', err.response.status, err.response.data);
        } else {
            error.value = 'Erreur lors de l\'import. ' + (err && err.message ? err.message : err);
            console.error(err);
        }
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="popop">
        <button @click="import_csv = false">X</button>
        <h1>Importer des commandes</h1>

        <input ref="fileRef" type="file" name="csv_file" id="csv_file" accept=".csv">

        <select v-model="separator" name="separateur">
            <option value=",">,</option>
            <option value=";">;</option>
        </select>

        <button @click="importCommandes" :disabled="loading">Importer</button>

        <Loading v-if="loading" message="Import en cours..." />
        <Warning v-if="warning" :warning="warning" />
        <Error v-if="error" :error="error" />

        <p v-if="total">{{ done }} / {{ total }} lignes traitees</p>

        <table v-if="results.length" border="1">
            <thead>
                <tr>
                    <th>Ligne</th>
                    <th>Email</th>
                    <th>Statut</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(r, idx) in results" :key="idx">
                    <td>{{ r.line }}</td>
                    <td>{{ r.email }}</td>
                    <td>{{ r.status }}</td>
                    <td>{{ r.message }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>