<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';

const product = ref(null);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const id_product = defineModel();

const optionGroups = ref([]);
const selectedOptionValueIds = ref({});

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

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
    if (!groupIds.length) {
        return {};
    }

    try {
        const responses = await Promise.all(
            groupIds.map((id) => api.get('/product_options/' + id, { params: { display: 'full' } }))
        );

        return responses.reduce((acc, response) => {
            const data = parser.parse(response.data)?.prestashop?.product_option;
            if (!data) return acc;
            acc[data.id] = pickLangValue(data.name);
            return acc;
        }, {});
    } catch (err) {
        console.error('Erreur lors du chargement des options:', err);
        return {};
    }
};

const fetchOptionValues = async (ids) => {
    if (!ids.length) {
        optionGroups.value = [];
        return;
    }

    try {
        const responses = await Promise.all(
            ids.map((id) => api.get('/product_option_values/' + id, { params: { display: 'full' } }))
        );

        const values = responses
            .map((response) => {
                const data = parser.parse(response.data)?.prestashop?.product_option_value;
                if (!data) return null;
                return {
                    id: data.id,
                    name: pickLangValue(data.name),
                    groupId: data.id_attribute_group
                };
            })
            .filter(Boolean);

        const groupIds = [...new Set(values.map((value) => value.groupId).filter(Boolean))];
        const groupNames = await fetchOptionGroups(groupIds);

        optionGroups.value = groupIds.map((groupId) => ({
            id: groupId,
            name: groupNames[groupId] || groupId,
            values: values.filter((value) => value.groupId === groupId)
        }));

        optionGroups.value.forEach((group) => {
            if (!selectedOptionValueIds.value[group.id]) {
                selectedOptionValueIds.value[group.id] = '';
            }
        });
    } catch (err) {
        console.error('Erreur lors du chargement des options:', err);
        optionGroups.value = [];
    }
};

const fetchproduct = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    
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

onMounted(fetchproduct);
</script>

<template>
    <div>

        <h2>Details du produit</h2>

        <button @click="id_product = null">X</button>

        <Loading v-if="loading" message="Chargement du produit..." />

        <div v-else-if="product">
            <h3>{{ pickLangValue(product.name) }}</h3>

            <p><strong>Prix:</strong> {{ product.price }}</p>
            <p><strong>Reference:</strong> {{ product.reference }}</p>
            <p><strong>Description:</strong> {{ pickLangValue(product.description_short) }}</p>

            <div v-for="group in optionGroups" :key="group.id">
                <label :for="'option-' + group.id">{{ group.name }}</label>
                <select :id="'option-' + group.id" v-model="selectedOptionValueIds[group.id]">
                    <option value="">Selectionner</option>
                    <option v-for="option in group.values" :key="option.id" :value="option.id">
                        {{ option.name || option.id }}
                    </option>
                </select>
            </div>
        </div>

        <Warning :warning="warning" v-if="warning" />
        <Error :error="error" v-if="error" />
    </div>
</template>