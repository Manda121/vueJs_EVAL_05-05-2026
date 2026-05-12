<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

import { useRouter } from 'vue-router';

const rooter = useRouter();
const parser = new XMLParser({});
const defaultGroupId = 3;
const selectedGroups = ref([defaultGroupId]);
const formError = ref('');
const showPassword = ref(false);
const acceptTerms = ref(false);
const acceptPrivacy = ref(false);
const newcustomer = ref({
    lastname: '',
    firstname: '',
    email: '',
    password: '',
    id_default_group: 3,
    active: 0,
    birthday: '',
    gender: 1,
    optin: 0,
    newsletter: 0
});

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Authorization': 'Basic ' + btoa('4XZXKK1Y8MMXSCYUMHJZ8J26JUY4W8TB' + ':'),
        'Content-Type': 'application/xml'
    }
});

const fetchCustomerByEmail = async (email) => {
    if (!email) return null;

    try {
        const response = await api.get('/customers', {
            params: {
                display: 'full',
                'filter[email]': email
            }
        });

        const jsonObj = parser.parse(response.data);
        const data = jsonObj?.prestashop?.customers?.customer;
        if (!data) return null;

        const list = Array.isArray(data) ? data : [data];
        return list[0] || null;
    } catch (err) {
        console.error(err.response?.data || err);
        return null;
    }
};

const SingIn = async () => {
    const builder = new XMLBuilder({ format: true });

    const customerData = {
        prestashop: {
            customer: {
                firstname: newcustomer.value.firstname,
                lastname: newcustomer.value.lastname,
                email: newcustomer.value.email,
                passwd: newcustomer.value.password,
                id_default_group: newcustomer.value.id_default_group,
                id_gender: newcustomer.value.gender,
                birthday: newcustomer.value.birthday,
                active: newcustomer.value.active,
                optin: newcustomer.value.optin,
                associations: {
                    groups: {
                        group: selectedGroups.value.map(id => ({ id: id }))
                    }
                }
            }
        }
    };

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(customerData)}`;
    try {
        formError.value = '';
        if (!acceptTerms.value || !acceptPrivacy.value) {
            formError.value = 'Merci d\'accepter les conditions et la politique de confidentialite.';
            return;
        }

        await api.post('/customers', xmlContent);
        const createdCustomer = await fetchCustomerByEmail(newcustomer.value.email);
        if (!createdCustomer) {
            formError.value = 'Client cree mais introuvable. Merci de reessayer.';
            return;
        }

        localStorage.setItem('customer_session', JSON.stringify(createdCustomer));
        rooter.push('/front/produits');
    } catch (err) {
        console.error(err.response?.data || err);
    }
};
</script>

<template>
    <div class="form-card">
        <p class="form-title">Vous avez deja un compte ? <span>Connectez-vous !</span></p>

        <div class="form-row">
            <label class="form-label">Titre</label>
            <div class="inline">
                <label class="radio">
                    <input type="radio" id="male" :value="1" v-model="newcustomer.gender">
                    M.
                </label>
                <label class="radio">
                    <input type="radio" id="female" :value="2" v-model="newcustomer.gender">
                    Mme
                </label>
            </div>
        </div>

        <div class="form-row">
            <label class="form-label" for="firstname">Prenom</label>
            <input id="firstname" class="form-input" type="text" v-model="newcustomer.firstname">
            <span class="hint">Seules les lettres et le point (.), suivi d'un espace, sont autorises.</span>
        </div>

        <div class="form-row">
            <label class="form-label" for="lastname">Nom</label>
            <input id="lastname" class="form-input" type="text" v-model="newcustomer.lastname">
            <span class="hint">Seules les lettres et le point (.), suivi d'un espace, sont autorises.</span>
        </div>

        <div class="form-row">
            <label class="form-label" for="email">E-mail</label>
            <input id="email" class="form-input" type="email" v-model="newcustomer.email">
        </div>

        <div class="form-row">
            <label class="form-label" for="password">Mot de passe</label>
            <div class="password-row">
                <input
                    id="password"
                    class="form-input"
                    :type="showPassword ? 'text' : 'password'"
                    v-model="newcustomer.password"
                >
                <button class="btn-secondary" type="button" @click="showPassword = !showPassword">
                    {{ showPassword ? 'Masquer' : 'Afficher' }}
                </button>
            </div>
            <span class="hint">Entrez un mot de passe entre 8 et 72 caracteres.</span>
            <span class="hint">Le score minimum doit etre: Fort.</span>
        </div>

        <div class="form-row">
            <label class="form-label" for="birthday">Date de naissance</label>
            <div class="inline">
                <input id="birthday" class="form-input" type="date" v-model="newcustomer.birthday">
                <span class="optional">Optionnel</span>
            </div>
            <span class="hint">(Ex. : 31/05/1970)</span>
        </div>

        <div class="form-row">
            <label class="checkbox">
                <input type="checkbox" :true-value="1" :false-value="0" v-model="newcustomer.optin">
                Recevoir les offres de nos partenaires
            </label>
        </div>

        <div class="form-row">
            <label class="checkbox">
                <input type="checkbox" v-model="acceptTerms">
                J'accepte les conditions generales et la politique de confidentialite
            </label>
        </div>

        <div class="form-row">
            <label class="checkbox">
                <input type="checkbox" v-model="acceptPrivacy">
                Message concernant la confidentialite des donnees clients
            </label>
        </div>

        <div class="form-row">
            <label class="checkbox">
                <input type="checkbox" :true-value="1" :false-value="0" v-model="newcustomer.newsletter">
                Recevoir notre newsletter
            </label>
            <span class="hint">Vous pouvez vous desinscrire a tout moment.</span>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>

        <button class="btn-primary" @click="SingIn">Creer le client</button>
    </div>
</template>

<style scoped>
.form-card {
    width: min(520px, 90vw);
    margin: 24px auto;
    padding: 24px;
    background: #fff;
    border: 1px solid #e3e3e3;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.form-title {
    margin: 0 0 16px;
    font-size: 14px;
    color: #666;
}

.form-title span {
    color: #1177cc;
    font-weight: 600;
}

.form-row {
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-label {
    font-weight: 600;
    color: #333;
}

.form-input {
    border: 1px solid #cfcfcf;
    padding: 8px 10px;
    border-radius: 2px;
}

.inline {
    display: flex;
    align-items: center;
    gap: 12px;
}

.radio {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.password-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.btn-secondary {
    padding: 7px 10px;
    border: 1px solid #888;
    background: #f4f4f4;
    cursor: pointer;
}

.btn-primary {
    width: 100%;
    padding: 10px 12px;
    background: #1b7d2c;
    color: #fff;
    border: none;
    cursor: pointer;
    font-weight: 600;
}

.hint {
    font-size: 12px;
    color: #6d6d6d;
}

.optional {
    font-size: 12px;
    color: #8c8c8c;
}

.checkbox {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #333;
}

.form-error {
    color: #b00020;
    font-size: 13px;
    margin-bottom: 12px;
}
</style>