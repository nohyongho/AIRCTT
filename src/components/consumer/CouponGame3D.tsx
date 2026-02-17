'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, X, Gift, Trophy, Coins, Zap, ArrowLeft,
    Pause, Play, RotateCcw, Wallet, Timer, Flame, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* =============================================
   Sound Engine (Web Audio API)
   ============================================= */

class GameSoundEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private initialized = false;

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3, delay = 0) {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration);
    }

    private playNoise(duration: number, volume = 0.1, delay = 0) {
        if (!this.ctx || !this.masterGain) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.masterGain!);
        source.start(this.ctx.currentTime + delay);
    }

    collect(comboLevel: number) {
        const baseFreq = 523 + comboLevel * 60;
        this.playTone(baseFreq, 0.15, 'sine', 0.25);
        this.playTone(baseFreq * 1.25, 0.12, 'sine', 0.2, 0.05);
        this.playTone(baseFreq * 1.5, 0.1, 'triangle', 0.15, 0.1);
        this.playTone(baseFreq * 2, 0.08, 'sine', 0.08, 0.12);
    }

    combo() {
        [523, 659, 784, 1047].forEach((f, i) => {
            this.playTone(f, 0.3 - i * 0.03, 'triangle', 0.15, i * 0.04);
        });
        this.playTone(1568, 0.4, 'sine', 0.06, 0.15);
    }

    levelUp() {
        const notes = [523, 659, 784, 1047, 1319];
        notes.forEach((f, i) => {
            this.playTone(f, 0.2, 'sine', 0.12, i * 0.08);
            this.playTone(f * 1.5, 0.15, 'triangle', 0.06, i * 0.08 + 0.03);
        });
    }

    gameStart() {
        [262, 330, 392, 523].forEach((f, i) => {
            this.playTone(f, 0.2, 'square', 0.08, i * 0.1);
            this.playTone(f * 2, 0.15, 'sine', 0.05, i * 0.1 + 0.05);
        });
        this.playTone(1047, 0.4, 'sawtooth', 0.06, 0.45);
        this.playNoise(0.15, 0.04, 0.45);
    }

    gameOver() {
        [784, 659, 523, 392].forEach((f, i) => {
            this.playTone(f, 0.35, 'sine', 0.12, i * 0.15);
        });
        this.playTone(262, 0.8, 'triangle', 0.1, 0.6);
        this.playTone(330, 0.7, 'sine', 0.08, 0.65);
        this.playTone(392, 0.6, 'sine', 0.06, 0.7);
    }

    miss() {
        this.playTone(120, 0.1, 'sine', 0.15);
        this.playNoise(0.05, 0.03);
    }

    tick() {
        this.playTone(880, 0.06, 'square', 0.08);
    }

    tickFinal() {
        this.playTone(1200, 0.1, 'square', 0.12);
        this.playTone(600, 0.08, 'sine', 0.08, 0.05);
    }
}

const soundEngine = new GameSoundEngine();

/* =============================================
   Types & Constants
   ============================================= */

interface CouponType {
    emoji: string;
    name: string;
    discount: string;
    color: string;
    points: number;
    bgLight: string;
    bgDark: string;
}

interface FallingCoupon {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
    rotation: number;
    rotSpeed: number;
    bobPhase: number;
    scale: number;
    opacity: number;
    type: CouponType;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
    opacity: number;
    color: string;
}

interface TouchEffect {
    x: number;
    y: number;
    radius: number;
    opacity: number;
}

interface FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
}

interface GameProps {
    onCouponAcquired?: (amount: number, name: string) => void;
    onClose?: () => void;
    lang?: 'ko' | 'en';
}

const COUPON_TYPES: CouponType[] = [
    { emoji: '🍕', name: '피자 할인', discount: '30% OFF', color: '#FF6B35', points: 100, bgLight: '#FFF3ED', bgDark: '#3D1A0A' },
    { emoji: '☕', name: '카페 쿠폰', discount: '50% OFF', color: '#7C3AED', points: 150, bgLight: '#F0EAFF', bgDark: '#1E0A3D' },
    { emoji: '🍱', name: '도시락 쿠폰', discount: '40% OFF', color: '#E11D48', points: 120, bgLight: '#FFF0F3', bgDark: '#3D0A15' },
    { emoji: '🛍️', name: '쇼핑 할인', discount: '20% OFF', color: '#0D9488', points: 80, bgLight: '#F0FDFA', bgDark: '#0A2D2A' },
    { emoji: '🎮', name: '게임 무료', discount: 'FREE', color: '#7C3AED', points: 200, bgLight: '#F3EEFF', bgDark: '#1A0A3D' },
    { emoji: '🎬', name: '영화 할인', discount: '1+1', color: '#2563EB', points: 180, bgLight: '#EFF6FF', bgDark: '#0A1A3D' },
    { emoji: '🧁', name: '디저트 쿠폰', discount: '60% OFF', color: '#EC4899', points: 160, bgLight: '#FDF2F8', bgDark: '#3D0A25' },
    { emoji: '🏋️', name: '헬스 이용권', discount: '무료체험', color: '#059669', points: 140, bgLight: '#ECFDF5', bgDark: '#0A3D25' },
    { emoji: '💈', name: '미용실 쿠폰', discount: '35% OFF', color: '#D97706', points: 110, bgLight: '#FFFBEB', bgDark: '#3D2A0A' },
    { emoji: '🚗', name: '세차 쿠폰', discount: '50% OFF', color: '#4F46E5', points: 130, bgLight: '#EEF2FF', bgDark: '#0A0E3D' },
];

/* =============================================
   Game Component
   ============================================= */

export default function CouponGame3D({ onCouponAcquired, onClose, lang = 'ko' }: GameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<{
        isRunning: boolean;
        isPaused: boolean;
        score: number;
        combo: number;
        maxCombo: number;
        couponsCollected: number;
        level: number;
        timeLeft: number;
        coupons: FallingCoupon[];
        particles: Particle[];
        touchEffects: TouchEffect[];
        floatingTexts: FloatingText[];
        wonCoupons: CouponType[];
        spawnTimer: number;
        lastTime: number;
        nextId: number;
        comboTimer: number;
    }>({
        isRunning: false,
        isPaused: false,
        score: 0,
        combo: 0,
        maxCombo: 0,
        couponsCollected: 0,
        level: 1,
        timeLeft: 60,
        coupons: [],
        particles: [],
        touchEffects: [],
        floatingTexts: [],
        wonCoupons: [],
        spawnTimer: 0,
        lastTime: 0,
        nextId: 0,
        comboTimer: 0,
    });

    const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'over'>('start');
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [level, setLevel] = useState(1);
    const [comboToast, setComboToast] = useState<string | null>(null);
    const [finalStats, setFinalStats] = useState({ score: 0, coupons: 0, maxCombo: 0, level: 1, wonCoupons: [] as CouponType[] });

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const levelRef = useRef<NodeJS.Timeout | null>(null);
    const animRef = useRef<number>(0);

    // Resize canvas
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }, []);

    useEffect(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    // Spawn coupon
    const spawnCoupon = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const g = gameRef.current;
        const type = COUPON_TYPES[Math.floor(Math.random() * COUPON_TYPES.length)];
        const baseSize = Math.min(80, canvas.width * 0.15);
        const speed = 70 + g.level * 18 + Math.random() * 35;

        g.coupons.push({
            id: g.nextId++,
            x: baseSize + Math.random() * (canvas.width - baseSize * 2),
            y: -120,
            width: baseSize,
            height: baseSize + 20,
            speed,
            rotation: (Math.random() - 0.5) * 0.3,
            rotSpeed: (Math.random() - 0.5) * 1.5,
            bobPhase: Math.random() * Math.PI * 2,
            scale: 0.5,
            opacity: 0,
            type,
        });
    }, []);

    // Collect coupon
    const collectCoupon = useCallback((coupon: FallingCoupon, x: number, y: number) => {
        const g = gameRef.current;
        g.combo++;
        g.comboTimer = 2;
        if (g.combo > g.maxCombo) g.maxCombo = g.combo;

        const multiplier = Math.min(5, 1 + (g.combo - 1) * 0.5);
        const points = Math.floor(coupon.type.points * multiplier);
        g.score += points;
        g.couponsCollected++;

        if (!g.wonCoupons.find(c => c.name === coupon.type.name)) {
            g.wonCoupons.push(coupon.type);
        }

        soundEngine.collect(g.combo);

        // Particles
        const count = 12 + g.combo * 2;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 180;
            g.particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd - 80,
                size: 2 + Math.random() * 4,
                life: 0.4 + Math.random() * 0.4,
                maxLife: 0.8,
                opacity: 1,
                color: coupon.type.color,
            });
        }

        // Floating text
        g.floatingTexts.push({
            x, y, text: `+${points}`, color: coupon.type.color,
            life: 1, maxLife: 1,
        });

        // Combo toast + sound
        if (g.combo >= 3 && g.combo % 3 === 0) {
            setComboToast(`${g.combo}x COMBO!`);
            soundEngine.combo();
            setTimeout(() => setComboToast(null), 800);
        }

        // Haptic
        if (navigator.vibrate) navigator.vibrate(25);

        setScore(g.score);
        setCombo(g.combo);

        onCouponAcquired?.(points, coupon.type.name);
    }, [onCouponAcquired]);

    // Handle touch/click
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const g = gameRef.current;
        if (!g.isRunning || g.isPaused) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        g.touchEffects.push({ x: px, y: py, radius: 8, opacity: 1 });

        let hit = false;
        for (let i = g.coupons.length - 1; i >= 0; i--) {
            const c = g.coupons[i];
            const w = c.width * c.scale;
            const h = c.height * c.scale;
            if (px >= c.x - w / 2 && px <= c.x + w / 2 && py >= c.y - h / 2 && py <= c.y + h / 2) {
                collectCoupon(c, px, py);
                g.coupons.splice(i, 1);
                hit = true;
                break;
            }
        }

        if (!hit) {
            g.combo = 0;
            g.comboTimer = 0;
            setCombo(0);
            soundEngine.miss();
        }
    }, [collectCoupon]);

    // Round rect helper
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    // Draw coupon
    const drawCoupon = useCallback((ctx: CanvasRenderingContext2D, c: FallingCoupon) => {
        const w = c.width * c.scale;
        const h = c.height * c.scale;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.globalAlpha = c.opacity;

        // Shadow
        ctx.shadowColor = c.type.color + '50';
        ctx.shadowBlur = 12 * c.scale;
        ctx.shadowOffsetY = 4 * c.scale;

        // Card BG
        const isDark = document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? c.type.bgDark : c.type.bgLight;
        roundRect(ctx, -w / 2, -h / 2, w, h, 10 * c.scale);
        ctx.fill();

        // Border
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = c.type.color + '40';
        ctx.lineWidth = 1.5 * c.scale;
        roundRect(ctx, -w / 2, -h / 2, w, h, 10 * c.scale);
        ctx.stroke();

        // Top color strip
        ctx.fillStyle = c.type.color;
        ctx.beginPath();
        const sr = 10 * c.scale;
        ctx.moveTo(-w / 2 + sr, -h / 2);
        ctx.lineTo(w / 2 - sr, -h / 2);
        ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + sr);
        ctx.lineTo(w / 2, -h / 2 + 5 * c.scale);
        ctx.lineTo(-w / 2, -h / 2 + 5 * c.scale);
        ctx.lineTo(-w / 2, -h / 2 + sr);
        ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + sr, -h / 2);
        ctx.fill();

        // Emoji
        ctx.font = `${24 * c.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.type.emoji, 0, -5 * c.scale);

        // Discount
        ctx.font = `bold ${9 * c.scale}px "Outfit", sans-serif`;
        ctx.fillStyle = c.type.color;
        ctx.fillText(c.type.discount, 0, h / 2 - 14 * c.scale);

        // Sparkle
        if (c.scale > 0.85) {
            const sp = performance.now() / 250 + c.bobPhase;
            ctx.globalAlpha = c.opacity * (0.25 + Math.sin(sp) * 0.25);
            ctx.font = `${7 * c.scale}px sans-serif`;
            ctx.fillText('✨', -w / 3, -h / 3);
            ctx.fillText('✨', w / 3, h / 4);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }, []);

    // Game loop
    const gameLoop = useCallback((timestamp: number) => {
        const g = gameRef.current;
        if (!g.isRunning) return;
        if (g.isPaused) {
            animRef.current = requestAnimationFrame(gameLoop);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dt = Math.min((timestamp - g.lastTime) / 1000, 0.1);
        g.lastTime = timestamp;

        // Spawn
        g.spawnTimer += dt;
        const rate = Math.max(0.25, 1.4 - g.level * 0.11);
        if (g.spawnTimer >= rate) {
            spawnCoupon();
            g.spawnTimer = 0;
        }

        // Combo timeout
        if (g.comboTimer > 0) {
            g.comboTimer -= dt;
            if (g.comboTimer <= 0) {
                g.combo = 0;
                setCombo(0);
            }
        }

        // Update coupons
        for (let i = g.coupons.length - 1; i >= 0; i--) {
            const c = g.coupons[i];
            c.y += c.speed * dt;
            c.rotation += c.rotSpeed * dt;
            c.bobPhase += dt * 2;
            c.x += Math.sin(c.bobPhase) * 0.4;
            const progress = c.y / canvas.height;
            c.scale = 0.55 + progress * 0.55;
            c.opacity = Math.min(1, c.y / 80);
            if (c.y > canvas.height + 100) {
                g.coupons.splice(i, 1);
            }
        }

        // Update particles
        for (let i = g.particles.length - 1; i >= 0; i--) {
            const p = g.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 180 * dt;
            p.life -= dt;
            p.opacity = Math.max(0, p.life / p.maxLife);
            p.size *= 0.995;
            if (p.life <= 0) g.particles.splice(i, 1);
        }

        // Update touch effects
        for (let i = g.touchEffects.length - 1; i >= 0; i--) {
            const e = g.touchEffects[i];
            e.radius += 120 * dt;
            e.opacity -= 1.8 * dt;
            if (e.opacity <= 0) g.touchEffects.splice(i, 1);
        }

        // Update floating texts
        for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
            const t = g.floatingTexts[i];
            t.y -= 60 * dt;
            t.life -= dt;
            if (t.life <= 0) g.floatingTexts.splice(i, 1);
        }

        // Render
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Grid
        const isDark = document.documentElement.classList.contains('dark');
        ctx.strokeStyle = isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.025)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Coupons
        const sorted = [...g.coupons].sort((a, b) => a.y - b.y);
        sorted.forEach(c => drawCoupon(ctx, c));

        // Particles
        g.particles.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        });

        // Touch effects
        g.touchEffects.forEach(e => {
            ctx.globalAlpha = e.opacity * 0.4;
            ctx.strokeStyle = '#7C3AED';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        });

        // Floating texts
        g.floatingTexts.forEach(t => {
            const a = t.life / t.maxLife;
            ctx.globalAlpha = a;
            ctx.font = `bold ${18 + (1 - a) * 8}px "Outfit", sans-serif`;
            ctx.fillStyle = t.color;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        });

        animRef.current = requestAnimationFrame(gameLoop);
    }, [spawnCoupon, drawCoupon]);

    // Start game
    const startGame = useCallback(() => {
        soundEngine.init();
        soundEngine.gameStart();

        const g = gameRef.current;
        g.isRunning = true;
        g.isPaused = false;
        g.score = 0; g.combo = 0; g.maxCombo = 0;
        g.couponsCollected = 0; g.level = 1; g.timeLeft = 60;
        g.coupons = []; g.particles = []; g.touchEffects = [];
        g.floatingTexts = []; g.wonCoupons = [];
        g.spawnTimer = 0; g.comboTimer = 0;
        g.lastTime = performance.now();

        setScore(0); setCombo(0); setTimeLeft(60); setLevel(1);
        setGameState('playing');

        // Timer
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const gg = gameRef.current;
            if (!gg.isPaused && gg.isRunning) {
                gg.timeLeft--;
                setTimeLeft(gg.timeLeft);
                if (gg.timeLeft <= 10 && gg.timeLeft > 3) {
                    soundEngine.tick();
                } else if (gg.timeLeft <= 3 && gg.timeLeft > 0) {
                    soundEngine.tickFinal();
                }
                if (gg.timeLeft <= 0) endGame();
            }
        }, 1000);

        // Level progression
        if (levelRef.current) clearInterval(levelRef.current);
        levelRef.current = setInterval(() => {
            const gg = gameRef.current;
            if (!gg.isPaused && gg.isRunning && gg.level < 10) {
                gg.level++;
                setLevel(gg.level);
                setComboToast(`LEVEL ${gg.level}!`);
                soundEngine.levelUp();
                setTimeout(() => setComboToast(null), 800);
            }
        }, 10000);

        animRef.current = requestAnimationFrame(gameLoop);
    }, [gameLoop]);

    // End game
    const endGame = useCallback(() => {
        const g = gameRef.current;
        g.isRunning = false;
        if (timerRef.current) clearInterval(timerRef.current);
        if (levelRef.current) clearInterval(levelRef.current);
        cancelAnimationFrame(animRef.current);

        soundEngine.gameOver();

        // Save won coupons to localStorage
        if (g.wonCoupons.length > 0) {
            try {
                const existing = JSON.parse(localStorage.getItem('my-coupons') || '[]');
                const newCoupons = g.wonCoupons.map((coupon) => {
                    let purchaseUrl, orderUrl, reservationUrl;
                    if (coupon.name.includes('피자') || coupon.name.includes('도시락') || coupon.name.includes('디저트')) {
                        orderUrl = 'https://www.baemin.com';
                    } else if (coupon.name.includes('카페') || coupon.name.includes('커피')) {
                        orderUrl = 'https://www.yogiyo.co.kr';
                        purchaseUrl = 'https://www.coupang.com';
                    } else if (coupon.name.includes('영화')) {
                        reservationUrl = 'https://www.cgv.co.kr';
                        purchaseUrl = 'https://www.megabox.co.kr';
                    } else if (coupon.name.includes('헬스')) {
                        reservationUrl = 'https://www.naver.com/booking';
                    } else if (coupon.name.includes('쇼핑')) {
                        purchaseUrl = 'https://www.coupang.com';
                    } else if (coupon.name.includes('게임')) {
                        purchaseUrl = 'https://store.steampowered.com';
                    } else if (coupon.name.includes('미용')) {
                        reservationUrl = 'https://www.naver.com/booking';
                    } else if (coupon.name.includes('세차')) {
                        reservationUrl = 'https://booking.naver.com';
                    }

                    return {
                        id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: coupon.name,
                        brand: coupon.name.split(' ')[0],
                        description: `게임에서 획득한 ${coupon.discount} 할인 쿠폰`,
                        storeName: '게임 보상',
                        discount: coupon.discount,
                        color: coupon.color,
                        claimedAt: new Date().toISOString(),
                        status: 'available',
                        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        emoji: coupon.emoji,
                        points: coupon.points,
                        purchaseUrl,
                        orderUrl,
                        reservationUrl,
                    };
                });
                localStorage.setItem('my-coupons', JSON.stringify([...existing, ...newCoupons]));
            } catch (error) {
                console.error('Failed to save coupons to localStorage:', error);
            }
        }

        setFinalStats({
            score: g.score,
            coupons: g.couponsCollected,
            maxCombo: g.maxCombo,
            level: g.level,
            wonCoupons: [...g.wonCoupons],
        });
        setGameState('over');
    }, []);

    // Toggle pause
    const togglePause = useCallback(() => {
        const g = gameRef.current;
        g.isPaused = !g.isPaused;
        if (g.isPaused) {
            g.lastTime = performance.now();
            setGameState('paused');
        } else {
            g.lastTime = performance.now();
            setGameState('playing');
        }
    }, []);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (levelRef.current) clearInterval(levelRef.current);
            cancelAnimationFrame(animRef.current);
        };
    }, []);

    const t = (ko: string, en: string) => lang === 'ko' ? ko : en;

    const toggleDark = useCallback(() => {
        document.documentElement.classList.toggle('dark');
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-background">
            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full touch-none"
                onPointerDown={handlePointerDown}
            />

            {/* ===== START SCREEN ===== */}
            <AnimatePresence>
                {gameState === 'start' && (
                    <motion.div
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background p-6 text-center"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4 }}
                    >
                        {onClose && (
                            <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={onClose}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-lg" onClick={toggleDark} title="다크모드">
                            🌙
                        </Button>

                        <motion.div
                            className="w-32 h-32 rounded-3xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center mb-8 shadow-xl shadow-purple-500/30"
                            animate={{ rotateY: [0, 360] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                        >
                            <Sparkles className="w-16 h-16 text-white" />
                        </motion.div>

                        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
                            3D {t('터치', 'Touch')}{' '}
                            <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                {t('쿠폰 게임', 'Coupon Game')}
                            </span>
                        </h1>
                        <p className="text-muted-foreground mb-8 text-lg sm:text-xl">
                            {t('떨어지는 쿠폰을 터치하여 획득하세요!', 'Touch falling coupons to collect them!')}
                        </p>

                        <div className="grid grid-cols-3 gap-4 mb-8 max-w-md w-full">
                            {[
                                { icon: '👆', label: t('쿠폰 터치', 'Touch') },
                                { icon: '🔥', label: t('콤보 보너스', 'Combo') },
                                { icon: '⏰', label: t('60초 챌린지', '60s') },
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    className="p-5 rounded-xl bg-muted/50 border border-border text-center"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + i * 0.1 }}
                                >
                                    <div className="text-3xl mb-2">{item.icon}</div>
                                    <div className="text-sm font-semibold text-muted-foreground">{item.label}</div>
                                </motion.div>
                            ))}
                        </div>

                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-xl shadow-purple-500/30 px-14 py-7 text-xl font-bold rounded-full"
                            onClick={startGame}
                        >
                            <Zap className="w-7 h-7 mr-2" />
                            {t('게임 시작하기', 'Start Game')}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== GAME HUD ===== */}
            {(gameState === 'playing' || gameState === 'paused') && (
                <>
                    {/* Top HUD */}
                    <div className="absolute top-0 left-0 right-0 z-30 safe-area-top">
                        <div className="flex items-center justify-between px-4 py-3 bg-background/70 backdrop-blur-xl border-b border-border/50">
                            <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onClose}>
                                <ArrowLeft className="w-6 h-6" />
                            </Button>

                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1 px-4 py-2 text-base bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                                    <Star className="w-4 h-4" /> {score.toLocaleString()}
                                </Badge>
                                {combo >= 2 && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={combo}>
                                        <Badge variant="secondary" className="gap-1 px-4 py-2 text-base bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold">
                                            <Flame className="w-4 h-4" /> {combo}x
                                        </Badge>
                                    </motion.div>
                                )}
                                <Badge variant="secondary" className={`gap-1 px-4 py-2 text-base font-bold ${timeLeft <= 10 ? 'bg-red-500/10 text-red-600 animate-pulse' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                                    <Timer className="w-4 h-4" /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </Badge>
                            </div>

                            <Button variant="ghost" size="icon" className="h-12 w-12" onClick={togglePause}>
                                {gameState === 'paused' ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-12 w-12 text-lg" onClick={toggleDark}>
                                🌙
                            </Button>
                        </div>
                    </div>

                    {/* Level indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-background/70 backdrop-blur-xl border border-border/50">
                            <span className="text-sm font-bold text-purple-500">Level {level}</span>
                            <div className="w-28 h-2.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                    animate={{ width: `${level * 10}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pause Overlay */}
                    <AnimatePresence>
                        {gameState === 'paused' && (
                            <motion.div
                                className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <Pause className="w-20 h-20 text-muted-foreground mb-6" />
                                <h2 className="text-3xl font-bold mb-8">{t('일시정지', 'Paused')}</h2>
                                <Button size="lg" onClick={togglePause} className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-full px-12 py-4 text-xl">
                                    <Play className="w-7 h-7 mr-2" /> {t('계속하기', 'Resume')}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* ===== COMBO TOAST ===== */}
            <AnimatePresence>
                {comboToast && (
                    <motion.div
                        className="absolute top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0, y: -30 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    >
                        <div className="text-5xl sm:text-7xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
                            {comboToast}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== GAME OVER ===== */}
            <AnimatePresence>
                {gameState === 'over' && (
                    <motion.div
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl p-6 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mb-6 shadow-xl shadow-orange-500/30"
                        >
                            <Trophy className="w-14 h-14 text-white" />
                        </motion.div>

                        <h2 className="text-3xl font-bold mb-3">{t('게임 완료!', 'Game Over!')}</h2>

                        <motion.p
                            className="text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-6"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.4 }}
                        >
                            {finalStats.score.toLocaleString()}
                        </motion.p>

                        <div className="flex gap-8 mb-8">
                            {[
                                { value: finalStats.coupons, label: t('쿠폰 획득', 'Coupons') },
                                { value: `${finalStats.maxCombo}x`, label: t('최대 콤보', 'Max Combo') },
                                { value: `Lv.${finalStats.level}`, label: t('도달 레벨', 'Level') },
                            ].map((s, i) => (
                                <motion.div
                                    key={i}
                                    className="text-center"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                >
                                    <div className="text-2xl font-bold">{s.value}</div>
                                    <div className="text-sm text-muted-foreground">{s.label}</div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Won coupons */}
                        {finalStats.wonCoupons.length > 0 && (
                            <motion.div
                                className="mb-8"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                            >
                                <p className="text-sm text-muted-foreground mb-3">{t('🎉 획득한 쿠폰', '🎉 Won Coupons')}</p>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {finalStats.wonCoupons.map((c, i) => (
                                        <div
                                            key={i}
                                            className="w-20 h-24 rounded-xl flex flex-col items-center justify-center text-sm font-semibold border"
                                            style={{ borderColor: c.color + '40', background: c.color + '10' }}
                                        >
                                            <span className="text-2xl mb-1">{c.emoji}</span>
                                            <span style={{ color: c.color, fontSize: '0.7rem' }}>{c.discount}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        <div className="flex gap-4 w-full max-w-sm">
                            <Button
                                size="lg"
                                className="flex-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white rounded-full font-bold text-lg py-4"
                                onClick={startGame}
                            >
                                <RotateCcw className="w-5 h-5 mr-2" /> {t('다시하기', 'Retry')}
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 rounded-full font-bold text-lg py-4"
                                onClick={() => onClose?.()}
                            >
                                <Wallet className="w-5 h-5 mr-2" /> {t('지갑', 'Wallet')}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
