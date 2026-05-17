<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import Login from '../login/Login.vue';
import Singin from '../login/Singin.vue';
import NewAddresse from '../adresse/NewAddresse.vue';
import UpdateAddresse from '../adresse/UpdateAddresse.vue';
import {
    getCustomerSession,
    getStoredCart,
    removeCustomerSession,
    removeStoredCart,
    isGuestCustomer,
    canPlaceOrder,
    onFrontStorageChange
} from '@/utils/frontStorage';

const loading = ref(false);
const warning = ref(null);
const error = ref(null);

const etape = ref(1);

const customer_session = ref(null);
const cart_session = ref(null);

const showAuthForm = ref(false);
const authMode = ref('login');

const addresses = ref([]);
const selectedAddressId = ref('');
const showNewAddress = ref(false);
const updateAddressId = ref(null);

const carriers = ref([]);
const selectedCarrierId = ref('');

const optionsPaiement = [
    { id: 1, label: 'Payer comptant a la livraison', module: 'ps_cashondelivery', nom: 'Paiement a la livraison' },
    { id: 2, label: 'Payer par cheque', module: 'ps_checkpayment', nom: 'Cheque' },
    { id: 3, label: 'Payer par virement bancaire', module: 'ps_wirepayment', nom: 'Virement bancaire' }
];

const selectedPaymentId = ref('');

const orderStates = ref([]);
const selectedOrderStateId = ref('');

const parser = new XMLParser({});
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const refreshSession = () => {
    customer_session.value = getCustomerSession();
    cart_session.value = getStoredCart();
};

const toggleAuthForm = (mode) => {
    authMode.value = mode;
    showAuthForm.value = true;
};

const disconnect = () => {
    removeCustomerSession();
    customer_session.value = null;
    cart_session.value = getStoredCart();
    warning.value = 'Vous etes deconnecte.';
    etape.value = 1;
};

const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const parseNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundPrice = (value) => {
    return Math.round(parseNumber(value));
};

const taxRateCache = ref({});
const specificPriceCache = ref({});

const getTaxRateFromRuleGroup = async (idTaxRulesGroup) => {
    const key = String(idTaxRulesGroup || '0');
    if (key === '0') return 0;
    if (taxRateCache.value[key] !== undefined) {
        return taxRateCache.value[key];
    }

    try {
        const resRules = await api.get('/tax_rules', {
            params: {
                'filter[id_tax_rules_group]': `[${key}]`,
                'display': 'full'
            }
        });

        const rulesRoot = parser.parse(resRules.data)?.prestashop?.tax_rules;
        const rules = normalizeToArray(rulesRoot?.tax_rule);
        const rule = rules[0];
        const taxId = rule?.id_tax;
        if (!taxId) {
            taxRateCache.value[key] = 0;
            return 0;
        }

        const resTax = await api.get(`/taxes/${taxId}`, { params: { 'display': 'full' } });
        const taxRoot = parser.parse(resTax.data)?.prestashop;
        const tax = taxRoot?.tax || normalizeToArray(taxRoot?.taxes?.tax)[0];
        const rate = parseNumber(tax?.rate);
        const rateValue = rate / 100;
        taxRateCache.value[key] = rateValue;
        return rateValue;
    } catch (err) {
        console.error('Erreur taxe:', err);
        taxRateCache.value[key] = 0;
        return 0;
    }
};

const getSpecificPrice = async (productId, productAttributeId) => {
    const key = `${productId || 0}-${productAttributeId || 0}`;
    if (specificPriceCache.value[key] !== undefined) {
        return specificPriceCache.value[key];
    }

    try {
        const res = await api.get('/specific_prices', {
            params: {
                'filter[id_product]': `[${productId}]`,
                'display': 'full'
            }
        });

        const root = parser.parse(res.data)?.prestashop?.specific_prices;
        const list = normalizeToArray(root?.specific_price);

        const attrId = String(productAttributeId || '0');
        const match = list.find((item) => {
            return String(item.id_product_attribute || '0') === attrId;
        }) || list.find((item) => {
            return String(item.id_product_attribute || '0') === '0';
        });

        specificPriceCache.value[key] = match || null;
        return match || null;
    } catch (err) {
        console.error('Erreur specific price:', err);
        specificPriceCache.value[key] = null;
        return null;
    }
};

const computeFinalPrices = async (product, productAttributeId, priceImpact) => {
    const basePriceHt = parseNumber(product?.price);
    const taxRate = await getTaxRateFromRuleGroup(product?.id_tax_rules_group);
    const specificPrice = await getSpecificPrice(product?.id, productAttributeId);
    const specificBasePriceHt = specificPrice && parseNumber(specificPrice.price) > 0
        ? parseNumber(specificPrice.price)
        : basePriceHt;

    const reductionValue = specificPrice ? parseNumber(specificPrice.reduction) : 0;
    const reductionType = specificPrice?.reduction_type || null;
    const reductionTax = String(specificPrice?.reduction_tax || '0') === '1';

    const priceWithImpactHt = specificBasePriceHt + priceImpact;
    let priceWithTax = priceWithImpactHt * (1 + taxRate);
    let priceWithoutTax = priceWithImpactHt;

    if (reductionValue > 0 && reductionType) {
        if (reductionType === 'percentage') {
            priceWithTax = priceWithTax * (1 - reductionValue);
            priceWithoutTax = priceWithoutTax * (1 - reductionValue);
        } else if (reductionType === 'amount') {
            const reductionTtc = reductionTax ? reductionValue : reductionValue * (1 + taxRate);
            priceWithTax = priceWithTax - reductionTtc;
            priceWithoutTax = priceWithoutTax - (reductionTax ? reductionValue / (1 + taxRate) : reductionValue);
        }
        if (priceWithTax < 0) priceWithTax = 0;
        if (priceWithoutTax < 0) priceWithoutTax = 0;
    }

    return {
        unitPriceTaxIncl: priceWithTax,
        unitPriceTaxExcl: priceWithoutTax
    };
};

const fetchAddresses = async () => {
    if (!customer_session.value?.id) return;
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/addresses', {
            params: {
                display: 'full',
                'filter[id_customer]': customer_session.value.id
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.addresses?.address;
        addresses.value = Array.isArray(data) ? data : data ? [data] : [];

        if (addresses.value.length > 0 && !selectedAddressId.value) {
            selectedAddressId.value = String(addresses.value[0].id);
        }
    } catch (err) {
        error.value = 'Erreur lors du chargement des adresses.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

const fetchCarriers = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/carriers', {
            params: {
                display: 'full',
                'filter[active]': 1
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.carriers?.carrier;
        carriers.value = Array.isArray(data) ? data : data ? [data] : [];

        if (carriers.value.length > 0 && !selectedCarrierId.value) {
            selectedCarrierId.value = String(carriers.value[0].id);
        }
    } catch (err) {
        error.value = 'Erreur lors du chargement des modes de livraison.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

const setDefaultPayment = () => {
    if (optionsPaiement.length > 0 && !selectedPaymentId.value) {
        selectedPaymentId.value = String(optionsPaiement[0].id);
    }
};

const fetchOrderStates = async () => {
    loading.value = true;
    error.value = null;

    try {
        const response = await api.get('/order_states', {
            params: {
                display: 'full'
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.order_states?.order_state;
        const list = Array.isArray(data) ? data : data ? [data] : [];
        orderStates.value = list.filter((stateItem) => {
            return stateItem.active === undefined || String(stateItem.active) === '1';
        });

        if (orderStates.value.length > 0 && !selectedOrderStateId.value) {
            selectedOrderStateId.value = String(orderStates.value[0].id);
        }
    } catch (err) {
        error.value = 'Erreur lors du chargement des statuts.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

const goToStep = (step) => {
    etape.value = step;
    warning.value = null;

    if (step === 2) {
        fetchAddresses();
    }

    if (step === 3) {
        fetchCarriers();
    }

    if (step === 4) {
        setDefaultPayment();
        fetchOrderStates();
    }
};

const ensureStep1 = () => {
    refreshSession();
    if (!customer_session.value) {
        warning.value = 'Vous devez vous connecter ou vous inscrire.';
        return;
    }
    if (isGuestCustomer(customer_session.value)) {
        warning.value = 'Compte invite (is_guest) : commande impossible.';
        return;
    }
    goToStep(2);
};

const ensureStep2 = () => {
    if (!selectedAddressId.value) {
        warning.value = 'Vous devez choisir une adresse.';
        return;
    }
    goToStep(3);
};

const ensureStep3 = () => {
    if (!selectedCarrierId.value) {
        warning.value = 'Vous devez choisir un mode de livraison.';
        return;
    }
    goToStep(4);
};

const fetchCustomerSecureKey = async (customerId) => {
    if (!customerId || String(customerId) === '0') return '';

    try {
        const response = await api.get('/customers/' + customerId, { params: { display: 'full' } });
        const data = parser.parse(response.data)?.prestashop?.customer;
        return data?.secure_key ? String(data.secure_key) : '';
    } catch (err) {
        console.error('Erreur secure_key client:', err);
        return '';
    }
};

const buildCartUpdateXml = (cart, rows, secureKey, idCustomer) => {
    const builder = new XMLBuilder({ format: true });
    const cartRows = rows.map((row) => {
        return {
            id_product: row.id_product || row.idProduct,
            id_product_attribute: row.id_product_attribute || row.idProductAttribute || 0,
            id_address_delivery: row.id_address_delivery || row.idAddressDelivery || cart.id_address_delivery,
            quantity: row.quantity
        };
    });

    const cartData = {
        prestashop: {
            cart: {
                id: cart.id,
                id_customer: idCustomer || cart.id_customer,
                id_address_delivery: cart.id_address_delivery,
                id_address_invoice: cart.id_address_invoice,
                id_currency: cart.id_currency,
                id_lang: cart.id_lang,
                id_shop_group: cart.id_shop_group || '1',
                id_shop: cart.id_shop || '1',
                secure_key: secureKey || cart.secure_key || '',
                associations: {
                    cart_rows: {
                        cart_row: cartRows
                    }
                }
            }
        }
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(cartData)}`;
};

const updateCartAddresses = async (cartId, addressId) => {
    if (!cartId || !addressId) return;

    const cartResponse = await api.get('/carts/' + cartId, {
        params: { display: 'full' }
    });

    const cartData = parser.parse(cartResponse.data)?.prestashop?.cart;
    if (!cartData) return;

    const rows = normalizeToArray(cartData?.associations?.cart_rows?.cart_row);
    cartData.id_address_delivery = addressId;
    cartData.id_address_invoice = addressId;

    const sessionCustomerId = customer_session.value?.id ? String(customer_session.value.id) : '0';
    let secureKey = customer_session.value?.secure_key ? String(customer_session.value.secure_key) : '';
    if (!secureKey && sessionCustomerId !== '0') {
        secureKey = await fetchCustomerSecureKey(sessionCustomerId);
    }

    const cartXml = buildCartUpdateXml(cartData, rows, secureKey, sessionCustomerId);
    await api.put('/carts/' + cartData.id, cartXml, {
        headers: { 'Content-Type': 'application/xml' }
    });
};

const buildOrderRow = async (row) => {
    const response = await api.get('/products/' + row.id_product, {
        params: { display: 'full' }
    });
    const product = parser.parse(response.data)?.prestashop?.product;

    let priceImpact = 0;
    if (row.id_product_attribute && row.id_product_attribute !== '0') {
        try {
            const comboRes = await api.get('/combinations/' + row.id_product_attribute, {
                params: { display: 'full' }
            });
            const combo = parser.parse(comboRes.data)?.prestashop?.combination;
            priceImpact = parseFloat(combo?.price || 0);
        } catch (err) {
            console.error('Details:', err);
        }
    }

    const finalPrices = await computeFinalPrices(product, row.id_product_attribute, priceImpact);
    const roundedTaxIncl = roundPrice(finalPrices.unitPriceTaxIncl);
    const roundedTaxExcl = roundPrice(finalPrices.unitPriceTaxExcl);

    return {
        orderRow: {
            product_id: row.id_product,
            product_attribute_id: row.id_product_attribute || '0',
            product_quantity: row.quantity,
            product_name: Array.isArray(product?.name?.language)
                ? product.name.language[0]
                : product?.name?.language || product?.name || '',
            unit_price_tax_incl: roundedTaxIncl.toFixed(2),
            unit_price_tax_excl: roundedTaxExcl.toFixed(2)
        },
        unitPriceTaxInclRaw: finalPrices.unitPriceTaxIncl,
        unitPriceTaxExclRaw: finalPrices.unitPriceTaxExcl
    };
};

const createOrder = async () => {
    warning.value = null;
    error.value = null;

    refreshSession();
    if (!canPlaceOrder(customer_session.value)) {
        warning.value = 'Compte invite (is_guest) : commande impossible.';
        return;
    }

    if (!cart_session.value?.idCart) {
        warning.value = 'Aucun panier disponible.';
        return;
    }

    if (!selectedAddressId.value || !selectedCarrierId.value || !selectedPaymentId.value || !selectedOrderStateId.value) {
        warning.value = 'Merci de completer toutes les etapes.';
        return;
    }

    loading.value = true;

    try {
        const cartResponse = await api.get('/carts/' + cart_session.value.idCart, {
            params: { display: 'full' }
        });

        const cartData = parser.parse(cartResponse.data)?.prestashop?.cart;
        const rows = normalizeToArray(cartData?.associations?.cart_rows?.cart_row);
        const sessionCustomerId = customer_session.value?.id ? String(customer_session.value.id) : '0';
        let secureKey = customer_session.value?.secure_key ? String(customer_session.value.secure_key) : '';
        if (!secureKey && sessionCustomerId !== '0') {
            secureKey = await fetchCustomerSecureKey(sessionCustomerId);
        }

        const needsCartUpdate =
            String(cartData?.id_customer || '0') !== sessionCustomerId ||
            String(cartData?.secure_key || '') !== String(secureKey || '');

        if (needsCartUpdate) {
            const cartXml = buildCartUpdateXml(cartData, rows, secureKey, sessionCustomerId);
            await api.put('/carts/' + cartData.id, cartXml, {
                headers: { 'Content-Type': 'application/xml' }
            });
            cartData.secure_key = secureKey;
            cartData.id_customer = sessionCustomerId;
        }

        if (selectedAddressId.value && String(cartData.id_address_delivery || '') !== String(selectedAddressId.value)) {
            cartData.id_address_delivery = selectedAddressId.value;
            cartData.id_address_invoice = selectedAddressId.value;
            const cartXml = buildCartUpdateXml(cartData, rows, secureKey, sessionCustomerId);
            await api.put('/carts/' + cartData.id, cartXml, {
                headers: { 'Content-Type': 'application/xml' }
            });
        }

        const orderRows = [];
        let totalProductsWT = 0;
        let totalProductsExcl = 0;

        for (let i = 0; i < rows.length; i++) {
            const orderRowData = await buildOrderRow(rows[i]);
            orderRows.push(orderRowData.orderRow);
            const qty = Number(orderRowData.orderRow.product_quantity || 0);
            totalProductsWT += orderRowData.unitPriceTaxInclRaw * qty;
            totalProductsExcl += orderRowData.unitPriceTaxExclRaw * qty;
        }

        const cartTotalProductsWT = Number(cartData.total_products_wt || 0);
        const cartTotalProducts = Number(cartData.total_products || 0);
        const cartTotalShipping = Number(cartData.total_shipping || 0);
        const cartTotalPaid = Number(cartData.total_paid_tax_incl || cartData.total_paid || 0);

        const totalProductsFinal = cartTotalProductsWT > 0 ? cartTotalProductsWT : totalProductsWT;
        const totalProductsExclFinal = cartTotalProducts > 0 ? cartTotalProducts : totalProductsExcl;
        const totalShippingFinal = cartTotalShipping > 0 ? cartTotalShipping : 0;
        const totalPaidFinal = cartTotalPaid > 0 ? cartTotalPaid : totalProductsFinal + totalShippingFinal;

        const totalProductsFinalRounded = roundPrice(totalProductsFinal);
        const totalProductsExclFinalRounded = roundPrice(totalProductsExclFinal);
        const totalShippingFinalRounded = roundPrice(totalShippingFinal);
        const totalPaidFinalRounded = roundPrice(totalPaidFinal);

        const paymentOption = optionsPaiement.find((item) => String(item.id) === String(selectedPaymentId.value));
        const paymentName = paymentOption?.nom || 'payment';
        const paymentModule = paymentOption?.module || paymentName;

        const builder = new XMLBuilder({ format: true });
        const orderData = {
            prestashop: {
                order: {
                    id_address_delivery: selectedAddressId.value,
                    id_address_invoice: selectedAddressId.value,
                    id_cart: cartData.id,
                    secure_key: cartData.secure_key || customer_session.value?.secure_key || '',
                    id_currency: cartData.id_currency,
                    id_lang: cartData.id_lang,
                    id_customer: cartData.id_customer,
                    id_carrier: selectedCarrierId.value,
                    current_state: selectedOrderStateId.value,
                    module: paymentModule,
                    payment: paymentName,
                    total_paid: totalPaidFinalRounded.toFixed(2),
                    total_paid_tax_incl: totalPaidFinalRounded.toFixed(2),
                    total_paid_tax_excl: totalPaidFinalRounded.toFixed(2),
                    total_paid_real: '0.00',
                    total_products: totalProductsExclFinalRounded.toFixed(2),
                    total_products_wt: totalProductsFinalRounded.toFixed(2),
                    total_shipping: totalShippingFinalRounded.toFixed(2),
                    total_shipping_tax_incl: totalShippingFinalRounded.toFixed(2),
                    total_shipping_tax_excl: totalShippingFinalRounded.toFixed(2),
                    conversion_rate: '1.000000',
                    associations: {
                        order_rows: {
                            order_row: orderRows
                        }
                    }
                }
            }
        };

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(orderData)}`;
        await api.post('/orders', xmlContent, {
            headers: { 'Content-Type': 'application/xml' }
        });

        warning.value = 'Commande creee.';
        removeStoredCart();
        cart_session.value = null;
    } catch (err) {
        error.value = 'Erreur lors de la creation de la commande.';
        console.error('Details:', err);
    } finally {
        loading.value = false;
    }
};

const openUpdateAddress = () => {
    if (!selectedAddressId.value) return;
    updateAddressId.value = selectedAddressId.value;
};

const refreshAddresses = () => {
    fetchAddresses();
};

let interval = null;
let stopListen = null;

onMounted(() => {
    refreshSession();
    if (!customer_session.value) {
        etape.value = 1;
    } else if (isGuestCustomer(customer_session.value)) {
        warning.value = 'Compte invite (is_guest) : vous ne pouvez pas passer commande.';
        etape.value = 1;
    } else if (!cart_session.value?.idCart) {
        warning.value = 'Vous devez avoir des produits dans votre panier pour passer une commande.';
    } else {
        fetchAddresses();
    }

    interval = setInterval(refreshSession, 500);
    stopListen = onFrontStorageChange(function (detail) {
        refreshSession();
        if (detail.type === 'customer' && customer_session.value && canPlaceOrder(customer_session.value)) {
            warning.value = null;
            if (etape.value === 1) {
                fetchAddresses();
            }
        }
        if (detail.type === 'address' && customer_session.value && etape.value >= 2) {
            fetchAddresses();
        }
    });
});

onUnmounted(() => {
    clearInterval(interval);
    if (stopListen) {
        stopListen();
    }
});

watch(selectedAddressId, async (newId, oldId) => {
    if (!newId || newId === oldId) return;
    refreshSession();
    const cartId = cart_session.value?.idCart;
    if (!cartId) return;
    try {
        await updateCartAddresses(cartId, newId);
    } catch (err) {
        console.error('Erreur mise a jour adresse panier:', err);
    }
});
</script>

<template>
    <div>
        <h2>Nouvelle commande</h2>

        <Loading v-if="loading" message="Chargement..." />
        <Warning v-if="warning" :warning="warning" />
        <Error v-if="error" :error="error" />

        <div v-if="etape === 1">
            <h3>Etape 1: Client</h3>

            <div v-if="customer_session">
                <p>Client: {{ customer_session.firstname }} {{ customer_session.lastname }}</p>
                <p v-if="isGuestCustomer(customer_session)" class="guest-info">
                    Ce compte client a is_guest=1 : vous ne pouvez pas passer commande.
                </p>
                <button v-if="!isGuestCustomer(customer_session)" @click="ensureStep1">Continuer</button>
                <button @click="disconnect">Changer (deconnecter)</button>
            </div>

            <div v-else>
                <div>
                    <button @click="toggleAuthForm('login')">Login</button>
                    <button @click="toggleAuthForm('signin')">S'inscrire</button>
                </div>
                <Login v-if="showAuthForm && authMode === 'login'" />
                <Singin v-if="showAuthForm && authMode === 'signin'" />
                <button @click="ensureStep1">J'ai deja un compte</button>
            </div>
        </div>

        <div v-if="etape === 2">
            <h3>Etape 2: Adresse</h3>

            <div v-if="addresses.length">
                <div v-for="addr in addresses" :key="addr.id">
                    <label>
                        <input type="radio" name="address" :value="String(addr.id)" v-model="selectedAddressId">
                        {{ addr.alias }} - {{ addr.address1 }}, {{ addr.city }}
                    </label>
                </div>

                <button @click="openUpdateAddress">Modifier l'adresse</button>
                <button @click="showNewAddress = true">Nouvelle adresse</button>
                <button @click="refreshAddresses">Rafraichir les adresses</button>
            </div>

            <div v-else>
                <NewAddresse v-model="showNewAddress" />
            </div>

            <button @click="ensureStep2">Continuer</button>
            <button @click="goToStep(1)">Retour</button>
        </div>

        <div v-if="etape === 3">
            <h3>Etape 3: Livraison</h3>

            <div v-for="carrier in carriers" :key="carrier.id">
                <label>
                    <input type="radio" name="carrier" :value="String(carrier.id)" v-model="selectedCarrierId">
                    {{ carrier.name }}
                </label>
            </div>

            <button @click="ensureStep3">Continuer</button>
            <button @click="goToStep(2)">Retour</button>
        </div>

        <div v-if="etape === 4">
            <h3>Etape 4: Paiement</h3>

            <div v-for="option in optionsPaiement" :key="option.id">
                <label>
                    <input type="radio" name="payment" :value="String(option.id)" v-model="selectedPaymentId">
                    {{ option.label }}
                </label>
            </div>

            <button @click="createOrder">Valider la commande</button>
            <button @click="goToStep(3)">Retour</button>
        </div>
    </div>

    <UpdateAddresse v-if="updateAddressId" v-model="updateAddressId" />
    <NewAddresse v-if="showNewAddress && addresses.length" v-model="showNewAddress" />
</template>
