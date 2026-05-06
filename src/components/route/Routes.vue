<script setup>
    import { useRouter } from 'vue-router';

    const allroute = useRouter().options.routes;
</script>

<template>
    <table>
        <tr v-for="value in allroute" :key="value.path">
            <td>{{ value }}</td>
        </tr>
    </table>
</template>