import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, type User } from './api';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('qnt_token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            setIsLoading(false);
            return;
        }
        api.auth
            .me()
            .then(({ user }) => setUser(user))
            .catch(() => {
                localStorage.removeItem('qnt_token');
                setToken(null);
            })
            .finally(() => setIsLoading(false));
    }, [token]);

    function login(newToken: string, newUser: User) {
        localStorage.setItem('qnt_token', newToken);
        setToken(newToken);
        setUser(newUser);
    }

    function logout() {
        localStorage.removeItem('qnt_token');
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
