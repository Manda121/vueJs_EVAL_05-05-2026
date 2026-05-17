<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const loading = ref(false);
const error = ref(null);
const warning = ref(null);

const mouvements = ref([]); // Contiendra nos mouvements propres

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

// Fonction pour récupérer le motif en français
const getMotifMouvement = async (idStockMvtReason) => {
    if (!idStockMvtReason) return "Ajustement de stock";
    try {
        const res = await api.get(`/stock_mvt_reasons/${idStockMvtReason}`);
        const reasonData = parser.parse(res.data)?.prestashop?.stock_mvt_reason;
        return Array.isArray(reasonData?.name?.language) ? reasonData.name.language[0] : reasonData?.name?.language;
    } catch (err) {
        return `Motif #${idStockMvtReason}`;
    }
};

// Fonction principale
const fetchMouvements = async () => {
    loading.value = true;
    error.value = null;
    warning.value = null;
    mouvements.value = [];

    try {
        // On interroge l'URL qui vous a renvoyé ce XML
        const response = await api.get('/stock_movements', {
            params: {
                'display': 'full',
                'sort': '[id_DESC]'
            }
        });

        // Lecture exacte de vos balises : prestashop -> stock_mvts -> stock_mvt
        const root = parser.parse(response.data)?.prestashop?.stock_mvts;
        const mvtsRaw = normalizeToArray(root?.stock_mvt);

        if (mvtsRaw.length === 0) {
            warning.value = "Aucun mouvement de stock enregistré.";
            return;
        }

        let listeEnrichie = [];
        
        for (const mvt of mvtsRaw) {
            const idMvt = mvt.id || mvt["@_id"];
            
            // On récupère le motif (3 dans votre premier exemple)
            const nomMotif = await getMotifMouvement(mvt.id_stock_mvt_reason);

            listeEnrichie.push({
                id: idMvt,
                id_stock: mvt.id_stock, // On affiche l'ID du Stock technique puisque l'ID produit est vide
                quantite: parseInt(mvt.physical_quantity || 0, 10), // Correction : utilisation de physical_quantity
                date: mvt.date_add, 
                motif: nomMotif,
                signe: parseInt(mvt.sign || 1, 10),
                id_order: mvt.id_order || null // Permet de voir si c'est lié à une commande (ex: commande #9)
            });
        }

        mouvements.value = listeEnrichie;

    } catch (err) {
        error.value = "Erreur lors du chargement des mouvements.";
        console.error(err);
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchMouvements();
});
</script>

<template>
    <div class="mvt-container">
        <div class="entete">
            <h2>Historique des Mouvements de Stock</h2>
            <button type="button" @click="fetchMouvements" class="btn-rafraichir">
                Actualiser
            </button>
        </div>

        <div v-if="loading" class="info-etat">Chargement de l'historique...</div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-if="warning" class="warning-msg">{{ warning }}</div>

        <table v-if="!loading && !error && mouvements.length">
            <thead>
                <tr>
                    <th>ID Mvt</th>
                    <th>Date</th>
                    <th>ID Stock lié</th>
                    <th>Motif / Raison</th>
                    <th>Commande</th>
                    <th>Variation</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="mvt in mouvements" :key="mvt.id">
                    <td><code>#{{ mvt.id }}</code></td>
                    <td>{{ mvt.date }}</td>
                    <td>Stock #{{ mvt.id_stock }}</td>
                    <td>{{ mvt.motif }}</td>
                    <td>
                        <span v-if="mvt.id_order">Commande #{{ mvt.id_order }}</span>
                        <span v-else class="txt-vide">-</span>
                    </td>
                    <td>
                        <span :class="mvt.signe === 1 ? 'badge-entree' : 'badge-sortie'">
                            {{ mvt.signe === 1 ? '+' : '-' }}{{ mvt.quantite }}
                        </span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.mvt-container {
    padding: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin-top: 20px;
}
.entete {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.btn-rafraichir {
    background-color: #607d8b;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}
.info-etat {
    padding: 10px;
    background: #e1f5fe;
    color: #0288d1;
    border-radius: 4px;
}
table {
    width: 100%;
    border-collapse: collapse;
}
th, td {
    border: 1px solid #eee;
    padding: 12px 10px;
    text-align: left;
}
th {
    background-color: #f5f5f5;
}
.txt-vide {
    color: #bbb;
}
.badge-entree {
    background-color: #e6f4ea;
    color: #137333;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: bold;
}
.badge-sortie {
    background-color: #fce8e6;
    color: #c5221f;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: bold;
}
.error-msg { color: red; }
.warning-msg { color: orange; }
</style>