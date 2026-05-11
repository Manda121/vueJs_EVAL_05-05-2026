<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';
import AddToCartForm from './AddToCartForm.vue';

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

const cartContext = {
    idCustomer: '1',
    idCurrency: '1',
    idLang: '1',
    idShop: '1',
    idShopGroup: '1',
    idAddressDelivery: '1',
    idAddressInvoice: '1'
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
    idProduct,
    idProductAttribute,
    qty
}) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <cart>
    <id_customer>${cartContext.idCustomer}</id_customer>
    <id_address_delivery>${cartContext.idAddressDelivery}</id_address_delivery>
    <id_address_invoice>${cartContext.idAddressInvoice}</id_address_invoice>
    <id_currency>${cartContext.idCurrency}</id_currency>
    <id_lang>${cartContext.idLang}</id_lang>
    <id_shop_group>${cartContext.idShopGroup}</id_shop_group>
    <id_shop>${cartContext.idShop}</id_shop>
    <associations>
      <cart_rows>
        <cart_row>
          <id_product>${idProduct}</id_product>
          <id_product_attribute>${idProductAttribute}</id_product_attribute>
          <id_address_delivery>${cartContext.idAddressDelivery}</id_address_delivery>
          <quantity>${qty}</quantity>
        </cart_row>
      </cart_rows>
    </associations>
  </cart>
</prestashop>`;
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
        const combinationId = await findCombinationId();

        if (optionGroups.value.length > 0 && !combinationId) {
            warning.value = 'Aucune combinaison ne correspond aux options choisies.';
            return;
        }

        const xml = buildCartXml({
            idProduct: product.value.id,
            idProductAttribute: combinationId || '0',
            qty: quantity.value
        });

        await api.post('/carts', xml, {
            headers: { 'Content-Type': 'application/xml' }
        });

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

            <p><strong>Prix:</strong> {{ product.price }}</p>
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