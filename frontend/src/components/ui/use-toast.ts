import { useState, useCallback } from 'react';

type ToastVariant = 'default' | 'destructive' | 'success';

interface ToastItem {
    id: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
}

// Simple global store
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toasts: ToastItem[] = [];

function dispatch(toast: ToastItem) {
    toasts = [toast, ...toasts].slice(0, 5);
    listeners.forEach((l) => l(toasts));
    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== toast.id);
        listeners.forEach((l) => l(toasts));
    }, 4000);
}

export function toast(opts: Omit<ToastItem, 'id'>) {
    dispatch({ id: Math.random().toString(36).slice(2), ...opts });
}

export function useToastState() {
    const [items, setItems] = useState<ToastItem[]>([]);
    const subscribe = useCallback(() => {
        const handler = (t: ToastItem[]) => setItems([...t]);
        listeners.push(handler);
        return () => {
            listeners = listeners.filter((l) => l !== handler);
        };
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useState(() => { const unsub = subscribe(); return unsub; });

    return items;
}
