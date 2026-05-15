<script setup>
import { ref, watch } from 'vue';
import DeleteCategorie from '../../../components/backoffice/categorie/DeleteCategorie.vue';
import DeleteCommande from '../../../components/backoffice/commande/DeleteCommande.vue';
import DeletePanier from '../../../components/backoffice/panier/DeletePanier.vue';
import DeleteProduit from '../../../components/backoffice/produit/DeleteProduit.vue';
import DeleteCustomer from '../../../components/backoffice/customers/DeleteCustomer.vue';
import ImportProduit from '@/components/backoffice/produit/ImportProduit.vue';
import ImportDeclinaison from '@/components/backoffice/declinaison/ImportDeclinaison.vue';
import ImportCommande from '@/components/backoffice/order/ImportCommande.vue';

const running = ref(false);

const runCommande = ref(0);
const runPanier = ref(0);
const runCustomer = ref(0);
const runProduit = ref(0);
const runCategorie = ref(0);

const doneCommande = ref(0);
const donePanier = ref(0);
const doneCustomer = ref(0);
const doneProduit = ref(0);
const doneCategorie = ref(0);

const waitForDone = (doneRef) => new Promise((resolve) => {
	const stop = watch(doneRef, () => {
		stop();
		resolve();
	});
});

const Reinitialiser = async () => {
	if (running.value) return;
	running.value = true;

	try {
		runCommande.value += 1;
		await waitForDone(doneCommande);

		runPanier.value += 1;
		await waitForDone(donePanier);

		runCustomer.value += 1;
		await waitForDone(doneCustomer);

		runProduit.value += 1;
		await waitForDone(doneProduit);

		runCategorie.value += 1;
		await waitForDone(doneCategorie);
	} finally {
		running.value = false;
	}
};
</script>

<template>
	<div>
		<h2>Reinitialisation</h2>
		<button @click="Reinitialiser" :disabled="running">
			{{ running ? 'Reinitialisation en cours...' : 'Lancer la reinitialisation' }}
		</button>

		<DeleteCommande v-model:runSignal="runCommande" @done="doneCommande += 1" />
		<DeletePanier v-model:runSignal="runPanier" @done="donePanier += 1" />
		<DeleteCustomer v-model:runSignal="runCustomer" @done="doneCustomer += 1" />
		<DeleteProduit v-model:runSignal="runProduit" @done="doneProduit += 1" />
		<DeleteCategorie v-model:runSignal="runCategorie" @done="doneCategorie += 1" />

        <ImportProduit />
        <ImportDeclinaison />
        <ImportCommande />

	</div>
</template>