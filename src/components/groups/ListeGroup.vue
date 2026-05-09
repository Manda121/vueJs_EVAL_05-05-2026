<script setup>
const props = defineProps({
    groups: {
        type: Array,
        default: () => []
    },
    showCheckboxes: {
        type: Boolean,
        default: true
    },
    readonly: {
        type: Boolean,
        default: false
    }
});

const selectedGroups = defineModel({ default: () => [] });

const getGroupName = (group) => {
    const name = group?.name?.language;
    if (Array.isArray(name)) {
        return name[0];
    }
    return name;
};
</script>

<template>
    <div class="group-list">
        <p v-if="groups.length === 0">Aucun groupe.</p>
        <label v-for="group in groups" :key="group.id">
            <input
                v-if="showCheckboxes"
                type="checkbox"
                :value="group.id"
                v-model="selectedGroups"
                :disabled="readonly"
            >
            {{ getGroupName(group) }}
        </label>
    </div>
</template>

<style scoped>
.group-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin: 10px 0;
}
</style>
