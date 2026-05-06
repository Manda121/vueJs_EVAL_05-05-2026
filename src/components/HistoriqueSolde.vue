<script setup>
    import { useRoute } from 'vue-router';

    const historique = defineModel();

    const id = useRoute().params.id;
</script>

<template>
    <p v-if="id">id: {{ id }}</p>
    <table>
        <tr>
            <th>date</th>
            <th>montant</th>
            <th>description</th>
        </tr>

        <tr v-for="value in historique" :key="value.date">
            <td>
                {{ value.date }}
            </td>
            <td>
                {{ value.montant }}
            </td>
            <td>
                {{ value.description }}
            </td>
        </tr>

    </table>
</template>