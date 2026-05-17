<script>
export default {
  name: 'Solde2',
  data() {
    return {
      balance: 100,
      currency: 'Ariary',
      hidden: false,
      addAmount: '',
      subtractAmount: '',
    };
  },
  computed: {
    formattedBalance() {
      const val = this.balance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${val} ${this.currency}`;
    },
  },
  methods: {
    toggleHidden() {
      this.hidden = !this.hidden;
    },
    doAdd() {
      const n = parseFloat(this.addAmount);
      if (!isNaN(n)) {
        this.balance += n;
      }
      this.addAmount = '';
    },
    doSubtract() {
      const n = parseFloat(this.subtractAmount);
      if (!isNaN(n)) {
        this.balance -= n;
      }
      this.subtractAmount = '';
    },
  },
};
</script>

<template>
  <div class="solde-component">
    <div class="display">
      <label>Solde :</label>
      <span class="value">
        {{ hidden ? '*****' : formattedBalance }}
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