<script setup>
import { ref } from 'vue';
import ListeStock from '@/components/backoffice/stock/ListeStock.vue';
import ListeMvtStock from '@/components/backoffice/stock/ListeMvtStock.vue';

const mvt = ref(false);
</script>

<template>
    <div class="page-liste-stock">
        <button @click="mvt = !mvt" v-if="!mvt">mvt</button>
        <button @click="mvt = !mvt" v-else>stock</button>
        <ListeStock v-if="!mvt"/>
        <ListeMvtStock v-if="mvt"/>
    </div>
</template>