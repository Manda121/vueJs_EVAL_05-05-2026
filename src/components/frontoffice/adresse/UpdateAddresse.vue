<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { notifyAddressChange } from '@/utils/frontStorage';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';

const update_addresse = defineModel();

const countries = ref([]);
const loading = ref(true);
const warning = ref(null);
const error = ref(null);

const address = ref({
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
	try {
		const response = await api.get('/countries', { params: { display: 'full' } });
		const jsonObj = parser.parse(response.data);
		const data = jsonObj?.prestashop?.countries?.country;
		countries.value = Array.isArray(data) ? data : [data];
	} catch (err) {
		console.error(err.response?.data || err);
	}
};

const fetchAddress = async () => {
	loading.value = true;
	error.value = null;

	try {
		const response = await api.get('/addresses/' + update_addresse.value, {
			params: { display: 'full' }
		});

		const jsonObj = parser.parse(response.data);
		const data = jsonObj?.prestashop?.address;

		if (!data) {
			warning.value = 'Aucune adresse trouvee.';
			return;
		}

		address.value = {
			...data,
			use_for_invoice: true
		};
	} catch (err) {
		error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
		console.error('Details:', err);
	} finally {
		loading.value = false;
	}
};

const buildAlias = () => {
	const base = `${address.value.firstname} ${address.value.lastname}`.trim();
	return address.value.alias?.trim() || base || 'Adresse';
};

const UpdateAddress = async () => {
	const builder = new XMLBuilder({ format: true });

	const addressData = {
		prestashop: {
			address: {
				id: address.value.id,
				id_customer: address.value.id_customer,
				id_country: address.value.id_country,
				alias: buildAlias(),
				company: address.value.company,
				lastname: address.value.lastname,
				firstname: address.value.firstname,
				vat_number: address.value.vat_number,
				address1: address.value.address1,
				address2: address.value.address2,
				postcode: address.value.postcode,
				city: address.value.city,
				phone: address.value.phone
			}
		}
	};

	const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(addressData)}`;

	try {
		await api.put('/addresses', xmlContent, {
			headers: { 'Content-Type': 'application/xml' }
		});
		notifyAddressChange();
		update_addresse.value = null;
	} catch (err) {
		console.error(err.response?.data || err);
	}
};

onMounted(fetchCountries);
onMounted(fetchAddress);
</script>

<template>
	<div class="form-card">
		<button class="close" @click="update_addresse = null">X</button>

		<Loading v-if="loading" message="Chargement de l'adresse..." />

		<div v-else>
			<div class="form-row">
				<label class="form-label" for="alias">Alias</label>
				<div class="inline">
					<input id="alias" class="form-input" type="text" v-model="address.alias">
					<span class="optional">Optionnel</span>
				</div>
			</div>

			<div class="form-row">
				<label class="form-label" for="firstname">Prenom</label>
				<input id="firstname" class="form-input" type="text" v-model="address.firstname">
			</div>

			<div class="form-row">
				<label class="form-label" for="lastname">Nom</label>
				<input id="lastname" class="form-input" type="text" v-model="address.lastname">
			</div>

			<div class="form-row">
				<label class="form-label" for="company">Societe</label>
				<div class="inline">
					<input id="company" class="form-input" type="text" v-model="address.company">
					<span class="optional">Optionnel</span>
				</div>
			</div>

			<div class="form-row">
				<label class="form-label" for="vat">Numero de TVA</label>
				<div class="inline">
					<input id="vat" class="form-input" type="text" v-model="address.vat_number">
					<span class="optional">Optionnel</span>
				</div>
			</div>

			<div class="form-row">
				<label class="form-label" for="address1">Adresse</label>
				<input id="address1" class="form-input" type="text" v-model="address.address1">
			</div>

			<div class="form-row">
				<label class="form-label" for="address2">Complement d'adresse</label>
				<div class="inline">
					<input id="address2" class="form-input" type="text" v-model="address.address2">
					<span class="optional">Optionnel</span>
				</div>
			</div>

			<div class="form-row">
				<label class="form-label" for="postcode">Code postal</label>
				<input id="postcode" class="form-input" type="text" v-model="address.postcode">
			</div>

			<div class="form-row">
				<label class="form-label" for="city">Ville</label>
				<input id="city" class="form-input" type="text" v-model="address.city">
			</div>

			<div class="form-row">
				<label class="form-label" for="country">Pays</label>
				<select id="country" class="form-input" v-model="address.id_country">
					<option v-for="country in countries" :key="country.id" :value="country.id">
						{{ Array.isArray(country.name?.language) ? country.name.language[0] : country.name?.language || country.name }}
					</option>
				</select>
			</div>

			<div class="form-row">
				<label class="form-label" for="phone">Telephone</label>
				<div class="inline">
					<input id="phone" class="form-input" type="text" v-model="address.phone">
					<span class="optional">Optionnel</span>
				</div>
			</div>

			<div class="form-row">
				<label class="checkbox">
					<input type="checkbox" v-model="address.use_for_invoice">
					Utiliser aussi cette adresse pour la facturation
				</label>
			</div>

			<button class="btn-primary" type="button" @click="UpdateAddress">Mettre a jour l'adresse</button>
		</div>

		<Warning :warning="warning" v-if="warning" />
		<Error :error="error" v-if="error" />
	</div>
</template>
