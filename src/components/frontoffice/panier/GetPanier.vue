<script setup>
import { ref, onMounted, computed } from 'vue';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

import NewOrder from '../orders/NewOrder.vue';

const customer_session = JSON.parse(localStorage.getItem('customer_session'));
const panier_session = ref(JSON.parse(localStorage.getItem('cart_session')));

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const panier = ref();
const produits = ref([]);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const quantityTimers = ref({});

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

const buildCartXml = (cart, rows) => {
    const cartRowsXml = rows
        .map((row) => {
            return `        <cart_row>
          <id_product>${row.id_product}</id_product>
          <id_product_attribute>${row.id_product_attribute}</id_product_attribute>
          <id_address_delivery>${row.id_address_delivery}</id_address_delivery>
          <quantity>${row.quantity}</quantity>
        </cart_row>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <cart>
    <id>${cart.id}</id>
    <id_customer>${cart.id_customer}</id_customer>
    <id_address_delivery>${cart.id_address_delivery}</id_address_delivery>
    <id_address_invoice>${cart.id_address_invoice}</id_address_invoice>
    <id_currency>${cart.id_currency}</id_currency>
    <id_lang>${cart.id_lang}</id_lang>
    <id_shop_group>${cart.id_shop_group}</id_shop_group>
    <id_shop>${cart.id_shop}</id_shop>
    <associations>
      <cart_rows>
${cartRowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`;
};

const saveQuantity = async (produit) => {
    if (!panier_session.value?.idCart || !panier.value) return;

    const rows = normalizeToArray(panier.value?.associations?.cart_rows?.cart_row).map((row) => {
        return {
            id_product: String(row.id_product),
            id_product_attribute: String(row.id_product_attribute || '0'),
            id_address_delivery: String(row.id_address_delivery || panier.value.id_address_delivery || '0'),
            quantity: Number(row.quantity || 0)
        };
    });

    const target = rows.find((row) => {
        return (
            String(row.id_product) === String(produit.id) &&
            String(row.id_product_attribute || '0') === String(produit.id_product_attribute || '0')
        );
    });

    if (target) {
        target.quantity = Number(produit.quantity || 1);
    }

    const xml = buildCartXml(panier.value, rows);

    try {
        await api.put('/carts/' + panier_session.value.idCart, xml, {
            headers: { 'Content-Type': 'application/xml' }
        });

        panier.value.associations.cart_rows.cart_row = rows.map((row) => ({
            id_product: row.id_product,
            id_product_attribute: row.id_product_attribute,
            id_address_delivery: row.id_address_delivery,
            quantity: row.quantity
        }));
    } catch (err) {
        error.value = 'Erreur lors de la mise a jour de la quantite.';
        console.error('Details:', err);
    }
};

const onQuantityInput = (produit) => {
    if (!produit) return;
    if (!produit.quantity || produit.quantity < 1) {
        produit.quantity = 1;
    }

    const key = `${produit.id}-${produit.id_product_attribute || 0}`;
    if (quantityTimers.value[key]) {
        clearTimeout(quantityTimers.value[key]);
    }

    quantityTimers.value[key] = setTimeout(() => {
        saveQuantity(produit);
    }, 3000);
};

const updateCartRows = async (rows) => {
    if (!panier_session.value?.idCart || !panier.value) return;

    const xml = buildCartXml(panier.value, rows);

    try {
        await api.put('/carts/' + panier_session.value.idCart, xml, {
            headers: { 'Content-Type': 'application/xml' }
        });

        panier.value.associations.cart_rows.cart_row = rows.map((row) => ({
            id_product: row.id_product,
            id_product_attribute: row.id_product_attribute,
            id_address_delivery: row.id_address_delivery,
            quantity: row.quantity
        }));
    } catch (err) {
        error.value = 'Erreur lors de la mise a jour du panier.';
        console.error('Details:', err);
    }
};

const removeProduct = async (produit) => {
    const rows = normalizeToArray(panier.value?.associations?.cart_rows?.cart_row).map((row) => {
        return {
            id_product: String(row.id_product),
            id_product_attribute: String(row.id_product_attribute || '0'),
            id_address_delivery: String(row.id_address_delivery || panier.value.id_address_delivery || '0'),
            quantity: Number(row.quantity || 0)
        };
    });

    const filtered = rows.filter((row) => {
        return !(
            String(row.id_product) === String(produit.id) &&
            String(row.id_product_attribute || '0') === String(produit.id_product_attribute || '0')
        );
    });

    await updateCartRows(filtered);
    produits.value = produits.value.filter((item) => {
        return !(
            String(item.id) === String(produit.id) &&
            String(item.id_product_attribute || '0') === String(produit.id_product_attribute || '0')
        );
    });
};

const clearCart = async () => {
    const rows = [];
    await updateCartRows(rows);
    produits.value = [];
};

const fetchPanier = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    produits.value = [];

    try {
        if (!panier_session.value?.idCart) {
            warning.value = 'Aucun panier.';
            return;
        }

        let response = await api.get('/carts/' + panier_session.value.idCart, {
            params: { 'display': 'full' }
        });

        let jsonObj = parser.parse(response.data);

        let data = jsonObj?.prestashop?.cart;

        if (!data) {
            warning.value = 'Aucun panier.';
            return;
        }

        panier.value = data;
        const rows = normalizeToArray(panier.value?.associations?.cart_rows?.cart_row);

        for (const row of rows) {
            // 1. Récupérer les infos du produit de base
            let resProd = await api.get('/products/' + row.id_product, {
                params: { 'display': 'full' }
            });
            let prodData = parser.parse(resProd.data)?.prestashop?.product;

            let comboDetails = null;
            let priceImpact = 0;

            // 2. Si le produit a une combinaison, on récupère son impact
            if (row.id_product_attribute && row.id_product_attribute !== "0") {
                try {
                    let resCombo = await api.get('/combinations/' + row.id_product_attribute);
                    let comboData = parser.parse(resCombo.data)?.prestashop?.combination;

                    if (comboData) {
                        priceImpact = parseFloat(comboData.price || 0);
                        // On peut aussi stocker l'ID de la combinaison pour plus tard
                        comboDetails = row.id_product_attribute;
                    }
                } catch (cErr) {
                    console.error("Erreur combo:", cErr);
                }
            }

            if (prodData) {
                const basePriceHt = parseNumber(prodData.price);
                const taxRate = await getTaxRateFromRuleGroup(prodData.id_tax_rules_group);
                const specificPrice = await getSpecificPrice(prodData.id, row.id_product_attribute);
                const specificBasePriceHt = specificPrice && parseNumber(specificPrice.price) > 0
                    ? parseNumber(specificPrice.price)
                    : basePriceHt;
                const reductionValue = specificPrice ? parseNumber(specificPrice.reduction) : 0;
                const reductionType = specificPrice?.reduction_type || null;
                const reductionTax = String(specificPrice?.reduction_tax || '0') === '1';
                const priceWithImpactHt = specificBasePriceHt + priceImpact;
                let priceWithTax = priceWithImpactHt * (1 + taxRate);

                if (reductionValue > 0 && reductionType) {
                    if (reductionType === 'percentage') {
                        priceWithTax = priceWithTax * (1 - reductionValue);
                    } else if (reductionType === 'amount') {
                        const reductionTtc = reductionTax ? reductionValue : reductionValue * (1 + taxRate);
                        priceWithTax = priceWithTax - reductionTtc;
                    }
                    if (priceWithTax < 0) priceWithTax = 0;
                }
                const roundedUnitPrice = roundPrice(priceWithTax);
                produits.value.push({
                    ...prodData,
                    details: await getComboDetails(comboDetails), // Récupère les détails de la combinaison
                    quantity: Number(row.quantity || 0),
                    id_product_attribute: row.id_product_attribute,
                    price_impact: priceImpact, // On stocke l'impact
                    total_unit_price: roundedUnitPrice // HT + impact, puis taxe, puis reduction, puis arrondi
                });
            }
        }

    } catch (err) {
        error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
        console.error('Details:', err);
    } finally {
        loading.value = false;

        console.log('1.5: ' + Math.round(1.5 * 100) / 100);
    }
};

const getComboDetails = async (id_product_attribute) => {
    if (!id_product_attribute || id_product_attribute === "0") return [];

    try {
        const resCombo = await api.get(`/combinations/${id_product_attribute}`);
        const combo = parser.parse(resCombo.data)?.prestashop?.combination;

        const values = normalizeToArray(combo?.associations?.product_option_values?.product_option_value);

        let details = []; // Initialisation indispensable

        for (const v of values) {
            // 1. Récupérer la valeur (ex: "Bleu")
            const resVal = await api.get(`/product_option_values/${v.id}`);
            const valData = parser.parse(resVal.data)?.prestashop?.product_option_value;
            const valName = Array.isArray(valData.name.language) ? valData.name.language[0] : valData.name.language;

            // 2. Récupérer l'option parente (ex: "Couleur")
            // On utilise l'id_attribute_group qui lie la valeur à son groupe (option)
            const idGroup = valData.id_attribute_group;
            const resOpt = await api.get(`/product_options/${idGroup}`);
            const optData = parser.parse(resOpt.data)?.prestashop?.product_option;
            const optName = Array.isArray(optData.name.language) ? optData.name.language[0] : optData.name.language;

            details.push({
                option: optName,
                valeur: valName
            });
        }
        return details;
    } catch (err) {
        console.error("Erreur détails combo:", err);
        return [];
    }
};

onMounted(fetchPanier);

const totalPanier = computed(() => {
    const sum = produits.value.reduce((total, item) => {
        const unit = Number(item.total_unit_price || 0);
        const qty = Number(item.quantity || 0);
        return total + unit * qty;
    }, 0);
    return roundPrice(sum);
});
</script>

<template>
    <div>
        <h2>Mon Panier {{ panier_session.idCart }}</h2>
        <button v-if="produits.length" type="button" @click="clearCart">Vider le panier</button>
        <!-- <button @click="clearCart">Commander</button> -->
        <Loading v-if="loading" message="Chargement du panier..." />
        <Warning v-if="warning" :warning="warning" />
        <Error v-if="error" :error="error" />

        <table v-if="!loading && !error && produits.length">
            <thead>
                <tr>
                    <th>Produit</th>
                    <th>Prix</th>
                    <th>Quantite</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="produit in produits" :key="produit.id + '-' + produit.id_product_attribute">
                    <td>
                        <div class="product-name">
                            {{ Array.isArray(produit.name?.language) ? produit.name.language[0] : produit.name?.language
                            }}
                        </div>

                        <small v-if="produit.id_product_attribute != 0" class="combo-info">
                            Variante ID: {{ produit.id_product_attribute }}
                        </small>
                        <div v-for="(item, index) in produit.details" :key="index">
                            <strong>{{ item.option }} :</strong> {{ item.valeur }}
                        </div>
                    </td>
                    <td>
                        <div class="price-details">
                            <span class="final-price">{{ roundPrice(produit.total_unit_price).toFixed(2) }} €</span>

                            <div v-if="produit.price_impact !== 0" class="impact-tag">
                                <small>
                                    (Base: {{ roundPrice(produit.price).toFixed(2) }}
                                    {{ produit.price_impact > 0 ? '+' : '' }}{{ roundPrice(produit.price_impact).toFixed(2) }}
                                    impact)
                                </small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <input
                            type="number"
                            min="1"
                            v-model.number="produit.quantity"
                            @input="onQuantityInput(produit)"
                        >
                    </td>
                    <td>
                        <button type="button" @click="removeProduct(produit)">Supprimer</button>
                    </td>
                </tr>
            </tbody>
        </table>
        <div v-if="!loading && !error && produits.length" class="panier-total">
            <strong>Total panier :</strong> {{ totalPanier.toFixed(2) }} €
        </div>
    </div>
</template>