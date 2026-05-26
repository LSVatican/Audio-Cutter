import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    sendEmailVerification, signOut, updatePassword, deleteUser, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyADSn6Gsu8iOPtS7utA7eJaXYAmhjGC-Fw",
  authDomain: "imel-permana.firebaseapp.com",
  databaseURL: "https://imel-permana-default-rtdb.firebaseio.com",
  projectId: "imel-permana",
  storageBucket: "imel-permana.firebasestorage.app",
  messagingSenderId: "92007832224",
  appId: "1:92007832224:web:263452aa7bf09f040c87c5"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global Variables
let currentUser = null;
window.wavesurfer = null;
let audioBuffer = null;

// Tampilkan/Sembunyikan Loader
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

// Manajemen Modal secara global
window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); }
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); }

// Autentikasi Menggunakan State Listener
onAuthStateChanged(auth, async (user) => {
    showLoading(true);
    const navAuth = document.getElementById('navAuth');
    const userMenu = document.getElementById('userMenu');
    const btnOpenAuth = document.getElementById('btnOpenAuth');
    
    if (user) {
        if (user.emailVerified) {
            currentUser = user;
            document.getElementById('userDisplayEmail').innerText = user.email;
            btnOpenAuth.classList.add('hidden');
            userMenu.classList.remove('hidden');
            document.getElementById('profEmail').value = user.email;
            await loadAudioList(user.uid);
        } else {
            alert("Harap verifikasi email Anda! Link verifikasi telah dikirim ke kotak masuk Anda.");
            await signOut(auth);
            resetAuthUI();
        }
    } else {
        currentUser = null;
        resetAuthUI();
    }
    showLoading(false);
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

// Sistem Pendaftaran Akun
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        alert("Pendaftaran berhasil! Silakan cek kotak masuk/spam email Anda untuk melakukan verifikasi sebelum login.");
        closeModal('authModal');
        await signOut(auth);
    } catch (err) {
        alert("Gagal mendaftar: " + err.message);
    } finally { showLoading(false); }
});

// Sistem Login Akun
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('authModal');
    } catch (err) {
        alert("Gagal masuk: Email/Password salah atau belum terverifikasi.");
    } finally { showLoading(false); }
});

// Fitur Sembunyikan & Tampilkan Password
window.togglePasswordVisibility = function(id) {
    const field = document.getElementById(id);
    field.type = field.type === 'password' ? 'text' : 'password';
}

// Proses Mengubah Password di Profil
window.updateProfilePassword = async function() {
    const curPwd = document.getElementById('profCurrentPassword').value;
    const newPwd = document.getElementById('profNewPassword').value;
    const confNewPwd = document.getElementById('profConfirmNewPassword').value;

    if(newPwd !== confNewPwd) return alert("Konfirmasi password baru tidak cocok.");
    showLoading(true);

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, curPwd);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPwd);
        alert("Password berhasil diperbarui!");
        closeModal('profileModal');
    } catch (err) {
        alert("Gagal memperbarui: " + err.message);
    } finally { showLoading(false); }
}

// Log Out Akun
window.triggerLogout = function() {
    if (confirm("Apakah Anda yakin ingin keluar dari aplikasi Audio Cutter?")) {
        signOut(auth);
    }
}

// Hapus Akun & List Audionya secara Permanen
window.triggerDeleteAccount = async function() {
    const pwdVerify = prompt("Untuk menghapus akun beserta seluruh data potongan audio secara permanen, harap masukkan password konfirmasi Anda:");
    if (!pwdVerify) return;
    showLoading(true);

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, pwdVerify);
        await reauthenticateWithCredential(currentUser, credential);
        
        // Hapus dokumen database list audio user di Firestore
        await setDoc(doc(db, "user_tracks", currentUser.uid), { tracks: [] });
        await deleteUser(currentUser);
        alert("Akun Anda telah berhasil dihapus secara permanen.");
        closeModal('profileModal');
    } catch (err) {
        alert("Verifikasi gagal: " + err.message);
    } finally { showLoading(false); }
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

// Membaca input file ke Visualizer Audio Custom
window.handleAudioUpload = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('cutFileName').value = file.name.split('.')[0] + "_cut";
    showLoading(true);

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

    // Inisialisasi visualizer audio dari Wavesurfer.js versi terbaru
    window.wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#444455',
        progressColor: '#ff007f',
        cursorColor: '#00f0ff',
        responsive: true
    });

    window.wavesurfer.loadBlob(file);
    
    window.wavesurfer.on('ready', () => {
        showLoading(false);
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

// Proses Pemotongan Menggunakan AudioContext internal (Klien Sisi) Tanpa Server Eksternal
window.processAudioCut = async function() {
    const start = parseFloat(document.getElementById('startTime').value);
    const end = parseFloat(document.getElementById('endTime').value);
    const name = document.getElementById('cutFileName').value || "hasil_potongan";

    if (start >= end) return alert("Waktu mulai harus lebih kecil dari waktu selesai.");
    showLoading(true);

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

    // Ubah hasil potongan menjadi WAV format string base64 untuk disimpan langsung di Firestore
    const wavBlob = bufferToWavBlob(newBuffer);
    const reader = new FileReader();
    reader.readAsDataURL(wavBlob);
    reader.onloadend = async function() {
        const base64Audio = reader.result;
        
        // Simpan data track ke cloud riwayat pengguna
        const trackData = {
            id: Date.now().toString(),
            name: name + ".wav",
            audioData: base64Audio,
            timestamp: new Date().toLocaleDateString()
        };

        try {
            const userDocRef = doc(db, "user_tracks", currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (!docSnap.exists()) {
                await setDoc(userDocRef, { tracks: [trackData] });
            } else {
                await updateDoc(userDocRef, { tracks: arrayUnion(trackData) });
            }
            alert("Audio berhasil dipotong dan disimpan ke daftar beranda!");
            closeModal('cutterModal');
            // Reset workspace
            document.getElementById('uploadZone').classList.remove('hidden');
            document.getElementById('cutterWorkspace').classList.add('hidden');
            await loadAudioList(currentUser.uid);
        } catch (err) {
            alert("Gagal menyimpan hasil: " + err.message);
        } finally { showLoading(false); }
    };
}

// Ambil Riwayat Pemotongan Audio dari Database Firestore ke Beranda
async function loadAudioList(uid) {
    const audioListDiv = document.getElementById('audioList');
    const docSnap = await getDoc(doc(db, "user_tracks", uid));

    if (docSnap.exists() && docSnap.data().tracks.length > 0) {
        audioListDiv.innerHTML = "";
        docSnap.data().tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = "audio-item";
            item.innerHTML = `
                <div>
                    <strong>${track.name}</strong> <br>
                    <small style="color: #888;">Dibuat: ${track.timestamp}</small>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <audio src="${track.audioData}" controls style="height:35px;"></audio>
                    <button onclick="deleteTrack('${track.id}')" class="btn-danger" style="padding: 5px 10px;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            audioListDiv.appendChild(item);
        });
    } else {
        audioListDiv.innerHTML = '<p class="empty-msg">Belum ada riwayat potongan audio.</p>';
    }
}

// Menghapus Item Tertentu dari Daftar Beranda dengan Konfirmasi Password
window.deleteTrack = async function(trackId) {
    const pwdVerify = prompt("Masukkan password akun Anda untuk mengonfirmasi penghapusan file audio ini:");
    if (!pwdVerify) return;
    showLoading(true);

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, pwdVerify);
        await reauthenticateWithCredential(currentUser, credential);

        const userDocRef = doc(db, "user_tracks", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            const trackToDelete = docSnap.data().tracks.find(t => t.id === trackId);
            if (trackToDelete) {
                await updateDoc(userDocRef, { tracks: arrayRemove(trackToDelete) });
                alert("File berhasil dihapus.");
                await loadAudioList(currentUser.uid);
            }
        }
    } catch(err) {
        alert("Konfirmasi gagal: Password salah!");
    } finally { showLoading(false); }
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
