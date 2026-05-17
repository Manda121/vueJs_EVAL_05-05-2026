<script setup>
import {ref} from 'vue'
import HistoriqueSolde from '../components/HistoriqueSolde.vue'
import Transaction from '../components/Transaction.vue'
import Route from '../components/route/Routes.vue'
import { useRoute } from 'vue-router'

const historique = ref([
  {date: '2022-12-01', montant: 100, description: 'Dépôt initial'},
  {date: '2022-12-15', montant: 150, description: 'Achat'},
  {date: '2023-01-01', montant: 200, description: 'Virement reçu'},
])

const route = useRoute();

const id =  route.params.id;
</script>

<template>
  <header>
    <!-- <img alt="Vue logo" class="logo" src="./assets/logo.svg" width="125" height="125" /> -->

    <div class="wrapper">
      <!-- <Solde/> -->
      <!-- <Solde/> -->
      <HistoriqueSolde v-model="historique"/>
      <Transaction v-model="historique"/>
      <!-- <Route/> -->
      <!-- <p v-if="id"> id: {{ id }}</p> -->
    </div>
  </header>
 
  <!-- <main>
    <TheWelcome />
  </main> -->
</template>