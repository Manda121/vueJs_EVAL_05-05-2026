<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import Loading from '@/components/inc/Loading.vue';
import Warning from '@/components/inc/Warning.vue';
import Error from '@/components/inc/Error.vue';

const id_addresse = defineModel();

const address = ref({});
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

const fetchAddress = async () => {
	loading.value = true;
	error.value = null;

	try {
		const response = await api.get('/addresses/' + id_addresse.value, {
			params: { display: 'full' }
		});

		const jsonObj = parser.parse(response.data);
		const data = jsonObj?.prestashop?.address;

		if (!data) {
			warning.value = 'Aucune adresse trouvee.';
			return;
		}

		address.value = data;
	} catch (err) {
		error.value = 'Erreur lors de la recuperation ou du traitement des donnees.';
		console.error('Details:', err);
	} finally {
		loading.value = false;
	}
};

onMounted(fetchAddress);
</script>

<template>
	<div class="form-card">
		<button class="close" @click="id_addresse = null">X</button>

		<Loading v-if="loading" message="Chargement de l'adresse..." />

		<table v-else border="1">
			<tbody>
				<tr>
					<th>ID</th>
					<td>{{ address.id }}</td>
				</tr>
				<tr>
					<th>Alias</th>
					<td>{{ address.alias }}</td>
				</tr>
				<tr>
					<th>Prenom</th>
					<td>{{ address.firstname }}</td>
				</tr>
				<tr>
					<th>Nom</th>
					<td>{{ address.lastname }}</td>
				</tr>
				<tr>
					<th>Adresse</th>
					<td>{{ address.address1 }}</td>
				</tr>
				<tr>
					<th>Complement</th>
					<td>{{ address.address2 }}</td>
				</tr>
				<tr>
					<th>Code postal</th>
					<td>{{ address.postcode }}</td>
				</tr>
				<tr>
					<th>Ville</th>
					<td>{{ address.city }}</td>
				</tr>
				<tr>
					<th>Pays</th>
					<td>{{ address.id_country }}</td>
				</tr>
				<tr>
					<th>Telephone</th>
					<td>{{ address.phone }}</td>
				</tr>
			</tbody>
		</table>

		<Warning :warning="warning" v-if="warning" />
		<Error :error="error" v-if="error" />
	</div>
</template>

<style scoped>
.form-card {
	width: min(520px, 90vw);
	margin: 24px auto;
	padding: 24px;
	background: #fff;
	border: 1px solid #e3e3e3;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
	position: relative;
}

.close {
	position: absolute;
	top: 12px;
	right: 12px;
	border: 1px solid #ccc;
	background: #fff;
	cursor: pointer;
}

table {
	width: 100%;
	border-collapse: collapse;
}

th,
td {
	padding: 8px 10px;
	text-align: left;
}

th {
	background: #f4f4f4;
}
</style>
