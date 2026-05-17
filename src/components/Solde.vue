<script setup>
import { ref, computed } from 'vue';

// état local
const balance = ref(110);
const currency = ref('Euro');
const hidden = ref(false);

// formulaire de modification
const addAmount = ref('');
const subtractAmount = ref('');

const formattedBalance = computed(() => {
  const val = balance.value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${val} ${currency.value}`;
});

function toggleHidden() {
  hidden.value = !hidden.value;
}

function doAdd() {
  const n = parseFloat(addAmount.value);
  if (!isNaN(n)) {
    balance.value += n;
  }
  addAmount.value = '';
}

function doSubtract() {
  const n = parseFloat(subtractAmount.value);
  if (!isNaN(n)) {
    balance.value -= n;
  }
  subtractAmount.value = '';
}
</script>

<template>
  <div class="solde-component">
    <div class="display">
      <label>Solde :</label>
      <span class="value">
        {{ hidden ? '*****' : formattedBalance + '00'}}
      </span>
      <button @click="toggleHidden">
        {{ hidden ? 'Montrer' : 'Cacher' }}
      </button>
    </div>

    <div class="currency">
      <label for="currency">Devise :</label>
      <select id="currency" v-model="currency">
        <option>Ariary</option>
        <option>Euro</option>
        <option>Dollar</option>
        <option>Franc</option>
      </select>
    </div>

    <div class="forms">
      <form @submit.prevent="doAdd" class="modify-form">
        <h4>Augmenter le solde</h4>
        <input
          type="number"
          step="0.01"
          v-model="addAmount"
          placeholder="Montant"
        />
        <button type="submit">Ajouter</button>
      </form>

      <form @submit.prevent="doSubtract" class="modify-form">
        <h4>Diminuer le solde</h4>
        <input
          type="number"
          step="0.01"
          v-model="subtractAmount"
          placeholder="Montant"
        />
        <button type="submit">Soustraire</button>
      </form>
    </div>
  </div>
</template>