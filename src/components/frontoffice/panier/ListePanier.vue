<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';

const carts = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const parser = new XMLParser({});

const api = axios.create({
	baseURL: '/api',
	headers: {
		'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
	}
});

const normalizeToArray = (value) => {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
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

const productNameCache = {};
const combinationNameCache = {};

const fetchProductName = async (id) => {
	if (!id) return '';
	if (productNameCache[id]) return productNameCache[id];

	const response = await api.get('/products/' + id, {
		params: { display: 'full' }
	});
	const data = parser.parse(response.data)?.prestashop?.product;
	const name = pickLangValue(data?.name);
	productNameCache[id] = name || String(id);
	return productNameCache[id];
};

const fetchCombinationName = async (id) => {
	if (!id || String(id) === '0') return '';
	if (combinationNameCache[id]) return combinationNameCache[id];

	const response = await api.get('/combinations/' + id, {
		params: { display: 'full' }
	});
	const data = parser.parse(response.data)?.prestashop?.combination;

	const valueNodes = normalizeToArray(
		data?.associations?.product_option_values?.product_option_value
	);
	const valueIds = valueNodes
		.map((node) => (typeof node === 'object' ? node.id : node))
		.filter(Boolean);

	if (valueIds.length === 0) {
		combinationNameCache[id] = '';
		return '';
	}

	const names = [];
	for (const valueId of valueIds) {
		const valueResponse = await api.get('/product_option_values/' + valueId, {
			params: { display: 'full' }
		});
		const valueData = parser.parse(valueResponse.data)?.prestashop?.product_option_value;
		const name = pickLangValue(valueData?.name);
		if (name) {
			names.push(name);
		}
	}

	combinationNameCache[id] = names.join(' / ');
	return combinationNameCache[id];
};

const fetchCarts = async () => {
	loading.value = true;
	error.value = null;
	warning.value = null;

	try {
		const response = await api.get('/carts', {
			params: { display: 'full' }
		});

		const jsonObj = parser.parse(response.data);
		const data = jsonObj?.prestashop?.carts?.cart;

		if (!data) {
			warning.value = 'Aucun panier trouve.';
			return;
		}

		const list = Array.isArray(data) ? data : [data];

		for (const cart of list) {
			const rows = normalizeToArray(cart?.associations?.cart_rows?.cart_row);
			cart.items_count = rows.reduce((sum, row) => {
				const qty = Number(row?.quantity || 0);
				return sum + qty;
			}, 0);

			for (const row of rows) {
				row.product_name = await fetchProductName(row.id_product);
				row.combination_name = await fetchCombinationName(row.id_product_attribute);
			}

			cart.rows = rows;
		}

		carts.value = list;
	} catch (err) {
		error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
		console.error('Details:', err);
	} finally {
		loading.value = false;
	}
};

onMounted(fetchCarts);
</script>

<template>
	<div>
		<h2>Liste des paniers</h2>

		<Loading v-if="loading" message="Chargement des paniers..." />

		<table v-else border="1">
			<thead>
				<tr>
					<th>ID</th>
					<th>Client</th>
					<th>Devise</th>
					<th>Langue</th>
					<th>Articles</th>
					<th>Produits</th>
					<th>Ajout</th>
					<th>Maj</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="cart in carts" :key="cart.id">
					<td>{{ cart.id }}</td>
					<td>{{ cart.id_customer }}</td>
					<td>{{ cart.id_currency }}</td>
					<td>{{ cart.id_lang }}</td>
					<td>{{ cart.items_count }}</td>
					<td>
						<div v-for="row in cart.rows" :key="row.id_product + '-' + row.id_product_attribute">
							{{ row.product_name }}
							<span v-if="row.combination_name"> ({{ row.combination_name }})</span>
							x{{ row.quantity }}
						</div>
					</td>
					<td>{{ cart.date_add }}</td>
					<td>{{ cart.date_upd }}</td>
				</tr>
			</tbody>
		</table>

		<Warning :warning="warning" v-if="warning" />
		<Error :error="error" v-if="error" />
	</div>
</template>
