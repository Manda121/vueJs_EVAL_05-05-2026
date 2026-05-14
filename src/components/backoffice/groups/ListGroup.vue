<script setup>
import { onMounted, ref, computed } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser();

const create_group = ref(null);

const selectedGroupIds = defineModel();

const groups = ref([]);

const allSelected = computed(() => {
    try {
        const sel = selectedGroupIds && selectedGroupIds.value !== undefined ? selectedGroupIds.value : selectedGroupIds;
        if (!groups.value || !groups.value.length) return false;
        if (!sel || !sel.length) return false;
        return groups.value.every((g) => sel.includes(String(g.id)));
    } catch (e) {
        return false;
    }
});

function setSelectedArray(arr) {
    try {
        if (selectedGroupIds == null) return;
        if (selectedGroupIds.value !== undefined) {
            selectedGroupIds.value = arr;
        } else if (Array.isArray(selectedGroupIds)) {
            selectedGroupIds.splice(0, selectedGroupIds.length, ...arr);
        }
    } catch (e) {
        console.error('setSelectedArray error', e);
    }
}

function toggleSelectAll() {
    if (!groups.value) return;
    if (allSelected.value) {
        setSelectedArray([]);
    } else {
        setSelectedArray(groups.value.map((g) => String(g.id)));
    }
}

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
        <label style="display:block;margin-bottom:8px">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"> Tous
        </label>
        <ul>
            <li v-for="group in groups" :key="group.id">
                <input v-if="selectedGroupIds" type="checkbox" :value="String(group.id)" v-model="selectedGroupIds" :checked="selectedGroupIds.includes(String(group.id))">
                {{ group.name.language[0] }}
            </li>
            <li><button @click="create_group = true">ajouter</button></li>
        </ul>
    </div>
</template>