<script setup>
import Header from './components/inc/Header.vue';
</script>

<template>
  <Header />
  <div id="app">
    <router-view />
  </div>
</template>

<style>
/* Un peu de style pour voir clair */
#app {
  font-family: sans-serif;
  padding: 20px;
}
</style>