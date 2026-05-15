<script setup>
import { ref } from 'vue';
import axios from 'axios';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import Loading from '../../inc/Loading.vue';
import Warning from '../../inc/Warning.vue';
import Error from '../../inc/Error.vue';

const import_zip = defineModel();

const fileRef = ref(null);
const loading = ref(false);
const warning = ref(null);
const error = ref(null);
const results = ref([]);
const total = ref(0);
const done = ref(0);

const parser = new XMLParser({});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':')
    }
});

const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

const parseReference = (name) => {
    const lower = name.toLowerCase();
    const ext = imageExtensions.find((e) => lower.endsWith(e));
    if (!ext) return null;
    return name.slice(0, -ext.length);
};

const getProductIdByReference = async (reference) => {
    const response = await api.get('/products', {
        params: {
            'filter[reference]': reference,
            display: 'full'
        }
    });
    const jsonObj = parser.parse(response.data);
    const data = jsonObj?.prestashop?.products?.product;
    if (!data) return null;
    const product = Array.isArray(data) ? data[0] : data;
    return product?.id || null;
};

const uploadProductImage = async (productId, fileName, blob) => {
    const formData = new FormData();
    formData.append('image', blob, fileName);

    await api.post(`/images/products/${productId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};

const importImages = async () => {
    warning.value = null;
    error.value = null;
    results.value = [];
    done.value = 0;
    total.value = 0;

    const file = fileRef.value?.files?.[0];
    if (!file) {
        warning.value = 'Choisissez un fichier ZIP.';
        return;
    }

    loading.value = true;

    try {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter((entry) => !entry.dir);

        const imageEntries = entries.filter((entry) => {
            const lower = entry.name.toLowerCase();
            return imageExtensions.some((ext) => lower.endsWith(ext));
        });

        total.value = imageEntries.length;

        for (let i = 0; i < imageEntries.length; i++) {
            const entry = imageEntries[i];
            const baseName = entry.name.split('/').pop() || entry.name;
            const reference = parseReference(baseName);

            const rowInfo = { file: baseName, status: 'ok', message: 'OK' };

            if (!reference) {
                rowInfo.status = 'error';
                rowInfo.message = 'Nom de fichier invalide.';
                results.value.push(rowInfo);
                done.value++;
                continue;
            }

            try {
                const productId = await getProductIdByReference(reference);
                if (!productId) {
                    rowInfo.status = 'error';
                    rowInfo.message = 'Produit introuvable par reference.';
                    results.value.push(rowInfo);
                    done.value++;
                    continue;
                }

                const blob = await entry.async('blob');
                await uploadProductImage(productId, baseName, blob);
                results.value.push(rowInfo);
            } catch (err) {
                rowInfo.status = 'error';
                rowInfo.message = 'Erreur lors de l\'upload.';
                results.value.push(rowInfo);
                console.error('Import image error:', err);
            } finally {
                done.value++;
            }
        }
    } catch (err) {
        error.value = 'Erreur lors du traitement du ZIP.';
        console.error('ZIP error:', err);
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="popop">
        <button @click="import_zip = false">X</button>
        <h1>Importer des images</h1>

        <input ref="fileRef" type="file" name="zip_file" id="zip_file" accept=".zip">

        <button @click="importImages" :disabled="loading">Importer</button>

        <Loading v-if="loading" message="Import en cours..." />
        <Warning v-if="warning" :warning="warning" />
        <Error v-if="error" :error="error" />

        <p v-if="total">{{ done }} / {{ total }} images traitees</p>

        <table v-if="results.length" border="1">
            <thead>
                <tr>
                    <th>Fichier</th>
                    <th>Statut</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(r, idx) in results" :key="idx">
                    <td>{{ r.file }}</td>
                    <td>{{ r.status }}</td>
                    <td>{{ r.message }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
