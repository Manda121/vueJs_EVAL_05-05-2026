<script setup>
import { ref, inject, watch } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';
import {
    validateProduitCsv,
    hasResultErrors,
    isDateDDMMYYYY
} from '@/utils/csvImportValidation';

const reinitialiserTout = inject('reinitialiserTout', null);

const runSignal = defineModel('runSignal');
const emit = defineEmits(['done']);
const isRunning = ref(false);

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
const defaultParentCategoryId = 2;
const defaultCountryId = 8;

const taxGroupCache = ref({});
const taxRateCache = ref({});
const categoryCache = ref({});
const languageIds = ref([]);

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(',', '.').replace('%', '').trim();
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 128);
}

function normalizeDate(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';
    return `${match[3]}-${match[2]}-${match[1]}`;
}

async function failImport(message) {
    if (reinitialiserTout) {
        await reinitialiserTout();
    }
    error.value = message + (reinitialiserTout ? ' Reinitialisation effectuee (tout ou rien).' : '');
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

function buildTaxGroupXml(name) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const groupData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            tax_rule_group: {
                name: name,
                active: 1
            }
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(groupData)}`;
}

function buildTaxXml(name, rate) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const taxData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            tax: {
                rate: rate,
                active: 1,
                name: {
                    language: [
                        {
                            '@_id': defaultLangId,
                            '#text': name
                        }
                    ]
                }
            }
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(taxData)}`;
}

function buildTaxRuleXml(groupId, taxId, rate) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const ruleData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            tax_rule: {
                id_tax_rules_group: groupId,
                id_country: defaultCountryId,
                id_state: 0,
                zipcode_from: 0,
                zipcode_to: 0,
                id_tax: taxId,
                behavior: 0,
                description: `TVA ${rate}`
            }
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(ruleData)}`;
}

async function loadTaxGroups() {
    if (Object.keys(taxGroupCache.value).length > 0) return;

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

    const response = await api.get('/tax_rule_groups', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.tax_rule_groups?.tax_rule_group;
    const groups = Array.isArray(data) ? data : data ? [data] : [];

    groups.forEach((g) => {
        if (g && g.name) {
            taxGroupCache.value[String(g.name).trim().toLowerCase()] = g.id;
        }
    });
}

async function loadTaxes() {
    if (Object.keys(taxRateCache.value).length > 0) return;

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

    const response = await api.get('/taxes', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.taxes?.tax;
    const taxes = Array.isArray(data) ? data : data ? [data] : [];

    taxes.forEach((t) => {
        const rate = parseNumber(t.rate);
        if (rate !== null) {
            taxRateCache.value[String(rate)] = t.id;
        }
    });
}

async function loadLanguages() {
    if (languageIds.value.length > 0) return;

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

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

async function ensureTaxRulesGroup(rate) {
    const rateKey = String(rate);
    const groupName = `TVA ${rateKey}`;

    await loadTaxGroups();
    await loadTaxes();

    let groupId = taxGroupCache.value[groupName.toLowerCase()];
    let taxId = taxRateCache.value[rateKey];

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
            'Content-Type': 'application/xml'
        }
    });

    if (!groupId) {
        const groupXml = buildTaxGroupXml(groupName);
        const responseGroup = await api.post('/tax_rule_groups', groupXml);
        const jsonGroup = parser.parse(responseGroup.data);
        groupId = jsonGroup?.prestashop?.tax_rule_group?.id;
        if (groupId) {
            taxGroupCache.value[groupName.toLowerCase()] = groupId;
        }
    }

    if (!taxId) {
        const taxXml = buildTaxXml(groupName, rateKey);
        const responseTax = await api.post('/taxes', taxXml);
        const jsonTax = parser.parse(responseTax.data);
        taxId = jsonTax?.prestashop?.tax?.id;
        if (taxId) {
            taxRateCache.value[rateKey] = taxId;
        }
    }

    if (groupId && taxId) {
        const ruleXml = buildTaxRuleXml(groupId, taxId, rateKey);
        await api.post('/tax_rules', ruleXml);
        return groupId;
    }

    return null;
}

async function loadCategories(force = false) {
    if (!force && Object.keys(categoryCache.value).length > 0) return;
    if (force) categoryCache.value = {};

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

    const response = await api.get('/categories', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.categories?.category;
    const categories = Array.isArray(data) ? data : data ? [data] : [];

    categories.forEach((c) => {
        const nameNode = c.name?.language;
        if (Array.isArray(nameNode)) {
            nameNode.forEach((lng) => {
                if (lng && lng['#text']) {
                    categoryCache.value[lng['#text'].trim().toLowerCase()] = c.id;
                }
            });
        } else if (nameNode && nameNode['#text']) {
            categoryCache.value[nameNode['#text'].trim().toLowerCase()] = c.id;
        }
    });
}

function buildCategoryXml(name, langs) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const categoryData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            category: {
                id_parent: defaultParentCategoryId,
                active: 1,
                name: {
                    language: [
                        ...langs.map((id) => ({ '@_id': id, '#text': name }))
                    ]
                },
                link_rewrite: {
                    language: [
                        ...langs.map((id) => ({ '@_id': id, '#text': slugify(name) }))
                    ]
                }
            }
        }
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(categoryData)}`;
}

async function ensureCategory(name) {
    if (!name) return null;

    await loadCategories();
    await loadLanguages();

    const key = name.trim().toLowerCase();
    if (categoryCache.value[key]) return categoryCache.value[key];

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
            'Content-Type': 'application/xml'
        }
    });

    const langs = languageIds.value.length > 0 ? languageIds.value : [defaultLangId];
    const xml = buildCategoryXml(name, langs);

    let response = null;
    try {
        response = await api.post('/categories', xml);
    } catch (err) {
        if (err && err.response) {
            console.error('POST /categories error:', err.response.status, err.response.data);
        } else {
            console.error('POST /categories error:', err);
        }
        return null;
    }

    let newId = null;
    const location = response?.headers?.location || response?.headers?.Location;
    if (location) {
        const match = String(location).match(/\/(\d+)(?:\?.*)?$/);
        if (match) newId = match[1];
    }

    if (!newId && typeof response.data === 'string' && response.data.includes('<prestashop')) {
        try {
            const jsonObj = parser.parse(response.data);
            newId = jsonObj?.prestashop?.category?.id || null;
        } catch (parseErr) {
            console.warn('ensureCategory parse error, fallback to reload:', parseErr);
        }
    }

    if (!newId) {
        await loadCategories(true);
        newId = categoryCache.value[key] || null;
    }

    if (newId) {
        categoryCache.value[key] = newId;
        return newId;
    }

    return null;
}

function buildProductXml(product, langs) {
    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const productData = {
        prestashop: {
            '@_xmlns:xlink': 'http://www.w3.org/1999/xlink',
            product: {
                id_category_default: product.id_category_default,
                id_tax_rules_group: product.id_tax_rules_group,
                available_for_order: 1,
                type: { '@_id': 1, '#text': 'combinations' },
                show_price: 1,
                minimal_quantity: 1,
                active: 1,
                state: 1,
                price: product.price_ht,
                wholesale_price: product.wholesale_price,
                reference: product.reference,
                available_date: product.available_date,
                name: {
                    language: [
                        ...langs.map((id) => ({ '@_id': id, '#text': product.name }))
                    ]
                },
                link_rewrite: {
                    language: [
                        ...langs.map((id) => ({ '@_id': id, '#text': slugify(product.name) }))
                    ]
                },
                associations: {
                    categories: {
                        category: [
                            { id: product.id_category_default }
                        ]
                    }
                }
            }
        }
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(productData)}`;
}

async function importProduits() {
    warning.value = null;
    error.value = null;
    results.value = [];
    done.value = 0;
    total.value = 0;

    const file = fileRef.value?.files?.[0];
    if (!file) {
        warning.value = 'Choisissez un fichier CSV.';
        return false;
    }

    loading.value = true;

    try {
        const text = await readFileAsText(file);
        const rows = parseCsv(text, separator.value);
        if (rows.length < 2) {
            warning.value = 'Fichier CSV vide ou invalide.';
            return false;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        const validation = validateProduitCsv(headers, dataRows);
        if (!validation.ok) {
            await failImport(validation.message);
            return false;
        }

        const idxDate = findIndex(headers, ['date_availability_produit', 'date_availability', 'date']);
        const idxName = findIndex(headers, ['nom', 'name']);
        const idxReference = findIndex(headers, ['reference', 'ref']);
        const idxPrixTtc = findIndex(headers, ['prix_ttc', 'prix ttc', 'price_ttc']);
        const idxTaxe = findIndex(headers, ['taxe', 'tax', 'tva']);
        const idxCategorie = findIndex(headers, ['categorie', 'category']);
        const idxPrixAchat = findIndex(headers, ['prix_achat', 'prix achat', 'wholesale_price']);

        total.value = dataRows.length;

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            const available_date = normalizeDate(row[idxDate] || '');
            const name = row[idxName] || '';
            const reference = row[idxReference] || '';
            const prixTtc = parseNumber(row[idxPrixTtc]);
            const taxe = parseNumber(row[idxTaxe]) ?? 0;
            const categorie = row[idxCategorie] || '';
            const prixAchat = parseNumber(row[idxPrixAchat]) ?? 0;

            const rowInfo = { line: i + 2, reference, status: 'ok', message: 'OK' };

            if (!name || !reference || prixTtc === null) {
                rowInfo.status = 'error';
                rowInfo.message = 'Champs obligatoires manquants.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            if (!isDateDDMMYYYY(row[idxDate] || '')) {
                rowInfo.status = 'error';
                rowInfo.message = 'Date invalide (DD/MM/YYYY).';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const taxRate = taxe < 0 ? 0 : taxe;
            const price_ht = taxRate === 0 ? prixTtc : prixTtc / (1 + taxRate / 100);

            const taxGroupId = await ensureTaxRulesGroup(taxRate);
            if (!taxGroupId) {
                rowInfo.status = 'error';
                rowInfo.message = 'Impossible de creer la taxe.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const categoryId = await ensureCategory(categorie || 'Autre');
            if (!categoryId) {
                rowInfo.status = 'error';
                rowInfo.message = 'Impossible de creer la categorie.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const product = {
                name,
                reference,
                available_date: available_date || '',
                price_ht: price_ht.toFixed(6),
                wholesale_price: prixAchat.toFixed(6),
                id_tax_rules_group: taxGroupId,
                id_category_default: categoryId
            };

            await loadLanguages();
            const langs = languageIds.value.length > 0 ? languageIds.value : [defaultLangId];
            const xml = buildProductXml(product, langs);
            const api = axios.create({
                baseURL: '/api',
                headers: {
                    'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
                    'Content-Type': 'application/xml'
                }
            });

            await api.post('/products', xml);

            results.value.push(rowInfo);
            done.value++;
        }

        if (hasResultErrors(results.value)) {
            await failImport('Import produits : erreurs detectees.');
            return false;
        }

        return true;
    } catch (err) {
        if (err && err.response) {
            await failImport(`Erreur lors de l'import. Status ${err.response.status}: ${JSON.stringify(err.response.data)}`);
            console.error('importProduits error response:', err.response.status, err.response.data);
        } else {
            await failImport('Erreur lors de l\'import. ' + (err && err.message ? err.message : err));
            console.error(err);
        }
        return false;
    } finally {
        loading.value = false;
    }
}

watch(runSignal, async (newValue, oldValue) => {
    if (newValue === oldValue) return;
    if (!newValue) return;
    if (isRunning.value) return;

    isRunning.value = true;
    let success = false;
    try {
        success = await importProduits();
    } finally {
        isRunning.value = false;
        emit('done', success);
    }
});
</script>

<template>
    <div>
        <h2>Fichier 1 - Produits</h2>

        <input ref="fileRef" type="file" name="csv_file" id="csv_file" accept=".csv">

        <select v-model="separator" name="separateur">
            <option value=",">,</option>
            <option value=";">;</option>
        </select>

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