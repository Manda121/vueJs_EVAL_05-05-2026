<script setup>
import { computed } from 'vue';

const props = defineProps({
    optionGroups: {
        type: Array,
        default: () => []
    }
});

const selectedOptionValueIds = defineModel('selectedOptionValueIds');
const quantity = defineModel('quantity');

const emit = defineEmits(['add-to-cart']);

const hasOptions = computed(() => props.optionGroups.length > 0);

const submit = () => {
    emit('add-to-cart');
};
</script>

<template>
    <div>
        <div v-if="hasOptions" v-for="group in optionGroups" :key="group.id">
            <label :for="'option-' + group.id">{{ group.name }}</label>
            <select :id="'option-' + group.id" v-model="selectedOptionValueIds[group.id]">
                <option value="">Selectionner</option>
                <option v-for="option in group.values" :key="option.id" :value="option.id">
                    {{ option.name || option.id }}
                </option>
            </select>
        </div>

        <label for="quantity">Quantite</label>
        <input id="quantity" type="number" min="1" v-model.number="quantity" />

        <button type="button" @click="submit">Ajouter au panier</button>
    </div>
</template>
