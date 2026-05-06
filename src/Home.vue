<script setup>
import {ref} from 'vue'
// import HelloWorld from './components/HelloWorld.vue'
import Solde from './components/Solde.vue'
import HistoriqueSolde from './components/HistoriqueSolde.vue'
import Transaction from './components/Transaction.vue'
import { useRoute } from 'vue-router'

const historique = ref([
  {date: '2022-12-01', montant: 100, description: 'Dépôt initial'},
  {date: '2022-12-15', montant: 150, description: 'Achat'},
  {date: '2023-01-01', montant: 200, description: 'Virement reçu'},
])


</script>

<template>
  <header>
    <!-- <img alt="Vue logo" class="logo" src="./assets/logo.svg" width="125" height="125" /> -->

    <div class="wrapper">
      <!-- <Solde/> -->
      <!-- <Solde/> -->
      <HistoriqueSolde v-model="historique"/>
      <Transaction v-model="historique"/>
    </div>
  </header>
 
  <!-- <main>
    <TheWelcome />
  </main> -->
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
