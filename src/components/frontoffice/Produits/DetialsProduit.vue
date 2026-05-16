<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';
import AddToCartForm from './AddToCartForm.vue';
import {
    getCustomerSession,
    getStoredCart,
    saveStoredCart,
    removeStoredCart
} from '@/utils/frontStorage';

const product = ref(null);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);
const success = ref(null);

const id_product = defineModel();

const optionGroups = ref([]);
const selectedOptionValueIds = ref({});
const quantity = ref(1);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const fetchDeliveryAddressId = async (customerId) => {
    if (!customerId || String(customerId) === '0') {
        return '0';
    }

    try {
        const response = await api.get('/addresses', {
            params: {
                display: 'full',
                'filter[id_customer]': customerId
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.addresses?.address;
        if (!data) {
            return '0';
        }

        const list = Array.isArray(data) ? data : [data];
        const addressId = list[0]?.id || list[0];
        return addressId ? String(addressId) : '0';
    } catch (err) {
        console.error('Erreur lors du chargement des adresses:', err);
        return '0';
    }
};

const buildCartContext = async () => {
    const session = getCustomerSession();
    const idCustomer = session?.id ? String(session.id) : '0';
    const idAddressDelivery = await fetchDeliveryAddressId(idCustomer);
    const secureKey = session?.secure_key ? String(session.secure_key) : '';

    return {
        idCustomer,
        idCurrency: '1',
        idLang: '1',
        idShop: '1',
        idShopGroup: '1',
        idAddressDelivery,
        idAddressInvoice: idAddressDelivery,
        secureKey
    };
};

const pickLangValue = (node) => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    const languages = node.language;
    if (Array.isArray(languages)) {
        const fr = languages.find((lang) => String(lang.id) === '1');
        return fr?.['#text'] || fr || languages[0]?.['#text'] || languages[0] || '';
    }
    if (languages && typeof languages === 'object') {
        return languages['#text'] || '';
    }
    return '';
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

const fetchOptionGroups = async (groupIds) => {
    if (groupIds.length === 0) {
        return {};
    }

    try {
        const resultats = {};

        // On boucle sur chaque ID de groupe
        for (const id of groupIds) {
            // On attend que la requête finisse avant de passer à l'ID suivant
            const response = await api.get('/product_options/' + id, { 
                params: { display: 'full' } 
            });

            // On analyse les données reçues
            const data = parser.parse(response.data);
            const option = data.prestashop.product_option;

            if (option) {
                const nom = pickLangValue(option.name);
                const idOption = option.id;
                // On stocke dans notre objet : { "1": "Couleur" }
                resultats[idOption] = nom;
            }
        }

        return resultats;
    } catch (err) {
        console.error('Erreur lors du chargement des noms de groupes:', err);
        return {};
    }
};

const fetchOptionValues = async (ids) => {
    if (ids.length === 0) {
        optionGroups.value = [];
        return;
    }

    try {
        const toutesLesValeurs = [];

        // Étape 1 : Récupérer chaque valeur une par une
        for (const id of ids) {
            const response = await api.get('/product_option_values/' + id, { 
                params: { display: 'full' } 
            });

            const data = parser.parse(response.data);
            const valueData = data.prestashop.product_option_value;

            if (valueData) {
                // On crée un petit objet simple
                const objetValeur = {
                    id: valueData.id,
                    name: pickLangValue(valueData.name),
                    groupId: valueData.id_attribute_group
                };
                // On l'ajoute à notre liste
                toutesLesValeurs.push(objetValeur);
            }
        }

        // Étape 2 : Trouver les IDs de groupes uniques (sans doublons)
        const groupIdsUniques = [];
        for (const v of toutesLesValeurs) {
            if (groupIdsUniques.includes(v.groupId) === false) {
                groupIdsUniques.push(v.groupId);
            }
        }

        // Étape 3 : Récupérer les noms des groupes
        const nomsDesGroupes = await fetchOptionGroups(groupIdsUniques);

        // Étape 4 : Organiser les données pour l'affichage (le v-for)
        const structureFinale = [];
        for (const gId of groupIdsUniques) {
            // On filtre les valeurs qui appartiennent à ce groupe
            const valeursDuGroupe = [];
            for (const v of toutesLesValeurs) {
                if (v.groupId === gId) {
                    valeursDuGroupe.push(v);
                }
            }

            structureFinale.push({
                id: gId,
                name: nomsDesGroupes[gId] || gId,
                values: valeursDuGroupe
            });
        }

        optionGroups.value = structureFinale;

        // Initialiser les menus déroulants
        for (const group of optionGroups.value) {
            if (!selectedOptionValueIds.value[group.id]) {
                selectedOptionValueIds.value[group.id] = '';
            }
        }

    } catch (err) {
        console.error('Erreur lors du chargement des options:', err);
        optionGroups.value = [];
    }
};

const fetchproduct = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    success.value = null;
    
    try {
        const response = await api.get('/products/' + id_product.value, {
            params: { 'display': 'full' }
        });
        
        // Conversion XML -> JSON
        const jsonObj = parser.parse(response.data);

        console.log("Données parsées JSON:", jsonObj);

        // Accès aux données selon la structure PrestaShop : <prestashop><products><product>
        const data = jsonObj?.prestashop?.product;

        if (!data) {
            warning.value = "Aucun produit trouvé.";
            return;
        }

        // Si l'API renvoie un seul client, fast-xml-parser peut renvoyer un objet au lieu d'un tableau.
        // On force le format tableau pour le v-for du template.
        product.value = data;

        const optionValueNodes = normalizeToArray(
            data?.associations?.product_option_values?.product_option_value
        );
        const optionValueIds = optionValueNodes
            .map((node) => (typeof node === 'object' ? node.id : node))
            .filter(Boolean);

        await fetchOptionValues(optionValueIds);

        console.log("Produit chargé:", product.value);

    } catch (err) {
        error.value = "Erreur lors de la récupération ou du traitement des données.";
        console.error("Détails:", err);
    } finally {
        loading.value = false;
    }
};

const buildCartXml = ({
    idCart,
    context,
    rows
}) => {
    const cartRowsXml = rows
        .map((row) => {
            return `        <cart_row>
          <id_product>${row.idProduct}</id_product>
          <id_product_attribute>${row.idProductAttribute}</id_product_attribute>
          <id_address_delivery>${row.idAddressDelivery}</id_address_delivery>
          <quantity>${row.quantity}</quantity>
        </cart_row>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <cart>
    ${idCart ? `<id>${idCart}</id>` : ''}
    <id_customer>${context.idCustomer}</id_customer>
    <id_address_delivery>${context.idAddressDelivery}</id_address_delivery>
    <id_address_invoice>${context.idAddressInvoice}</id_address_invoice>
    <id_currency>${context.idCurrency}</id_currency>
    <id_lang>${context.idLang}</id_lang>
    <id_shop_group>${context.idShopGroup}</id_shop_group>
    <id_shop>${context.idShop}</id_shop>
        <secure_key>${context.secureKey || ''}</secure_key>
    <associations>
      <cart_rows>
${cartRowsXml}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`;
};

const fetchCartById = async (idCart) => {
    try {
        const response = await api.get('/carts/' + idCart, {
            params: { display: 'full' }
        });

        const jsonObj = parser.parse(response.data);
        return jsonObj?.prestashop?.cart || null;
    } catch (err) {
        console.error('Erreur lors du chargement du panier:', err);
        return null;
    }
};

const normalizeCartRows = (cart) => {
    const rows = normalizeToArray(cart?.associations?.cart_rows?.cart_row);
    return rows.map((row) => {
        return {
            idProduct: String(row?.id_product || '0'),
            idProductAttribute: String(row?.id_product_attribute || '0'),
            idAddressDelivery: String(row?.id_address_delivery || '0'),
            quantity: Number(row?.quantity || 0)
        };
    });
};

const mergeRow = (rows, newRow) => {
    const existing = rows.find((row) => {
        return (
            String(row.idProduct) === String(newRow.idProduct) &&
            String(row.idProductAttribute) === String(newRow.idProductAttribute) &&
            String(row.idAddressDelivery) === String(newRow.idAddressDelivery)
        );
    });

    if (existing) {
        existing.quantity += Number(newRow.quantity || 0);
    } else {
        rows.push(newRow);
    }
};

const findCombinationId = async () => {
    const selectedIds = Object.values(selectedOptionValueIds.value)
        .map((value) => String(value))
        .filter(Boolean);

    if (selectedIds.length === 0) {
        return '0';
    }

    const combinationNodes = normalizeToArray(
        product.value?.associations?.combinations?.combination
    );
    const combinationIds = combinationNodes
        .map((node) => (typeof node === 'object' ? node.id : node))
        .filter(Boolean);

    if (combinationIds.length === 0) {
        return null;
    }

    const selectedSet = new Set(selectedIds);

    for (const id of combinationIds) {
        const response = await api.get('/combinations/' + id, { params: { display: 'full' } });
        const data = parser.parse(response.data)?.prestashop?.combination;
        if (!data) continue;

        const valueNodes = normalizeToArray(
            data?.associations?.product_option_values?.product_option_value
        );
        const valueIds = valueNodes
            .map((node) => (typeof node === 'object' ? node.id : node))
            .filter(Boolean)
            .map((value) => String(value));

        if (valueIds.length !== selectedSet.size) {
            continue;
        }

        const matches = valueIds.every((value) => selectedSet.has(value));
        if (matches) {
            return String(data.id || id);
        }
    }

    return null;
};

const addToCart = async () => {
    error.value = null;
    warning.value = null;
    success.value = null;

    if (!product.value) {
        warning.value = 'Produit non disponible.';
        return;
    }

    const missingOption = optionGroups.value.some(
        (group) => !selectedOptionValueIds.value[group.id]
    );

    if (missingOption) {
        warning.value = 'Merci de choisir toutes les options.';
        return;
    }

    try {
        const context = await buildCartContext();
        const combinationId = await findCombinationId();

        if (optionGroups.value.length > 0 && !combinationId) {
            warning.value = 'Aucune combinaison ne correspond aux options choisies.';
            return;
        }

        const newRow = {
            idProduct: String(product.value.id),
            idProductAttribute: combinationId || '0',
            idAddressDelivery: context.idAddressDelivery,
            quantity: Number(quantity.value || 1)
        };

        const storedCart = getStoredCart();
        const storedCartId = storedCart?.idCart ? String(storedCart.idCart) : null;

        if (storedCartId) {
            const remoteCart = await fetchCartById(storedCartId);
            if (!remoteCart) {
                removeStoredCart();
            }
        }

        const activeStoredCart = getStoredCart();
        const activeCartId = activeStoredCart?.idCart ? String(activeStoredCart.idCart) : null;

        if (activeCartId) {
            const remoteCart = await fetchCartById(activeCartId);
            const rows = normalizeCartRows(remoteCart);

            mergeRow(rows, newRow);

            const xml = buildCartXml({
                idCart: activeCartId,
                context,
                rows
            });

            await api.put('/carts/' + activeCartId, xml, {
                headers: { 'Content-Type': 'application/xml' }
            });

            saveStoredCart({
                idCart: activeCartId,
                idCustomer: context.idCustomer,
                idAddressDelivery: context.idAddressDelivery,
                idAddressInvoice: context.idAddressInvoice
            });
        } else {
            const xml = buildCartXml({
                idCart: null,
                context,
                rows: [newRow]
            });

            const response = await api.post('/carts', xml, {
                headers: { 'Content-Type': 'application/xml' }
            });

            const jsonObj = parser.parse(response.data);
            const createdCart = jsonObj?.prestashop?.cart;
            const createdId = createdCart?.id || createdCart;
            if (createdId) {
                saveStoredCart({
                    idCart: String(createdId),
                    idCustomer: context.idCustomer,
                    idAddressDelivery: context.idAddressDelivery,
                    idAddressInvoice: context.idAddressInvoice
                });
            }
        }

        success.value = 'Produit ajoute au panier.';
    } catch (err) {
        error.value = 'Erreur lors de l\'ajout au panier.';
        console.error('Détails:', err);
    }
};

onMounted(fetchproduct);
</script>

<template>
    <div>

        <h2>Details du produit</h2>
        <button @click="$router.push('/front/paniers')">voir le panier</button>

        <Loading v-if="loading" message="Chargement du produit..." />

        <div v-else-if="product">
            <h3>{{ pickLangValue(product.name) }}</h3>

            <p><strong>Prix:</strong> {{ roundPrice(product.price).toFixed(2) }}</p>
            <p><strong>Reference:</strong> {{ product.reference }}</p>
            <p><strong>Description:</strong> {{ pickLangValue(product.description_short) }}</p>

            <AddToCartForm
                v-model:selectedOptionValueIds="selectedOptionValueIds"
                v-model:quantity="quantity"
                :option-groups="optionGroups"
                @add-to-cart="addToCart"
            />

            <p v-if="success">{{ success }}</p>
        </div>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
</template>