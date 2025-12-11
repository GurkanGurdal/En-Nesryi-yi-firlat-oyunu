// Canvas ve context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas boyutları
canvas.width = 900;
canvas.height = 520;

// En-Nesyri resmi
const enNesyriImg = new Image();
enNesyriImg.src = 'assets/en-nesyri.png';
let imageLoaded = false;
enNesyriImg.onload = () => { imageLoaded = true; };

// Ses efektleri
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

// Fırlatma sesi
function playLaunchSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
}

// Uçuş sesi (rüzgar)
function playFlyingSound() {
    initAudio();
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    whiteNoise.start();
    whiteNoise.stop(audioCtx.currentTime + 1.5);
}

// Düşme sesi
function playLandSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
}

// Başarı sesi (fanfar)
function playSuccessSound() {
    initAudio();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.3);
        osc.start(audioCtx.currentTime + i * 0.15);
        osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
}

// Başarısızlık sesi
function playFailSound() {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
}

// Şarj sesi
let chargeOsc = null;
let chargeGain = null;
function startChargeSound() {
    initAudio();
    chargeOsc = audioCtx.createOscillator();
    chargeGain = audioCtx.createGain();
    chargeOsc.connect(chargeGain);
    chargeGain.connect(audioCtx.destination);
    chargeOsc.frequency.value = 100;
    chargeOsc.type = 'sine';
    chargeGain.gain.value = 0.1;
    chargeOsc.start();
}

function updateChargeSound(power) {
    if (chargeOsc) {
        chargeOsc.frequency.value = 100 + power * 4;
        chargeGain.gain.value = 0.05 + power * 0.002;
    }
}

function stopChargeSound() {
    if (chargeOsc) {
        chargeOsc.stop();
        chargeOsc = null;
        chargeGain = null;
    }
}

// UI elementleri
const distanceDisplay = document.getElementById('distanceValue');
const bestDistanceDisplay = document.getElementById('bestDistanceValue');
const successCountDisplay = document.getElementById('successCountValue');
const hintElement = document.getElementById('hint');
const resetBtn = document.getElementById('resetBtn');

// Oyun durumları
const GameState = {
    READY: 'ready',
    CHARGING: 'charging',
    LAUNCHING: 'launching',
    FLYING: 'flying',
    LANDED: 'landed'
};

let gameState = GameState.READY;

// Fizik sabitleri
const gravity = 0.45;
const airResistance = 0.998;

// Mancınık sabitleri
const catapultX = 130;
const catapultBaseWidth = 80;
const catapultBaseHeight = 40;
const armLength = 110;
const armWidth = 12;
const pivotHeight = 50; // Pivot noktasının yerden yüksekliği
const counterweightSize = 25;

// Oyun değişkenleri
const groundLevel = canvas.height - 70;
let armAngle = Math.PI * 1.4; // Başlangıç açısı (arkaya yatık)
let targetArmAngle = armAngle;
let armAngularVelocity = 0;
let manX = 0;
let manY = 0;
let velocityX = 0;
let velocityY = 0;
let distance = 0;
let trail = [];
let particles = [];
let chargePower = 0;
let isCharging = false;
let launchSpeed = 0;
let powerDirection = 1; // 1: artıyor, -1: azalıyor

// Ülke sınırları
const turkeyEnd = canvas.width * 0.30;
const syriaEnd = canvas.width * 0.48;
const iraqEnd = canvas.width * 0.68;
const saudiStart = iraqEnd;
const kmPerPixel = 5000 / (canvas.width - catapultX);

// Skor
let bestDistance = parseInt(localStorage.getItem('bestDistance')) || 0;
let successCount = parseInt(localStorage.getItem('successCount')) || 0;
bestDistanceDisplay.textContent = bestDistance + ' km';
successCountDisplay.textContent = successCount;

// Yıldızlar ve bulutlar
let stars = [];
let clouds = [];

function createStars() {
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (groundLevel - 50),
            size: Math.random() * 2 + 0.5,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

function createClouds() {
    for (let i = 0; i < 6; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: 30 + Math.random() * 80,
            scale: 0.5 + Math.random() * 0.5,
            speed: 0.2 + Math.random() * 0.3
        });
    }
}

createStars();
createClouds();

// Adamın mancınık kolundaki pozisyonunu hesapla
function updateManOnArm() {
    const pivotX = catapultX;
    const pivotY = groundLevel - pivotHeight;
    // Kolun ucundaki pozisyon (adam tarafı)
    manX = pivotX + Math.cos(armAngle) * armLength * 0.9;
    manY = pivotY - Math.sin(armAngle) * armLength * 0.9;
}

// Input pozisyonunu al
function getInputPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// Mancınık üzerinde mi kontrol
function isOnCatapult(x, y) {
    // Mancınık alanı kontrolü
    return x > catapultX - 60 && x < catapultX + 100 && y > groundLevel - 150 && y < groundLevel;
}

// Başlangıç (tıklama)
function handleStart(e) {
    e.preventDefault();
    if (gameState !== GameState.READY) return;
    
    const pos = getInputPos(e);
    if (isOnCatapult(pos.x, pos.y)) {
        gameState = GameState.CHARGING;
        isCharging = true;
        chargePower = 0;
        canvas.style.cursor = 'pointer';
        hintElement.classList.add('hidden');
        startChargeSound();
    }
}

// Hareket
function handleMove(e) {
    e.preventDefault();
    
    if (gameState === GameState.READY) {
        const pos = getInputPos(e);
        canvas.style.cursor = isOnCatapult(pos.x, pos.y) ? 'pointer' : 'default';
    }
}

// Bırakma - Fırlatma
function handleEnd(e) {
    if (gameState !== GameState.CHARGING) return;
    
    canvas.style.cursor = 'default';
    isCharging = false;
    stopChargeSound();
    
    if (chargePower < 5) {
        gameState = GameState.READY;
        chargePower = 0;
        draw();
        return;
    }
    
    // Fırlatma başlat
    gameState = GameState.LAUNCHING;
    launchSpeed = 0.2 + (chargePower / 100) * 0.3; // Açısal hız
    armAngularVelocity = 0;
    playLaunchSound();
    
    // Titreşim efekti
    document.querySelector('.game-container').classList.add('shake');
    setTimeout(() => {
        document.querySelector('.game-container').classList.remove('shake');
    }, 400);
    
    // Fırlatma animasyonunu başlat
    requestAnimationFrame(launchAnimation);
}

// Event listeners
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('mouseleave', handleEnd);
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('touchend', handleEnd);
resetBtn.addEventListener('click', reset);

// Adam karakteri çizimi (En-Nesyri)
function drawMan(x, y, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Gölge (sadece yerde ise)
    if (gameState === GameState.LANDED) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 28, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Eğer resim yüklüyse PNG kullan
    if (imageLoaded) {
        const imgSize = 70;
        ctx.drawImage(enNesyriImg, -imgSize/2, -imgSize/2 - 10, imgSize, imgSize);
    } else {
        // Yedek olarak Fenerbahçe forması ile adam çiz
        
        // Bacaklar (lacivert)
        ctx.fillStyle = '#00205b';
        ctx.fillRect(-7, 10, 5, 18);
        ctx.fillRect(2, 10, 5, 18);
        
        // Ayakkabılar (sarı)
        ctx.fillStyle = '#ffd200';
        ctx.fillRect(-8, 25, 7, 4);
        ctx.fillRect(1, 25, 7, 4);
        
        // Gövde (Fenerbahçe forması - sarı)
        const bodyGradient = ctx.createLinearGradient(-10, -5, 10, 15);
        bodyGradient.addColorStop(0, '#ffd200');
        bodyGradient.addColorStop(1, '#e6bc00');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.roundRect(-10, -5, 20, 20, 3);
        ctx.fill();
        
        // Forma çizgileri (lacivert)
        ctx.fillStyle = '#00205b';
        ctx.fillRect(-10, 2, 20, 4);
        
        // Kollar
        ctx.fillStyle = '#8b6914';
        ctx.save();
        ctx.translate(-10, 2);
        ctx.rotate(-0.3);
        ctx.fillRect(-3, 0, 6, 14);
        ctx.restore();
        
        ctx.save();
        ctx.translate(10, 2);
        ctx.rotate(0.3);
        ctx.fillRect(-3, 0, 6, 14);
        ctx.restore();
        
        // Eller
        ctx.fillStyle = '#8b6914';
        ctx.beginPath();
        ctx.arc(-15, 14, 4, 0, Math.PI * 2);
        ctx.arc(15, 14, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Boyun
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(-4, -10, 8, 8);
        
        // Kafa
        const headGradient = ctx.createRadialGradient(0, -18, 0, 0, -18, 14);
        headGradient.addColorStop(0, '#a07840');
        headGradient.addColorStop(1, '#8b6914');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(0, -18, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Saç (siyah, kısa)
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, -26, 12, 6, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        
        // Gözler
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-5, -20, 4, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(5, -20, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Göz bebekleri
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(-4, -19, 2, 0, Math.PI * 2);
        ctx.arc(6, -19, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Kaşlar
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, -26);
        ctx.quadraticCurveTo(-5, -28, -2, -26);
        ctx.moveTo(2, -26);
        ctx.quadraticCurveTo(5, -28, 8, -26);
        ctx.stroke();
        
        // Ağız
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        
        if (gameState === GameState.FLYING || gameState === GameState.LAUNCHING) {
            // Çığlık atan ağız
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.ellipse(0, -10, 5, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(-3, -13, 6, 3);
        } else {
            // Normal ifade
            ctx.beginPath();
            ctx.arc(0, -12, 5, 0.2, Math.PI - 0.2);
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

// Adam karakteri (mancınık üzerinde) - En-Nesyri PNG
function drawManOnCatapult() {
    // Eğer resim yüklüyse PNG kullan
    if (imageLoaded) {
        const imgSize = 50;
        ctx.drawImage(enNesyriImg, -imgSize/2, -imgSize/2 + 5, imgSize, imgSize);
    } else {
        // Yedek olarak Fenerbahçe forması ile adam çiz
        
        // Bacaklar (lacivert)
        ctx.fillStyle = '#00205b';
        ctx.fillRect(-7, 10, 5, 18);
        ctx.fillRect(2, 10, 5, 18);
        
        // Ayakkabılar (sarı)
        ctx.fillStyle = '#ffd200';
        ctx.fillRect(-8, 25, 7, 4);
        ctx.fillRect(1, 25, 7, 4);
        
        // Gövde (Fenerbahçe sarı)
        ctx.fillStyle = '#ffd200';
        ctx.beginPath();
        ctx.roundRect(-10, -5, 20, 20, 3);
        ctx.fill();
        
        // Forma çizgisi (lacivert)
        ctx.fillStyle = '#00205b';
        ctx.fillRect(-10, 2, 20, 4);
        
        // Kollar
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(-15, 0, 6, 12);
        ctx.fillRect(9, 0, 6, 12);
        
        // Boyun
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(-4, -10, 8, 8);
        
        // Kafa
        ctx.fillStyle = '#8b6914';
        ctx.beginPath();
        ctx.arc(0, -18, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Saç (siyah, kısa)
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.ellipse(0, -26, 12, 6, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        
        // Gözler
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5, -20, 4, 0, Math.PI * 2);
        ctx.arc(5, -20, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(-4, -19, 2, 0, Math.PI * 2);
        ctx.arc(6, -19, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Ağız
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -12, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }
}

// Mancınık çizimi (Fenerbahçe temalı)
function drawCatapult() {
    const baseX = catapultX;
    const baseY = groundLevel;
    const pivotX = catapultX;
    const pivotY = groundLevel - pivotHeight;
    
    // === TABAN ===
    // Ana platform (lacivert)
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.roundRect(baseX - 50, baseY - 25, 100, 25, 4);
    ctx.fill();
    
    // Platform üst çizgisi (sarı)
    ctx.fillStyle = '#ffd200';
    ctx.fillRect(baseX - 48, baseY - 25, 96, 6);
    
    // Tekerlekler (sarı)
    ctx.fillStyle = '#ffd200';
    ctx.beginPath();
    ctx.arc(baseX - 35, baseY - 3, 14, 0, Math.PI * 2);
    ctx.arc(baseX + 35, baseY - 3, 14, 0, Math.PI * 2);
    ctx.fill();
    
    // Tekerlek jantları (lacivert)
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.arc(baseX - 35, baseY - 3, 7, 0, Math.PI * 2);
    ctx.arc(baseX + 35, baseY - 3, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Tekerlek merkezi
    ctx.fillStyle = '#ffd200';
    ctx.beginPath();
    ctx.arc(baseX - 35, baseY - 3, 3, 0, Math.PI * 2);
    ctx.arc(baseX + 35, baseY - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // === DESTEK DİREKLERİ (A-Frame) ===
    ctx.fillStyle = '#00205b';
    
    // Sol direk
    ctx.save();
    ctx.translate(baseX - 15, baseY - 25);
    ctx.rotate(-0.25);
    ctx.fillRect(-6, -55, 12, 60);
    ctx.restore();
    
    // Sağ direk
    ctx.save();
    ctx.translate(baseX + 15, baseY - 25);
    ctx.rotate(0.25);
    ctx.fillRect(-6, -55, 12, 60);
    ctx.restore();
    
    // Üst bağlantı kirişi (sarı)
    ctx.fillStyle = '#ffd200';
    ctx.fillRect(baseX - 20, pivotY - 8, 40, 10);
    
    // === PİVOT NOKTASI ===
    ctx.fillStyle = '#ffd200';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 10, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // === MANCINIK KOLU ===
    ctx.save();
    ctx.translate(pivotX, pivotY);
    // Kol açısı: armAngle = 1.4*PI (arkada) -> 0.55*PI (önde/dik)
    ctx.rotate(-armAngle + Math.PI);
    
    // Kol gövdesi (uzun çubuk - lacivert)
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.roundRect(-8, -armLength * 0.3, 16, armLength * 1.2, 4);
    ctx.fill();
    
    // Kol kenar çizgileri (sarı)
    ctx.strokeStyle = '#ffd200';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -armLength * 0.3, 16, armLength * 1.2);
    
    // === KARŞI AĞIRLIK (kısa taraf - yukarıda) ===
    const cwY = -armLength * 0.22;
    // Ağırlık kutusu (sarı)
    ctx.fillStyle = '#ffd200';
    ctx.beginPath();
    ctx.roundRect(-18, cwY - 15, 36, 30, 4);
    ctx.fill();
    
    // Ağırlık detayı (lacivert)
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.roundRect(-14, cwY - 11, 28, 22, 2);
    ctx.fill();
    
    // Ağırlık çizgileri (sarı)
    ctx.strokeStyle = '#ffd200';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, cwY - 8);
    ctx.lineTo(-10, cwY + 8);
    ctx.moveTo(0, cwY - 8);
    ctx.lineTo(0, cwY + 8);
    ctx.moveTo(10, cwY - 8);
    ctx.lineTo(10, cwY + 8);
    ctx.stroke();
    
    // === KEPÇE (Adam tarafı - En-Nesyri için) ===
    const bucketY = armLength * 0.8;
    
    // Kepçe gövdesi (lacivert)
    ctx.fillStyle = '#00205b';
    ctx.beginPath();
    ctx.moveTo(-22, bucketY);
    ctx.lineTo(-28, bucketY + 25);
    ctx.lineTo(28, bucketY + 25);
    ctx.lineTo(22, bucketY);
    ctx.closePath();
    ctx.fill();
    
    // Kepçe kenarı (sarı)
    ctx.strokeStyle = '#ffd200';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Kepçe iç kısmı
    ctx.fillStyle = '#001a4d';
    ctx.beginPath();
    ctx.moveTo(-18, bucketY + 4);
    ctx.lineTo(-22, bucketY + 21);
    ctx.lineTo(22, bucketY + 21);
    ctx.lineTo(18, bucketY + 4);
    ctx.closePath();
    ctx.fill();
    
    // Adam kepçede (sadece fırlatılmamışsa)
    if (gameState === GameState.READY || gameState === GameState.CHARGING || gameState === GameState.LAUNCHING) {
        ctx.save();
        ctx.translate(0, bucketY + 8);
        ctx.scale(0.55, 0.55);
        drawManOnCatapult();
        ctx.restore();
    }
    
    ctx.restore();
    
    // === GÜÇ GÖSTERGESİ ===
    if (gameState === GameState.CHARGING) {
        const barWidth = 100;
        const barHeight = 14;
        const barX = catapultX - barWidth/2;
        const barY = groundLevel + 18;
        
        // Arka plan
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(barX - 3, barY - 3, barWidth + 6, barHeight + 6, 10);
        ctx.fill();
        
        // Güç barı arka plan
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, 7);
        ctx.fill();
        
        // Güç barı (Fenerbahçe renkleri)
        const powerColor = chargePower < 40 ? '#ffd200' : chargePower < 70 ? '#ffaa00' : '#ff6600';
        ctx.fillStyle = powerColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, (barWidth * chargePower / 100), barHeight, 7);
        ctx.fill();
        
        // Parlama
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(barX + 2, barY + 2, (barWidth * chargePower / 100) - 4, barHeight / 3, 3);
        ctx.fill();
        
        // Güç yazısı
        ctx.fillStyle = '#ffd200';
        ctx.font = 'bold 12px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('GÜÇ: ' + Math.round(chargePower) + '%', catapultX, barY + barHeight + 18);
        ctx.shadowBlur = 0;
    }
}

// Harita çizimi
function drawMap() {
    // Gökyüzü (Fenerbahçe lacivert teması)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, groundLevel);
    skyGradient.addColorStop(0, '#00102e');
    skyGradient.addColorStop(0.3, '#001a4d');
    skyGradient.addColorStop(0.7, '#002366');
    skyGradient.addColorStop(1, '#003399');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, groundLevel);
    
    // Yıldızlar
    const time = Date.now() * 0.001;
    stars.forEach(star => {
        const twinkle = Math.sin(time * 2 + star.twinkle) * 0.5 + 0.5;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.3 + twinkle * 0.7) + ')';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * (0.8 + twinkle * 0.4), 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Ay
    const moonGradient = ctx.createRadialGradient(canvas.width - 70, 50, 0, canvas.width - 70, 50, 35);
    moonGradient.addColorStop(0, '#fffde7');
    moonGradient.addColorStop(0.8, '#fff9c4');
    moonGradient.addColorStop(1, '#fff59d');
    ctx.fillStyle = moonGradient;
    ctx.beginPath();
    ctx.arc(canvas.width - 70, 50, 30, 0, Math.PI * 2);
    ctx.fill();
    
    // Ay gölgesi
    ctx.fillStyle = 'rgba(100, 100, 150, 0.3)';
    ctx.beginPath();
    ctx.arc(canvas.width - 60, 45, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Bulutlar
    clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > canvas.width + 100) cloud.x = -100;
        drawCloud(cloud.x, cloud.y, cloud.scale);
    });
    
    // Türkiye
    const turkeyGradient = ctx.createLinearGradient(0, groundLevel, 0, canvas.height);
    turkeyGradient.addColorStop(0, '#27ae60');
    turkeyGradient.addColorStop(1, '#1e8449');
    ctx.fillStyle = turkeyGradient;
    ctx.fillRect(0, groundLevel, turkeyEnd, canvas.height - groundLevel);
    
    // Suriye
    const syriaGradient = ctx.createLinearGradient(0, groundLevel, 0, canvas.height);
    syriaGradient.addColorStop(0, '#e67e22');
    syriaGradient.addColorStop(1, '#d35400');
    ctx.fillStyle = syriaGradient;
    ctx.fillRect(turkeyEnd, groundLevel, syriaEnd - turkeyEnd, canvas.height - groundLevel);
    
    // Irak
    const iraqGradient = ctx.createLinearGradient(0, groundLevel, 0, canvas.height);
    iraqGradient.addColorStop(0, '#f1c40f');
    iraqGradient.addColorStop(1, '#d4ac0d');
    ctx.fillStyle = iraqGradient;
    ctx.fillRect(syriaEnd, groundLevel, iraqEnd - syriaEnd, canvas.height - groundLevel);
    
    // Suudi Arabistan
    const saudiGradient = ctx.createLinearGradient(0, groundLevel, 0, canvas.height);
    saudiGradient.addColorStop(0, '#006400');
    saudiGradient.addColorStop(1, '#004d00');
    ctx.fillStyle = saudiGradient;
    ctx.fillRect(iraqEnd, groundLevel, canvas.width - iraqEnd, canvas.height - groundLevel);
    
    // Çim
    drawGrass(0, turkeyEnd, '#2ecc71');
    drawGrass(turkeyEnd, syriaEnd, '#f39c12');
    drawGrass(syriaEnd, iraqEnd, '#f7dc6f');
    drawGrass(iraqEnd, canvas.width, '#228b22');
    
    // Sınırlar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    
    [turkeyEnd, syriaEnd, iraqEnd].forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, groundLevel);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    });
    
    ctx.setLineDash([]);
    
    // Ülke isimleri
    ctx.font = 'bold 13px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    
    ctx.fillText('🇹🇷 TÜRKİYE', turkeyEnd / 2, groundLevel + 35);
    ctx.fillText('🇸🇾 SURİYE', (turkeyEnd + syriaEnd) / 2, groundLevel + 35);
    ctx.fillText('🇮🇶 IRAK', (syriaEnd + iraqEnd) / 2, groundLevel + 35);
    ctx.fillText('🇸🇦 ARABİSTAN', (iraqEnd + canvas.width) / 2, groundLevel + 35);
    
    ctx.shadowBlur = 0;
    
    // Mesafe göstergeleri
    ctx.font = '10px Poppins, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('0 km', 60, groundLevel - 8);
    ctx.fillText('1500 km', turkeyEnd, groundLevel - 8);
    ctx.fillText('2400 km', syriaEnd, groundLevel - 8);
    ctx.fillText('3400 km', iraqEnd, groundLevel - 8);
    
    // Hedef
    drawTarget(iraqEnd + (canvas.width - iraqEnd) / 2, groundLevel + 60);
}

// Çim
function drawGrass(startX, endX, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    for (let x = startX + 5; x < endX; x += 15) {
        const height = 5 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(x, groundLevel);
        ctx.lineTo(x - 2, groundLevel - height);
        ctx.moveTo(x, groundLevel);
        ctx.lineTo(x + 2, groundLevel - height);
        ctx.stroke();
    }
}

// Hedef (Kırmızı)
function drawTarget(x, y) {
    const time = Date.now() * 0.003;
    const pulse = Math.sin(time) * 0.2 + 1;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// Bulut
function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.arc(30, -10, 25, 0, Math.PI * 2);
    ctx.arc(60, 0, 30, 0, Math.PI * 2);
    ctx.arc(30, 10, 25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// İz (Fenerbahçe sarısı)
function drawTrail() {
    if (trail.length < 2) return;
    
    for (let i = 1; i < trail.length; i++) {
        const alpha = i / trail.length;
        const width = 2 + (i / trail.length) * 4;
        
        ctx.strokeStyle = 'rgba(255, 210, 0, ' + (alpha * 0.7) + ')';
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
    }
    
    for (let i = 0; i < trail.length; i += 3) {
        const alpha = i / trail.length;
        ctx.fillStyle = 'rgba(255, 210, 0, ' + (alpha * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, 2 + alpha * 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Parçacıklar
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 80 + Math.random() * 40,
            maxLife: 80 + Math.random() * 40,
            color: color,
            size: Math.random() * 6 + 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        p.life--;
        return p.life > 0;
    });
}

function drawParticles() {
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const radius = i % 2 === 0 ? p.size : p.size * 0.5;
            if (i === 0) {
                ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            } else {
                ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    });
    ctx.globalAlpha = 1;
}

// Fırlatma animasyonu
function launchAnimation() {
    if (gameState !== GameState.LAUNCHING) return;
    
    // Kolu döndür (arkadan öne - açı azalıyor)
    armAngularVelocity += launchSpeed * 0.12;
    armAngle -= armAngularVelocity;
    
    // Adam pozisyonunu güncelle
    updateManOnArm();
    
    draw();
    
    // Fırlatma noktasına ulaştığında (kol dik/öne geldiğinde)
    if (armAngle <= Math.PI * 0.55) {
        // Adamı serbest bırak
        gameState = GameState.FLYING;
        playFlyingSound();
        
        // Hız hesapla - güce göre
        const baseSpeed = 4 + (chargePower / 100) * 10;
        const angle = Math.PI * 0.28;
        
        velocityX = baseSpeed * Math.cos(angle);
        velocityY = -baseSpeed * Math.sin(angle) * 1.3;
        
        trail = [];
        
        // Fırlatma efekti (Fenerbahçe renkleri)
        createParticles(manX, manY, 25, '#ffd200');
        createParticles(manX, manY, 15, '#00205b');
        
        requestAnimationFrame(gameLoop);
        return;
    }
    
    requestAnimationFrame(launchAnimation);
}

// Oyun döngüsü
function gameLoop() {
    if (gameState !== GameState.FLYING) return;
    
    velocityY += gravity;
    velocityX *= airResistance;
    velocityY *= airResistance;
    
    manX += velocityX;
    manY += velocityY;
    
    trail.push({ x: manX, y: manY });
    if (trail.length > 80) trail.shift();
    
    updateParticles();
    
    // Sarı parçacıklar (Fenerbahçe)
    if (Math.random() < 0.3) {
        createParticles(manX, manY, 1, 'hsl(' + (45 + Math.random() * 15) + ', 100%, 50%)');
    }
    
    const traveledPixels = Math.max(0, manX - catapultX);
    distance = Math.round(traveledPixels * kmPerPixel);
    distanceDisplay.textContent = distance + ' km';
    
    if (manY >= groundLevel - 25) {
        manY = groundLevel - 25;
        endFlight();
        return;
    }
    
    if (manX > canvas.width + 50) {
        endFlight();
        return;
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// Uçuş sonu
function endFlight() {
    gameState = GameState.LANDED;
    playLandSound();
    
    const traveledPixels = Math.max(0, manX - catapultX);
    distance = Math.round(traveledPixels * kmPerPixel);
    distanceDisplay.textContent = distance + ' km';
    
    if (distance > bestDistance) {
        bestDistance = distance;
        bestDistanceDisplay.textContent = bestDistance + ' km';
        localStorage.setItem('bestDistance', bestDistance);
    }
    
    if (manX >= saudiStart) {
        successCount++;
        successCountDisplay.textContent = successCount;
        localStorage.setItem('successCount', successCount);
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const colors = ['#ffd200', '#00205b', '#ffd200', '#00205b', '#ffd200'];
                createParticles(manX + (Math.random() - 0.5) * 100, manY - 50, 30, colors[i]);
            }, i * 150);
        }
        
        document.querySelector('.game-container').classList.add('celebrate');
        setTimeout(() => {
            document.querySelector('.game-container').classList.remove('celebrate');
        }, 2000);
        
        playSuccessSound();
        showVictoryMessage();
    } else {
        let landedIn = 'Türkiye';
        let emoji = '🇹🇷';
        if (manX >= syriaEnd) {
            landedIn = 'Irak';
            emoji = '🇮🇶';
        } else if (manX >= turkeyEnd) {
            landedIn = 'Suriye';
            emoji = '🇸🇾';
        }
        
        createParticles(manX, manY, 20, '#00205b');
        playFailSound();
        if (landedIn === 'Suriye' || landedIn === 'Irak') {
            showMessage('😩 En-Nesyri yine kaçırdı!', '#ff6b6b');
        } else {
            showMessage(emoji + ' ' + landedIn + '\'de düştü! (' + distance + ' km)', '#00205b');
        }
    }
    
    draw();
}

// Mesaj
function showMessage(text, color) {
    const hint = document.getElementById('hint');
    hint.innerHTML = '<span>' + text + '</span>';
    hint.style.background = color;
    hint.classList.remove('hidden');
    
    setTimeout(() => {
        hint.style.background = 'rgba(0, 32, 91, 0.8)';
        hint.innerHTML = '<span>⚽ Tekrar denemek için sıfırla!</span>';
    }, 3000);
}

// Büyük zafer mesajı (ekranın ortasında)
function showVictoryMessage() {
    // Mevcut victory div varsa kaldır
    const existingVictory = document.getElementById('victoryMessage');
    if (existingVictory) existingVictory.remove();
    
    const victoryDiv = document.createElement('div');
    victoryDiv.id = 'victoryMessage';
    victoryDiv.innerHTML = `
        <div class="victory-content">
            <div class="victory-emoji">🎉⚽🎉</div>
            <div class="victory-title">TEBRİKLER!</div>
            <div class="victory-subtitle">30 milyon € kazandık!</div>
            <div class="victory-detail">En-Nesyri Arabistan'a ulaştı!</div>
        </div>
    `;
    victoryDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes bounceIn {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.1); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        .victory-content {
            text-align: center;
            animation: bounceIn 0.6s ease;
        }
        .victory-emoji {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 1s ease infinite;
        }
        .victory-title {
            font-family: 'Bangers', cursive;
            font-size: 72px;
            color: #ffd200;
            text-shadow: 4px 4px 0 #00205b, 8px 8px 0 rgba(0,0,0,0.3);
            margin-bottom: 15px;
        }
        .victory-subtitle {
            font-family: 'Poppins', sans-serif;
            font-size: 42px;
            color: #4ade80;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            margin-bottom: 10px;
        }
        .victory-detail {
            font-family: 'Poppins', sans-serif;
            font-size: 24px;
            color: #fff;
            opacity: 0.9;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(victoryDiv);
    
    // Tıklayınca kapat
    victoryDiv.addEventListener('click', () => {
        victoryDiv.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => victoryDiv.remove(), 300);
    });
    
    // 5 saniye sonra otomatik kapat
    setTimeout(() => {
        if (document.getElementById('victoryMessage')) {
            victoryDiv.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => victoryDiv.remove(), 300);
        }
    }, 5000);
}

// Sıfırla
function reset() {
    gameState = GameState.READY;
    armAngle = Math.PI * 1.4; // Arkaya yatık başlangıç
    armAngularVelocity = 0;
    chargePower = 0;
    powerDirection = 1;
    velocityX = 0;
    velocityY = 0;
    distance = 0;
    trail = [];
    particles = [];
    launchSpeed = 0;
    distanceDisplay.textContent = '0 km';
    canvas.style.cursor = 'default';
    
    updateManOnArm();
    
    hintElement.innerHTML = '<span>⚽ Mancınığa tıkla ve En-Nesyri\'yi fırlat!</span>';
    hintElement.style.background = 'rgba(0, 32, 91, 0.8)';
    hintElement.classList.remove('hidden');
    
    draw();
}

// Ana çizim
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawMap();
    drawTrail();
    drawCatapult(); // Adam mancınık üzerindeyken burada çiziliyor
    
    // Uçuş ve iniş durumlarında adamı bağımsız çiz
    if (gameState === GameState.FLYING || gameState === GameState.LANDED) {
        let rotation = Math.atan2(velocityY, velocityX);
        drawMan(manX, manY, rotation);
    }
    
    drawParticles();
}

// Ana oyun döngüsü
function mainLoop() {
    // Şarj durumunda güç dolup boşalsın
    if (gameState === GameState.CHARGING) {
        chargePower += powerDirection * 2.5;
        updateChargeSound(chargePower);
        
        // Sınırlara ulaşınca yön değiştir
        if (chargePower >= 100) {
            chargePower = 100;
            powerDirection = -1;
        } else if (chargePower <= 0) {
            chargePower = 0;
            powerDirection = 1;
        }
    }
    
    // Her zaman çiz (FLYING hariç - o kendi döngüsünde)
    if (gameState !== GameState.FLYING && gameState !== GameState.LAUNCHING) {
        draw();
    }
    
    requestAnimationFrame(mainLoop);
}

// Başlat
reset();
mainLoop();
