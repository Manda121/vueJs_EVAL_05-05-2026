<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import Loading from '../inc/Loading.vue';
import Warning from '../inc/Warning.vue';
import Error from '../inc/Error.vue';

const import_csv = defineModel();

const fileRef = ref(null);
const separator = ref(';');
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

const groupCache = ref({});
const defaultLangId = 1;

function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isDateValid(value) {
    if (!value) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

async function loadGroups() {
    if (Object.keys(groupCache.value).length > 0) return;

    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

    const response = await api.get('/groups', { params: { display: 'full' } });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.groups?.group;
    const groups = Array.isArray(data) ? data : data ? [data] : [];

    groups.forEach((g) => {
        const id = g.id;
        const nameNode = g.name?.language;
        if (Array.isArray(nameNode)) {
            nameNode.forEach((lng) => {
                if (lng && lng['#text']) {
                    groupCache.value[lng['#text'].trim().toLowerCase()] = id;
                }
            });
        } else if (nameNode && nameNode['#text']) {
            groupCache.value[nameNode['#text'].trim().toLowerCase()] = id;
        }
    });
}

async function createGroupIfMissing(name) {
    const key = name.trim().toLowerCase();
    if (groupCache.value[key]) return groupCache.value[key];

    const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
    const groupData = {
    prestashop: {
        // L'attribut xmlns est souvent nécessaire pour le POST
        "@_xmlns:xlink": "http://www.w3.org/1999/xlink",
        group: {
            name: {
                // On utilise un tableau pour gérer les langues
                language: [
                    {
                        "@_id": defaultLangId, // Sera transformé en id="..."
                        "#text": name          // Contenu de la balise
                    }
                ]
            },
            price_display_method: 0,
            show_prices: 1
        }
    }
};
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(groupData)}`;
    console.log("new group: "+xml);
    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
            'Content-Type': 'application/xml'
        }
    });

    try {
        const response = await api.post('/groups', xml);
        // Log raw response for debugging
        console.log('createGroupIfMissing response status:', response.status);
        console.log('createGroupIfMissing response data:', response.data);

        const jsonObj = parser.parse(response.data);
        const newId = jsonObj?.prestashop?.group?.id;
        if (newId) {
            groupCache.value[key] = newId;
            return newId;
        }

        return null;
    } catch (err) {
        // If server returned a response, log details to help debugging
        if (err.response) {
            console.error('API POST /groups failed', err.response.status, err.response.data);
        } else {
            console.error('API POST /groups error', err);
        }
        // Re-throw so caller can handle and display the error
        throw err;
    }
}

async function customerExists(email, birthday) {
    const api = axios.create({
        baseURL: '/api',
        headers: {
            'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
        }
    });

    const params = {
        'filter[email]': email,
        'display': 'full'
    };
    if (birthday) {
        params['filter[birthday]'] = birthday;
    }
    const response = await api.get('/customers', { params });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.customers?.customer;
    if (!data) return false;
    return Array.isArray(data) ? data.length > 0 : true;
}

function buildCustomerXml(customer, groups) {
        const builder = new XMLBuilder({ format: true, attributeNamePrefix: '@_', ignoreAttributes: false });
        const customerData = {
                prestashop: {
                        customer: {
                                id_lang: defaultLangId,
                                id_default_group: customer.default_group_id,
                                id_gender: customer.id_gender,
                                lastname: customer.lastname,
                                firstname: customer.firstname,
                                email: customer.email,
                                passwd: customer.passwd,
                                birthday: customer.birthday,
                                newsletter: customer.newsletter,
                                optin: customer.optin,
                                active: customer.active,
                                date_add: customer.date_add,
                                date_upd: customer.date_upd,
                                associations: {
                                        groups: {
                                                group: groups.map((id) => ({ id: id }))
                                        }
                                }
                        }
                }
        };

        return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(customerData)}`;
}

async function importCustomers() {
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
        await loadGroups();

        const text = await readFileAsText(file);
        const rows = parseCsv(text, separator.value);
        if (rows.length < 2) {
            warning.value = 'Fichier CSV vide ou invalide.';
            return;
        }

        const headers = rows[0];
        const idxEmail = findIndex(headers, ['Email *', 'Email']);
        const idxPassword = findIndex(headers, ['Password *', 'Password']);
        const idxLastname = findIndex(headers, ['Last Name *', 'Last Name']);
        const idxFirstname = findIndex(headers, ['First Name *', 'First Name']);
        const idxBirthday = findIndex(headers, ['Birthday (yyyy-mm-dd)', 'Birthday']);
        const idxActive = findIndex(headers, ['Active (0/1)', 'Active']);
        const idxGender = findIndex(headers, ['Titles ID (Mr = 1, Ms = 2, else 0)', 'Titles ID']);
        const idxNewsletter = findIndex(headers, ['Newsletter (0/1)', 'Newsletter']);
        const idxOptin = findIndex(headers, ['Opt-in (0/1)', 'Opt-in']);
        const idxDateAdd = findIndex(headers, ['Registration date (yyyy-mm-dd)', 'Registration date']);
        const idxGroups = findIndex(headers, ['Groups (x,y,z...)', 'Groups']);
        const idxDefaultGroup = findIndex(headers, ['Default group ID', 'Default group']);

        total.value = rows.length - 1;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const email = row[idxEmail] || '';
            const passwd = row[idxPassword] || '';
            const lastname = row[idxLastname] || '';
            const firstname = row[idxFirstname] || '';
            const birthday = row[idxBirthday] || '';
            const active = row[idxActive] === '0' ? '0' : '1';
            const id_gender = row[idxGender] || '0';
            const newsletter = row[idxNewsletter] === '1' ? '1' : '0';
            const optin = row[idxOptin] === '1' ? '1' : '0';
            const date_add = row[idxDateAdd] || new Date().toISOString().slice(0, 10);
            const groupsRaw = row[idxGroups] || '';
            const defaultGroupRaw = row[idxDefaultGroup] || '3';

            const rowInfo = { line: i + 1, email, status: 'ok', message: 'OK' };

            if (!email || !passwd || !lastname || !firstname) {
                rowInfo.status = 'error';
                rowInfo.message = 'Champs obligatoires manquants.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            if (!isEmailValid(email)) {
                rowInfo.status = 'error';
                rowInfo.message = 'Email invalide.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            if (!isDateValid(birthday)) {
                rowInfo.status = 'error';
                rowInfo.message = 'Date de naissance invalide.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const exists = await customerExists(email, birthday);
            if (exists) {
                rowInfo.status = 'warning';
                rowInfo.message = 'Client deja existant (email + naissance).';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            const groupIds = [];
            if (groupsRaw) {
                const parts = groupsRaw.split(',');
                for (let g = 0; g < parts.length; g++) {
                    const value = parts[g].trim();
                    if (!value) continue;
                    if (/^\d+$/.test(value)) {
                        groupIds.push(value);
                    } else {
                        const id = await createGroupIfMissing(value);
                        if (id) groupIds.push(id);
                    }
                }
            }

            let defaultGroupId = defaultGroupRaw;
            if (!/^\d+$/.test(defaultGroupId)) {
                const created = await createGroupIfMissing(defaultGroupId);
                if (created) defaultGroupId = created;
                else defaultGroupId = '3';
            }

            if (!groupIds.includes(defaultGroupId)) {
                groupIds.push(defaultGroupId);
            }

            const customer = {
                email,
                passwd,
                lastname,
                firstname,
                birthday,
                active,
                id_gender,
                newsletter,
                optin,
                date_add,
                date_upd: date_add,
                default_group_id: defaultGroupId
            };

            const xml = buildCustomerXml(customer, groupIds);
            const api = axios.create({
                baseURL: '/api',
                headers: {
                    'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
                    'Content-Type': 'application/xml'
                }
            });

            await api.post('/customers', xml);

            results.value.push(rowInfo);
            done.value++;
        }
    } catch (err) {
        // Provide more useful error info including server response when available
        if (err && err.response) {
            error.value = `Erreur lors de l'import. Status ${err.response.status}: ${JSON.stringify(err.response.data)}`;
            console.error('importCustomers error response:', err.response.status, err.response.data);
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
        <h1>Importer des clients</h1>

        <input ref="fileRef" type="file" name="csv_file" id="csv_file" accept=".csv">

        <select v-model="separator" name="separateur">
            <option value=",">,</option>
            <option value=";">;</option>
        </select>

        <button @click="importCustomers" :disabled="loading">Importer</button>

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

<style scoped>
.popop {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 20px;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    position: absolute;
}
</style>