<script setup>

import { ref, watch, provide } from 'vue';

import DeleteCategorie from '../../../components/backoffice/categorie/DeleteCategorie.vue';

import DeleteCommande from '../../../components/backoffice/commande/DeleteCommande.vue';

import DeletePanier from '../../../components/backoffice/panier/DeletePanier.vue';

import DeleteProduit from '../../../components/backoffice/produit/DeleteProduit.vue';

import DeleteCustomer from '../../../components/backoffice/customers/DeleteCustomer.vue';

import ImportProduit from '@/components/backoffice/produit/ImportProduit.vue';

import ImportDeclinaison from '@/components/backoffice/declinaison/ImportDeclinaison.vue';

import ImportCommande from '@/components/backoffice/order/ImportCommande.vue';

import ImportImages from '@/components/backoffice/images/ImportImages.vue';



const running = ref(false);

const importRunning = ref(false);



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



const runImportProduit = ref(0);

const runImportDeclinaison = ref(0);

const runImportCommande = ref(0);



const doneImportProduit = ref(0);

const doneImportDeclinaison = ref(0);

const doneImportCommande = ref(0);



const okImportProduit = ref(true);

const okImportDeclinaison = ref(true);

const okImportCommande = ref(true);



const waitForDone = (doneRef) => new Promise((resolve) => {

	const stop = watch(doneRef, () => {

		stop();

		resolve();

	});

});



const Reinitialiser = async () => {

	if (running.value || importRunning.value) return;

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



const onImportProduitDone = (success) => {

	okImportProduit.value = success === true;

	doneImportProduit.value += 1;

};



const onImportDeclinaisonDone = (success) => {

	okImportDeclinaison.value = success === true;

	doneImportDeclinaison.value += 1;

};



const onImportCommandeDone = (success) => {

	okImportCommande.value = success === true;

	doneImportCommande.value += 1;

};



const lancerImports = async () => {

	if (importRunning.value || running.value) return;

	importRunning.value = true;



	try {

		runImportProduit.value += 1;

		await waitForDone(doneImportProduit);

		if (!okImportProduit.value) return;



		runImportDeclinaison.value += 1;

		await waitForDone(doneImportDeclinaison);

		if (!okImportDeclinaison.value) return;



		runImportCommande.value += 1;

		await waitForDone(doneImportCommande);

	} finally {

		importRunning.value = false;

	}

};



provide('reinitialiserTout', Reinitialiser);

</script>



<template>

	<div>

		<h2>Reinitialisation</h2>

		<button @click="Reinitialiser" :disabled="running || importRunning">

			{{ running ? 'Reinitialisation en cours...' : 'Lancer la reinitialisation' }}

		</button>



		<DeleteCommande v-model:runSignal="runCommande" @done="doneCommande += 1" />

		<DeletePanier v-model:runSignal="runPanier" @done="donePanier += 1" />

		<DeleteCustomer v-model:runSignal="runCustomer" @done="doneCustomer += 1" />

		<DeleteProduit v-model:runSignal="runProduit" @done="doneProduit += 1" />

		<DeleteCategorie v-model:runSignal="runCategorie" @done="doneCategorie += 1" />



		<hr>



		<h2>Import CSV</h2>

		<p>Ordre : fichier 1 (produits) puis fichier 2 (declinaisons) puis fichier 3 (commandes).</p>

		<button @click="lancerImports" :disabled="importRunning || running">

			{{ importRunning ? 'Import en cours...' : 'Lancer les imports' }}

		</button>



		<ImportProduit v-model:runSignal="runImportProduit" @done="onImportProduitDone" />

		<ImportDeclinaison v-model:runSignal="runImportDeclinaison" @done="onImportDeclinaisonDone" />

		<ImportCommande v-model:runSignal="runImportCommande" @done="onImportCommandeDone" />

		<ImportImages />

	</div>

</template>

