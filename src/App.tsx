/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Volume2, 
  Play, 
  Download, 
  RotateCcw,
  Loader2,
  AlertCircle,
  Pause,
  ChevronRight,
  Trash2,
  Crown,
  Zap,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  CreditCard,
  CheckCircle2,
  X,
  Sparkles,
  Type,
  UserCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, signIn, signOut, UserProfile } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PLANS = {
  free: { name: 'Free', limit: 20 },
  founder_monthly: { name: 'Founder Monthly', limit: 500, price: '£4', period: 'month' },
  founder_yearly: { name: 'Founder Yearly', limit: 500, price: '£35', period: 'year' },
};

interface TTSHistoryItem {
  id: string;
  text: string;
  voice: string;
  style: string;
  temperature: number;
  timestamp: number;
  base64Audio: string;
}

const BASE_VOICES = [
  { id: 'puck', name: 'Puck', voiceName: 'Puck', gender: 'Male', description: 'Youthful & Energetic' },
  { id: 'charon', name: 'Charon', voiceName: 'Charon', gender: 'Male', description: 'Deep & Authoritative' },
  { id: 'kore', name: 'Kore', voiceName: 'Kore', gender: 'Female', description: 'Clear & Professional' },
  { id: 'fenrir', name: 'Fenrir', voiceName: 'Fenrir', gender: 'Male', description: 'Warm & Textured' },
  { id: 'zephyr', name: 'Zephyr', voiceName: 'Zephyr', gender: 'Female', description: 'Soft & Melodic' },
  { id: 'aoede', name: 'Aoede', voiceName: 'Aoede', gender: 'Female', description: 'Bright & Engaging' },
  { id: 'ersa', name: 'Ersa', voiceName: 'Ersa', gender: 'Female', description: 'Calm & Steady' },
  { id: 'iapetos', name: 'Iapetos', voiceName: 'Iapetos', gender: 'Male', description: 'Mature & Resonant' },
  { id: 'rasalgethi', name: 'Rasalgethi', voiceName: 'Charon', gender: 'Male', description: 'Pro-Grade Authority' },
  { id: 'leda', name: 'Leda', voiceName: 'Kore', gender: 'Female', description: 'Fast & Efficient Clarity' },
] as const;

const STYLE_PRESETS = [
  { id: 'natural', name: 'Natural / Default', style: 'in a natural, neutral tone' },
  { id: 'british-calm', name: 'British Calm', style: 'in a clear, authentic British Received Pronunciation accent' },
  { id: 'lancashire', name: 'Lancashire', style: 'in a warm, authentic Northern English Lancashire accent, with distinct local vowels' },
  { id: 'geordie', name: 'Geordie', style: 'in a strong, friendly Geordie accent from Newcastle, avoiding any American inflections' },
  { id: 'liverpudlian', name: 'Liverpudlian', style: 'in a distinct, authentic Scouse Liverpudlian accent' },
  { id: 'yorkshire', name: 'Yorkshire', style: 'in a hearty, authentic Northern English Yorkshire accent' },
  { id: 'scottish', name: 'Scottish', style: 'in a strong, authentic Scottish accent with rolled Rs' },
  { id: 'welsh', name: 'Welsh', style: 'in a melodic, authentic Welsh accent' },
  { id: 'irish-lilt', name: 'Irish Lilt', style: 'in a soft, authentic Irish lilt with a melodic cadence' },
  { id: 'south-devon', name: 'South Devon', style: 'in a soft, authentic West Country South Devon accent' },
  { id: 'black-country', name: 'Black Country', style: 'in a thick, authentic West Midlands Black Country accent' },
  { id: 'australian', name: 'Australian', style: 'in a broad, authentic Australian accent' },
  { id: 'american-nyc', name: 'New York', style: 'in a sharp, fast-paced New York City accent' },
  { id: 'american-southern', name: 'US Southern', style: 'in a warm, slow-paced Southern American drawl' },
  { id: 'canadian', name: 'Canadian', style: 'in a polite, authentic Canadian accent' },
  { id: 'indian', name: 'Indian', style: 'in a clear, authentic Indian English accent' },
  { id: 'whispering', name: 'Whispering', style: 'in a very quiet, intimate, and breathy whisper' },
  { id: 'excited', name: 'Excited', style: 'in a very excited, high-pitched, and high-energy tone' },
  { id: 'sad', name: 'Sad/Somber', style: 'in a sad, somber, and low-energy tone with heavy pauses' },
  { id: 'authoritative', name: 'Authoritative', style: 'in a firm, authoritative, and commanding professional tone' },
] as const;

const SEGMENT_LIMIT = 1500; // Character limit per segment for synthesis
const MAX_WORDS = 10000;

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="w-20 h-20 bg-red-950/30 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
              <p className="text-slate-400">The application encountered an unexpected error. Please try reloading the page.</p>
            </div>
            {this.state.error && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-slate-500">{this.state.error.toString()}</p>
              </div>
            )}
            <button 
              onClick={() => window.location.href = window.location.origin + window.location.pathname}
              className="w-full h-14 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reload Now
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ founder_monthly_count: 0, founder_yearly_count: 0 });
  const [showPricing, setShowPricing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [text, setText] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(BASE_VOICES[0].id);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(STYLE_PRESETS[0].id);
  const [customStyle, setCustomStyle] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [demoAudios, setDemoAudios] = useState<Record<string, string>>({});
  const [playingDemo, setPlayingDemo] = useState<string | null>(null);
  
  const aiRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const demoAudioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedVoice = BASE_VOICES.find(v => v.id === selectedVoiceId) || BASE_VOICES[0];
  const selectedStylePreset = STYLE_PRESETS.find(s => s.id === selectedStyleId) || STYLE_PRESETS[0];

  useEffect(() => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }
  }, []);

  // Auth & Profile Sync
  useEffect(() => {
    console.log("App: Initializing Firebase Auth listener...");
    let unsubscribeProfile: (() => void) | null = null;
    
    // Immediate check for current user (might be cached)
    if (auth.currentUser) {
      console.log("App: Found cached user:", auth.currentUser.email);
      setUser(auth.currentUser);
      // We still wait for onAuthStateChanged for the definitive state, 
      // but this could speed up the initial load.
    }
    // Safety timeout: if auth doesn't ready in 10s, show an error
    const timeoutId = setTimeout(() => {
      if (!isAuthReady) {
        console.error("App: Auth initialization timed out after 10s");
        setAuthTimeout(true);
        // We don't force isAuthReady(true) anymore, we show a retry button
      }
    }, 10000);
    
    // Global error handler for unhandled rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason || "";
      console.warn("App: Unhandled promise rejection:", reason);
      
      // Ignore benign WebSocket errors from Vite/HMR which are expected in this environment
      if (reason.includes('WebSocket') || reason.includes('websocket')) {
        return;
      }

      if (reason.includes('Firebase')) {
        setError("Firebase connection error. Please refresh or check your connection.");
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("App: Auth state changed:", firebaseUser?.email || "No user");
      clearTimeout(timeoutId);
      setUser(firebaseUser);
      setIsAuthReady(true);
      
      if (firebaseUser) {
        const fetchProfile = async () => {
          console.log("App: Fetching profile for", firebaseUser.uid);
          const userRef = doc(db, 'users', firebaseUser.uid);
          try {
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
              console.log("App: Creating new profile for", firebaseUser.email);
              const isOwner = firebaseUser.email === 'talkingowlandgirl@gmail.com';
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: isOwner ? 'admin' : 'user',
                plan: isOwner ? 'founder_yearly' : 'free',
                generations_used: 0,
                generation_limit: isOwner ? 999999 : 20,
                last_reset: new Date().toISOString()
              };
              await setDoc(userRef, newProfile);
              setProfile(newProfile);
            } else {
              const data = userSnap.data() as UserProfile;
              console.log("App: Profile found:", data.role);
              // Auto-upgrade owner if they exist but aren't admin
              if (firebaseUser.email === 'talkingowlandgirl@gmail.com' && data.role !== 'admin') {
                const updatedProfile = { ...data, role: 'admin', generation_limit: 999999 };
                await updateDoc(userRef, { role: 'admin', generation_limit: 999999 });
                setProfile(updatedProfile as UserProfile);
              } else {
                setProfile(data);
              }
            }

            // Real-time updates for profile
            if (unsubscribeProfile) unsubscribeProfile();
            unsubscribeProfile = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setProfile(doc.data() as UserProfile);
              } else {
                setProfile(null);
              }
            }, (err) => {
              console.error("App: Profile sync error:", err);
            });
          } catch (err) {
            console.error("App: Auth sync error:", err);
          }
        };
        fetchProfile();
      } else {
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
    }, (err) => {
      console.error("App: onAuthStateChanged error:", err);
      clearTimeout(timeoutId);
      setError("Authentication service error. Please check your Firebase configuration.");
      setIsAuthReady(true);
    });

    // Founder Count Sync
    const statsRef = doc(db, 'stats', 'global');
    const unsubscribeStats = onSnapshot(statsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setStats({
          founder_monthly_count: data.founder_monthly_count || 0,
          founder_yearly_count: data.founder_yearly_count || 0
        });
      }
    }, (err) => {
      console.error("Stats sync error:", err);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribeAuth();
      unsubscribeStats();
      if (unsubscribeProfile) unsubscribeProfile();
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('tts_text', text);
    localStorage.setItem('tts_voice', selectedVoiceId);
    localStorage.setItem('tts_style', selectedStyleId);
    localStorage.setItem('tts_custom_style', customStyle);
    localStorage.setItem('tts_temp', temperature.toString());
  }, [text, selectedVoiceId, selectedStyleId, customStyle, temperature]);

  const exportSession = () => {
    const sessionData = {
      text,
      selectedVoiceId,
      selectedStyleId,
      customStyle,
      temperature,
      timestamp: Date.now(),
      version: '1.1'
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts-session-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.text !== undefined) setText(data.text);
        if (data.selectedVoiceId !== undefined) setSelectedVoiceId(data.selectedVoiceId);
        if (data.selectedStyleId !== undefined) setSelectedStyleId(data.selectedStyleId);
        if (data.customStyle !== undefined) setCustomStyle(data.customStyle);
        if (data.temperature !== undefined) setTemperature(data.temperature);
      } catch (err) {
        setError('Failed to import session. Invalid file format.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createAudioUrlFromPCM = (pcmData: Uint8Array) => {
    const len = pcmData.length;
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + len, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, len, true);

    const blob = new Blob([header, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const splitText = (input: string): string[] => {
    if (input.length <= SEGMENT_LIMIT) return [input];

    const segments: string[] = [];
    let remaining = input;

    while (remaining.length > 0) {
      if (remaining.length <= SEGMENT_LIMIT) {
        segments.push(remaining);
        break;
      }

      // Try to find a natural break point
      let breakPoint = -1;
      const sub = remaining.substring(0, SEGMENT_LIMIT);
      
      // Try paragraph break
      breakPoint = sub.lastIndexOf('\n\n');
      if (breakPoint === -1) breakPoint = sub.lastIndexOf('\n');
      if (breakPoint === -1) breakPoint = sub.lastIndexOf('. ');
      if (breakPoint === -1) breakPoint = sub.lastIndexOf('? ');
      if (breakPoint === -1) breakPoint = sub.lastIndexOf('! ');
      if (breakPoint === -1) breakPoint = sub.lastIndexOf(' ');

      if (breakPoint === -1 || breakPoint < SEGMENT_LIMIT * 0.5) {
        // Force break if no good point found
        breakPoint = SEGMENT_LIMIT;
      } else {
        breakPoint += 1; // Include the space or punctuation
      }

      segments.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }

    return segments;
  };

  const handleCheckout = async (planType: string) => {
    if (!user) {
      signIn();
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, planType })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }
      
      const { url } = await response.json();
      // Open in new tab to avoid iframe restrictions
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Checkout Error:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
    }
  };

  const generateVoice = async () => {
    if (!user || !profile) {
      setShowPricing(true);
      return;
    }

    if (!text.trim()) {
      setError('Please enter some text.');
      return;
    }

    if (!aiRef.current) {
      setError('AI service is not initialized. Please check your configuration.');
      return;
    }

    const isAdmin = profile?.role === 'admin' || profile?.email === 'talkingowlandgirl@gmail.com';
    const hasLimit = (profile?.generations_used ?? 0) < (profile?.generation_limit ?? 0);

    if (!isAdmin && !hasLimit) {
      setError('Generation limit reached. Please upgrade your plan.');
      setShowPricing(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentAudioUrl(null);

    try {
      let segments = splitText(text);
      const isFree = profile?.plan === 'free' || !profile?.plan;
      
      if (isFree) {
        // Prepend and append the watermark for free users
        segments = ["Created with VoiceForge", ...segments, "Created with VoiceForge"];
      }

      const pcmSegments: Uint8Array[] = [];

      setProgress({ current: 0, total: segments.length });

      const selectedVoice = BASE_VOICES.find(v => v.id === selectedVoiceId) || BASE_VOICES[0];
      const selectedStylePreset = STYLE_PRESETS.find(s => s.id === selectedStyleId) || STYLE_PRESETS[0];
      const styleInstruction = customStyle.trim() || selectedStylePreset.style;

      for (let i = 0; i < segments.length; i++) {
        setProgress({ current: i + 1, total: segments.length });
        
        const prompt = `Say ${styleInstruction}: ${segments[i]}`;
        
        const response = await aiRef.current.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: temperature,
            responseModalities: [Modality.AUDIO || 'AUDIO' as any],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice.voiceName },
              },
            },
          },
        });

        let base64Audio = '';
        let textResponse = '';

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
          throw new Error(`AI generation stopped early. Reason: ${candidate.finishReason}`);
        }

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) {
              base64Audio = part.inlineData.data;
              break;
            }
            if (part.text) {
              textResponse += part.text;
            }
          }
        }

        if (!base64Audio) {
          if (textResponse) {
            throw new Error(`AI returned text instead of audio. This usually happens if the content is flagged by safety filters. Response: ${textResponse}`);
          }
          throw new Error('No audio data received from AI. Please try a different prompt or voice.');
        }

        const binaryString = window.atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        pcmSegments.push(bytes);
      }

      // Merge all PCM segments
      const totalLength = pcmSegments.reduce((acc, curr) => acc + curr.length, 0);
      const mergedPcm = new Uint8Array(totalLength);
      let offset = 0;
      for (const segment of pcmSegments) {
        mergedPcm.set(segment, offset);
        offset += segment.length;
      }

      const audioUrl = createAudioUrlFromPCM(mergedPcm);
      setCurrentAudioUrl(audioUrl);

      // Update generation count in Firestore
      if (!isAdmin) {
        await updateDoc(doc(db, 'users', user.uid), {
          generations_used: increment(1)
        });
      }
    } catch (err: any) {
      console.error('Generation Error:', err);
      let message = err.message || 'An error occurred during generation.';
      if (message.includes('NOT_FOUND')) {
        message = 'The TTS model was not found. This might be a temporary service issue or region restriction.';
      }
      setError(message);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const playDemo = async (voiceId: string, styleId: string) => {
    const demoKey = `${voiceId}-${styleId}`;
    if (playingDemo === demoKey) {
      demoAudioRef.current?.pause();
      setPlayingDemo(null);
      return;
    }

    if (demoAudios[demoKey]) {
      setPlayingDemo(demoKey);
      if (demoAudioRef.current) {
        demoAudioRef.current.src = demoAudios[demoKey];
        demoAudioRef.current.play();
      }
      return;
    }

    const style = STYLE_PRESETS.find(s => s.id === styleId);
    if (!style) return;

    setPlayingDemo(demoKey);
    try {
      const voice = BASE_VOICES.find(v => v.id === voiceId) || BASE_VOICES[0];
      
      if (!aiRef.current) {
        throw new Error('AI service not initialized');
      }

      const prompt = `Say ${style.style}: This is a demo of the ${voice.name} voice.`;
      
      const response = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO || 'AUDIO' as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice.voiceName },
            },
          },
        },
      });

      let base64Audio = '';
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            base64Audio = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Audio) throw new Error('No audio data received');

      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const url = createAudioUrlFromPCM(bytes);
      setDemoAudios(prev => ({ ...prev, [demoKey]: url }));
      if (demoAudioRef.current) {
        demoAudioRef.current.src = url;
        demoAudioRef.current.play();
      }
    } catch (err) {
      console.error('Demo Error:', err);
      setPlayingDemo(null);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 p-6">
        <div className="relative">
          <Loader2 className={cn("w-12 h-12 text-blue-500 animate-spin", authTimeout && "animate-none opacity-50")} />
          {authTimeout && (
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
          )}
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-slate-400 font-medium">
            {isOffline ? "You are currently offline" : authTimeout ? "Connection taking longer than expected..." : "Initializing voiceforge-tts..."}
          </p>
          {(authTimeout || isOffline) && (
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {isOffline 
                ? "Please check your internet connection to continue." 
                : "This can happen if Firebase is still provisioning or if there's a network issue in the iframe."}
            </p>
          )}
        </div>

        {authTimeout && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button 
              onClick={() => window.location.reload()}
              className="h-12 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Connection
            </button>
            <button 
              onClick={() => setIsAuthReady(true)}
              className="h-12 bg-slate-900 text-slate-400 font-bold rounded-xl border border-slate-800 hover:bg-slate-800 transition-all"
            >
              Continue Anyway
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
        {/* Background Glows */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl mx-auto px-6 py-12 space-y-16 relative z-10"
      >
        
        {/* Title Section */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
          <div className="space-y-4 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              Next-Gen AI Synthesis
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-500">
              voiceforge-tts
            </h1>
            <div className="space-y-2 text-slate-400">
              <p className="text-xl font-medium leading-relaxed">Generate natural voices for narration, dialogue, and storytelling.</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
                <p className="text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  YouTube Creators
                </p>
                <p className="text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  Storytellers
                </p>
                <p className="text-sm flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-blue-500" />
                  Developers
                </p>
              </div>
              <p className="text-sm font-bold text-blue-400 flex items-center justify-center sm:justify-start gap-2">
                <Zap className="w-4 h-4 fill-current" />
                Voices generate in seconds.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2">
            <button 
              onClick={() => window.location.href = window.location.origin + window.location.pathname}
              className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded-lg transition-all flex items-center gap-2"
              title="Reload App"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="text-xs font-bold hidden sm:inline">Reload Now</span>
            </button>
            <button 
              onClick={exportSession}
              className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded-lg transition-all"
              title="Export Session"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded-lg transition-all"
              title="Import Session"
            >
              <ChevronRight className="w-5 h-5 rotate-90" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              accept=".json" 
              className="hidden" 
            />
            {!user && (
              <button 
                onClick={() => setShowPricing(true)}
                className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all shadow-md shadow-amber-900/40 flex items-center gap-2"
              >
                <Zap className="w-3 h-3 fill-current" />
                Get Founder Access
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-800 ml-2">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{profile?.plan || 'Free'} Plan</p>
                  <p className="text-xs font-bold text-white">{user.email?.split('@')[0]}</p>
                </div>
                <button 
                  onClick={() => signOut()}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signIn()}
                className="ml-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all shadow-md shadow-blue-900/40"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* How it Works Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Enter your text",
              desc: "Write narration, dialogue or character lines.",
              icon: <Type className="w-5 h-5" />
            },
            {
              step: "2",
              title: "Choose a voice",
              desc: "Select voice profile, accent and emotion.",
              icon: <UserCheck className="w-5 h-5" />
            },
            {
              step: "3",
              title: "Generate instantly",
              desc: "Download natural speech in seconds.",
              icon: <Zap className="w-5 h-5" />
            }
          ].map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/50 backdrop-blur-sm space-y-3 group hover:bg-slate-900/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Step {item.step}</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Controls Section */}
        <section className="space-y-10">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Base Voice Selector */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Voice Profile</label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <select 
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="relative w-full h-14 px-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer hover:border-slate-700"
                >
                  <optgroup label="Female Voices" className="bg-slate-900 text-pink-400">
                    {BASE_VOICES.filter(v => v.gender === 'Female').map(voice => (
                      <option key={voice.id} value={voice.id} className="bg-slate-900 text-white">{voice.name} — {voice.description}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Male Voices" className="bg-slate-900 text-blue-400">
                    {BASE_VOICES.filter(v => v.gender === 'Male').map(voice => (
                      <option key={voice.id} value={voice.id} className="bg-slate-900 text-white">{voice.name} — {voice.description}</option>
                    ))}
                  </optgroup>
                </select>
                <ChevronRight className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Voice Style Selector */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Style Preset</label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <select 
                  value={selectedStyleId}
                  onChange={(e) => setSelectedStyleId(e.target.value)}
                  className="relative w-full h-14 px-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer hover:border-slate-700"
                >
                  {STYLE_PRESETS.map(style => (
                    <option key={style.id} value={style.id} className="bg-slate-900">{style.name}</option>
                  ))}
                </select>
                <ChevronRight className="w-4 h-4 absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Custom Style Input */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Custom Style Override</label>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <textarea 
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                placeholder="e.g. with a robotic monotone, like a pirate, whispering softly..."
                className="relative w-full h-24 p-5 bg-slate-900/80 backdrop-blur-md border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700 resize-none"
              />
            </div>
            <p className="text-[10px] text-slate-500 flex items-center gap-1.5 px-1">
              <AlertCircle className="w-3 h-3" />
              Tip: Use words like "authentic", "Northern English", or "Received Pronunciation" to refine accents.
            </p>
          </div>

          {/* Temperature Control */}
          <div className="space-y-6 p-8 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Temperature</label>
                <p className="text-[10px] text-slate-600">Lower = steadier • Higher = expressive</p>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-900/30 px-3 py-1 rounded-full border border-blue-500/20">{temperature.toFixed(1)}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Text Input Box */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Script Content</label>
              <button 
                onClick={() => setText('')}
                className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-red-400 flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Clear Script
              </button>
            </div>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/5 to-transparent rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="(thinking) Hmm...&#10;(excited) Look at this!&#10;(curiously) What do you think it is?&#10;(almost whispering) Something strange is happening..."
                className="relative w-full h-80 p-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 text-white rounded-[2rem] text-xl leading-relaxed focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all resize-none placeholder:text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-600 italic text-center">
              Pro Tip: Use cues like <span className="text-blue-400/60">(excited)</span> or <span className="text-blue-400/60">(whispering)</span> to guide the AI.
            </p>
          </div>

          {/* Generate Button & Output */}
          <div className="space-y-6">
            {!currentAudioUrl ? (
              <button 
                onClick={generateVoice}
                disabled={isGenerating || !text.trim()}
                className={cn(
                  "w-full h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/20",
                  isGenerating || !text.trim()
                    ? "bg-slate-900 text-slate-600 cursor-not-allowed shadow-none"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {progress && progress.total > 1 
                      ? `Processing section ${progress.current} of ${progress.total}…` 
                      : "Generating voice…"}
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Generate Voice
                  </>
                )}
              </button>
            ) : (
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Audio Ready</p>
                    <p className="text-xs text-slate-500">Synthesis complete</p>
                  </div>
                </div>
                
                <audio 
                  ref={audioRef}
                  src={currentAudioUrl} 
                  controls 
                  className="w-full h-10 accent-blue-600"
                  autoPlay
                />

                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => audioRef.current?.play()}
                    className="h-12 bg-blue-600 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-900/20"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play
                  </button>
                  <a 
                    href={currentAudioUrl}
                    download={`narration-${Date.now()}.wav`}
                    className="h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  <button 
                    onClick={() => {
                      setCurrentAudioUrl(null);
                      setError(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Voice Examples Section */}
        <section className="pt-16 border-t border-slate-900 space-y-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-white">Voice Previews</h2>
            <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {BASE_VOICES.length} Profiles Available
            </div>
          </div>

          {/* Female Voices Group */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-pink-500/60 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-pink-500/20" />
              Female Voices
              <span className="flex-1 h-[1px] bg-pink-500/20" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {BASE_VOICES.filter(v => v.gender === 'Female').map((voice, idx) => (
                <motion.div 
                  key={voice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-slate-800/80 hover:border-pink-500/30 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-pink-400 group-hover:bg-pink-500/10 shadow-sm transition-all duration-300">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-pink-400 transition-colors">{voice.name}</p>
                      <p className="text-xs text-slate-500">{voice.description}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => playDemo(voice.id, 'natural')}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                      playingDemo === `${voice.id}-natural` 
                        ? "bg-pink-500 text-white shadow-pink-900/40" 
                        : "bg-slate-800 text-pink-400 hover:bg-pink-500 hover:text-white shadow-blue-900/20"
                    )}
                  >
                    {playingDemo === `${voice.id}-natural` ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Male Voices Group */}
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-500/60 flex items-center gap-3">
              <span className="w-8 h-[1px] bg-blue-500/20" />
              Male Voices
              <span className="flex-1 h-[1px] bg-blue-500/20" />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {BASE_VOICES.filter(v => v.gender === 'Male').map((voice, idx) => (
                <motion.div 
                  key={voice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 bg-slate-900/50 border border-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-slate-800/80 hover:border-blue-500/30 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 shadow-sm transition-all duration-300">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{voice.name}</p>
                      <p className="text-xs text-slate-500">{voice.description}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => playDemo(voice.id, 'natural')}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                      playingDemo === `${voice.id}-natural` 
                        ? "bg-blue-500 text-white shadow-blue-900/40" 
                        : "bg-slate-800 text-blue-400 hover:bg-blue-500 hover:text-white shadow-blue-900/20"
                    )}
                  >
                    {playingDemo === `${voice.id}-natural` ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </motion.div>

        {/* Hidden Audio for Demos */}
        <audio ref={demoAudioRef} onEnded={() => setPlayingDemo(null)} className="hidden" />

        {/* Pricing Modal */}
        <AnimatePresence>
          {showPricing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPricing(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
                    <p className="text-slate-400 text-sm">Upgrade to unlock more generations and premium voices.</p>
                  </div>
                  <button 
                    onClick={() => setShowPricing(false)}
                    className="p-2 text-slate-500 hover:text-white transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/50">
                  
                  {/* Free Plan */}
                  <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-col space-y-6 hover:border-slate-700 transition-all">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white">Free</h3>
                      <p className="text-xs text-slate-500">Perfect for trying out</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">£0</span>
                      </div>
                    </div>

                    <ul className="space-y-3 flex-1">
                      {[
                        '20 generations / month',
                        'Standard voices',
                        'Spoken watermark included',
                        'Community support'
                      ].map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <button 
                      disabled={profile?.plan === 'free'}
                      className="w-full py-3 bg-slate-800 text-slate-500 font-bold rounded-xl cursor-default"
                    >
                      {profile?.plan === 'free' ? 'Current Plan' : 'Free Plan'}
                    </button>
                  </div>

                  {/* Monthly Plan */}
                  <div className="relative p-6 rounded-2xl border-2 border-amber-500/30 bg-amber-950/20 backdrop-blur-md flex flex-col space-y-6 hover:border-amber-500/50 transition-all group">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-amber-900/40 group-hover:scale-105 transition-transform">
                      <Zap className="w-3 h-3 fill-current" />
                      Limited Founder Offer
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white">🟣 Monthly</h3>
                      <p className="text-xs text-slate-500">First 500 users only</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">£4</span>
                        <span className="text-slate-500 text-sm">/ month</span>
                      </div>
                    </div>

                    <ul className="space-y-3 flex-1">
                      {[
                        '👉 50 generations / month',
                        'All premium voices',
                        'No spoken watermark',
                        'Safe for your costs',
                        'Still feels generous',
                        'Enough for real use (YouTube scripts, etc.)'
                      ].map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <button 
                      onClick={() => handleCheckout('founder_monthly')}
                      disabled={profile?.plan === 'founder_monthly' || stats.founder_monthly_count >= 500}
                      className={cn(
                        "w-full py-3 font-bold rounded-xl transition-all",
                        profile?.plan === 'founder_monthly'
                          ? "bg-amber-900/30 text-amber-500 cursor-default"
                          : stats.founder_monthly_count >= 500
                            ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                            : "bg-amber-500 text-white hover:bg-amber-600 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] shadow-lg shadow-amber-900/40"
                      )}
                    >
                      {profile?.plan === 'founder_monthly' ? 'Current Plan' : stats.founder_monthly_count >= 500 ? 'Founder plan sold out' : 'Get Founder Access'}
                    </button>
                    <p className="text-[10px] text-center text-amber-500 font-bold uppercase tracking-widest">
                      {500 - stats.founder_monthly_count} / 500 spots remaining
                    </p>
                  </div>

                  {/* Yearly Plan */}
                  <div className="relative p-6 rounded-2xl border-2 border-blue-500/30 bg-blue-950/20 backdrop-blur-md flex flex-col space-y-6 hover:border-blue-500/50 transition-all group">
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-blue-900/40 group-hover:scale-105 transition-transform">
                      <Crown className="w-3 h-3 fill-current" />
                      Best Value
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-white">🟣 Yearly</h3>
                      <p className="text-xs text-slate-500">First 500 users only</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-white">£48</span>
                        <span className="text-slate-500 text-sm">/ year</span>
                      </div>
                    </div>

                    <ul className="space-y-3 flex-1">
                      {[
                        '👉 600 generations / year',
                        'All premium voices',
                        'No spoken watermark',
                        'Priority support',
                        'Commercial rights'
                      ].map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <button 
                      onClick={() => handleCheckout('founder_yearly')}
                      disabled={profile?.plan === 'founder_yearly' || stats.founder_yearly_count >= 500}
                      className={cn(
                        "w-full py-3 font-bold rounded-xl transition-all",
                        profile?.plan === 'founder_yearly'
                          ? "bg-blue-900/30 text-blue-500 cursor-default"
                          : stats.founder_yearly_count >= 500
                            ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] shadow-lg shadow-blue-900/40"
                      )}
                    >
                      {profile?.plan === 'founder_yearly' ? 'Current Plan' : stats.founder_yearly_count >= 500 ? 'Founder plan sold out' : 'Get Founder Access'}
                    </button>
                    <p className="text-[10px] text-center text-blue-400 font-bold uppercase tracking-widest">
                      {500 - stats.founder_yearly_count} / 500 spots remaining
                    </p>
                  </div>

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="pt-12 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium">Enterprise Grade Security</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-xs font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest">Privacy</a>
              <a href="#" className="text-xs font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest">Terms</a>
              <a href="#" className="text-xs font-bold text-slate-500 hover:text-white transition-all uppercase tracking-widest">Support</a>
            </div>
          </div>
        </footer>

      </div>
    </ErrorBoundary>
  );
}
