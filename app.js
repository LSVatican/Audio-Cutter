// Mengimport Supabase JS Client dari CDN resmi
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Kredensial Proyek Supabase Anda (Ganti dengan milik Anda sendiri)
const SUPABASE_URL = 'https://vvhdhngtpadjpnlgntpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aGRobmd0cGFkanBubGdudHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDI2MTUsImV4cCI6MjA5NTM3ODYxNX0.w3bKxtkQHkNC_mEcCrUT-uZKR144LAUwpwUF_56M7Qo';

// Inisialisasi Klien Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global Variables
let currentUser = null;
window.wavesurfer = null;
let audioBuffer = null;

// Fungsi helper untuk mengosongkan form pendaftaran
function clearRegisterInputs() {
    document.getElementById('regEmail').value = "";
    document.getElementById('regPassword').value = "";
    document.getElementById('regConfirmPassword').value = "";
    updateRuleUI('ruleLength', false);
    updateRuleUI('ruleCaps', false);
    updateRuleUI('ruleSymbol', false);
    updateRuleUI('ruleMatch', false);
    document.getElementById('btnSubmitRegister').disabled = true;
}

// Fungsi helper untuk mengosongkan form login
function clearLoginInputs() {
    document.getElementById('loginEmail').value = "";
    document.getElementById('loginPassword').value = "";
}

// Manajemen Modal secara global
window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); }
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); }

// Memantau Status Autentikasi Pengguna (Session Listener)
supabase.auth.onAuthStateChange(async (event, session) => {
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    const userMenu = document.getElementById('userMenu');

    if (session && session.user) {
        currentUser = session.user;
        document.getElementById('userDisplayEmail').innerText = currentUser.email;
        btnOpenAuth.classList.add('hidden');
        userMenu.classList.remove('hidden');
        document.getElementById('profEmail').value = currentUser.email;
        await loadAudioList();
    } else {
        currentUser = null;
        resetAuthUI();
    }
});

function resetAuthUI() {
    document.getElementById('btnOpenAuth').classList.remove('hidden');
    document.getElementById('userMenu').classList.add('hidden');
    document.getElementById('audioList').innerHTML = '<p class="empty-msg">Silakan login untuk memotong dan melihat riwayat audio Anda.</p>';
}

// Navigasi Tab Login vs Daftar
window.switchTab = function(type) {
    if (type === 'login') {
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    } else {
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('tabLogin').classList.remove('active');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    }
}

// Validasi Password Real-time saat Mengetik
window.validateRegisterPassword = function() {
    const pwd = document.getElementById('regPassword').value;
    const confirmPwd = document.getElementById('regConfirmPassword').value;
    
    const hasLen = pwd.length >= 7 && pwd.length <= 12;
    const hasCaps = /[A-Z]/.test(pwd);
    const hasSymbol = /[#*._]/.test(pwd);
    const matches = pwd === confirmPwd && pwd !== "";

    updateRuleUI('ruleLength', hasLen);
    updateRuleUI('ruleCaps', hasCaps);
    updateRuleUI('ruleSymbol', hasSymbol);
    updateRuleUI('ruleMatch', matches);

    document.getElementById('btnSubmitRegister').disabled = !(hasLen && hasCaps && hasSymbol && matches);
}

function updateRuleUI(id, isValid) {
    const el = document.getElementById(id);
    if (isValid) {
        el.classList.add('valid');
        el.querySelector('i').className = 'fas fa-check-circle';
    } else {
        el.classList.remove('valid');
        el.querySelector('i').className = 'fas fa-times-circle';
    }
}

// Sistem Pendaftaran Akun Supabase
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    clearRegisterInputs();

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        alert("Gagal mendaftar: " + error.message);
    } else {
        alert("Pendaftaran berhasil! Silakan cek inbox email Anda untuk melakukan verifikasi sebelum login.");
        closeModal('authModal');
    }
});

// Sistem Login Akun Supabase
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    clearLoginInputs();

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert("Gagal masuk: " + error.message + ". Pastikan email sudah diverifikasi.");
    } else {
        closeModal('authModal');
    }
});

// Fitur Sembunyikan & Tampilkan Password
window.togglePasswordVisibility = function(id) {
    const field = document.getElementById(id);
    field.type = field.type === 'password' ? 'text' : 'password';
}

// Proses Mengubah Password di Profil
window.updateProfilePassword = async function() {
    const curPwd = document.getElementById('profCurrentPassword').value; // Supabase tidak wajib re-auth untuk ganti pwd lewat updateUser
    const newPwd = document.getElementById('profNewPassword').value;
    const confNewPwd = document.getElementById('profConfirmNewPassword').value;

    if (newPwd !== confNewPwd) return alert("Konfirmasi password baru tidak cocok.");

    const { data, error } = await supabase.auth.updateUser({
        password: newPwd
    });

    if (error) {
        alert("Gagal memperbarui password: " + error.message);
    } else {
        alert("Password berhasil diperbarui!");
        document.getElementById('profCurrentPassword').value = "";
        document.getElementById('profNewPassword').value = "";
        document.getElementById('profConfirmNewPassword').value = "";
        closeModal('profileModal');
    }
}

// Log Out Akun
window.triggerLogout = async function() {
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi Audio Cutter?")) {
        await supabase.auth.signOut();
    }
}

// Hapus Akun & Seluruh Objek Audio di Storage secara Permanen
window.triggerDeleteAccount = async function() {
    const pwdVerify = prompt("Ketik 'HAPUS AKUN' untuk mengonfirmasi penghapusan akun beserta semua file audio Anda:");
    if (pwdVerify !== 'HAPUS AKUN') return;

    // Ambil list file di folder user terlebih dahulu
    const folderPath = `${currentUser.id}/`;
    const { data: files } = await supabase.storage.from('audio-tracks').list(currentUser.id);

    if (files && files.length > 0) {
        const filesToRemove = files.map(f => `${folderPath}${f.name}`);
        await supabase.storage.from('audio-tracks').remove(filesToRemove);
    }

    // Catatan: Penghapusan user auth secara penuh di Supabase idealnya memerlukan service_role / Edge Function,
    // Di sisi client, kita akan memaksa user log out setelah membersihkan file storagenya.
    alert("Data file audio Anda berhasil dibersihkan. Anda akan otomatis keluar.");
    await supabase.auth.signOut();
    closeModal('profileModal');
}

// ================= LOGIKA UTAMA: AUDIO PROCESSING (CUTTER) =================

window.checkAuthAndOpenCutter = function() {
    if (!currentUser) {
        alert("Anda harus login terlebih dahulu untuk menggunakan pemotong audio.");
        openModal('authModal');
    } else {
        openModal('cutterModal');
    }
}

window.handleAudioUpload = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('cutFileName').value = file.name.split('.')[0] + "_cut";

    const reader = new FileReader();
    reader.onload = function(evt) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.decodeAudioData(evt.target.result, function(buffer) {
            audioBuffer = buffer;
            initWaveSurfer(file);
        });
    };
    reader.readAsArrayBuffer(file);
}

function initWaveSurfer(file) {
    if (window.wavesurfer) window.wavesurfer.destroy();

    window.wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#444455',
        progressColor: '#ff007f',
        cursorColor: '#00f0ff',
        responsive: true
    });

    window.wavesurfer.loadBlob(file);
    
    window.wavesurfer.on('ready', () => {
        document.getElementById('uploadZone').classList.add('hidden');
        document.getElementById('cutterWorkspace').classList.remove('hidden');
        
        const duration = window.wavesurfer.getDuration();
        document.getElementById('startTime').value = 0;
        document.getElementById('endTime').value = (duration > 10 ? 10 : duration).toFixed(1);
    });
}

window.togglePlay = function() {
    window.wavesurfer.playPause();
    const icon = document.getElementById('btnPlayPause').querySelector('i');
    icon.className = window.wavesurfer.isPlaying() ? 'fas fa-pause' : 'fas fa-play';
}

// Proses Pemotongan dan Mengunggah Hasil Langsung ke Supabase Storage
window.processAudioCut = async function() {
    const start = parseFloat(document.getElementById('startTime').value);
    const end = parseFloat(document.getElementById('endTime').value);
    let name = document.getElementById('cutFileName').value || "hasil_potongan";
    name = name.replace(/\s+/g, '_'); // Hindari spasi di nama file storage

    if (start >= end) return alert("Waktu mulai harus lebih kecil dari waktu selesai.");

    const sampleRate = audioBuffer.sampleRate;
    const startOffset = start * sampleRate;
    const endOffset = end * sampleRate;
    const frameCount = endOffset - startOffset;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const newBuffer = ctx.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);

    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        const channelData = audioBuffer.getChannelData(i);
        const newChannelData = newBuffer.getChannelData(i);
        for (let j = 0; j < frameCount; j++) {
            newChannelData[j] = channelData[j + startOffset];
        }
    }

    const wavBlob = bufferToWavBlob(newBuffer);
    const fileName = `${name}_${Date.now()}.wav`;
    const filePath = `${currentUser.id}/${fileName}`;

    // Unggah file blob audio biner asli ke Supabase Storage Bucket
    const { data, error } = await supabase.storage
        .from('audio-tracks')
        .upload(filePath, wavBlob, {
            contentType: 'audio/wav',
            upsert: true
        });

    if (error) {
        alert("Gagal mengunggah hasil potongan: " + error.message);
    } else {
        alert("Audio berhasil dipotong dan diunggah ke cloud!");
        closeModal('cutterModal');
        document.getElementById('uploadZone').classList.remove('hidden');
        document.getElementById('cutterWorkspace').classList.add('hidden');
        await loadAudioList();
    }
}

// Membaca daftar file audio dari folder Storage milik user ke Beranda
async function loadAudioList() {
    const audioListDiv = document.getElementById('audioList');
    
    // List file dari folder berdasarkan UID user yang sedang login
    const { data: files, error } = await supabase.storage
        .from('audio-tracks')
        .list(currentUser.id, {
            sortBy: { column: 'created_at', order: 'desc' }
        });

    if (error) {
        audioListDiv.innerHTML = '<p class="empty-msg">Gagal memuat daftar audio.</p>';
        return;
    }

    if (files && files.length > 0) {
        audioListDiv.innerHTML = "";
        files.forEach(file => {
            // Dapatkan URL publik dari file audio terkait
            const { data: urlData } = supabase.storage
                .from('audio-tracks')
                .getPublicUrl(`${currentUser.id}/${file.name}`);

            const createdDate = new Date(file.created_at).toLocaleDateString();

            const item = document.createElement('div');
            item.className = "audio-item";
            item.innerHTML = `
                <div>
                    <strong>${file.name.split('_')[0]}.wav</strong> <br>
                    <small style="color: #888;">Dibuat: ${createdDate}</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <audio src="${urlData.publicUrl}" controls style="height:35px;"></audio>
                    <button onclick="deleteTrack('${file.name}')" class="btn-danger" style="padding: 5px 10px;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            audioListDiv.appendChild(item);
        });
    } else {
        audioListDiv.innerHTML = '<p class="empty-msg">Belum ada riwayat potongan audio.</p>';
    }
}

// Menghapus spesifik satu file audio dari Storage
window.deleteTrack = async function(fileName) {
    if (!confirm("Apakah Anda yakin ingin menghapus potongan audio ini?")) return;

    const filePath = `${currentUser.id}/${fileName}`;
    const { data, error } = await supabase.storage
        .from('audio-tracks')
        .remove([filePath]);

    if (error) {
        alert("Gagal menghapus file: " + error.message);
    } else {
        alert("File audio berhasil dihapus.");
        await loadAudioList();
    }
}

// Helper: Mengubah Audio Buffer Menjadi Blob file .WAV standard
function bufferToWavBlob(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);

    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([bufferArr], { type: 'audio/wav' });
}
