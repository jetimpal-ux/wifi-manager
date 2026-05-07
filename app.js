// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyBVTmfJQiRkC0eHAEdktRVtJRfMLQAVwes",
    authDomain: "wifi-manager-sambalean.firebaseapp.com",
    projectId: "wifi-manager-sambalean",
    storageBucket: "wifi-manager-sambalean.firebasestorage.app",
    messagingSenderId: "437031687666",
    appId: "1:437031687666:web:3775aed72b826956df476b"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==================== GLOBAL STATE ====================
let pelangganData = [];
let pengeluaranData = [];
let transaksiData = [];
let offlineQueue = [];
let isOnline = navigator.onLine;

const BULAN_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PAKET_LABELS = {
    '40000': '40.000',
    '60000': '60.000',
    '70000': '70.000',
    '150000': '150.000'
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupNetworkListener();
    loadOfflineData();
    setDefaultDates();
    populateYearFilter();
});

function initApp() {
    loadDataFromFirestore();
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tglDaftar').value = today;
    document.getElementById('tglJatuhTempo').value = today;
    document.getElementById('bayarTanggal').value = today;
    document.getElementById('pengeluaranTanggal').value = today;

    const now = new Date();
    const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('filterBulanPengeluaran').value = monthStr;
    document.getElementById('filterBulanKeuangan').value = monthStr;
}

function populateYearFilter() {
    const sel = document.getElementById('filterTahunBayar');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
}

// ==================== NETWORK & OFFLINE ====================
function setupNetworkListener() {
    window.addEventListener('online', () => {
        isOnline = true;
        updateSyncStatus();
        flushOfflineQueue();
        loadDataFromFirestore();
    });
    window.addEventListener('offline', () => {
        isOnline = false;
        updateSyncStatus();
    });
}

function updateSyncStatus() {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    if (isOnline) {
        dot.classList.remove('offline');
        text.textContent = 'Online - Synced';
    } else {
        dot.classList.add('offline');
        text.textContent = 'Offline - Data Disimpan Lokal';
    }
}

function saveToOfflineStorage(key, data) {
    try {
        localStorage.setItem('wifi_' + key, JSON.stringify(data));
    } catch (e) {
        console.warn('Offline storage full');
    }
}

function loadFromOfflineStorage(key) {
    try {
        const data = localStorage.getItem('wifi_' + key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function addToOfflineQueue(action, data) {
    offlineQueue.push({ action, data, timestamp: Date.now() });
    saveToOfflineStorage('queue', offlineQueue);
}

function flushOfflineQueue() {
    if (offlineQueue.length === 0) return;
    console.log('Flushing offline queue...', offlineQueue.length, 'items');
    offlineQueue.forEach(item => {
        executeOfflineAction(item);
    });
    offlineQueue = [];
    localStorage.removeItem('wifi_queue');
}

function executeOfflineAction(item) {
    const { action, data } = item;
    switch (action) {
        case 'addPelanggan':
            db.collection('pelanggan').doc(data.id).set(data).catch(e => console.error(e));
            break;
        case 'updatePelanggan':
            db.collection('pelanggan').doc(data.id).update(data).catch(e => console.error(e));
            break;
        case 'addPengeluaran':
            db.collection('pengeluaran').doc(data.id).set(data).catch(e => console.error(e));
            break;
        case 'addTransaksi':
            db.collection('transaksi').doc(data.id).set(data).catch(e => console.error(e));
            break;
    }
}

function loadOfflineData() {
    const savedPelanggan = loadFromOfflineStorage('pelanggan');
    const savedPengeluaran = loadFromOfflineStorage('pengeluaran');
    const savedTransaksi = loadFromOfflineStorage('transaksi');
    const savedQueue = loadFromOfflineStorage('queue');
    
    if (savedPelanggan) pelangganData = savedPelanggan;
    if (savedPengeluaran) pengeluaranData = savedPengeluaran;
    if (savedTransaksi) transaksiData = savedTransaksi;
    if (savedQueue) offlineQueue = savedQueue;
    
    updateSyncStatus();
}

// ==================== FIREBASE OPERATIONS ====================
function loadDataFromFirestore() {
    showLoading();
    
    db.collection('pelanggan').orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            pelangganData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToOfflineStorage('pelanggan', pelangganData);
            renderAll();
            hideLoading();
        })
        .catch(err => {
            console.warn('Firestore load failed, using offline ', err);
            renderAll();
            hideLoading();
        });

    db.collection('pengeluaran').orderBy('tanggal', 'desc').get()
        .then(snapshot => {
            pengeluaranData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToOfflineStorage('pengeluaran', pengeluaranData);
            renderAll();
        })
        .catch(err => {
            console.warn('Firestore pengeluaran load failed:', err);
        });

    db.collection('transaksi').orderBy('timestamp', 'desc').limit(200).get()
        .then(snapshot => {
            transaksiData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            saveToOfflineStorage('transaksi', transaksiData);
            renderAll();
        })
        .catch(err => {
            console.warn('Firestore transaksi load failed:', err);
        });
}

function showLoading() {
    // Minimal loading indicator
}

function hideLoading() {
    // Hide loading
}

// ==================== RENDER FUNCTIONS ====================
function renderAll() {
    renderDashboard();
    renderPelanggan();
    renderPembayaran();
    renderPengeluaran();
    renderKeuangan();
    renderRiwayat();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    document.getElementById('totalPelanggan').textContent = pelangganData.length;

    // Pemasukan bulan ini
    let pemasukan = 0;
    transaksiData.forEach(t => {
        if (t.tipe === 'pemasukan' && t.timestamp) {
            const d = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                pemasukan += Number(t.jumlah) || 0;
            }
        }
    });

    let pengeluaran = 0;
    pengeluaranData.forEach(p => {
        const d = p.tanggal ? new Date(p.tanggal) : new Date();
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            pengeluaran += Number(p.jumlah) || 0;
        }
    });

    let saldo = 0;
    transaksiData.forEach(t => {
        if (t.tipe === 'pemasukan') saldo += Number(t.jumlah) || 0;
        if (t.tipe === 'pengeluaran') saldo -= Number(t.jumlah) || 0;
    });

    // Hitung tunggakan
    let tunggakan = 0;
    pelangganData.forEach(p => {
        tunggakan += hitungTunggakanPelanggan(p);
    });

    document.getElementById('pemasukanBulanIni').textContent = formatRupiah(pemasukan);
    document.getElementById('pengeluaranBulanIni').textContent = formatRupiah(pengeluaran);
    document.getElementById('saldoTotal').textContent = formatRupiah(saldo);
    document.getElementById('totalTunggakan').textContent = formatRupiah(tunggakan);

    // Jatuh tempo bulan ini
    const jatuhTempoContainer = document.getElementById('jatuhTempoList');
    const jatuhTempo = pelangganData.filter(p => {
        if (!p.tglJatuhTempo) return false;
        const jt = new Date(p.tglJatuhTempo);
        return jt.getMonth() === currentMonth && jt.getFullYear() === currentYear;
    });

    if (jatuhTempo.length === 0) {
        jatuhTempoContainer.innerHTML = '<p style="color:var(--gray);font-size:13px;">Tidak ada jatuh tempo bulan ini</p>';
    } else {
        jatuhTempoContainer.innerHTML = jatuhTempo.map(p => `
            <div class="list-item">
                <div>
                    <strong>${p.nama}</strong><br>
                    <small>${p.nomorKTL} - ${PAKET_LABELS[p.paket] || p.paket}</small>
                </div>
                <span class="badge badge-warning">Jatuh Tempo</span>
            </div>
        `).join('');
    }

    // Pembayaran terakhir
    const bayarContainer = document.getElementById('pembayaranTerakhir');
    const lastPayments = transaksiData
        .filter(t => t.tipe === 'pemasukan')
        .sort((a, b) => {
            const da = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
            const db2 = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
            return db2 - da;
        })
        .slice(0, 5);

    if (lastPayments.length === 0) {
        bayarContainer.innerHTML = '<p style="color:var(--gray);font-size:13px;">Belum ada transaksi</p>';
    } else {
        bayarContainer.innerHTML = lastPayments.map(t => `
            <div class="list-item">
                <div>
                    <strong>${t.keterangan || t.namaPelanggan}</strong><br>
                    <small>${t.timestamp ? (t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp)).toLocaleDateString('id-ID') : '-'}</small>
                </div>
                <strong style="color:var(--green)">+${formatRupiah(t.jumlah)}</strong>
            </div>
        `).join('');
    }
}

function hitungTunggakanPelanggan(p) {
    if (!p.pembayaran || !p.tglDaftar) return 0;
    
    const tglDaftar = new Date(p.tglDaftar);
    const now = new Date();
    let totalTunggakan = 0;
    const tarif = Number(p.paket) || 0;
    
    // Cek setiap bulan dari tanggal daftar sampai sekarang
    let checkDate = new Date(tglDaftar);
    while (checkDate <= now) {
        const bulanKey = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0');
        const sudahBayar = p.pembayaran && p.pembayaran[bulanKey] && p.pembayaran[bulanKey].status === 'lunas';
        if (!sudahBayar) {
            totalTunggakan += tarif;
        }
        checkDate.setMonth(checkDate.getMonth() + 1);
    }
    
    return totalTunggakan;
}

// ==================== DATA PELANGGAN ====================
function renderPelanggan() {
    const tbody = document.getElementById('tbodyPelanggan');
    const search = document.getElementById('searchPelanggan').value.toLowerCase();
    
    let filtered = pelangganData;
    if (search) {
        filtered = pelangganData.filter(p => 
            (p.nama || '').toLowerCase().includes(search) ||
            (p.nomorKTL || '').toLowerCase().includes(search) ||
            (p.nomorHP || '').toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Belum ada data pelanggan</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const tunggakan = hitungTunggakanPelanggan(p);
        return `
        <tr>
            <td><strong>${p.nomorKTL || '-'}</strong></td>
            <td>${p.nama || '-'}</td>
            <td>${p.nomorHP || '-'}</td>
            <td>${p.alamat || '-'}</td>
            <td><span class="badge badge-success">${PAKET_LABELS[p.paket] || p.paket}</span></td>
            <td>${p.jumlahDevice || 1} device</td>
            <td>${p.tglDaftar || '-'}</td>
            <td>${tunggakan > 0 ? `<span class="tunggakan-badge">${formatRupiah(tunggakan)}</span>` : '<span class="badge badge-success">Lunas</span>'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-info btn-sm" onclick="detailPelanggan('${p.id}')" title="Detail">📋</button>
                    <button class="btn-warning btn-sm" onclick="editPelanggan('${p.id}')" title="Edit">✏️</button>
                    <button class="btn-success btn-sm" onclick="printKupon('${p.id}')" title="Print Kupon">🖨️</button>
                    <button class="btn-danger btn-sm" onclick="hapusPelanggan('${p.id}')" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

function filterPelanggan() {
    renderPelanggan();
}

function simpanPelanggan() {
    const data = {
        nomorKTL: document.getElementById('nomorKTL').value.trim(),
        nama: document.getElementById('namaPelanggan').value.trim(),
        nomorHP: document.getElementById('nomorHP').value.trim(),
        alamat: document.getElementById('alamatPelanggan').value.trim(),
        paket: document.getElementById('paketPelanggan').value,
        jumlahDevice: Number(document.getElementById('jumlahDevice').value) || 1,
        tglDaftar: document.getElementById('tglDaftar').value,
        tglJatuhTempo: document.getElementById('tglJatuhTempo').value,
        pembayaran: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.nama || !data.nomorKTL) {
        showToast('Nama dan Nomor KTL wajib diisi!', 'error');
        return;
    }

    const id = 'p_' + Date.now();
    data.id = id;

    // Simpan ke Firestore atau offline
    if (isOnline) {
        db.collection('pelanggan').doc(id).set(data)
            .then(() => {
                showToast('Pelanggan berhasil ditambahkan!', 'success');
                hideModal('modalTambahPelanggan');
                clearForm('modalTambahPelanggan');
                loadDataFromFirestore();
            })
            .catch(err => {
                console.error(err);
                addToOfflineQueue('addPelanggan', data);
                showToast('Disimpan offline, akan sync saat online', 'warning');
                hideModal('modalTambahPelanggan');
                clearForm('modalTambahPelanggan');
                pelangganData.unshift(data);
                saveToOfflineStorage('pelanggan', pelangganData);
                renderAll();
            });
    } else {
        addToOfflineQueue('addPelanggan', data);
        showToast('Disimpan offline!', 'warning');
        hideModal('modalTambahPelanggan');
        clearForm('modalTambahPelanggan');
        pelangganData.unshift(data);
        saveToOfflineStorage('pelanggan', pelangganData);
        renderAll();
    }

    // Catat transaksi
    addTransaksi('info', `Pelanggan baru: ${data.nama}`, 0, data.nama);
}

function editPelanggan(id) {
    const p = pelangganData.find(x => x.id === id);
    if (!p) return;

    document.getElementById('editPelangganId').value = id;
    document.getElementById('editNomorKTL').value = p.nomorKTL || '';
    document.getElementById('editNamaPelanggan').value = p.nama || '';
    document.getElementById('editNomorHP').value = p.nomorHP || '';
    document.getElementById('editAlamatPelanggan').value = p.alamat || '';
    document.getElementById('editPaketPelanggan').value = p.paket || '40000';
    document.getElementById('editJumlahDevice').value = p.jumlahDevice || 1;
    document.getElementById('editTglDaftar').value = p.tglDaftar || '';
    document.getElementById('editTglJatuhTempo').value = p.tglJatuhTempo || '';

    showModal('modalEditPelanggan');
}

function updatePelanggan() {
    const id = document.getElementById('editPelangganId').value;
    const data = {
        nomorKTL: document.getElementById('editNomorKTL').value.trim(),
        nama: document.getElementById('editNamaPelanggan').value.trim(),
        nomorHP: document.getElementById('editNomorHP').value.trim(),
        alamat: document.getElementById('editAlamatPelanggan').value.trim(),
        paket: document.getElementById('editPaketPelanggan').value,
        jumlahDevice: Number(document.getElementById('editJumlahDevice').value) || 1,
        tglDaftar: document.getElementById('editTglDaftar').value,
        tglJatuhTempo: document.getElementById('editTglJatuhTempo').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (isOnline) {
        db.collection('pelanggan').doc(id).update(data)
            .then(() => {
                showToast('Data pelanggan berhasil diupdate!', 'success');
                hideModal('modalEditPelanggan');
                loadDataFromFirestore();
            })
            .catch(err => {
                console.error(err);
                showToast('Gagal update: ' + err.message, 'error');
            });
    } else {
        addToOfflineQueue('updatePelanggan', { id, ...data });
        const idx = pelangganData.findIndex(x => x.id === id);
        if (idx >= 0) {
            pelangganData[idx] = { ...pelangganData[idx], ...data };
            saveToOfflineStorage('pelanggan', pelangganData);
        }
        showToast('Disimpan offline!', 'warning');
        hideModal('modalEditPelanggan');
        renderAll();
    }
}

function hapusPelanggan(id) {
    if (!confirm('Yakin hapus pelanggan ini?')) return;

    const p = pelangganData.find(x => x.id === id);

    if (isOnline) {
        db.collection('pelanggan').doc(id).delete()
            .then(() => {
                showToast('Pelanggan berhasil dihapus!', 'success');
                loadDataFromFirestore();
            })
            .catch(err => {
                console.error(err);
                showToast('Gagal hapus: ' + err.message, 'error');
            });
    } else {
        pelangganData = pelangganData.filter(x => x.id !== id);
        saveToOfflineStorage('pelanggan', pelangganData);
        showToast('Dihapus offline!', 'warning');
        renderAll();
    }

    if (p) addTransaksi('info', `Pelanggan dihapus: ${p.nama}`, 0, p.nama);
}

function detailPelanggan(id) {
    const p = pelangganData.find(x => x.id === id);
    if (!p) return;

    const tunggakan = hitungTunggakanPelanggan(p);

    document.getElementById('detailPelangganInfo').innerHTML = `
        <div class="detail-item"><label>No. KTL</label><p>${p.nomorKTL}</p></div>
        <div class="detail-item"><label>Nama</label><p>${p.nama}</p></div>
        <div class="detail-item"><label>No. HP</label><p>${p.nomorHP}</p></div>
        <div class="detail-item"><label>Alamat</label><p>${p.alamat}</p></div>
        <div class="detail-item"><label>Paket</label><p>${PAKET_LABELS[p.paket] || p.paket}</p></div>
        <div class="detail-item"><label>Perangkat</label><p>${p.jumlahDevice || 1} device</p></div>
        <div class="detail-item"><label>Tgl Daftar</label><p>${p.tglDaftar || '-'}</p></div>
        <div class="detail-item"><label>Jatuh Tempo</label><p>${p.tglJatuhTempo || '-'}</p></div>
        <div class="detail-item"><label>Total Tunggakan</label><p style="color:var(--red);font-weight:700">${formatRupiah(tunggakan)}</p></div>
    `;

    // Render 12 bulan pembayaran
    const now = new Date();
    const currentYear = now.getFullYear();
    const tbody = document.getElementById('tbodyDetailBayar');
    let html = '';

    for (let m = 0; m < 12; m++) {
        const bulanKey = currentYear + '-' + String(m + 1).padStart(2, '0');
        const bulanNama = BULAN_NAMES[m] + ' ' + currentYear;
        const bayar = p.pembayaran && p.pembayaran[bulanKey];
        const status = bayar && bayar.status === 'lunas';

        html += `
        <tr>
            <td>${bulanNama}</td>
            <td>${status 
                ? '<span class="badge badge-success">✅ Lunas</span>' 
                : '<span class="badge badge-danger">❌ Belum Bayar</span>'}</td>
            <td>${status ? (bayar.tglBayar || '-') : '-'}</td>
            <td>
                ${!status ? `<button class="btn-success btn-sm" onclick="bayarDariDetail('${p.id}', '${bulanKey}', ${m}, ${currentYear})">💰 Bayar</button>` : 
                `<button class="btn-danger btn-sm" onclick="batalBayar('${p.id}', '${bulanKey}')">↩️ Batal</button>`}
                ${status ? `<button class="btn-info btn-sm" onclick="printBayarKupon('${p.id}', '${bulanKey}')">🖨️</button>` : ''}
            </td>
        </tr>
        `;
    }

    tbody.innerHTML = html;
    showModal('modalDetailPelanggan');
}

function bayarDariDetail(pelangganId, bulanKey, bulan, tahun) {
    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p) return;

    document.getElementById('bayarPelangganId').value = pelangganId;
    document.getElementById('bayarBulan').value = bulan;
    document.getElementById('bayarTahun').value = tahun;
    document.getElementById('bayarNama').value = p.nama;
    document.getElementById('bayarPaket').value = PAKET_LABELS[p.paket] || p.paket;
    document.getElementById('bayarBulanTahun').value = BULAN_NAMES[bulan] + ' ' + tahun;
    document.getElementById('bayarTanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('bayarJumlah').value = p.paket;

    hideModal('modalDetailPelanggan');
    showModal('modalBayar');
}

// ==================== PEMBAYARAN ====================
function renderPembayaran() {
    const bulan = Number(document.getElementById('filterBulanBayar').value);
    const tahun = Number(document.getElementById('filterTahunBayar').value);
    const filterPaket = document.getElementById('filterPaketBayar').value;

    const tbody = document.getElementById('tbodyPembayaran');
    let html = '';

    let filtered = pelangganData;
    if (filterPaket) {
        filtered = filtered.filter(p => p.paket === filterPaket);
    }

    filtered.forEach(p => {
        const bulanKey = tahun + '-' + String(bulan + 1).padStart(2, '0');
        const bayar = p.pembayaran && p.pembayaran[bulanKey];
        const status = bayar && bayar.status === 'lunas';

        html += `
        <tr>
            <td>${p.nomorKTL}</td>
            <td>${p.nama}</td>
            <td>${PAKET_LABELS[p.paket] || p.paket}</td>
            <td>${status 
                ? '<span class="badge badge-success">✅ Lunas</span>' 
                : '<span class="badge badge-danger">❌ Belum</span>'}</td>
            <td>${status ? (bayar.tglBayar || '-') : '-'}</td>
            <td>
                ${!status ? `<button class="btn-success btn-sm" onclick="bayarPelanggan('${p.id}', ${bulan}, ${tahun})">💰 Bayar</button>` : 
                `<button class="btn-danger btn-sm" onclick="batalBayar('${p.id}', '${bulanKey}')">↩️</button>
                 <button class="btn-info btn-sm" onclick="printBayarKupon('${p.id}', '${bulanKey}')">🖨️</button>`}
            </td>
        </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" class="loading">Tidak ada data</td></tr>';
}

function bayarPelanggan(pelangganId, bulan, tahun) {
    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p) return;

    document.getElementById('bayarPelangganId').value = pelangganId;
    document.getElementById('bayarBulan').value = bulan;
    document.getElementById('bayarTahun').value = tahun;
    document.getElementById('bayarNama').value = p.nama;
    document.getElementById('bayarPaket').value = PAKET_LABELS[p.paket] || p.paket;
    document.getElementById('bayarBulanTahun').value = BULAN_NAMES[bulan] + ' ' + tahun;
    document.getElementById('bayarTanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('bayarJumlah').value = p.paket;

    showModal('modalBayar');
}

function prosesBayar() {
    const pelangganId = document.getElementById('bayarPelangganId').value;
    const bulan = Number(document.getElementById('bayarBulan').value);
    const tahun = Number(document.getElementById('bayarTahun').value);
    const tglBayar = document.getElementById('bayarTanggal').value;
    const jumlah = Number(document.getElementById('bayarJumlah').value);

    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p) return;

    const bulanKey = tahun + '-' + String(bulan + 1).padStart(2, '0');

    // Update pembayaran pelanggan
    if (!p.pembayaran) p.pembayaran = {};
    p.pembayaran[bulanKey] = {
        status: 'lunas',
        tglBayar: tglBayar,
        jumlah: jumlah,
        dibayarPada: new Date().toISOString()
    };

    if (isOnline) {
        db.collection('pelanggan').doc(pelangganId).update({
            pembayaran: p.pembayaran,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            // Catat transaksi pemasukan
            addTransaksi('pemasukan', `Pembayaran ${BULAN_NAMES[bulan]} ${tahun} - ${p.nama}`, jumlah, p.nama);
            showToast(`Pembayaran ${BULAN_NAMES[bulan]} ${tahun} berhasil!`, 'success');
            hideModal('modalBayar');
            loadDataFromFirestore();
        }).catch(err => {
            console.error(err);
            showToast('Gagal: ' + err.message, 'error');
        });
    } else {
        // Save to Firestore batch for offline sync
        const idx = pelangganData.findIndex(x => x.id === pelangganId);
        if (idx >= 0) {
            pelangganData[idx] = p;
        }
        saveToOfflineStorage('pelanggan', pelangganData);
        addTransaksi('pemasukan', `Pembayaran ${BULAN_NAMES[bulan]} ${tahun} - ${p.nama}`, jumlah, p.nama);
        showToast('Pembayaran disimpan offline!', 'warning');
        hideModal('modalBayar');
        renderAll();
    }
}

function batalBayar(pelangganId, bulanKey) {
    if (!confirm('Batalkan pembayaran ini?')) return;

    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p || !p.pembayaran || !p.pembayaran[bulanKey]) return;

    delete p.pembayaran[bulanKey];

    if (isOnline) {
        db.collection('pelanggan').doc(pelangganId).update({
            pembayaran: p.pembayaran,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            showToast('Pembayaran dibatalkan', 'success');
            loadDataFromFirestore();
        });
    } else {
        const idx = pelangganData.findIndex(x => x.id === pelangganId);
        if (idx >= 0) pelangganData[idx] = p;
        saveToOfflineStorage('pelanggan', pelangganData);
        showToast('Dibatalkan offline', 'warning');
        renderAll();
    }
}

// ==================== PENGELUARAN ====================
function renderPengeluaran() {
    const filterBulan = document.getElementById('filterBulanPengeluaran').value;
    const tbody = document.getElementById('tbodyPengeluaran');

    let filtered = pengeluaranData;
    if (filterBulan) {
        filtered = pengeluaranData.filter(p => p.tanggal && p.tanggal.startsWith(filterBulan));
    }

    let total = 0;
    let html = filtered.map(p => {
        total += Number(p.jumlah) || 0;
        return `
        <tr>
            <td>${p.tanggal || '-'}</td>
            <td>${p.keterangan || '-'}</td>
            <td>${formatRupiah(p.jumlah)}</td>
            <td><button class="btn-danger btn-sm" onclick="hapusPengeluaran('${p.id}')">🗑️</button></td>
        </tr>
        `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="4" class="loading">Belum ada pengeluaran</td></tr>';
    document.getElementById('totalPengeluaranList').textContent = formatRupiah(total);
}

function simpanPengeluaran() {
    const data = {
        tanggal: document.getElementById('pengeluaranTanggal').value,
        keterangan: document.getElementById('pengeluaranKeterangan').value.trim(),
        jumlah: Number(document.getElementById('pengeluaranJumlah').value) || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.keterangan || !data.jumlah) {
        showToast('Keterangan dan jumlah wajib diisi!', 'error');
        return;
    }

    const id = 'pg_' + Date.now();
    data.id = id;

    if (isOnline) {
        db.collection('pengeluaran').doc(id).set(data)
            .then(() => {
                addTransaksi('pengeluaran', data.keterangan, data.jumlah);
                showToast('Pengeluaran berhasil ditambahkan!', 'success');
                hideModal('modalTambahPengeluaran');
                clearForm('modalTambahPengeluaran');
                loadDataFromFirestore();
            })
            .catch(err => {
                console.error(err);
                showToast('Gagal: ' + err.message, 'error');
            });
    } else {
        addToOfflineQueue('addPengeluaran', data);
        addTransaksi('pengeluaran', data.keterangan, data.jumlah);
        pengeluaranData.unshift(data);
        saveToOfflineStorage('pengeluaran', pengeluaranData);
        showToast('Disimpan offline!', 'warning');
        hideModal('modalTambahPengeluaran');
        clearForm('modalTambahPengeluaran');
        renderAll();
    }
}

function hapusPengeluaran(id) {
    if (!confirm('Hapus pengeluaran ini?')) return;

    const p = pengeluaranData.find(x => x.id === id);

    if (isOnline) {
        db.collection('pengeluaran').doc(id).delete()
            .then(() => {
                showToast('Pengeluaran dihapus!', 'success');
                loadDataFromFirestore();
            });
    } else {
        pengeluaranData = pengeluaranData.filter(x => x.id !== id);
        saveToOfflineStorage('pengeluaran', pengeluaranData);
        showToast('Dihapus offline', 'warning');
        renderAll();
    }

    if (p) addTransaksi('info', `Pengeluaran dihapus: ${p.keterangan}`, 0);
}

// ==================== LAPORAN KEUANGAN ====================
function renderKeuangan() {
    const filterBulan = document.getElementById('filterBulanKeuangan').value;
    
    let totalMasuk = 0;
    let totalKeluar = 0;

    // Pemasukan
    transaksiData.filter(t => t.tipe === 'pemasukan').forEach(t => {
        if (!filterBulan || (t.timestamp && t.timestamp.toDate && t.timestamp.toDate().toISOString().startsWith(filterBulan))) {
            totalMasuk += Number(t.jumlah) || 0;
        }
    });

    // Pengeluaran dari data pengeluaran
    pengeluaranData.forEach(p => {
        if (!filterBulan || (p.tanggal && p.tanggal.startsWith(filterBulan))) {
            totalKeluar += Number(p.jumlah) || 0;
        }
    });

    // Pengeluaran dari transaksi
    transaksiData.filter(t => t.tipe === 'pengeluaran').forEach(t => {
        if (!filterBulan || (t.timestamp && t.timestamp.toDate && t.timestamp.toDate().toISOString().startsWith(filterBulan))) {
            totalKeluar += Number(t.jumlah) || 0;
        }
    });

    const saldo = totalMasuk - totalKeluar;

    document.getElementById('laporanPemasukan').textContent = formatRupiah(totalMasuk);
    document.getElementById('laporanPengeluaran').textContent = formatRupiah(totalKeluar);
    document.getElementById('laporanSaldo').textContent = formatRupiah(saldo);

    // Detail transaksi
    const tbody = document.getElementById('tbodyLaporanKeuangan');
    const allTransaksi = [];

    transaksiData.forEach(t => {
        if (!filterBulan || (t.timestamp && t.timestamp.toDate && t.timestamp.toDate().toISOString().startsWith(filterBulan))) {
            allTransaksi.push(t);
        }
    });

    pengeluaranData.forEach(p => {
        if (!filterBulan || (p.tanggal && p.tanggal.startsWith(filterBulan))) {
            allTransaksi.push({
                tipe: 'pengeluaran',
                keterangan: p.keterangan,
                jumlah: p.jumlah,
                timestamp: new Date(p.tanggal)
            });
        }
    });

    allTransaksi.sort((a, b) => {
        const da = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const db2 = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return db2 - da;
    });

    tbody.innerHTML = allTransaksi.map(t => `
        <tr>
            <td>${t.timestamp ? (t.timestamp.toDate ? t.timestamp.toDate().toLocaleDateString('id-ID') : new Date(t.timestamp).toLocaleDateString('id-ID')) : '-'}</td>
            <td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : t.tipe === 'pengeluaran' ? 'badge-danger' : 'badge-warning'}">${t.tipe}</span></td>
            <td>${t.keterangan || '-'}</td>
            <td style="color:${t.tipe === 'pemasukan' ? 'var(--green)' : t.tipe === 'pengeluaran' ? 'var(--red)' : 'var(--gray)'}">
                ${t.tipe === 'pemasukan' ? '+' : t.tipe === 'pengeluaran' ? '-' : ''}${formatRupiah(t.jumlah)}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" class="loading">Tidak ada transaksi</td></tr>';
}

// ==================== RIWAYAT TRANSAKSI ====================
function renderRiwayat() {
    const tbody = document.getElementById('tbodyRiwayat');
    const sorted = [...transaksiData].sort((a, b) => {
        const da = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date(0);
        const db2 = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : new Date(0);
        return db2 - da;
    });

    tbody.innerHTML = sorted.slice(0, 100).map(t => `
        <tr>
            <td>${t.timestamp ? (t.timestamp.toDate ? t.timestamp.toDate().toLocaleString('id-ID') : new Date(t.timestamp).toLocaleString('id-ID')) : '-'}</td>
            <td><span class="badge ${t.tipe === 'pemasukan' ? 'badge-success' : t.tipe === 'pengeluaran' ? 'badge-danger' : 'badge-warning'}">${t.tipe}</span></td>
            <td>${t.keterangan || '-'}</td>
            <td style="font-weight:600;color:${t.tipe === 'pemasukan' ? 'var(--green)' : t.tipe === 'pengeluaran' ? 'var(--red)' : 'var(--gray)'}">
                ${t.tipe === 'pemasukan' ? '+' : t.tipe === 'pengeluaran' ? '-' : ''}${formatRupiah(t.jumlah)}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" class="loading">Belum ada riwayat</td></tr>';
}

// ==================== TRANSAKSI HELPER ====================
function addTransaksi(tipe, keterangan, jumlah, namaPelanggan) {
    const data = {
        tipe: tipe,
        keterangan: keterangan,
        jumlah: jumlah,
        namaPelanggan: namaPelanggan || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const id = 'tx_' + Date.now();

    // Tambahkan ke data lokal dulu
    const localData = { id, ...data, timestamp: new Date() };
    transaksiData.unshift(localData);
    saveToOfflineStorage('transaksi', transaksiData);

    if (isOnline) {
        db.collection('transaksi').doc(id).set(data).catch(e => console.error(e));
    } else {
        addToOfflineQueue('addTransaksi', localData);
    }
}

// ==================== PRINT ====================
function printPage() {
    window.print();
}

function printKupon(pelangganId) {
    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p) return;

    const now = new Date();
    const bulanKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    printBayarKupon(pelangganId, bulanKey);
}

function printBayarKupon(pelangganId, bulanKey) {
    const p = pelangganData.find(x => x.id === pelangganId);
    if (!p) return;

    const [tahun, bulan] = bulanKey.split('-');
    const bulanNama = BULAN_NAMES[parseInt(bulan) - 1] + ' ' + tahun;
    const bayar = p.pembayaran && p.pembayaran[bulanKey];

    const kuponHTML = generateKuponHTML(p, bulanNama, tahun, bulan, bayar);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kupon Tagihan WiFi - ${p.nama} - ${bulanNama}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; }
                .kupon-container { display: flex; width: 100%; max-width: 550px; margin: 0 auto; }
                .kupon-half { width: 50%; border: 2px solid #333; padding: 10px; }
                .kupon-half.arsip { border-right: 3px dashed #999; }
                .kupon-half.pelanggan { border-left: none; }
                .kupon-title { text-align: center; font-weight: bold; font-size: 14px; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 8px; }
                .kupon-title small { font-weight: normal; font-size: 10px; }
                .kupon-row { display: flex; margin-bottom: 4px; align-items: baseline; }
                .kupon-label { width: 85px; font-weight: bold; font-size: 10px; }
                .kupon-value { flex: 1; border-bottom: 1px dotted #999; padding-bottom: 1px; min-height: 14px; }
                .kupon-divider { border-top: 2px solid #333; margin: 10px 0; }
                .kupon-footer { text-align: center; margin-top: 12px; font-size: 9px; border-top: 1px solid #ccc; padding-top: 6px; }
                .kupon-footer .ttd { margin-top: 30px; display: flex; justify-content: space-around; }
                .kupon-footer .ttd div { text-align: center; }
                .kupon-footer .ttd .line { border-top: 1px solid #333; width: 100px; margin: 30px auto 4px; }
                .status-lunas { color: green; font-weight: bold; }
                .status-belum { color: red; font-weight: bold; }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${kuponHTML}
            <div class="no-print" style="text-align:center;margin-top:20px;">
                <button onclick="window.print()" style="padding:10px 30px;font-size:16px;cursor:pointer;">️ Print</button>
                <button onclick="window.close()" style="padding:10px 30px;font-size:16px;cursor:pointer;margin-left:10px;">Tutup</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function generateKuponHTML(p, bulanNama, tahun, bulan, bayar) {
    const status = bayar && bayar.status === 'lunas';
    const tglBayar = bayar ? bayar.tglBayar : '-';
    const tarif = formatRupiah(p.paket);

    return `
    <h2 style="text-align:center;margin-bottom:15px;font-family:sans-serif;">KUPON TAGIHAN WIFI</h2>
    <div class="kupon-container">
        <!-- SISI KIRI - ARSIP -->
        <div class="kupon-half arsip">
            <div class="kupon-title">
                📡 KUPON TAGIHAN WIFI<br>
                <small>(ARSIP - PEMILIK)</small>
            </div>
            <div class="kupon-row"><span class="kupon-label">NOMOR HP</span><span class="kupon-value">${p.nomorHP || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">NOMOR KTL</span><span class="kupon-value">${p.nomorKTL || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">NAMA</span><span class="kupon-value">${p.nama || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">ALAMAT</span><span class="kupon-value">${p.alamat || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">BULAN</span><span class="kupon-value">${bulanNama}</span></div>
            <div class="kupon-row"><span class="kupon-label">TARIFF</span><span class="kupon-value">${tarif}</span></div>
            <div class="kupon-row"><span class="kupon-label">STATUS</span><span class="kupon-value ${status ? 'status-lunas' : 'status-belum'}">${status ? '✅ LUNAS' : '❌ BELUM BAYAR'}</span></div>
            <div class="kupon-row"><span class="kupon-label">TGL BAYAR</span><span class="kupon-value">${tglBayar}</span></div>
            <div class="kupon-divider"></div>
            <div class="kupon-row"><span class="kupon-label">JUMLAH RP</span><span class="kupon-value" style="font-weight:bold;font-size:13px;">${tarif}</span></div>
            <div class="kupon-footer">
                <div class="ttd">
                    <div><div class="line"></div>Penerima</div>
                    <div><div class="line"></div>Penagih</div>
                </div>
                <p style="margin-top:8px;">Cetak: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}</p>
            </div>
        </div>

        <!-- SISI KANAN - PELANGGAN -->
        <div class="kupon-half pelanggan">
            <div class="kupon-title">
                📡 KUPON TAGIHAN WIFI<br>
                <small>(PELANGGAN)</small>
            </div>
            <div class="kupon-row"><span class="kupon-label">NOMOR HP</span><span class="kupon-value">${p.nomorHP || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">NOMOR KTL</span><span class="kupon-value">${p.nomorKTL || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">NAMA</span><span class="kupon-value">${p.nama || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">ALAMAT</span><span class="kupon-value">${p.alamat || '-'}</span></div>
            <div class="kupon-row"><span class="kupon-label">BULAN</span><span class="kupon-value">${bulanNama}</span></div>
            <div class="kupon-row"><span class="kupon-label">TARIFF</span><span class="kupon-value">${tarif}</span></div>
            <div class="kupon-row"><span class="kupon-label">STATUS</span><span class="kupon-value ${status ? 'status-lunas' : 'status-belum'}">${status ? '✅ LUNAS' : '❌ BELUM BAYAR'}</span></div>
            <div class="kupon-row"><span class="kupon-label">TGL BAYAR</span><span class="kupon-value">${tglBayar}</span></div>
            <div class="kupon-divider"></div>
            <div class="kupon-row"><span class="kupon-label">JUMLAH RP</span><span class="kupon-value" style="font-weight:bold;font-size:13px;">${tarif}</span></div>
            <div class="kupon-footer">
                <div class="ttd">
                    <div><div class="line"></div>Penerima</div>
                    <div><div class="line"></div>Penagih</div>
                </div>
                <p style="margin-top:8px;">Cetak: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}</p>
            </div>
        </div>
    </div>
    `;
}

// ==================== NAVIGATION ====================
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById('page-' + pageName).classList.add('active');
    event.target.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'pelanggan': 'Data Pelanggan',
        'pembayaran': 'Pembayaran Bulanan',
        'pengeluaran': 'Pengeluaran Operasional',
        'keuangan': 'Laporan Keuangan',
        'riwayat': 'Riwayat Transaksi'
    };
    document.getElementById('pageTitle').textContent = titles[pageName] || 'Dashboard';

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==================== MODALS ====================
function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
}

function clearForm(modalId) {
    const modal = document.getElementById(modalId);
    modal.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]').forEach(input => {
        if (input.id !== 'jumlahDevice') input.value = '';
    });
}

// ==================== UTILITIES ====================
function formatRupiah(angka) {
    if (!angka && angka !== 0) return 'Rp 0';
    return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});