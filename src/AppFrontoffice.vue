<script setup>
import Header from './components/inc/Header.vue';
</script>

<template>
    <Header />
    <div id="app" class="app-shell app-shell--front">
        <router-view />
    </div>
</template>
