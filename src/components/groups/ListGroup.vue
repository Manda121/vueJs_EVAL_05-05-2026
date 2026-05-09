<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const parser = new XMLParser();

const selectedGroupIds = defineModel();

const groups = ref();

const api = axios.create({
    baseURL: '/api',
    headers: { 'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':') }
});

const fetchgroups = async () => {
    try {
        const response = await api.get('/groups', { params: { 'display': 'full' } });
        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.groups?.group;
        groups.value = Array.isArray(data) ? data : [data];
    } catch (err) {
        console.error(err);
    }
};

onMounted(fetchgroups);
</script>

<template>
    <div>
        <h2>Liste des groupes</h2>
        <ul>
            <li v-for="group in groups" :key="group.id">
                <input type="checkbox" :value="group.id" v-model="selectedGroupIds" v-if="selectedGroupIds" :checked="selectedGroupIds.includes(String(group.id))">
                {{ group.name.language[0] }}
            </li>
        </ul>
    </div>
</template>