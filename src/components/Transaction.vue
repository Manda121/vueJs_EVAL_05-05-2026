<script setup>
    import {computed, ref} from 'vue'

    const historique = defineModel();
    const transaction = ref({
        montant: '',
        description: ''
    });

    const sommetotal = computed(() => {
        return historique.value.reduce((total, item) => total + item.montant, 0);
    });
    
    function ajouter() {
        const montant = parseFloat(transaction.value.montant);
        const description = transaction.value.description;
        
        if (!isNaN(montant) && description) {
            historique.value.push({
                date: new Date().toISOString().split('T')[0], 
                montant,
                description
            });
        }
    }

</script>

<template>
    <div>
    <p v-if="sommetotal >= 0" style="color: green;"> Total amount: {{ sommetotal }}</p>
    <p v-else="sommetotal > 0" style="color: red;"> Total amount: {{ sommetotal }}</p>
    <input type="text" name="montant" placeholder="montant" v-model="transaction.montant">
    <input type="text" name="description" placeholder="description" v-model="transaction.description">
    <button @click="ajouter">valider</button>
    </div>
</template>