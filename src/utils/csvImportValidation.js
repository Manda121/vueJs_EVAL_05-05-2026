import enteteFichier1 from '../../import/entetefichier1?raw';
import enteteFichier2 from '../../import/entetefichier2?raw';
import enteteFichier3 from '../../import/entetefichier3?raw';

const ENTETES = {
    1: enteteFichier1,
    2: enteteFichier2,
    3: enteteFichier3
};

function parseEntete(raw) {
    return String(raw || '')
        .trim()
        .split(',')
        .map((h) => h.trim());
}

export function getExpectedHeaders(fichierNum) {
    return parseEntete(ENTETES[fichierNum]);
}

export function isDateDDMMYYYY(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    return /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed);
}

function parseAmount(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(',', '.').replace('%', '').trim();
    if (normalized === '') return null;
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
}

export function isPositiveAmount(value, allowEmpty) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return allowEmpty === true;
    const num = parseAmount(value);
    return num !== null && num > 0;
}

export function isPositiveOrZeroAmount(value, allowEmpty) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return allowEmpty === true;
    const num = parseAmount(value);
    return num !== null && num >= 0;
}

export function validateHeaders(headers, fichierNum) {
    const expected = getExpectedHeaders(fichierNum);
    const actual = headers.map((h) => String(h).trim());

    if (actual.length !== expected.length) {
        return {
            ok: false,
            message: `En-tetes invalides (fichier ${fichierNum}) : ${actual.length} colonnes au lieu de ${expected.length}. Attendu : ${expected.join(',')}`
        };
    }

    for (let i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
            return {
                ok: false,
                message: `Colonne ${i + 1} invalide : attendu "${expected[i]}", recu "${actual[i]}".`
            };
        }
    }

    return { ok: true };
}

function findColIndex(headers, name) {
    return headers.findIndex((h) => String(h).trim() === name);
}

export function validateProduitCsv(headers, dataRows) {
    const headerCheck = validateHeaders(headers, 1);
    if (!headerCheck.ok) return headerCheck;

    const idxDate = findColIndex(headers, 'date_availability_produit');
    const idxPrixTtc = findColIndex(headers, 'prix_ttc');
    const idxPrixAchat = findColIndex(headers, 'prix_achat');
    const idxTaxe = findColIndex(headers, 'Taxe');

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const line = i + 2;

        if (!isDateDDMMYYYY(row[idxDate])) {
            return {
                ok: false,
                message: `Ligne ${line} : date invalide (format attendu DD/MM/YYYY).`
            };
        }

        if (!isPositiveAmount(row[idxPrixTtc], false)) {
            return {
                ok: false,
                message: `Ligne ${line} : prix_ttc doit etre un montant positif.`
            };
        }

        if (!isPositiveAmount(row[idxPrixAchat], false)) {
            return {
                ok: false,
                message: `Ligne ${line} : prix_achat doit etre un montant positif.`
            };
        }

        const taxeVal = String(row[idxTaxe] ?? '').trim();
        if (taxeVal && !isPositiveAmount(row[idxTaxe], false)) {
            return {
                ok: false,
                message: `Ligne ${line} : Taxe doit etre positive.`
            };
        }
    }

    return { ok: true };
}

export function validateDeclinaisonCsv(headers, dataRows) {
    const headerCheck = validateHeaders(headers, 2);
    if (!headerCheck.ok) return headerCheck;

    const idxStock = findColIndex(headers, 'stock_initial');
    const idxPrix = findColIndex(headers, 'prix_vente_ttc');

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const line = i + 2;

        if (!isPositiveOrZeroAmount(row[idxStock], true)) {
            return {
                ok: false,
                message: `Ligne ${line} : stock_initial doit etre positif ou nul.`
            };
        }

        const prixRaw = String(row[idxPrix] ?? '').trim();
        if (prixRaw && !isPositiveAmount(row[idxPrix], false)) {
            return {
                ok: false,
                message: `Ligne ${line} : prix_vente_ttc doit etre un montant positif.`
            };
        }
    }

    return { ok: true };
}

function parseAchatQuantities(value) {
    const items = [];
    if (!value) return items;
    const regex = /\(\s*"([^"]*)"\s*;\s*(\d+)\s*;\s*"([^"]*)"\s*\)/g;
    let match = null;
    while ((match = regex.exec(value)) !== null) {
        items.push({ quantity: parseInt(match[2], 10) });
    }
    return items;
}

export function validateCommandeCsv(headers, dataRows) {
    const headerCheck = validateHeaders(headers, 3);
    if (!headerCheck.ok) return headerCheck;

    const idxDate = findColIndex(headers, 'date');
    const idxAchat = findColIndex(headers, 'achat');

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const line = i + 2;

        if (!isDateDDMMYYYY(row[idxDate])) {
            return {
                ok: false,
                message: `Ligne ${line} : date invalide (format attendu DD/MM/YYYY).`
            };
        }

        const items = parseAchatQuantities(row[idxAchat] || '');
        for (let j = 0; j < items.length; j++) {
            if (!items[j].quantity || items[j].quantity <= 0) {
                return {
                    ok: false,
                    message: `Ligne ${line} : quantite achat doit etre positive.`
                };
            }
        }
    }

    return { ok: true };
}

export function hasResultErrors(results) {
    if (!results || results.length === 0) return false;
    return results.some((r) => r.status === 'error');
}
