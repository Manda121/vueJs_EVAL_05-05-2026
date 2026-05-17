<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { getCustomerSession, notifyAddressChange } from '@/utils/frontStorage';

const create_addresse = defineModel();
const customer_session = getCustomerSession();

const countries = ref([]);
const loading = ref(false);
const warning = ref(null);
const error = ref(null);

const newAddress = ref({
	alias: '',
	firstname: '',
	lastname: '',
	company: '',
	vat_number: '',
	address1: '',
	address2: '',
	postcode: '',
	city: '',
	id_country: '8',
	phone: '',
	use_for_invoice: true
});

const parser = new XMLParser({});
const api = axios.create({
	baseURL: '/api',
	headers: {
		'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
	}
});

const fetchCountries = async () => {
	loading.value = true;
	error.value = null;

	try {
		const response = await api.get('/countries', { params: { display: 'full' } });
		const jsonObj = parser.parse(response.data);
		const data = jsonObj?.prestashop?.countries?.country;
		countries.value = Array.isArray(data) ? data : [data];
	} catch (err) {
		error.value = 'Erreur lors du chargement des pays.';
		console.error(err.response?.data || err);
	} finally {
		loading.value = false;
	}
};

const buildAlias = () => {
	const base = `${newAddress.value.firstname} ${newAddress.value.lastname}`.trim();
	return newAddress.value.alias?.trim() || base || 'Adresse';
};

const SaveAddress = async () => {
	const builder = new XMLBuilder({ format: true });
	const idCustomer = customer_session?.id ? String(customer_session.id) : '0';

	const addressData = {
		prestashop: {
			address: {
				id_customer: idCustomer,
				id_country: newAddress.value.id_country,
				alias: buildAlias(),
				company: newAddress.value.company,
				lastname: newAddress.value.lastname,
				firstname: newAddress.value.firstname,
				vat_number: newAddress.value.vat_number,
				address1: newAddress.value.address1,
				address2: newAddress.value.address2,
				postcode: newAddress.value.postcode,
				city: newAddress.value.city,
				phone: newAddress.value.phone
			}
		}
	};

	const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(addressData)}`;

	try {
		await api.post('/addresses', xmlContent, {
			headers: { 'Content-Type': 'application/xml' }
		});
		notifyAddressChange();
		create_addresse.value = null;
	} catch (err) {
		console.error(err.response?.data || err);
	}
};

onMounted(fetchCountries);
</script>

<template>
	<div class="form-card">
		<button class="close" @click="create_addresse = null">X</button>

		<div class="form-row">
			<label class="form-label" for="alias">Alias</label>
			<div class="inline">
				<input id="alias" class="form-input" type="text" v-model="newAddress.alias">
				<span class="optional">Optionnel</span>
			</div>
		</div>

		<div class="form-row">
			<label class="form-label" for="firstname">Prenom</label>
			<input id="firstname" class="form-input" type="text" v-model="newAddress.firstname">
		</div>

		<div class="form-row">
			<label class="form-label" for="lastname">Nom</label>
			<input id="lastname" class="form-input" type="text" v-model="newAddress.lastname">
		</div>

		<div class="form-row">
			<label class="form-label" for="company">Societe</label>
			<div class="inline">
				<input id="company" class="form-input" type="text" v-model="newAddress.company">
				<span class="optional">Optionnel</span>
			</div>
		</div>

		<div class="form-row">
			<label class="form-label" for="vat">Numero de TVA</label>
			<div class="inline">
				<input id="vat" class="form-input" type="text" v-model="newAddress.vat_number">
				<span class="optional">Optionnel</span>
			</div>
		</div>

		<div class="form-row">
			<label class="form-label" for="address1">Adresse</label>
			<input id="address1" class="form-input" type="text" v-model="newAddress.address1">
		</div>

		<div class="form-row">
			<label class="form-label" for="address2">Complement d'adresse</label>
			<div class="inline">
				<input id="address2" class="form-input" type="text" v-model="newAddress.address2">
				<span class="optional">Optionnel</span>
			</div>
		</div>

		<div class="form-row">
			<label class="form-label" for="postcode">Code postal</label>
			<input id="postcode" class="form-input" type="text" v-model="newAddress.postcode">
		</div>

		<div class="form-row">
			<label class="form-label" for="city">Ville</label>
			<input id="city" class="form-input" type="text" v-model="newAddress.city">
		</div>

		<div class="form-row">
			<label class="form-label" for="country">Pays</label>
			<select id="country" class="form-input" v-model="newAddress.id_country">
				<option v-for="country in countries" :key="country.id" :value="country.id">
					{{ Array.isArray(country.name?.language) ? country.name.language[0] : country.name?.language || country.name }}
				</option>
			</select>
		</div>

		<div class="form-row">
			<label class="form-label" for="phone">Telephone</label>
			<div class="inline">
				<input id="phone" class="form-input" type="text" v-model="newAddress.phone">
				<span class="optional">Optionnel</span>
			</div>
		</div>

		<div class="form-row">
			<label class="checkbox">
				<input type="checkbox" v-model="newAddress.use_for_invoice">
				Utiliser aussi cette adresse pour la facturation
			</label>
		</div>

		<p v-if="warning" class="form-hint">{{ warning }}</p>
		<p v-if="error" class="form-error">{{ error }}</p>

		<button class="btn-primary" type="button" @click="SaveAddress">Creer l'adresse</button>
	</div>
</template>