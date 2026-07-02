import { useRef, useState } from "react";
import { toast } from "sonner";

export function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const start = () => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error("Reconhecimento de voz não suportado neste navegador");
      return;
    }
    const rec = new SpeechRecognitionCtor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript ?? "";
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop };
}