"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const decodeTokenUser = (jwtToken: string): User | null => {
    try {
      const parts = jwtToken.split(".");
      if (parts.length < 2) return null;
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = atob(payload);
      const data = JSON.parse(json) as {
        userId?: string;
        email?: string;
        role?: string;
        exp?: number;
      };
      if (data.exp && Date.now() >= data.exp * 1000) {
        return null;
      }
      if (!data.userId || !data.email || !data.role) return null;
      return { id: data.userId, email: data.email, name: data.email, role: data.role };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    // Check for existing token on mount
    const savedToken = localStorage.getItem("bookingcoo_token");
    const savedUser = localStorage.getItem("bookingcoo_user");

    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          const decoded = decodeTokenUser(savedToken);
          if (decoded) {
            setUser(decoded);
            localStorage.setItem("bookingcoo_user", JSON.stringify(decoded));
          } else {
            localStorage.removeItem("bookingcoo_token");
            localStorage.removeItem("bookingcoo_user");
            setUser(null);
            setToken(null);
          }
        }
      } else {
        const decoded = decodeTokenUser(savedToken);
        if (decoded) {
          setUser(decoded);
          localStorage.setItem("bookingcoo_user", JSON.stringify(decoded));
        } else {
          localStorage.removeItem("bookingcoo_token");
          localStorage.removeItem("bookingcoo_user");
          setUser(null);
          setToken(null);
        }
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();

      setUser(data.user);
      setToken(data.token);

      localStorage.setItem("bookingcoo_token", data.token);
      localStorage.setItem("bookingcoo_user", JSON.stringify(data.user));
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("bookingcoo_token");
    localStorage.removeItem("bookingcoo_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
