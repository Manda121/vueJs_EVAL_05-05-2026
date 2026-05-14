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

const languageIds = ref([]);
const productCache = ref({});
const taxRateCache = ref({});
const optionCache = ref({});
const optionValueCache = ref({});
const defaultCombinationCache = ref({});

const api = axios.create({
	baseURL: '/api',
	headers: {
		'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
	}
});

function parseNumber(value) {
	if (value === null || value === undefined) return null;
	const normalized = String(value).replace(',', '.').replace('%', '').trim();
	const num = Number(normalized);
	return Number.isNaN(num) ? null : num;
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

async function readFileAsText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result || '');
		reader.onerror = () => reject(reader.error);
		reader.readAsText(file);
	});
}

async function loadLanguages() {
	if (languageIds.value.length > 0) return;

	const response = await api.get('/languages', { params: { display: 'full' } });
	const jsonObj = parser.parse(response.data);
	const data = jsonObj?.prestashop?.languages?.language;
	const languages = Array.isArray(data) ? data : data ? [data] : [];

	languageIds.value = languages
		.map((lng) => lng.id)
		.filter((id) => id !== undefined && id !== null && String(id).trim() !== '');

	if (languageIds.value.length === 0) {
		languageIds.value = [defaultLangId];
	}
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
		return 0;
	}

	const taxResponse = await api.get(`/taxes/${rule.id_tax}`);
	const taxObj = parser.parse(taxResponse.data);
	const rate = parseNumber(taxObj?.prestashop?.tax?.rate) ?? 0;
	taxRateCache.value[groupId] = rate;
	return rate;
}

async function loadOptions() {
	if (Object.keys(optionCache.value).length > 0) return;

	const response = await api.get('/product_options', { params: { display: 'full' } });
	const jsonObj = parser.parse(response.data);
	const data = jsonObj?.prestashop?.product_options?.product_option;
	const options = Array.isArray(data) ? data : data ? [data] : [];

	options.forEach((opt) => {
		const nameNode = opt.name?.language;
		if (Array.isArray(nameNode)) {
			nameNode.forEach((lng) => {
				if (lng && lng['#text']) {
					optionCache.value[lng['#text'].trim().toLowerCase()] = opt.id;
				}
			});
		} else if (nameNode && nameNode['#text']) {
			optionCache.value[nameNode['#text'].trim().toLowerCase()] = opt.id;
		}
	});
}

function buildOptionXml(name, langs) {
	const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
	const optionData = {
		prestashop: {
			'@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
			product_option: {
				group_type: 'select',
				name: {
					language: [...langs.map((id) => ({ '@_id': id, '#text': name }))]
				},
				public_name: {
					language: [...langs.map((id) => ({ '@_id': id, '#text': name }))]
				}
			}
		}
	};
	return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(optionData)}`;
}

async function ensureOption(name) {
	await loadOptions();
	await loadLanguages();

	const key = name.trim().toLowerCase();
	if (optionCache.value[key]) return optionCache.value[key];

	const xml = buildOptionXml(name, languageIds.value);
	const response = await api.post('/product_options', xml, {
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
		newId = jsonObj?.prestashop?.product_option?.id || null;
	}

	if (newId) {
		optionCache.value[key] = newId;
		return newId;
	}

	return null;
}

async function loadOptionValues(optionId) {
	if (optionValueCache.value[optionId]) return;

	const response = await api.get('/product_option_values', {
		params: { 'filter[id_attribute_group]': optionId, display: 'full' }
	});
	const jsonObj = parser.parse(response.data);
	const data = jsonObj?.prestashop?.product_option_values?.product_option_value;
	const values = Array.isArray(data) ? data : data ? [data] : [];

	const map = {};
	values.forEach((val) => {
		const nameNode = val.name?.language;
		if (Array.isArray(nameNode)) {
			nameNode.forEach((lng) => {
				if (lng && lng['#text']) {
					map[lng['#text'].trim().toLowerCase()] = val.id;
				}
			});
		} else if (nameNode && nameNode['#text']) {
			map[nameNode['#text'].trim().toLowerCase()] = val.id;
		}
	});
	optionValueCache.value[optionId] = map;
}

function buildOptionValueXml(optionId, value, langs) {
	const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
	const valueData = {
		prestashop: {
			'@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
			product_option_value: {
				id_attribute_group: optionId,
				name: {
					language: [...langs.map((id) => ({ '@_id': id, '#text': value }))]
				}
			}
		}
	};
	return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(valueData)}`;
}

async function ensureOptionValue(optionId, value) {
	await loadLanguages();
	await loadOptionValues(optionId);

	const key = value.trim().toLowerCase();
	const cache = optionValueCache.value[optionId] || {};
	if (cache[key]) return cache[key];

	const xml = buildOptionValueXml(optionId, value, languageIds.value);
	const response = await api.post('/product_option_values', xml, {
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
		newId = jsonObj?.prestashop?.product_option_value?.id || null;
	}

	if (newId) {
		optionValueCache.value[optionId][key] = newId;
		return newId;
	}

	return null;
}

function buildCombinationXml(productId, optionValueId, impactPriceHt, reference) {
	const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
	const comboData = {
		prestashop: {
			'@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
			combination: {
				id_product: productId,
				reference: reference,
				minimal_quantity: 1,
				price: impactPriceHt,
				associations: {
					product_option_values: {
						product_option_value: [
							{ id: optionValueId }
						]
					}
				}
			}
		}
	};
	return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(comboData)}`;
}

async function updateStock(productId, combinationId, quantity) {
	const response = await api.get('/stock_availables', {
		params: {
			'filter[id_product]': productId,
			'filter[id_product_attribute]': combinationId,
			display: 'full'
		}
	});
	const jsonObj = parser.parse(response.data);
	const data = jsonObj?.prestashop?.stock_availables?.stock_available;
	const stock = Array.isArray(data) ? data[0] : data;
	if (!stock || !stock.id) return;

	const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
	const stockData = {
		prestashop: {
			'@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
			stock_available: {
				id: stock.id,
				id_product: productId,
				id_product_attribute: combinationId,
				quantity: quantity,
				depends_on_stock: 0,
                id_shop: 1,
				out_of_stock: 2
			}
		}
	};
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(stockData)}`;
try{
    await api.put(`/stock_availables/${stock.id}`, xml, {
        headers: { 'Content-Type': 'application/xml' }
	});
    console.log(`Stock updated for product ${productId}, combination ${combinationId}: ${quantity}`);
} catch (err) {
    console.error('Erreur mise a jour stock:', err);    
}
}

async function markProductAsHavingCombinations(productId, defaultComboId) {
	if (!productId || !defaultComboId) return;
	if (defaultCombinationCache.value[productId]) return;

	const productResponse = await api.get(`/products/${productId}`);
	const productObj = parser.parse(productResponse.data);
	const product = productObj?.prestashop?.product;
	if (!product) return;

	const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
	const updateData = {
		prestashop: {
			'@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
			product: {
				id: productId,
				price: product.price,
				type: {
					'@_id': 1,
					'#text': 'combinations'
				},
                available_for_order: 1,
                show_price: 1,
                minimal_quantity: 1,
                reference: product.reference,
                active: 1,
                state: 1,
                available_for_order: 1,
				id_category_default: product.id_category_default,
				id_tax_rules_group: product.id_tax_rules_group,
				active: product.active,
				name: product.name,
				link_rewrite: product.link_rewrite,
				cache_default_attribute: defaultComboId,
				id_default_combination: defaultComboId
			}
		}
	};
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(updateData)}`;

	await api.put(`/products/${productId}`, xml, {
		headers: { 'Content-Type': 'application/xml' }
	});
	defaultCombinationCache.value[productId] = true;
}

async function importDeclinaisons() {
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
		const idxReference = findIndex(headers, ['reference']);
		const idxSpec = findIndex(headers, ['specificite', 'specificité', 'specifite']);
		const idxValue = findIndex(headers, ['karazany', 'valeur', 'value']);
		const idxStock = findIndex(headers, ['stock_initial', 'stock']);
		const idxPrixTtc = findIndex(headers, ['prix_vente_ttc', 'prix ttc', 'price_ttc']);

		total.value = rows.length - 1;

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			const reference = row[idxReference] || '';
			const specificite = row[idxSpec] || '';
			const karazany = row[idxValue] || '';
			const stockInitial = parseNumber(row[idxStock]) ?? 0;
			const prixVenteTtc = parseNumber(row[idxPrixTtc]);

			const rowInfo = { line: i + 1, reference, status: 'ok', message: 'OK' };

			if (!reference || !specificite || !karazany) {
				rowInfo.status = 'warning';
				rowInfo.message = 'Declinaison ignoree (reference/specificite/valeur manquante).';
				results.value.push(rowInfo);
				done.value++;
				continue;
			}

			const product = await loadProductByReference(reference);
			if (!product) {
				rowInfo.status = 'error';
				rowInfo.message = 'Produit introuvable par reference.';
				results.value.push(rowInfo);
				done.value++;
				continue;
			}

            const id_cust = (typeof product.id_tax_rules_group === 'object') ? (product.id_tax_rules_group['#text'] || product.id_tax_rules_group.id) : product.id_tax_rules_group;

			const taxRate = await getTaxRateForGroup(id_cust);
			const baseTtc = product.price_ht * (1 + taxRate / 100);
			const finalTtc = prixVenteTtc == null ? baseTtc : prixVenteTtc;
			const impactTtc = finalTtc - baseTtc;
			const impactHt = taxRate == 0 ? impactTtc : impactTtc / (1 + taxRate / 100);

			const optionId = await ensureOption(specificite);
			if (!optionId) {
				rowInfo.status = 'error';
				rowInfo.message = 'Impossible de creer la specificite.';
				results.value.push(rowInfo);
				done.value++;
				continue;
			}

			const valueId = await ensureOptionValue(optionId, karazany);
			if (!valueId) {
				rowInfo.status = 'error';
				rowInfo.message = 'Impossible de creer la valeur.';
				results.value.push(rowInfo);
				done.value++;
				continue;
			}

			const comboXml = buildCombinationXml(product.id, valueId, impactHt.toFixed(6), reference);
			const comboResponse = await api.post('/combinations', comboXml, {
				headers: { 'Content-Type': 'application/xml' }
			});

			let comboId = null;
			const location = comboResponse?.headers?.location || comboResponse?.headers?.Location;
			if (location) {
				const match = String(location).match(/\/(\d+)(?:\?.*)?$/);
				if (match) comboId = match[1];
			}
			if (!comboId && typeof comboResponse.data === 'string' && comboResponse.data.includes('<prestashop')) {
				const comboObj = parser.parse(comboResponse.data);
				comboId = comboObj?.prestashop?.combination?.id || null;
			}

			if (comboId && stockInitial !== null) {
				await updateStock(product.id, comboId, stockInitial);
			}

			if (comboId) {
				try {
					await markProductAsHavingCombinations(product.id, comboId);
				} catch (err) {
					console.error('Erreur mise a jour produit parent:', err);
				}
			}

			results.value.push(rowInfo);
			done.value++;
		}
	} catch (err) {
		if (err && err.response) {
			error.value = `Erreur lors de l'import. Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
			console.error('importDeclinaisons error response:', err.response.status, err.response.data);
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
		<h1>Importer des declinaisons</h1>

		<input ref="fileRef" type="file" name="csv_file" id="csv_file" accept=".csv">

		<select v-model="separator" name="separateur">
			<option value=",">,</option>
			<option value=";">;</option>
		</select>

		<button @click="importDeclinaisons" :disabled="loading">Importer</button>

		<Loading v-if="loading" message="Import en cours..." />
		<Warning v-if="warning" :warning="warning" />
		<Error v-if="error" :error="error" />

		<p v-if="total">{{ done }} / {{ total }} lignes traitees</p>

		<table v-if="results.length" border="1">
			<thead>
				<tr>
					<th>Ligne</th>
					<th>Reference</th>
					<th>Statut</th>
					<th>Message</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(r, idx) in results" :key="idx">
					<td>{{ r.line }}</td>
					<td>{{ r.reference }}</td>
					<td>{{ r.status }}</td>
					<td>{{ r.message }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>